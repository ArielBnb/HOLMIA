-- Offers accept / reject check: paste into Supabase Dashboard > SQL Editor and click Run.
-- Requires migration 20261121120000_offers_decisions.sql and the three demo accounts.
-- Runs as the real "authenticated" role, then aborts on purpose: the
-- "ERROR: TEST_RESULT ..." message IS the result and everything is rolled back.
-- Expected:
--   other_seller=blocked | buyer=blocked | direct_update=blocked | agent_reject=ok | received=3
--   | accept_rejected_others=1 | property=under_offer | accepted_count=1 | second_accept=blocked
do $$
declare
  sid uuid; aid uuid; bid uuid; other uuid := gen_random_uuid(); pid uuid;
  o1 uuid; o2 uuid; o3 uuid; res jsonb; n int;
  other_seller text := 'ALLOWED (bad)'; buyer text := 'ALLOWED (bad)'; direct text := 'ALLOWED (bad)';
  agent_reject text := 'failed'; received int; rejected_others int; pstatus text; accepted int;
  second text := 'ALLOWED (bad)';
begin
  select id into sid from auth.users where email = 'seller@holmia.example';
  select id into aid from auth.users where email = 'agent@holmia.example';
  select id into bid from auth.users where email = 'buyer@holmia.example';
  if sid is null or aid is null or bid is null then raise exception 'Create the three demo accounts first'; end if;

  -- Trusted setup: a second Seller and an active listing (owner seller, agent assigned).
  insert into auth.users (id, email) values (other, 'other-seller-offers@holmia.example');
  update public.profiles set role = 'seller' where id = other;
  insert into public.properties (seller_id, agent_id, title, description, price, listing_type, property_type, location, status)
  values (sid, aid, 'Offers check', 'Listing for the offers check.', 300000, 'sale', 'flat', 'Lyon', 'active') returning id into pid;

  -- Buyer submits three offers.
  perform set_config('request.jwt.claims', json_build_object('sub', bid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.offers (property_id, amount) values (pid, 280000) returning id into o1;
  insert into public.offers (property_id, amount) values (pid, 295000) returning id into o2;
  insert into public.offers (property_id, amount) values (pid, 270000) returning id into o3;
  begin
    perform public.accept_offer(o2);
  exception when insufficient_privilege then buyer := 'blocked';
  end;
  begin
    update public.offers set status = 'accepted' where id = o2;
    get diagnostics n = row_count;
    if n = 0 then direct := 'blocked'; end if;
  exception when insufficient_privilege then direct := 'blocked';
  end;
  execute 'reset role';

  -- Another Seller cannot decide.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.accept_offer(o2);
  exception when insufficient_privilege then other_seller := 'blocked';
  end;
  execute 'reset role';

  -- Assigned Agent rejects the lowest offer.
  perform set_config('request.jwt.claims', json_build_object('sub', aid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.reject_offer(o3);
  agent_reject := 'ok';
  execute 'reset role';

  -- Owner sees the offers, accepts the best one.
  perform set_config('request.jwt.claims', json_build_object('sub', sid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into received from public.offers_received() r where r.property_id = pid;
  res := public.accept_offer(o2);
  rejected_others := (res->>'rejected_count')::int;
  begin
    perform public.accept_offer(o1);
  exception when others then second := 'blocked';
  end;
  execute 'reset role';

  select status into pstatus from public.properties where id = pid;
  select count(*) into accepted from public.offers where property_id = pid and status = 'accepted';

  raise exception 'TEST_RESULT | other_seller=% | buyer=% | direct_update=% | agent_reject=% | received=% | accept_rejected_others=% | property=% | accepted_count=% | second_accept=%',
    other_seller, buyer, direct, agent_reject, received, rejected_others, pstatus, accepted, second;
end $$;
