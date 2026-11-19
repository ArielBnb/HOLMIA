-- Seller form check: paste into Supabase Dashboard > SQL Editor and click Run.
-- Acts as seller@holmia.example, inserts the exact row the app sends, then
-- aborts on purpose: the "ERROR: TEST_RESULT ..." message IS the result and
-- everything is rolled back (nothing stays in the database).
-- Expected: status=draft | owner_is_seller=true | visible_to_owner=1 | visible_to_public=0 | other_owner=rejected (...)
do $$
declare
  sid uuid; bid uuid; r public.properties;
  forged text := 'ALLOWED (bad)'; own_count int; anon_count int;
begin
  select id into sid from auth.users where email = 'seller@holmia.example';
  select id into bid from auth.users where email = 'buyer@holmia.example';
  perform set_config('request.jwt.claims', json_build_object('sub', sid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.properties (seller_id, title, description, price, listing_type, property_type, location, image_url, status)
  values (sid, 'E2E seller form check', 'Automated check of the Seller listing form payload.', 199000, 'sale', 'flat', 'Lyon, France',
          'https://picsum.photos/seed/holmia-living-room/800/600', 'draft')
  returning * into r;
  select count(*) into own_count from public.properties where id = r.id;
  begin
    insert into public.properties (seller_id, title, description, price, listing_type, property_type, location, status)
    values (bid, 'Forged owner', 'Should be rejected by RLS policy.', 100, 'sale', 'flat', 'Paris', 'draft');
  exception when others then forged := 'rejected (' || sqlerrm || ')';
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  select count(*) into anon_count from public.properties where id = r.id;
  raise exception 'TEST_RESULT | status=% | owner_is_seller=% | price=% | image=% | visible_to_owner=% | visible_to_public=% | other_owner=%',
    r.status, (r.seller_id = sid), r.price, (r.image_url is not null), own_count, anon_count, forged;
end $$;
