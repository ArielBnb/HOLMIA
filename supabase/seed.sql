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
 ('a0000000-0000-4000-8000-000000000001','Appartement lumineux à Paris','Bien fictif : trois pièces, balcon et proximité des transports.',425000,'sale','flat','Paris, France',true),
 ('a0000000-0000-4000-8000-000000000002','Maison familiale à Lyon','Bien fictif : maison avec jardin et trois chambres.',580000,'sale','house','Lyon, France',false),
 ('a0000000-0000-4000-8000-000000000003','Studio étudiant à Lille','Bien fictif : studio meublé proche des universités.',650,'rent','studio','Lille, France',true),
 ('a0000000-0000-4000-8000-000000000004','Appartement avec terrasse à Bordeaux','Bien fictif : deux pièces avec terrasse en location mensuelle.',1150,'rent','flat','Bordeaux, France',false),
 ('a0000000-0000-4000-8000-000000000005','Loft à Nantes','Bien fictif : loft ouvert dans un ancien atelier rénové.',310000,'sale','loft','Nantes, France',true),
 ('a0000000-0000-4000-8000-000000000006','Maison au calme à Toulouse','Bien fictif : quatre pièces, jardin et garage.',1450,'rent','house','Toulouse, France',false)
) as d(id,title,description,price,listing_type,property_type,location,assigned)
cross join (select id from auth.users where email='seller@holmia.example') s
cross join (select id from auth.users where email='agent@holmia.example') a
on conflict (id) do nothing;
commit;
select status, count(*) from public.properties group by status;
