-- Seller representation & messaging check: paste into Supabase Dashboard > SQL Editor and click Run.
-- Requires migration 20261120120000_seller_agent_messaging.sql and the three demo accounts.
-- Everything runs as the real "authenticated" role, then aborts on purpose:
-- the "ERROR: TEST_RESULT ..." message IS the result and everything is rolled back.
-- Expected:
--   agents_visible>=1 | seller_to_agent=ok | agent_to_seller=ok | seller_to_buyer_on_agent_listing=rejected
--   | buyer_to_seller_direct=ok | seller_reply=ok | buyer_on_draft=rejected | buyer_reads_agent_thread=0
--   | seller_inbox=2 | agent_locked=yes
do $$
declare
  sid uuid; aid uuid; bid uuid; p_agent uuid; p_direct uuid; p_draft uuid;
  agents int; s2a text := 'failed'; a2s text := 'failed'; s2b text := 'ALLOWED (bad)';
  b2s text := 'failed'; reply text := 'failed'; draft text := 'ALLOWED (bad)';
  leak int; inbox int; locked text := 'NO (bad)';
begin
  select id into sid from auth.users where email = 'seller@holmia.example';
  select id into aid from auth.users where email = 'agent@holmia.example';
  select id into bid from auth.users where email = 'buyer@holmia.example';
  if sid is null or aid is null or bid is null then raise exception 'Create the three demo accounts first'; end if;

  -- Trusted setup: one listing with an agent, one direct, one direct draft.
  insert into public.properties (seller_id, agent_id, title, description, price, listing_type, property_type, location, status)
  values (sid, aid, 'Msg check agent', 'Listing with an agent.', 300000, 'sale', 'flat', 'Lyon', 'active') returning id into p_agent;
  insert into public.properties (seller_id, title, description, price, listing_type, property_type, location, status)
  values (sid, 'Msg check direct', 'Direct listing.', 250000, 'sale', 'house', 'Lyon', 'active') returning id into p_direct;
  insert into public.properties (seller_id, title, description, price, listing_type, property_type, location, status)
  values (sid, 'Msg check draft', 'Direct draft.', 200000, 'sale', 'flat', 'Lyon', 'draft') returning id into p_draft;

  -- Seller
  perform set_config('request.jwt.claims', json_build_object('sub', sid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into agents from public.list_agents();
  insert into public.property_messages (property_id, recipient_id, body) values (p_agent, aid, 'Any offers yet?');
  s2a := 'ok';
  begin
    insert into public.property_messages (property_id, recipient_id, body) values (p_agent, bid, 'Bypassing my agent');
  exception when insufficient_privilege then s2b := 'rejected';
  end;
  execute 'reset role';

  -- Agent
  perform set_config('request.jwt.claims', json_build_object('sub', aid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.property_messages (property_id, recipient_id, body) values (p_agent, sid, 'One offer at 290k.');
  a2s := 'ok';
  execute 'reset role';

  -- Buyer
  perform set_config('request.jwt.claims', json_build_object('sub', bid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.property_messages (property_id, recipient_id, body) values (p_direct, sid, 'Is the garden south-facing?');
  b2s := 'ok';
  begin
    insert into public.property_messages (property_id, recipient_id, body) values (p_draft, sid, 'Saw your draft');
  exception when insufficient_privilege then draft := 'rejected';
  end;
  select count(*) into leak from public.property_messages where property_id = p_agent;
  execute 'reset role';

  -- Seller replies, checks inbox, tries to swap agent on an Under Offer listing.
  update public.properties set status = 'under_offer' where id = p_agent;
  perform set_config('request.jwt.claims', json_build_object('sub', sid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.property_messages (property_id, recipient_id, body) values (p_direct, bid, 'Yes, fully south-facing.');
  reply := 'ok';
  select count(*) into inbox from public.my_conversations();
  begin
    update public.properties set agent_id = null where id = p_agent;
  exception when insufficient_privilege then locked := 'yes';
  end;
  execute 'reset role';

  raise exception 'TEST_RESULT | agents_visible=% | seller_to_agent=% | agent_to_seller=% | seller_to_buyer_on_agent_listing=% | buyer_to_seller_direct=% | seller_reply=% | buyer_on_draft=% | buyer_reads_agent_thread=% | seller_inbox=% | agent_locked=%',
    agents, s2a, a2s, s2b, b2s, reply, draft, leak, inbox, locked;
end $$;
