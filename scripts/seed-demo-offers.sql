-- Demo offers for the "Offers" tab. Paste into Supabase SQL Editor and click Run.
-- Demo-only data: run once, after migration 20261121120000_offers_decisions.sql
-- and supabase/seed.sql. Re-running adds nothing if pending demo offers already exist.
--   London flat (with agent)   : 3 offers -> visible to seller@ AND agent@
--   Manchester house (direct)  : 2 offers -> visible to seller@ only
begin;
insert into public.offers (property_id, buyer_id, amount)
select d.property_id::uuid, b.id, d.amount
from (values
  ('a0000000-0000-4000-8000-000000000001', 410000),
  ('a0000000-0000-4000-8000-000000000001', 420000),
  ('a0000000-0000-4000-8000-000000000001', 398000),
  ('a0000000-0000-4000-8000-000000000002', 560000),
  ('a0000000-0000-4000-8000-000000000002', 572500)
) as d(property_id, amount)
cross join (select id from auth.users where email = 'buyer@holmia.example') b
where exists (select 1 from public.properties p where p.id = d.property_id::uuid and p.status = 'active')
  and not exists (select 1 from public.offers o where o.property_id = d.property_id::uuid and o.status = 'pending');
commit;
select p.title, p.status, o.amount, o.status
from public.offers o join public.properties p on p.id = o.property_id
order by p.title, o.amount desc;
