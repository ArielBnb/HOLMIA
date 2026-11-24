-- Extends HOLMIA's deployed final_workflows migration. Keep the original
-- decision and inbox RPC contracts available to older app versions.
alter table public.offers add column message text check (length(message) <= 2000);
revoke insert on public.offers from authenticated;
grant insert (id, property_id, amount, message) on public.offers to authenticated;

-- A former Buyer might later become the assigned Agent on the same listing.
create function private.prevent_self_acceptance() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.buyer_id = (select auth.uid()) then
    raise exception 'You cannot accept your own submission' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.prevent_self_acceptance() from public, anon, authenticated;
create trigger prevent_self_acceptance before update of status on public.offers
  for each row when (new.status = 'accepted' and old.status is distinct from new.status)
  execute function private.prevent_self_acceptance();
create trigger prevent_self_acceptance before update of status on public.rental_applications
  for each row when (new.status = 'accepted' and old.status is distinct from new.status)
  execute function private.prevent_self_acceptance();

create or replace function public.buyer_submissions() returns table (
  id uuid, title text, kind text, status text, amount numeric, move_in_date date, notes text, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select o.id, p.title, 'offer', o.status, o.amount, null::date, o.message, o.created_at
    from public.offers o join public.properties p on p.id = o.property_id
    where o.buyer_id = (select auth.uid())
  union all
  select a.id, p.title, 'rental', a.status, null::numeric, a.move_in_date, a.notes, a.created_at
    from public.rental_applications a join public.properties p on p.id = a.property_id
    where a.buyer_id = (select auth.uid())
  order by created_at desc, id
$$;

create function public.offers_received_with_message() returns table (
  id uuid, property_id uuid, property_title text, property_status text, property_price numeric,
  buyer_name text, amount numeric, status text, decided_at timestamptz, created_at timestamptz, message text
)
language sql stable security invoker set search_path = '' as $$
  select r.*, o.message from public.offers_received() r join public.offers o on o.id = r.id
  order by r.property_id, r.created_at desc, r.id
$$;
revoke all on function public.offers_received_with_message() from public, anon;
grant execute on function public.offers_received_with_message() to authenticated;
