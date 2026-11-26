-- Security & Business-Logic Hardening Migration (Audit 2026-11-24)
-- 1. Enforce p.listing_type = 'sale' inside public.accept_offer() so a purchase
--    offer can never be accepted on a rental listing.
-- 2. Revoke PUBLIC / anon execute on public.buyer_submissions().
-- 3. Restrict public.list_agents() to Sellers & Agents (least privilege).
-- 4. Compute avg_active_price in public.agent_dashboard() on active sale listings
--    (falling back to all active listings only when no active sales exist) so
--    sale prices and monthly rents are not averaged together.

begin;

-- 1. Harden public.accept_offer()
create or replace function public.accept_offer(p_offer uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  o public.offers;
  p public.properties;
begin
  select * into o from public.offers where id = p_offer for update;
  if not found then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  select * into p from public.properties where id = o.property_id for update;
  if not private.can_decide_offer(p) then
    raise exception 'Only the assigned agent or the direct seller can decide offers' using errcode = '42501';
  end if;
  if p.listing_type <> 'sale' then
    raise exception 'Purchase offers can only be accepted on sale listings' using errcode = '22023';
  end if;
  if p.status <> 'active' then
    raise exception 'Listing is not open to offers (status: %)', p.status using errcode = '22023';
  end if;
  if o.status <> 'pending' then
    raise exception 'Offer has already been decided (status: %)', o.status using errcode = '22023';
  end if;

  update public.offers set status = 'accepted', decided_by = auth.uid(), decided_at = now() where id = p_offer;
  update public.offers set status = 'rejected', decided_by = auth.uid(), decided_at = now()
    where property_id = o.property_id and id <> p_offer and status = 'pending';
  update public.properties set status = 'under_offer' where id = o.property_id;
  return p_offer;
end $$;

-- 2. Defense-in-depth execute grant on public.buyer_submissions()
do $$
begin
  if to_regprocedure('public.buyer_submissions()') is not null then
    revoke all on function public.buyer_submissions() from public, anon;
    grant execute on function public.buyer_submissions() to authenticated;
  end if;
end $$;

-- 3. Restrict public.list_agents() to Sellers and Agents
create or replace function public.list_agents()
returns table (id uuid, full_name text, username text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.username
  from public.profiles p
  where p.role = 'agent'
    and private.current_profile_role() in ('seller', 'agent')
  order by coalesce(p.full_name, p.username, '');
$$;
revoke all on function public.list_agents() from public, anon;
grant execute on function public.list_agents() to authenticated;

-- 4. Keep avg_active_price meaningful in public.agent_dashboard()
create or replace function public.agent_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  avg_sale numeric;
  avg_all numeric;
begin
  if me is null or (select role from public.profiles where id = me) is distinct from 'agent' then
    raise exception 'Only Agents have a dashboard' using errcode = '42501';
  end if;

  select round(avg(price)) into avg_sale
  from public.properties
  where agent_id = me and status = 'active' and listing_type = 'sale';

  select coalesce(round(avg(price)), 0) into avg_all
  from public.properties
  where agent_id = me and status = 'active';

  return jsonb_build_object(
    'assigned_count', (select count(*) from public.properties where agent_id = me),
    'active_count', (select count(*) from public.properties where agent_id = me and status = 'active'),
    'avg_active_price', coalesce(avg_sale, avg_all, 0),
    'by_status', coalesce((
      select jsonb_object_agg(status, n) from (
        select status, count(*) as n from public.properties where agent_id = me group by status
      ) s), '{}'::jsonb),
    'listings_per_seller', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'count', n) order by n desc, name)
      from (
        select coalesce(s.full_name, s.username, 'Seller') as name, count(*) as n
        from public.properties p join public.profiles s on s.id = p.seller_id
        where p.agent_id = me and p.status = 'active'
        group by 1
      ) x), '[]'::jsonb),
    'offers_per_property', coalesce((
      select jsonb_agg(jsonb_build_object('title', title, 'count', n, 'pending', pending) order by n desc, title)
      from (
        select p.title, count(o.id) as n, count(o.id) filter (where o.status = 'pending') as pending
        from public.properties p left join public.offers o on o.property_id = p.id
        where p.agent_id = me and p.listing_type = 'sale' and p.status <> 'draft'
        group by p.id, p.title
      ) x), '[]'::jsonb)
  );
end $$;
revoke all on function public.agent_dashboard() from public, anon;
grant execute on function public.agent_dashboard() to authenticated;

-- 5. Drop any legacy status-check trigger on public.properties (e.g. from
--    uncommitted final_workflows) that conflicts with validate_status_transition
--    and rejects valid transitions with "Invalid listing status change".
do $$
declare
  r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.properties'::regclass
      and not t.tgisinternal
      and t.tgname <> 'validate_status_transition'
      and pg_get_functiondef(p.oid) ilike '%Invalid listing status change%'
  loop
    execute format('drop trigger if exists %I on public.properties;', r.tgname);
  end loop;
end $$;

commit;
