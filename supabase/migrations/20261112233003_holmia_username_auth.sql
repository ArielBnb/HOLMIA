-- Mission 3: preserve existing roles/RLS and record requests without granting them.
alter table public.profiles add column requested_role text not null default 'buyer'
  check (requested_role in ('buyer','seller','agent'));
update public.profiles set requested_role = role;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,40}$');
create unique index profiles_username_normalized_key on public.profiles (lower(btrim(username)));

create or replace function private.create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  username_value text := lower(btrim(new.raw_user_meta_data ->> 'username'));
  full_name_value text := btrim(new.raw_user_meta_data ->> 'full_name');
  request_value text := coalesce(new.raw_user_meta_data ->> 'requested_role', 'buyer');
begin
  if nullif(new.email, '') is null then raise exception 'Email is required'; end if;
  if username_value is null or username_value !~ '^[a-z0-9_]{3,40}$' then raise exception 'Invalid username'; end if;
  if full_name_value is null or char_length(full_name_value) not between 1 and 120 then raise exception 'Invalid full name'; end if;
  if request_value not in ('buyer','seller','agent') then raise exception 'Invalid requested role'; end if;
  -- Never trust metadata.role or metadata.requested_role for authorization.
  insert into public.profiles(id, username, full_name, role, requested_role)
    values(new.id, username_value, full_name_value, 'buyer', request_value);
  return new;
end $$;
revoke all on function private.create_profile() from public, anon, authenticated;

create or replace function private.protect_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Profile identity is immutable' using errcode = '42501';
  end if;
  if new.requested_role is distinct from old.requested_role and auth.uid() is not null then
    raise exception 'Role requests are managed by trusted administration' using errcode = '42501';
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
revoke all on function private.protect_profile() from public, anon, authenticated;
grant select(requested_role) on public.profiles to authenticated;
-- UPDATE remains limited to username/full_name by existing column grants.

create table private.login_attempts (
  key text primary key,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0)
);
alter table private.login_attempts enable row level security;
revoke all on private.login_attempts from public, anon, authenticated;

-- Deliberately service-only: never expose username-to-email resolution to clients.
create function public.holmia_login_target(username_input text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_window timestamptz := date_trunc('minute', clock_timestamp());
  global_count integer;
  user_count integer;
  target_email text;
begin
  if username_input !~ '^[a-z0-9_]{3,40}$' or username_input is null then
    return jsonb_build_object('allowed', false);
  end if;
  delete from private.login_attempts where window_start < current_window - interval '2 minutes';
  insert into private.login_attempts as a(key,window_start,attempts) values('global',current_window,1)
    on conflict(key) do update set window_start = excluded.window_start,
      attempts = case when a.window_start = excluded.window_start then a.attempts + 1 else 1 end
    returning attempts into global_count;
  if global_count > 60 then return jsonb_build_object('allowed',false); end if;
  insert into private.login_attempts as a(key,window_start,attempts) values('user:' || md5(username_input),current_window,1)
    on conflict(key) do update set window_start = excluded.window_start,
      attempts = case when a.window_start = excluded.window_start then a.attempts + 1 else 1 end
    returning attempts into user_count;
  if user_count > 5 then return jsonb_build_object('allowed',false); end if;
  select u.email into target_email from public.profiles p join auth.users u on u.id = p.id
    where lower(btrim(p.username)) = username_input and u.deleted_at is null;
  return jsonb_build_object('allowed',true,'email',target_email);
end $$;
revoke all on function public.holmia_login_target(text) from public, anon, authenticated;
grant execute on function public.holmia_login_target(text) to service_role;
comment on function public.holmia_login_target(text) is 'Private identity lookup and rate gate. Only service_role, never anon/authenticated. Called by username-login.';
