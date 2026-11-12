begin;
create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  username text unique check (username is null or char_length(btrim(username)) between 3 and 40),
  full_name text check (full_name is null or char_length(btrim(full_name)) between 1 and 120),
  role text not null default 'buyer' check (role in ('buyer','seller','agent')),
  created_at timestamptz not null default now()
);
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  agent_id uuid references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  description text not null default '' check (char_length(description) <= 10000),
  price numeric(14,2) not null check (price > 0 and price < 1000000000000),
  listing_type text not null check (listing_type in ('sale','rent')),
  property_type text not null check (char_length(btrim(property_type)) between 2 and 40),
  location text not null check (char_length(btrim(location)) between 2 and 200),
  image_url text check (image_url is null or image_url ~ '^https://[^[:space:]]+$'),
  status text not null default 'draft' check (status in ('draft','active','under_offer','sold','rented')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (agent_id is null or agent_id <> seller_id),
  check (not (listing_type = 'sale' and status = 'rented')),
  check (not (listing_type = 'rent' and status = 'sold'))
);
create index properties_seller_idx on public.properties(seller_id);
create index properties_agent_idx on public.properties(agent_id) where agent_id is not null;
create index properties_catalogue_idx on public.properties(status, listing_type, created_at desc);
create index properties_location_idx on public.properties(location);

create function private.current_profile_role() returns text
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;
grant usage on schema private to authenticated;
revoke all on function private.current_profile_role() from public;
grant execute on function private.current_profile_role() to authenticated;

-- Never trust signup metadata for authorization. Every new account starts as buyer.
create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  return new;
end $$;
revoke all on function private.create_profile() from public;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.create_profile();

create function private.validate_property() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.seller_id and role = 'seller') then
    raise exception 'seller_id must reference a Seller' using errcode = '23514';
  end if;
  if new.agent_id is not null and not exists (select 1 from public.profiles where id = new.agent_id and role = 'agent') then
    raise exception 'agent_id must reference an Agent' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.seller_id is distinct from old.seller_id or new.created_at is distinct from old.created_at then
      raise exception 'Property identity and ownership are immutable' using errcode = '42501';
    end if;
    if auth.uid() is not null and private.current_profile_role() = 'agent' and new.agent_id is distinct from old.agent_id then
      raise exception 'Agents cannot reassign properties' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.validate_property() from public;
create trigger validate_property before insert or update on public.properties
for each row execute function private.validate_property();

-- Prevent changing a role while existing property assignments depend on it.
create function private.protect_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Profile identity is immutable' using errcode = '42501';
  end if;
  if new.role is distinct from old.role then
    if auth.uid() is not null then
      raise exception 'Only trusted administration can assign roles' using errcode = '42501';
    end if;
    if exists (select 1 from public.properties where seller_id = old.id or agent_id = old.id) then
      raise exception 'Reassign properties before changing this role' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.protect_profile() from public;
create trigger protect_profile before update on public.profiles
for each row execute function private.protect_profile();

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
revoke all on public.profiles, public.properties from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, full_name) on public.profiles to authenticated;
grant select on public.properties to anon, authenticated;
grant insert, update, delete on public.properties to authenticated;
create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Public catalogue supports the pre-login connection screen. Non-active rows stay private.
create policy properties_public_active on public.properties for select to anon, authenticated using (status = 'active');
create policy properties_manage_read on public.properties for select to authenticated using (
  (seller_id = (select auth.uid()) and (select private.current_profile_role()) = 'seller') or
  (agent_id = (select auth.uid()) and (select private.current_profile_role()) = 'agent')
);
create policy properties_seller_insert on public.properties for insert to authenticated with check (
  seller_id = (select auth.uid()) and (select private.current_profile_role()) = 'seller'
);
create policy properties_update_assigned on public.properties for update to authenticated using (
  (seller_id = (select auth.uid()) and (select private.current_profile_role()) = 'seller') or
  (agent_id = (select auth.uid()) and (select private.current_profile_role()) = 'agent')
) with check (
  (seller_id = (select auth.uid()) and (select private.current_profile_role()) = 'seller') or
  (agent_id = (select auth.uid()) and (select private.current_profile_role()) = 'agent')
);
create policy properties_delete_assigned on public.properties for delete to authenticated using (
  (seller_id = (select auth.uid()) and (select private.current_profile_role()) = 'seller') or
  (agent_id = (select auth.uid()) and (select private.current_profile_role()) = 'agent')
);
comment on table public.profiles is 'Auth identity only; role assigned by trusted administration. Future offers/favourites reference this UUID.';
comment on table public.properties is 'Canonical listing UUID for future offers, rental applications, favourites, enquiries and status history.';
commit;
