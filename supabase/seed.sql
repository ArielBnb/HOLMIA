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
insert into public.properties (id,seller_id,agent_id,title,description,price,listing_type,property_type,location,image_url,status)
select
  d.id::uuid,
  case d.seller_slot
    when 2 then coalesce((select id from auth.users where email='seller2@holmia.example'), s.id)
    when 3 then coalesce((select id from auth.users where email='seller3@holmia.example'), s.id)
    else s.id
  end,
  case when d.assigned then a.id else null end,
  d.title,d.description,d.price,d.listing_type,d.property_type,d.location,d.image_url,'active'
from (values
 ('a0000000-0000-4000-8000-000000000001','Bright Apartment in Central London','Charming two-bedroom apartment with private balcony, close to tube station and amenities.',425000,'sale','flat','London, UK','https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=80',true,1),
 ('a0000000-0000-4000-8000-000000000002','Spacious Family House in Manchester','Detached four-bedroom family home with private garden, garage and modern kitchen.',580000,'sale','house','Manchester, UK','https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=900&q=80',false,2),
 ('a0000000-0000-4000-8000-000000000003','Furnished Student Studio in Oxford','Compact fully furnished modern studio located within walking distance of university colleges.',650,'rent','studio','Oxford, UK','https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',true,2),
 ('a0000000-0000-4000-8000-000000000004','Riverside Apartment with Terrace in Bristol','Stylish two-bedroom apartment featuring a large river-view terrace and secure parking space.',1150,'rent','flat','Bristol, UK','https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80',false,1),
 ('a0000000-0000-4000-8000-000000000005','Industrial Converted Loft in Birmingham','Open-plan loft in a former warehouse with exposed brickwork, high ceilings and industrial character.',310000,'sale','loft','Birmingham, UK','https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80',true,3),
 ('a0000000-0000-4000-8000-000000000006','Detached House with Garden in Cambridge','Peaceful three-bedroom house situated in a quiet cul-de-sac with landscaped garden and driveway.',1450,'rent','house','Cambridge, UK','https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80',false,3)
) as d(id,title,description,price,listing_type,property_type,location,image_url,assigned,seller_slot)
cross join (select id from auth.users where email='seller@holmia.example') s
cross join (select id from auth.users where email='agent@holmia.example') a
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  price = excluded.price,
  listing_type = excluded.listing_type,
  property_type = excluded.property_type,
  location = excluded.location,
  image_url = excluded.image_url,
  status = excluded.status;
commit;
select status, count(*) from public.properties group by status;
