-- Run on the migrated project. Every account and property is created inside
-- this transaction. Assertions use real roles/RLS, then the fixtures roll back.
begin;
set local plpgsql.check_asserts = on;
do $$
declare
  buyer uuid := gen_random_uuid(); other_buyer uuid := gen_random_uuid();
  seller uuid := gen_random_uuid(); agent uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid(); unassigned uuid := gen_random_uuid(); actor uuid;
  sale uuid; rental uuid; draft uuid; oid uuid := gen_random_uuid(); aid uuid := gen_random_uuid();
  competing_offer uuid; competing_rental uuid;
begin
  insert into auth.users(id,email,raw_user_meta_data)
  select u, u::text || '@holmia-check.invalid',
    jsonb_build_object('username','qa_'||replace(u::text,'-',''),'full_name','Buyer workflow test')
    from unnest(array[buyer,other_buyer,seller,agent,outsider,unassigned]) u;
  update public.profiles set role='seller' where id in (seller,outsider);
  update public.profiles set role='agent' where id in (agent,unassigned);
  insert into public.properties(seller_id,agent_id,title,price,location,listing_type,property_type,status)
    values(seller,agent,'Sale fixture',250000,'London','sale','flat','active') returning id into sale;
  insert into public.properties(seller_id,agent_id,title,price,location,listing_type,property_type,status)
    values(seller,agent,'Rental fixture',1200,'London','rent','flat','active') returning id into rental;
  insert into public.properties(seller_id,title,price,location,listing_type,property_type,status)
    values(seller,'Draft fixture',200000,'London','sale','flat','draft') returning id into draft;

  execute 'set local role anon';
  begin perform * from public.buyer_submissions(); assert false; exception when insufficient_privilege then null; end;
  begin insert into public.offers(property_id,amount) values(sale,1); assert false; exception when insufficient_privilege then null; end;
  begin insert into public.rental_applications(property_id,move_in_date) values(rental,current_date); assert false; exception when insufficient_privilege then null; end;
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',json_build_object('sub',buyer,'role','authenticated')::text,true);
  insert into public.offers(id,property_id,amount,message) values(oid,sale,245000.50,'Offer note');
  insert into public.rental_applications(id,property_id,move_in_date,notes) values(aid,rental,current_date+5,'Rental note');
  assert exists(select 1 from public.offers where id=oid and buyer_id=buyer and status='pending');
  assert exists(select 1 from public.rental_applications where id=aid and buyer_id=buyer and status='pending');
  begin insert into public.offers(id,property_id,amount) values(oid,sale,245000.50); assert false; exception when unique_violation then null; end;
  begin insert into public.rental_applications(id,property_id,move_in_date) values(aid,rental,current_date+5); assert false; exception when unique_violation then null; end;
  begin insert into public.offers(property_id,amount) values(rental,100); assert false; exception when check_violation then null; end;
  begin insert into public.offers(property_id,amount) values(draft,100); assert false; exception when check_violation then null; end;
  begin insert into public.offers(property_id,amount) values(sale,0); assert false; exception when check_violation then null; end;
  begin insert into public.rental_applications(property_id,move_in_date) values(sale,current_date); assert false; exception when check_violation then null; end;
  begin insert into public.rental_applications(property_id,move_in_date) values(rental,current_date-1); assert false; exception when check_violation then null; end;
  begin insert into public.offers(buyer_id,property_id,amount) values(other_buyer,sale,1); assert false; exception when insufficient_privilege then null; end;
  begin insert into public.rental_applications(buyer_id,property_id,move_in_date) values(other_buyer,rental,current_date); assert false; exception when insufficient_privilege then null; end;
  begin update public.offers set status='accepted' where id=oid; assert false; exception when insufficient_privilege then null; end;
  begin update public.rental_applications set status='accepted' where id=aid; assert false; exception when insufficient_privilege then null; end;
  foreach actor in array array[buyer,outsider,unassigned] loop
    perform set_config('request.jwt.claims',json_build_object('sub',actor,'role','authenticated')::text,true);
    assert not exists(select 1 from public.offers_received_with_message() where id=oid);
    assert not exists(select 1 from public.rentals_received() where id=aid);
    begin perform public.accept_offer(oid); assert false; exception when insufficient_privilege then null; end;
    begin perform public.decide_rental(aid,true); assert false; exception when insufficient_privilege then null; end;
  end loop;
  perform set_config('request.jwt.claims',json_build_object('sub',other_buyer,'role','authenticated')::text,true);
  assert not exists(select 1 from public.buyer_submissions());
  assert not exists(select 1 from public.offers where id=oid);
  assert not exists(select 1 from public.rental_applications where id=aid);
  insert into public.offers(property_id,amount) values(sale,210000) returning id into competing_offer;
  insert into public.rental_applications(property_id,move_in_date) values(rental,current_date) returning id into competing_rental;
  foreach actor in array array[seller,agent] loop
    perform set_config('request.jwt.claims',json_build_object('sub',actor,'role','authenticated')::text,true);
    assert exists(select 1 from public.offers_received_with_message() where id=oid and message='Offer note');
    assert exists(select 1 from public.rentals_received() where id=aid and notes='Rental note');
    begin insert into public.offers(property_id,amount) values(sale,1); assert false; exception when insufficient_privilege then null; end;
    begin insert into public.rental_applications(property_id,move_in_date) values(rental,current_date); assert false; exception when insufficient_privilege then null; end;
  end loop;
  perform public.reject_offer(competing_offer);
  perform public.decide_rental(aid,true);
  perform set_config('request.jwt.claims',json_build_object('sub',seller,'role','authenticated')::text,true);
  perform public.accept_offer(oid);
  perform set_config('request.jwt.claims',json_build_object('sub',buyer,'role','authenticated')::text,true);
  assert (select count(*) from public.buyer_submissions() where status='accepted')=2;
  assert exists(select 1 from public.buyer_submissions() where id=oid and title='Sale fixture' and notes='Offer note');
  assert exists(select 1 from public.buyer_submissions() where id=aid and title='Rental fixture' and move_in_date=current_date+5);
  begin insert into public.offers(property_id,amount) values(sale,1); assert false; exception when check_violation then null; end;
  begin insert into public.rental_applications(property_id,move_in_date) values(rental,current_date); assert false; exception when check_violation then null; end;
  perform set_config('request.jwt.claims',json_build_object('sub',other_buyer,'role','authenticated')::text,true);
  assert (select count(*) from public.buyer_submissions() where status='rejected')=2;
  -- A Buyer may later be promoted and assigned to their former listing.
  execute 'reset role';
  perform set_config('request.jwt.claims','{}',true);
  insert into public.properties(seller_id,title,price,location,listing_type,property_type,status)
    values(seller,'Role change sale',200000,'London','sale','flat','active') returning id into sale;
  insert into public.properties(seller_id,title,price,location,listing_type,property_type,status)
    values(seller,'Role change rental',1200,'London','rent','flat','active') returning id into rental;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',json_build_object('sub',other_buyer,'role','authenticated')::text,true);
  insert into public.offers(property_id,amount) values(sale,195000) returning id into oid;
  insert into public.rental_applications(property_id,move_in_date) values(rental,current_date) returning id into aid;
  execute 'reset role';
  perform set_config('request.jwt.claims','{}',true);
  update public.profiles set role='agent' where id=other_buyer;
  update public.properties set agent_id=other_buyer where id in (sale,rental);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',json_build_object('sub',other_buyer,'role','authenticated')::text,true);
  assert exists(select 1 from public.offers_received() where id=oid);
  begin perform public.accept_offer(oid); assert false; exception when insufficient_privilege then null; end;
  begin perform public.decide_rental(aid,true); assert false; exception when insufficient_privilege then null; end;
  assert (select status from public.offers where id=oid)='pending';
  assert (select status from public.rental_applications where id=aid)='pending';
  execute 'reset role';
end $$;
select 'Buyer submission permissions and decisions passed' as result;
rollback;
