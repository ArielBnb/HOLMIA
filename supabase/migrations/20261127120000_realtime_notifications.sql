-- Instant in-app notifications for every role.
-- src/services/notificationService.js listens to these tables with Supabase
-- Realtime (postgres_changes) and also polls every 6 s as a fallback.
-- Realtime respects RLS: a user only receives changes on rows they may read
-- (their own messages, offers, applications, enquiries, favourites, listings).
-- Idempotent: a table already in the publication is skipped.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publication supabase_realtime not found: notifications keep working by polling.';
    return;
  end if;
  foreach t in array array['property_messages', 'offers', 'rental_applications', 'enquiries', 'properties', 'favourites'] loop
    if to_regclass('public.' || t) is not null and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
