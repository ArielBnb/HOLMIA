-- Status transitions & history check: paste into Supabase Dashboard > SQL Editor and click Run.
-- Requires migration 20261124130000_property_transitions.sql and the three demo accounts.
-- Runs as the real "authenticated" role, then aborts on purpose: the
-- "ERROR: TEST_RESULT ..." message IS the result and everything is rolled back.
-- Expected:
--   buyer=blocked | other_seller=blocked | unpublish=draft | publish=active | manual_under_offer=refused
--   | direct_sold=refused | released=1 | sold=sold | sold_to_active=refused (Sold is a final status...)
--   | direct_update_after_sold=refused | history_rows>=6 | history_has_note=yes | buyer_history=blocked
do $$
declare
  sid uuid; aid uuid; bid uuid; other uuid := gen_random_uuid(); pid uuid; o1 uuid; o2 uuid; res jsonb;
  buyer text := 'ALLOWED (bad)'; other_seller text := 'ALLOWED (bad)'; unpublish text; publish text;
  manual_uo text := 'ALLOWED (bad)'; direct_sold text := 'ALLOWED (bad)'; released int; sold text;
  sold_to_active text := 'ALLOWED (bad)'; direct_after text := 'ALLOWED (bad)'; rows int; has_note text := 'no';
  buyer_history text := 'ALLOWED (bad)';
begin
  select id into sid from auth.users where email = 'seller@holmia.example';
  select id into aid from auth.users where email = 'agent@holmia.example';
  select id into bid from auth.users where email = 'buyer@holmia.example';
  if sid is null or aid is null or bid is null then raise exception 'Create the three demo accounts first'; end if;

  insert into auth.users (id, email) values (other, 'other-seller-status@holmia.example');
  update public.profiles set role = 'seller' where id = other;

  execute 'set local role authenticated';
  -- Seller creates a listing: history starts with "Listing created".
  perform set_config('request.jwt.claims', json_build_object('sub', sid, 'role', 'authenticated')::text, true);
  insert into public.properties (seller_id, agent_id, title, description, price, listing_type, property_type, location, status)
  values (sid, aid, 'Status check', 'Transitions check.', 300000, 'sale', 'flat', 'London', 'draft') returning id into pid;
  publish := (public.change_property_status(pid, 'active'))->>'new_status';

  -- Buyer and another Seller cannot change the status.
  perform set_config('request.jwt.claims', json_build_object('sub', bid, 'role', 'authenticated')::text, true);
  begin perform public.change_property_status(pid, 'draft'); exception when insufficient_privilege then buyer := 'blocked'; end;
  begin perform public.property_history(pid); exception when insufficient_privilege then buyer_history := 'blocked'; end;
  insert into public.offers (property_id, amount) values (pid, 290000) returning id into o1;
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  begin perform public.change_property_status(pid, 'draft'); exception when insufficient_privilege then other_seller := 'blocked'; end;

  -- Assigned agent: unpublish / publish with a note; manual Under Offer and Active -> Sold refused.
  perform set_config('request.jwt.claims', json_build_object('sub', aid, 'role', 'authenticated')::text, true);
  unpublish := (public.change_property_status(pid, 'draft', 'Photos to redo'))->>'new_status';
  perform public.change_property_status(pid, 'active');
  begin perform public.change_property_status(pid, 'under_offer'); exception when check_violation then manual_uo := 'refused'; end;
  begin perform public.change_property_status(pid, 'sold'); exception when check_violation then direct_sold := 'refused'; end;

  -- Seller accepts, the deal falls through (offer released), accepts another, completes the sale.
  perform set_config('request.jwt.claims', json_build_object('sub', sid, 'role', 'authenticated')::text, true);
  perform public.accept_offer(o1);
  released := ((public.change_property_status(pid, 'active', 'Buyer withdrew'))->>'released_deals')::int;
  perform set_config('request.jwt.claims', json_build_object('sub', bid, 'role', 'authenticated')::text, true);
  insert into public.offers (property_id, amount) values (pid, 295000) returning id into o2;
  perform set_config('request.jwt.claims', json_build_object('sub', sid, 'role', 'authenticated')::text, true);
  perform public.accept_offer(o2);
  sold := (public.change_property_status(pid, 'sold', 'Completion signed'))->>'new_status';
  begin
    perform public.change_property_status(pid, 'active');
  exception when check_violation then sold_to_active := 'refused (' || sqlerrm || ')';
  end;
  begin update public.properties set status = 'active' where id = pid; exception when check_violation then direct_after := 'refused'; end;

  select count(*) into rows from public.property_history(pid);
  if exists (select 1 from public.property_history(pid) h where h.note = 'Buyer withdrew') then has_note := 'yes'; end if;
  execute 'reset role';

  raise exception 'TEST_RESULT | buyer=% | other_seller=% | unpublish=% | publish=% | manual_under_offer=% | direct_sold=% | released=% | sold=% | sold_to_active=% | direct_update_after_sold=% | history_rows=% | history_has_note=% | buyer_history=%',
    buyer, other_seller, unpublish, publish, manual_uo, direct_sold, released, sold, sold_to_active, direct_after, rows, has_note, buyer_history;
end $$;
