-- Acceptance-test (recette) fixes, 24/11/2026.
-- 1. Agent dashboard statistics computed by the database (wireframe 13):
--    the screen previously invented "offers per property" counts.
-- 2. public.messages (20261119120000_create_messages_table.sql) was readable and
--    writable by anonymous visitors with the public app key. Restrict it to
--    signed-in users. Private Seller/Agent/Buyer messages use property_messages.
-- Requires 20261121120000_offers_decisions.sql.
begin;

create function public.agent_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null or (select role from public.profiles where id = me) is distinct from 'agent' then
    raise exception 'Only Agents have a dashboard' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'assigned_count', (select count(*) from public.properties where agent_id = me),
    'active_count', (select count(*) from public.properties where agent_id = me and status = 'active'),
    'avg_active_price', (select coalesce(round(avg(price)), 0) from public.properties where agent_id = me and status = 'active'),
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
      ) y), '[]'::jsonb)
  );
end $$;
revoke all on function public.agent_dashboard() from public, anon;
grant execute on function public.agent_dashboard() to authenticated;

revoke all on public.messages from anon;
drop policy if exists "Allow read messages" on public.messages;
drop policy if exists "Allow insert messages" on public.messages;
create policy messages_read_signed_in on public.messages for select to authenticated using (true);
create policy messages_insert_signed_in on public.messages for insert to authenticated with check (true);

commit;
