-- Rental decisions check: paste into Supabase Dashboard > SQL Editor and click Run.
-- Requires migration 20261124120000_rental_decisions.sql and the three demo accounts.
-- Runs as the real "authenticated" role, then aborts on purpose: the
-- "ERROR: TEST_RESULT ..." message IS the result and everything is rolled back.
-- Expected:
--   other_seller=blocked | buyer=blocked | received=3 | notes=yes | agent_reject=ok | property_after_reject=active
--   | accept_rejected_others=1 | property=under_offer | accepted_count=1 | second_accept=blocked
--   | buyer_sees=accepted | tenancy=rented
do $$
declare
  sid uuid; aid uuid; bid uuid; other uuid := gen_random_uuid(); b2 uuid := gen_random_uuid(); b3 uuid := gen_random_uuid();
  pid uuid; a1 uuid; a2 uuid; a3 uuid; res jsonb;
  other_seller text := 'ALLOWED (bad)'; buyer text := 'ALLOWED (bad)'; received int; notes text := 'no';
  agent_reject text := 'failed'; after_reject text; rejected_others int; pstatus text; accepted int;
  second text := 'ALLOWED (bad)'; buyer_sees text; tenancy text;
begin
  select id into sid from auth.users where email = 'seller@holmia.example';
  select id into aid from auth.users where email = 'agent@holmia.example';
  select id into bid from auth.users where email = 'buyer@holmia.example';
  if sid is null or aid is null or bid is null then raise exception 'Create the three demo accounts first'; end if;

  -- Trusted setup: another Seller, two more Buyers, an active rental with the demo agent.
  insert into auth.users (id, email) values
    (other, 'other-seller-rent@holmia.example'), (b2, 'buyer2-rent@holmia.example'), (b3, 'buyer3-rent@holmia.example');
  update public.profiles set role = 'seller' where id = other;
  insert into public.properties (seller_id, agent_id, title, description, price, listing_type, property_type, location, status)
  values (sid, aid, 'Rental check', 'Rental decisions check.', 1200, 'rent', 'flat', 'London', 'active') returning id into pid;

  -- Three Buyers apply.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', bid, 'role', 'authenticated')::text, true);
  insert into public.rental_applications (property_id, move_in_date, notes) values (pid, current_date + 10, 'Permanent contract') returning id into a1;
  begin
    perform public.decide_rental_application(a1, true);
  exception when insufficient_privilege then buyer := 'blocked';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', b2, 'role', 'authenticated')::text, true);
  insert into public.rental_applications (property_id, move_in_date) values (pid, current_date + 20) returning id into a2;
  perform set_config('request.jwt.claims', json_build_object('sub', b3, 'role', 'authenticated')::text, true);
  insert into public.rental_applications (property_id, move_in_date) values (pid, current_date + 30) returning id into a3;

  -- Another Seller cannot decide.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  begin
    perform public.decide_rental_application(a1, true);
  exception when insufficient_privilege then other_seller := 'blocked';
  end;

  -- Assigned Agent sees the applications and rejects one: listing stays active.
  perform set_config('request.jwt.claims', json_build_object('sub', aid, 'role', 'authenticated')::text, true);
  select count(*) into received from public.rental_applications_received() r where r.property_id = pid;
  if exists (select 1 from public.rental_applications_received() r where r.id = a1 and r.notes = 'Permanent contract') then notes := 'yes'; end if;
  perform public.decide_rental_application(a3, false);
  agent_reject := 'ok';
  select r.property_status into after_reject from public.rental_applications_received() r where r.id = a3;

  -- Owner accepts: the other pending one is rejected, listing Under Offer.
  perform set_config('request.jwt.claims', json_build_object('sub', sid, 'role', 'authenticated')::text, true);
  res := public.decide_rental_application(a1, true);
  rejected_others := (res->>'rejected_count')::int;
  select status into pstatus from public.properties where id = pid;
  begin
    perform public.decide_rental_application(a2, true);
  exception when others then second := 'blocked';
  end;

  -- The Buyer sees the decision in their activity.
  perform set_config('request.jwt.claims', json_build_object('sub', bid, 'role', 'authenticated')::text, true);
  select s.status into buyer_sees from public.buyer_submissions() s where s.id = a1;

  -- Agent starts the tenancy: Rented.
  perform set_config('request.jwt.claims', json_build_object('sub', aid, 'role', 'authenticated')::text, true);
  res := public.start_tenancy(a1);
  execute 'reset role';

  select status into tenancy from public.properties where id = pid;
  select count(*) into accepted from public.rental_applications where property_id = pid and status = 'accepted';

  raise exception 'TEST_RESULT | other_seller=% | buyer=% | received=% | notes=% | agent_reject=% | property_after_reject=% | accept_rejected_others=% | property=% | accepted_count=% | second_accept=% | buyer_sees=% | tenancy=%',
    other_seller, buyer, received, notes, agent_reject, after_reject, rejected_others,
    pstatus, accepted, second, buyer_sees, tenancy;
end $$;
