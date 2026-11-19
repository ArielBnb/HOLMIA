-- Seller edit & delete rules (mission: edit and delete own listings).
-- Mirrors src/repositories/propertyRepository.ts and src/services/propertyEditRules.js.
-- Ownership is already enforced by RLS (another Seller sees and changes 0 rows).
-- Trusted administration (no auth.uid(): SQL Editor, service role) keeps the
-- ability to correct data, like private.protect_profile().
begin;

-- 1. Commercial terms are frozen once an offer is accepted.
create function private.protect_property_terms() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.status in ('under_offer', 'sold', 'rented') and (
       new.price is distinct from old.price
    or new.listing_type is distinct from old.listing_type
    or new.property_type is distinct from old.property_type
  ) then
    raise exception 'Price, transaction type and property type are locked once a property is %', old.status
      using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.protect_property_terms() from public;
create trigger protect_property_terms before update on public.properties
for each row execute function private.protect_property_terms();

-- 2. A property with an accepted offer or a completed transaction keeps its
--    record, so future offers, rental applications and history stay consistent.
create function private.protect_property_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return old;
  end if;
  if old.status in ('under_offer', 'sold', 'rented') then
    raise exception 'A property that is % cannot be deleted', old.status
      using errcode = '42501';
  end if;
  return old;
end $$;
revoke all on function private.protect_property_delete() from public;
create trigger protect_property_delete before delete on public.properties
for each row execute function private.protect_property_delete();

-- 3. Deletion is reserved to the owning Seller; assigned Agents can edit but not delete.
drop policy properties_delete_assigned on public.properties;
create policy properties_seller_delete on public.properties for delete to authenticated using (
  seller_id = (select auth.uid()) and (select private.current_profile_role()) = 'seller'
);

commit;
