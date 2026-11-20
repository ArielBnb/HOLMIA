-- Run against the migrated database as an administrator. No fixtures are committed.
-- The authenticated role and JWT claims exercise database permissions without logins.
begin;

do $$
declare
  buyer uuid := gen_random_uuid();
  other_buyer uuid := gen_random_uuid();
  seller uuid := gen_random_uuid();
  other_seller uuid := gen_random_uuid();
  agent uuid := gen_random_uuid();
  assigned_property uuid;
  direct_property uuid;
  draft_property uuid;
  enquiry uuid := gen_random_uuid();
  direct_enquiry uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  select id, 'enquiry-check-' || id || '@example.invalid',
         jsonb_build_object('username', 'qa_' || replace(id::text, '-', ''), 'full_name', 'Enquiry QA Buyer')
  from unnest(array[buyer, other_buyer, seller, other_seller, agent]) as users(id);
  update public.profiles set role = 'seller' where id in (seller, other_seller);
  update public.profiles set role = 'agent' where id = agent;

  insert into public.properties (seller_id, agent_id, title, price, listing_type, property_type, location, status)
  values (seller, agent, 'Assigned enquiry fixture', 300000, 'sale', 'flat', 'London', 'active')
  returning id into assigned_property;
  insert into public.properties (seller_id, title, price, listing_type, property_type, location, status)
  values (seller, 'Direct enquiry fixture', 300000, 'sale', 'flat', 'London', 'active')
  returning id into direct_property;
  insert into public.properties (seller_id, title, price, listing_type, property_type, location, status)
  values (seller, 'Draft enquiry fixture', 300000, 'sale', 'flat', 'London', 'draft')
  returning id into draft_property;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.enquiries (id, property_id, message)
  values (enquiry, assigned_property, 'Is the flat available?'), (direct_enquiry, direct_property, 'Can I visit?');
  if not exists (select 1 from public.enquiries where id = enquiry and buyer_id = buyer
      and property_id = assigned_property and status = 'new' and reply is null) then
    raise exception 'Buyer write or identity check failed';
  end if;

  begin
    insert into public.enquiries (id, property_id, message) values (enquiry, assigned_property, 'Is the flat available?');
    raise exception 'Duplicate insert succeeded';
  exception when unique_violation then null;
  end;
  begin
    insert into public.enquiries (property_id, message) values (assigned_property, E' \n\t');
    raise exception 'Blank message was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.enquiries (property_id, message) values (draft_property, 'Draft');
    raise exception 'Unpublished property query was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.enquiries (buyer_id, property_id, message) values (other_buyer, assigned_property, 'Wrong author');
    raise exception 'Author override was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.enquiries (property_id, message, status, reply, replied_at)
    values (assigned_property, 'Question', 'answered', 'Forged reply', now());
    raise exception 'Forged initial state was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reply_enquiry(enquiry, 'Buyer reply');
    raise exception 'Buyer could reply';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_buyer, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.enquiries where id = enquiry)
      or exists (select 1 from public.my_enquiries() where id = enquiry) then
    raise exception 'Unrelated Buyer could read the enquiry';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_seller, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.enquiries where id = enquiry)
      or exists (select 1 from public.enquiries_received() where id = enquiry) then
    raise exception 'Unrelated Seller could read the enquiry';
  end if;
  begin
    perform public.reply_enquiry(enquiry, 'Unrelated reply');
    raise exception 'Unrelated Seller could reply';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', seller, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.enquiries_received()
      where id = enquiry and buyer_name = 'Enquiry QA Buyer' and property_title = 'Assigned enquiry fixture')
      or not exists (select 1 from public.enquiries where id = direct_enquiry) then
    raise exception 'Owning Seller could not see enquiries';
  end if;
  begin
    insert into public.enquiries (property_id, message) values (assigned_property, 'Seller cannot create');
    raise exception 'Seller could create an enquiry';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.enquiries set property_id = direct_property, status = 'answered' where id = enquiry;
    raise exception 'Manual identity/status update succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.enquiries set reply = 'Direct update' where id = direct_enquiry;
    raise exception 'Direct reply update succeeded';
  exception when insufficient_privilege then null;
  end;
  perform public.reply_enquiry(direct_enquiry, 'Please contact us.');

  perform set_config('request.jwt.claims', jsonb_build_object('sub', agent, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.enquiries_received() where id = enquiry)
      or exists (select 1 from public.enquiries where id = direct_enquiry) then
    raise exception 'Agent assignment scope failed';
  end if;
  begin
    perform public.reply_enquiry(enquiry, E' \n');
    raise exception 'Blank reply was accepted';
  exception when check_violation then null;
  end;
  perform public.reply_enquiry(enquiry, 'Yes, it is available.');
  perform public.reply_enquiry(enquiry, 'Yes, it is still available.');

  perform set_config('request.jwt.claims', jsonb_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.my_enquiries()
      where id = enquiry and replied_at is not null and replied_by_role = 'agent' and reply = 'Yes, it is still available.')
      or not exists (select 1 from public.enquiries where id = enquiry and status = 'answered' and replied_by = agent)
      or not exists (select 1 from public.enquiries where id = direct_enquiry and status = 'answered' and replied_at is not null) then
    raise exception 'Buyer cannot retrieve the persisted answers';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    perform * from public.my_enquiries();
    raise exception 'Anonymous list was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform id from public.enquiries;
    raise exception 'Anonymous direct read was allowed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;

select 'PASS: Buyer submission and identity, validation and duplicate checks, role isolation, Seller/Agent replies, persisted status and anonymous access' as result;
rollback;
