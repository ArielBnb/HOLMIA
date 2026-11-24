-- Recette fixes check: paste into Supabase Dashboard > SQL Editor and click Run.
-- Requires migration 20261124140000_recette_fixes.sql and the three demo accounts.
-- Aborts on purpose: the "ERROR: TEST_RESULT ..." message IS the result (rolled back).
-- Expected:
--   anon_read_messages=blocked | anon_insert_messages=blocked | seller_dashboard=blocked
--   | active_count=<agent's active listings> | offers_counted=2 | seller_name=yes
do $$
declare
  sid uuid; aid uuid; bid uuid; pid uuid; d jsonb;
  anon_read text := 'ALLOWED (bad)'; anon_insert text := 'ALLOWED (bad)'; seller_dash text := 'ALLOWED (bad)';
  offers_counted int; seller_name text := 'no';
begin
  select id into sid from auth.users where email = 'seller@holmia.example';
  select id into aid from auth.users where email = 'agent@holmia.example';
  select id into bid from auth.users where email = 'buyer@holmia.example';
  if sid is null or aid is null or bid is null then raise exception 'Create the three demo accounts first'; end if;

  insert into public.properties (seller_id, agent_id, title, description, price, listing_type, property_type, location, status)
  values (sid, aid, 'Recette stats check', 'Stats check.', 400000, 'sale', 'flat', 'London', 'active') returning id into pid;

  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform 1 from public.messages limit 1; exception when insufficient_privilege then anon_read := 'blocked'; end;
  begin
    insert into public.messages (conversation_id, property_id, sender_role, sender_name, text) values ('x', 'x', 'buyer', 'x', 'x');
  exception when insufficient_privilege then anon_insert := 'blocked';
  end;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', bid, 'role', 'authenticated')::text, true);
  insert into public.offers (property_id, amount) values (pid, 380000), (pid, 390000);
  perform set_config('request.jwt.claims', json_build_object('sub', sid, 'role', 'authenticated')::text, true);
  begin perform public.agent_dashboard(); exception when insufficient_privilege then seller_dash := 'blocked'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', aid, 'role', 'authenticated')::text, true);
  d := public.agent_dashboard();
  execute 'reset role';

  select (e->>'count')::int into offers_counted from jsonb_array_elements(d->'offers_per_property') e where e->>'title' = 'Recette stats check';
  if jsonb_array_length(d->'listings_per_seller') > 0 then seller_name := 'yes'; end if;

  raise exception 'TEST_RESULT | anon_read_messages=% | anon_insert_messages=% | seller_dashboard=% | active_count=% | offers_counted=% | seller_name=%',
    anon_read, anon_insert, seller_dash, d->>'active_count', offers_counted, seller_name;
end $$;
