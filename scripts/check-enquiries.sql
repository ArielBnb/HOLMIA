-- Enquiries check: paste into Supabase Dashboard > SQL Editor and click Run.
-- Requires migration 20261122120000_enquiries.sql and the three demo accounts.
-- Runs as the real "authenticated" role, then aborts on purpose: the
-- "ERROR: TEST_RESULT ..." message IS the result and everything is rolled back.
-- Expected:
--   other_seller_sees=0 | other_seller_reply=blocked | buyer_reply=blocked | direct_update=blocked
--   | agent_sees=1 | agent_on_direct=blocked | seller_received=2 | pending_before=2
--   | buyer_sees_reply=yes | handled_after=2 | other_buyer_sees=0 | draft_enquiry=rejected
do $$
declare
  sid uuid; aid uuid; bid uuid; other_s uuid := gen_random_uuid(); other_b uuid := gen_random_uuid();
  p_agent uuid; p_direct uuid; p_draft uuid; e1 uuid; e2 uuid; n int;
  os_sees int; os_reply text := 'ALLOWED (bad)'; b_reply text := 'ALLOWED (bad)'; direct text := 'ALLOWED (bad)';
  a_sees int; a_direct text := 'ALLOWED (bad)'; s_received int; pending_before int;
  b_sees text := 'no'; handled_after int; ob_sees int; draft text := 'ALLOWED (bad)';
begin
  select id into sid from auth.users where email = 'seller@holmia.example';
  select id into aid from auth.users where email = 'agent@holmia.example';
  select id into bid from auth.users where email = 'buyer@holmia.example';
  if sid is null or aid is null or bid is null then raise exception 'Create the three demo accounts first'; end if;

  -- Trusted setup.
  insert into auth.users (id, email) values (other_s, 'other-seller-enq@holmia.example'), (other_b, 'other-buyer-enq@holmia.example');
  update public.profiles set role = 'seller' where id = other_s;
  insert into public.properties (seller_id, agent_id, title, description, price, listing_type, property_type, location, status)
  values (sid, aid, 'Enq agent', 'With agent.', 300000, 'sale', 'flat', 'Lyon', 'active') returning id into p_agent;
  insert into public.properties (seller_id, title, description, price, listing_type, property_type, location, status)
  values (sid, 'Enq direct', 'Direct.', 1200, 'rent', 'flat', 'Lyon', 'active') returning id into p_direct;
  insert into public.properties (seller_id, title, description, price, listing_type, property_type, location, status)
  values (sid, 'Enq draft', 'Draft.', 1000, 'rent', 'flat', 'Lyon', 'draft') returning id into p_draft;

  -- Buyer asks.
  perform set_config('request.jwt.claims', json_build_object('sub', bid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.enquiries (property_id, message) values (p_agent, 'Is the balcony south-facing?') returning id into e1;
  insert into public.enquiries (property_id, message) values (p_direct, 'Pets allowed?') returning id into e2;
  begin
    insert into public.enquiries (property_id, message) values (p_draft, 'Saw your draft');
  exception when others then draft := 'rejected';
  end;
  begin
    perform public.reply_enquiry(e1, 'self answer');
  exception when insufficient_privilege then b_reply := 'blocked';
  end;
  begin
    update public.enquiries set reply = 'forged' where id = e1;
    get diagnostics n = row_count;
    if n = 0 then direct := 'blocked'; end if;
  exception when insufficient_privilege then direct := 'blocked';
  end;
  execute 'reset role';

  -- Another Seller sees nothing and cannot reply.
  perform set_config('request.jwt.claims', json_build_object('sub', other_s, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into os_sees from public.enquiries where id in (e1, e2);
  begin
    perform public.reply_enquiry(e1, 'not mine');
  exception when insufficient_privilege then os_reply := 'blocked';
  end;
  execute 'reset role';

  -- Assigned Agent: sees the agent listing only, replies there.
  perform set_config('request.jwt.claims', json_build_object('sub', aid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into a_sees from public.enquiries_received() r where r.id in (e1, e2);
  begin
    perform public.reply_enquiry(e2, 'not assigned');
  exception when insufficient_privilege then a_direct := 'blocked';
  end;
  perform public.reply_enquiry(e1, 'Yes, fully south-facing.');
  execute 'reset role';

  -- Owner: sees both (one already handled by the agent), replies to the direct one.
  perform set_config('request.jwt.claims', json_build_object('sub', sid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into s_received from public.enquiries_received() r where r.id in (e1, e2);
  select count(*) into pending_before from public.enquiries_received() r where r.id in (e1, e2) and (r.reply is null or r.id = e1);
  perform public.reply_enquiry(e2, 'Small pets are fine.');
  select count(*) into handled_after from public.enquiries_received() r where r.id in (e1, e2) and r.reply is not null;
  execute 'reset role';

  -- Buyer sees the replies; another Buyer sees nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', bid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if (select count(*) from public.my_enquiries() m where m.id in (e1, e2) and m.reply is not null) = 2 then b_sees := 'yes'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', other_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into ob_sees from public.enquiries where id in (e1, e2);
  execute 'reset role';

  raise exception 'TEST_RESULT | other_seller_sees=% | other_seller_reply=% | buyer_reply=% | direct_update=% | agent_sees=% | agent_on_direct=% | seller_received=% | pending_before=% | buyer_sees_reply=% | handled_after=% | other_buyer_sees=% | draft_enquiry=%',
    os_sees, os_reply, b_reply, direct, a_sees, a_direct, s_received, pending_before, b_sees, handled_after, ob_sees, draft;
end $$;
