-- Buyer enquiries on listings, answered in the app by the owning Seller or the
-- assigned Agent. Mirrors EnquiryRepository (src/repositories/enquiryRepository.ts).
-- Requires 20261121120000_offers_decisions.sql (private.is_offer_decider).
--   pending  = reply is null
--   handled  = reply is set (kept, and visible to the Buyer who asked)
begin;

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  buyer_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  reply text check (reply is null or char_length(btrim(reply)) between 1 and 2000),
  replied_by uuid references public.profiles(id) on delete restrict,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  check ((reply is null) = (replied_at is null) and (reply is null) = (replied_by is null))
);
create index enquiries_property_idx on public.enquiries(property_id, created_at desc);
create index enquiries_buyer_idx on public.enquiries(buyer_id, created_at desc);
create index enquiries_pending_idx on public.enquiries(property_id) where reply is null;

-- A Buyer asks about a published listing; a new enquiry is always pending.
create function private.validate_enquiry() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.buyer_id and role = 'buyer') then
    raise exception 'Only Buyers can send enquiries' using errcode = '42501';
  end if;
  if not exists (select 1 from public.properties where id = new.property_id and status <> 'draft') then
    raise exception 'Enquiries can only be sent about published listings' using errcode = '23514';
  end if;
  new.reply := null;
  new.replied_by := null;
  new.replied_at := null;
  return new;
end $$;
revoke all on function private.validate_enquiry() from public;
create trigger validate_enquiry before insert on public.enquiries
for each row execute function private.validate_enquiry();

alter table public.enquiries enable row level security;
revoke all on public.enquiries from anon, authenticated;
-- No direct UPDATE/DELETE: replies go through reply_enquiry only.
grant select, insert on public.enquiries to authenticated;
-- Isolation: the Buyer who asked, or the listing's owner Seller / assigned Agent.
create policy enquiries_read on public.enquiries for select to authenticated using (
  buyer_id = (select auth.uid()) or private.is_offer_decider(property_id)
);
create policy enquiries_buyer_insert on public.enquiries for insert to authenticated with check (
  buyer_id = (select auth.uid()) and (select private.current_profile_role()) = 'buyer'
);

-- Seller (own listings) / Agent (assigned listings): enquiries received.
create function public.enquiries_received() returns table (
  id uuid, property_id uuid, property_title text, buyer_name text, message text,
  reply text, replied_by_name text, replied_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select e.id, p.id, p.title, coalesce(b.full_name, b.username, 'Buyer'), e.message,
         e.reply, coalesce(r.full_name, r.username), e.replied_at, e.created_at
  from public.enquiries e
  join public.properties p on p.id = e.property_id
  join public.profiles b on b.id = e.buyer_id
  left join public.profiles r on r.id = e.replied_by
  join public.profiles me on me.id = (select auth.uid())
  where (p.seller_id = me.id and me.role = 'seller') or (p.agent_id = me.id and me.role = 'agent')
  order by (e.reply is null) desc, e.created_at desc
$$;
revoke all on function public.enquiries_received() from public, anon;
grant execute on function public.enquiries_received() to authenticated;

-- Buyer: own enquiries with the reply and who answered.
create function public.my_enquiries() returns table (
  id uuid, property_id uuid, property_title text, message text,
  reply text, replied_by_name text, replied_by_role text, replied_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select e.id, p.id, p.title, e.message, e.reply,
         coalesce(r.full_name, r.username), r.role, e.replied_at, e.created_at
  from public.enquiries e
  join public.properties p on p.id = e.property_id
  left join public.profiles r on r.id = e.replied_by
  where e.buyer_id = (select auth.uid())
  order by e.created_at desc
$$;
revoke all on function public.my_enquiries() from public, anon;
grant execute on function public.my_enquiries() to authenticated;

-- Reply (or correct a reply). Only the owner Seller or the assigned Agent.
create function public.reply_enquiry(p_enquiry uuid, p_reply text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_property uuid; v_text text := btrim(coalesce(p_reply, ''));
begin
  select property_id into v_property from public.enquiries where id = p_enquiry;
  if v_property is null then
    raise exception 'Enquiry not found' using errcode = 'P0002';
  end if;
  if not private.is_offer_decider(v_property) then
    raise exception 'Only the owner or the assigned agent can reply to this enquiry' using errcode = '42501';
  end if;
  if char_length(v_text) not between 1 and 2000 then
    raise exception 'A reply must be between 1 and 2000 characters' using errcode = '23514';
  end if;
  update public.enquiries set reply = v_text, replied_by = auth.uid(), replied_at = now()
  where id = p_enquiry;
  return jsonb_build_object('enquiry', p_enquiry, 'status', 'handled');
end $$;
revoke all on function public.reply_enquiry(uuid, text) from public, anon;
grant execute on function public.reply_enquiry(uuid, text) to authenticated;

comment on table public.enquiries is 'Buyer enquiries. Pending until the owner Seller or assigned Agent replies via reply_enquiry.';
commit;
