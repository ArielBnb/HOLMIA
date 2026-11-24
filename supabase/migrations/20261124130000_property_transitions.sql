-- Property status transitions and server-side status history.
-- Same state machine as PropertyRepository (src/repositories/propertyRepository.ts):
--   draft       -> active
--   active      -> draft | under_offer
--   under_offer -> active | sold (sale) | rented (rent)
--   sold, rented: final
-- Under Offer / Sold / Rented also require the accepted offer (sale) or
-- accepted rental application (rent), so the listing and the deals stay consistent.
-- Trusted administration (no auth.uid(): SQL Editor, seed) is not restricted,
-- like the other HOLMIA triggers. Every status change is recorded by the database.
-- Requires 20261124120000_rental_decisions.sql.
begin;

create table public.property_status_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  changed_at timestamptz not null default now()
);
create index property_status_history_property_idx on public.property_status_history(property_id, changed_at desc);

alter table public.property_status_history enable row level security;
revoke all on public.property_status_history from anon, authenticated;
-- Read through property_history(); rows are only written by the trigger below.

create function private.transition_error(p_from text, p_to text, p_listing text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_from in ('sold', 'rented') then
      format('%s is a final status: this listing can no longer change status', initcap(p_from))
    when p_to = 'sold' and p_listing = 'rent' then 'A listing for rent cannot be Sold (use Rented)'
    when p_to = 'rented' and p_listing = 'sale' then 'A listing for sale cannot be Rented (use Sold)'
    else format('Transition from %s to %s is not allowed', replace(p_from, '_', ' '), replace(p_to, '_', ' '))
  end
$$;

create function private.is_allowed_transition(p_from text, p_to text, p_listing text) returns boolean
language sql immutable set search_path = '' as $$
  select (p_from, p_to) in (('draft', 'active'), ('active', 'draft'), ('active', 'under_offer'), ('under_offer', 'active'))
      or (p_from = 'under_offer' and p_to = 'sold' and p_listing = 'sale')
      or (p_from = 'under_offer' and p_to = 'rented' and p_listing = 'rent')
$$;

create function private.has_accepted_deal(p_property uuid, p_listing text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p_listing = 'sale'
    then exists (select 1 from public.offers where property_id = p_property and status = 'accepted')
    else exists (select 1 from public.rental_applications where property_id = p_property and status = 'accepted')
  end
$$;
revoke all on function private.has_accepted_deal(uuid, text) from public;

create function private.validate_status_transition() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.status is not distinct from old.status then
    return new;
  end if;
  if not private.is_allowed_transition(old.status, new.status, new.listing_type) then
    raise exception '%', private.transition_error(old.status, new.status, new.listing_type) using errcode = '23514';
  end if;
  if new.status in ('under_offer', 'sold', 'rented') and not private.has_accepted_deal(new.id, new.listing_type) then
    raise exception '%', case when new.listing_type = 'sale'
      then 'Accept an offer first: Under Offer and Sold require an accepted offer'
      else 'Accept a rental application first: Under Offer and Rented require an accepted application' end
      using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.validate_status_transition() from public;
create trigger validate_status_transition before update of status on public.properties
for each row execute function private.validate_status_transition();

-- History: one row per creation and per status change, whatever the path
-- (change_property_status, accept_offer, decide_rental_application, start_tenancy...).
create function private.record_status_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  insert into public.property_status_history (property_id, old_status, new_status, changed_by, note)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.status end,
    new.status,
    auth.uid(),
    coalesce(nullif(current_setting('holmia.status_note', true), ''),
             case when tg_op = 'INSERT' then 'Listing created' end)
  );
  return null;
end $$;
revoke all on function private.record_status_change() from public;
create trigger record_status_change after insert or update of status on public.properties
for each row execute function private.record_status_change();

-- Starting point for listings that already exist.
insert into public.property_status_history (property_id, old_status, new_status, note, changed_at)
select id, null, status, 'Status when history tracking started', now() from public.properties;

-- The status-change service used by the app. Explicit errors, role checks,
-- and the deals kept consistent when a sale or let falls through.
create function public.change_property_status(p_property uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.properties; v_note text := nullif(btrim(coalesce(p_note, '')), ''); released int := 0;
begin
  select * into p from public.properties where id = p_property for update;
  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if not private.is_offer_decider(p_property) then
    raise exception 'Only the owner or the assigned agent can change this listing''s status' using errcode = '42501';
  end if;
  if p_status is not distinct from p.status then
    raise exception 'The listing is already %', replace(p.status, '_', ' ') using errcode = '23514';
  end if;
  if not private.is_allowed_transition(p.status, p_status, p.listing_type) then
    raise exception '%', private.transition_error(p.status, p_status, p.listing_type) using errcode = '23514';
  end if;
  if p_status = 'under_offer' then
    raise exception 'A listing moves to Under Offer when you accept an offer or application (Received tab)' using errcode = '23514';
  end if;
  if char_length(coalesce(v_note, '')) > 500 then
    raise exception 'The note is limited to 500 characters' using errcode = '23514';
  end if;

  -- The sale / let fell through: the accepted deal is released so another can be accepted.
  if p.status = 'under_offer' and p_status = 'active' then
    if p.listing_type = 'sale' then
      update public.offers set status = 'rejected', decided_by = auth.uid(), decided_at = now(), updated_at = now()
      where property_id = p_property and status = 'accepted';
    else
      update public.rental_applications set status = 'rejected', decided_by = auth.uid(), decided_at = now()
      where property_id = p_property and status = 'accepted';
    end if;
    get diagnostics released = row_count;
    v_note := coalesce(v_note, 'Deal fell through; accepted ' || case when p.listing_type = 'sale' then 'offer' else 'application' end || ' released');
  end if;

  perform set_config('holmia.status_note', coalesce(v_note, ''), true);
  update public.properties set status = p_status where id = p_property;
  perform set_config('holmia.status_note', '', true);

  return jsonb_build_object('property', p_property, 'old_status', p.status, 'new_status', p_status, 'released_deals', released);
end $$;
revoke all on function public.change_property_status(uuid, text, text) from public, anon;
grant execute on function public.change_property_status(uuid, text, text) to authenticated;

-- Readable history for the owner Seller and the assigned Agent.
create function public.property_history(p_property uuid) returns table (
  id uuid, old_status text, new_status text, changed_by_name text, changed_by_role text, note text, changed_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_offer_decider(p_property) then
    raise exception 'Only the owner or the assigned agent can see this listing''s history' using errcode = '42501';
  end if;
  return query
    select h.id, h.old_status, h.new_status, coalesce(u.full_name, u.username), u.role, h.note, h.changed_at
    from public.property_status_history h
    left join public.profiles u on u.id = h.changed_by
    where h.property_id = p_property
    order by h.changed_at desc, h.id;
end $$;
revoke all on function public.property_history(uuid) from public, anon;
grant execute on function public.property_history(uuid) to authenticated;

comment on table public.property_status_history is 'Server-generated status history (trigger record_status_change). Read via property_history().';
commit;
