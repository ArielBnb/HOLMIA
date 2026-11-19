-- Seller edit & delete check: paste into Supabase Dashboard > SQL Editor and click Run.
-- Requires migration 20261119120000_seller_edit_delete_rules.sql.
-- Creates a temporary second Seller and two listings owned by seller@holmia.example,
-- runs every rule as the real "authenticated" role, then aborts on purpose:
-- the "ERROR: TEST_RESULT ..." message IS the result and everything is rolled back.
-- Expected:
--   other_edit=0 | other_delete=0 | price_locked=yes | type_locked=yes
--   | desc_under_offer=ok | delete_under_offer=blocked | owner_delete=1
do $$
declare
  sid uuid; other uuid := gen_random_uuid();
  p_active uuid; p_offer uuid; n int;
  other_edit int; other_delete int;
  price_locked text := 'NO (bad)'; type_locked text := 'NO (bad)';
  desc_ok text := 'failed'; del_offer text := 'ALLOWED (bad)'; owner_delete int;
begin
  select id into sid from auth.users where email = 'seller@holmia.example';
  if sid is null then raise exception 'seller@holmia.example not found'; end if;

  -- Trusted setup (no auth.uid()): second Seller + two listings.
  insert into auth.users (id, email) values (other, 'other-seller-check@holmia.example');
  update public.profiles set role = 'seller' where id = other;
  insert into public.properties (seller_id, title, description, price, listing_type, property_type, location, status)
  values (sid, 'Check active', 'Active listing for the edit/delete check.', 300000, 'sale', 'flat', 'Lyon', 'active')
  returning id into p_active;
  insert into public.properties (seller_id, title, description, price, listing_type, property_type, location, status)
  values (sid, 'Check under offer', 'Under offer listing for the check.', 400000, 'sale', 'house', 'Lyon', 'under_offer')
  returning id into p_offer;

  -- 1. Another Seller is blocked (RLS: sees and changes 0 rows).
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.properties set title = 'Hijacked' where id = p_active;
  get diagnostics other_edit = row_count;
  delete from public.properties where id = p_active;
  get diagnostics other_delete = row_count;
  execute 'reset role';

  -- 2. Owner: protected fields after Under Offer, delete rules.
  perform set_config('request.jwt.claims', json_build_object('sub', sid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    update public.properties set price = 1 where id = p_offer;
  exception when insufficient_privilege then price_locked := 'yes';
  end;
  begin
    update public.properties set property_type = 'loft' where id = p_offer;
  exception when insufficient_privilege then type_locked := 'yes';
  end;
  update public.properties set description = 'Visits on Saturday.' where id = p_offer;
  get diagnostics n = row_count;
  if n = 1 then desc_ok := 'ok'; end if;
  begin
    delete from public.properties where id = p_offer;
  exception when insufficient_privilege then del_offer := 'blocked';
  end;
  delete from public.properties where id = p_active;
  get diagnostics owner_delete = row_count;
  execute 'reset role';

  raise exception 'TEST_RESULT | other_edit=% | other_delete=% | price_locked=% | type_locked=% | desc_under_offer=% | delete_under_offer=% | owner_delete=%',
    other_edit, other_delete, price_locked, type_locked, desc_ok, del_offer, owner_delete;
end $$;
