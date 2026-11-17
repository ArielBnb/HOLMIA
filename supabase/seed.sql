-- Demo-only. First create buyer/seller/agent@holmia.example in Supabase Auth
-- using Dashboard > Authentication > Add user > Create new user (auto-confirm).
-- No passwords or auth.users inserts belong in this file. Run as trusted admin.
begin;
do $$
begin
  if (select count(*) from auth.users where email in ('buyer@holmia.example','seller@holmia.example','agent@holmia.example')) <> 3 then
    raise exception 'Create the three real demo Auth accounts before running seed.sql';
  end if;
end $$;
update public.profiles p set
  username = 'demo_' || split_part(u.email, '@', 1),
  full_name = 'Demo ' || initcap(split_part(u.email, '@', 1)),
  role = split_part(u.email, '@', 1)
from auth.users u where p.id = u.id and u.email in ('buyer@holmia.example','seller@holmia.example','agent@holmia.example')
  and p.role is distinct from split_part(u.email, '@', 1);
update public.profiles p set username = 'demo_buyer', full_name = 'Demo Buyer'
from auth.users u where p.id=u.id and u.email='buyer@holmia.example';
insert into public.properties (id,seller_id,agent_id,title,description,price,listing_type,property_type,location,status)
select d.id::uuid, s.id, case when d.assigned then a.id else null end, d.title,d.description,d.price,d.listing_type,d.property_type,d.location,'active'
from (values
 ('a0000000-0000-4000-8000-000000000001','Bright Apartment in Central London','Charming two-bedroom apartment with private balcony, close to tube station and amenities.',425000,'sale','flat','London, UK',true),
 ('a0000000-0000-4000-8000-000000000002','Spacious Family House in Manchester','Detached four-bedroom family home with private garden, garage and modern kitchen.',580000,'sale','house','Manchester, UK',false),
 ('a0000000-0000-4000-8000-000000000003','Furnished Student Studio in Oxford','Compact fully furnished modern studio located within walking distance of university colleges.',650,'rent','studio','Oxford, UK',true),
 ('a0000000-0000-4000-8000-000000000004','Riverside Apartment with Terrace in Bristol','Stylish two-bedroom apartment featuring a large river-view terrace and secure parking space.',1150,'rent','flat','Bristol, UK',false),
 ('a0000000-0000-4000-8000-000000000005','Industrial Converted Loft in Birmingham','Open-plan loft in a former warehouse with exposed brickwork, high ceilings and industrial character.',310000,'sale','loft','Birmingham, UK',true),
 ('a0000000-0000-4000-8000-000000000006','Detached House with Garden in Cambridge','Peaceful three-bedroom house situated in a quiet cul-de-sac with landscaped garden and driveway.',1450,'rent','house','Cambridge, UK',false)
) as d(id,title,description,price,listing_type,property_type,location,assigned)
cross join (select id from auth.users where email='seller@holmia.example') s
cross join (select id from auth.users where email='agent@holmia.example') a
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  price = excluded.price,
  listing_type = excluded.listing_type,
  property_type = excluded.property_type,
  location = excluded.location,
  status = excluded.status;
commit;
select status, count(*) from public.properties group by status;
