-- Seller / Agent decisions on rental applications, with a coherent rental lifecycle:
--   listing active      + application accepted  -> listing under_offer (others rejected)
--   listing under_offer + tenancy started       -> listing rented
-- Mirrors RentalRepository.acceptApplication / completeRental (local SQLite).
--
-- public.rental_applications was created by the deployed "final_workflows"
-- migration, which is not in this repository yet. This file only extends it.
-- Requires 20261121120000_offers_decisions.sql (private.is_offer_decider).
begin;

do $$
begin
  if to_regclass('public.rental_applications') is null then
    raise exception 'public.rental_applications is missing: commit and apply the final_workflows migration first';
  end if;
end $$;

alter table public.rental_applications
  add column if not exists decided_by uuid references public.profiles(id) on delete restrict,
  add column if not exists decided_at timestamptz;

-- Hard guarantee, even under concurrency: at most one accepted application per listing.
create unique index if not exists rental_applications_one_accepted_idx
  on public.rental_applications(property_id) where status = 'accepted';

-- Applications received by the caller (Seller: own listings, Agent: assigned
-- listings) with move-in date, notes, the buyer's display name and listing status.
create function public.rental_applications_received() returns table (
  id uuid, property_id uuid, property_title text, property_status text, property_price numeric,
  buyer_name text, move_in_date date, notes text, status text, decided_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select a.id, p.id, p.title, p.status, p.price,
         coalesce(b.full_name, b.username, 'Buyer'), a.move_in_date, a.notes, a.status, a.decided_at, a.created_at
  from public.rental_applications a
  join public.properties p on p.id = a.property_id
  join public.profiles b on b.id = a.buyer_id
  join public.profiles me on me.id = (select auth.uid())
  where (p.seller_id = me.id and me.role = 'seller') or (p.agent_id = me.id and me.role = 'agent')
  order by p.created_at desc, a.move_in_date, a.created_at
$$;
revoke all on function public.rental_applications_received() from public, anon;
grant execute on function public.rental_applications_received() to authenticated;

-- Transactional decision. The listing row is locked first, so two decisions on
-- the same listing run one after the other and the second sees the first.
create function public.decide_rental_application(p_application uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_property uuid; p public.properties; a public.rental_applications; rejected int := 0;
begin
  select property_id into v_property from public.rental_applications where id = p_application;
  if v_property is null then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  select * into p from public.properties where id = v_property for update;
  if not private.is_offer_decider(v_property) then
    raise exception 'Only the owner or the assigned agent can decide on this application' using errcode = '42501';
  end if;
  select * into a from public.rental_applications where id = p_application for update;
  if a.status <> 'pending' then
    raise exception 'This application is already %', a.status using errcode = '23514';
  end if;

  if not coalesce(p_accept, false) then
    update public.rental_applications set status = 'rejected', decided_by = auth.uid(), decided_at = now()
    where id = p_application;
    return jsonb_build_object('application', p_application, 'status', 'rejected', 'property_status', p.status);
  end if;

  if p.listing_type <> 'rent' then
    raise exception 'Only listings for rent take rental applications' using errcode = '23514';
  end if;
  if p.status <> 'active' then
    raise exception 'The listing is % - no other application can be accepted', p.status using errcode = '23514';
  end if;
  -- private.prevent_self_acceptance (trigger) refuses accepting one's own application.
  update public.rental_applications set status = 'accepted', decided_by = auth.uid(), decided_at = now()
  where id = p_application;
  update public.rental_applications set status = 'rejected', decided_by = auth.uid(), decided_at = now()
  where property_id = v_property and id <> p_application and status = 'pending';
  get diagnostics rejected = row_count;
  update public.properties set status = 'under_offer' where id = v_property;

  return jsonb_build_object('application', p_application, 'status', 'accepted',
                            'rejected_count', rejected, 'property_status', 'under_offer');
end $$;
revoke all on function public.decide_rental_application(uuid, boolean) from public, anon;
grant execute on function public.decide_rental_application(uuid, boolean) to authenticated;

-- Tenancy starts for the accepted applicant: under_offer -> rented.
create function public.start_tenancy(p_application uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_property uuid; p public.properties; a public.rental_applications;
begin
  select property_id into v_property from public.rental_applications where id = p_application;
  if v_property is null then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  select * into p from public.properties where id = v_property for update;
  if not private.is_offer_decider(v_property) then
    raise exception 'Only the owner or the assigned agent can manage this rental' using errcode = '42501';
  end if;
  select * into a from public.rental_applications where id = p_application;
  if a.status <> 'accepted' then
    raise exception 'Only the accepted application can start the tenancy' using errcode = '23514';
  end if;
  if p.status <> 'under_offer' then
    raise exception 'The listing is % - it must be Under Offer to be marked as rented', p.status using errcode = '23514';
  end if;
  update public.properties set status = 'rented' where id = v_property;
  return jsonb_build_object('application', p_application, 'property_status', 'rented');
end $$;
revoke all on function public.start_tenancy(uuid) from public, anon;
grant execute on function public.start_tenancy(uuid) to authenticated;

commit;
