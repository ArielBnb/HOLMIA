-- Purchase offers and the transactional accept / reject service.
-- Mirrors OfferRepository.acceptOffer (src/repositories/offerRepository.ts):
-- accepting one offer rejects the other pending offers and moves the listing to
-- under_offer, all in one transaction. Only the owning Seller or the assigned
-- Agent decides. Requires 20261120120000_seller_agent_messaging.sql.
begin;

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  buyer_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0 and amount < 1000000000000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pending') = (decided_at is null))
);
create index offers_property_idx on public.offers(property_id, created_at desc);
create index offers_buyer_idx on public.offers(buyer_id);
-- Hard guarantee, even under concurrency: at most one accepted offer per listing.
create unique index offers_one_accepted_idx on public.offers(property_id) where status = 'accepted';

-- Owning Seller or assigned Agent of a listing (the only people who decide).
create function private.is_offer_decider(p_property uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.properties p join public.profiles me on me.id = (select auth.uid())
    where p.id = p_property and (
      (p.seller_id = me.id and me.role = 'seller') or (p.agent_id = me.id and me.role = 'agent')
    )
  )
$$;
revoke all on function private.is_offer_decider(uuid) from public;
grant execute on function private.is_offer_decider(uuid) to authenticated;

-- New offers: a Buyer, on an active listing for sale, always pending.
create function private.validate_offer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.buyer_id and role = 'buyer') then
    raise exception 'Only Buyers can submit offers' using errcode = '42501';
  end if;
  if not exists (select 1 from public.properties where id = new.property_id and listing_type = 'sale' and status = 'active') then
    raise exception 'Offers are only accepted on active listings for sale' using errcode = '23514';
  end if;
  new.status := 'pending';
  new.decided_by := null;
  new.decided_at := null;
  return new;
end $$;
revoke all on function private.validate_offer() from public;
create trigger validate_offer before insert on public.offers
for each row execute function private.validate_offer();

alter table public.offers enable row level security;
revoke all on public.offers from anon, authenticated;
-- No direct UPDATE/DELETE: decisions go through accept_offer / reject_offer only.
grant select, insert on public.offers to authenticated;
create policy offers_read on public.offers for select to authenticated using (
  buyer_id = (select auth.uid()) or private.is_offer_decider(property_id)
);
create policy offers_buyer_insert on public.offers for insert to authenticated with check (
  buyer_id = (select auth.uid()) and (select private.current_profile_role()) = 'buyer'
);

-- Offers received by the caller (Seller: own listings, Agent: assigned listings),
-- with the buyer's display name and the listing status.
create function public.offers_received() returns table (
  id uuid, property_id uuid, property_title text, property_status text, property_price numeric,
  buyer_name text, amount numeric, status text, decided_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select o.id, p.id, p.title, p.status, p.price,
         coalesce(b.full_name, b.username, 'Buyer'), o.amount, o.status, o.decided_at, o.created_at
  from public.offers o
  join public.properties p on p.id = o.property_id
  join public.profiles b on b.id = o.buyer_id
  join public.profiles me on me.id = (select auth.uid())
  where (p.seller_id = me.id and me.role = 'seller') or (p.agent_id = me.id and me.role = 'agent')
  order by p.created_at desc, o.created_at desc
$$;
revoke all on function public.offers_received() from public, anon;
grant execute on function public.offers_received() to authenticated;

-- Transactional acceptance. The listing row is locked first, so two decisions on
-- the same listing run one after the other and the second sees the first.
create function public.accept_offer(p_offer uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_property uuid; p public.properties; o public.offers; rejected int;
begin
  select property_id into v_property from public.offers where id = p_offer;
  if v_property is null then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  select * into p from public.properties where id = v_property for update;
  if not private.is_offer_decider(v_property) then
    raise exception 'Only the owner or the assigned agent can decide on this offer' using errcode = '42501';
  end if;
  select * into o from public.offers where id = p_offer for update;
  if o.status <> 'pending' then
    raise exception 'This offer is already %', o.status using errcode = '23514';
  end if;
  if p.status <> 'active' then
    raise exception 'The listing is % - no other offer can be accepted', p.status using errcode = '23514';
  end if;

  update public.offers set status = 'accepted', decided_by = auth.uid(), decided_at = now(), updated_at = now()
  where id = p_offer;
  update public.offers set status = 'rejected', decided_by = auth.uid(), decided_at = now(), updated_at = now()
  where property_id = v_property and id <> p_offer and status = 'pending';
  get diagnostics rejected = row_count;
  update public.properties set status = 'under_offer' where id = v_property;

  return jsonb_build_object('accepted_offer', p_offer, 'rejected_count', rejected, 'property_status', 'under_offer');
end $$;
revoke all on function public.accept_offer(uuid) from public, anon;
grant execute on function public.accept_offer(uuid) to authenticated;

create function public.reject_offer(p_offer uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_property uuid; o public.offers;
begin
  select property_id into v_property from public.offers where id = p_offer;
  if v_property is null then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  perform 1 from public.properties where id = v_property for update;
  if not private.is_offer_decider(v_property) then
    raise exception 'Only the owner or the assigned agent can decide on this offer' using errcode = '42501';
  end if;
  select * into o from public.offers where id = p_offer for update;
  if o.status <> 'pending' then
    raise exception 'This offer is already %', o.status using errcode = '23514';
  end if;
  update public.offers set status = 'rejected', decided_by = auth.uid(), decided_at = now(), updated_at = now()
  where id = p_offer;
  return jsonb_build_object('rejected_offer', p_offer);
end $$;
revoke all on function public.reject_offer(uuid) from public, anon;
grant execute on function public.reject_offer(uuid) to authenticated;

comment on table public.offers is 'Purchase offers. Decisions only via accept_offer / reject_offer (owner Seller or assigned Agent).';
commit;
