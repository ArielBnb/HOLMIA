begin;

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  buyer_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  message text not null check (char_length(message) <= 2000 and message ~ '[^[:space:]]'),
  reply text check (char_length(reply) <= 2000 and reply ~ '[^[:space:]]'),
  status text not null default 'new' check (status in ('new', 'answered')),
  created_at timestamptz not null default now(),
  replied_at timestamptz,
  check (
    (status = 'new' and reply is null and replied_at is null) or
    (status = 'answered' and reply is not null and replied_at is not null)
  )
);

create index enquiries_property_idx on public.enquiries(property_id, created_at desc);
create index enquiries_buyer_idx on public.enquiries(buyer_id, created_at desc);

-- Use the listing's current ownership and assignment, including archived listings.
create function private.can_answer_enquiry(p_property_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.properties p
    where p.id = p_property_id and (
      (p.seller_id = (select auth.uid()) and (select private.current_profile_role()) = 'seller')
      or (p.agent_id = (select auth.uid()) and (select private.current_profile_role()) = 'agent')
    )
  )
$$;
revoke all on function private.can_answer_enquiry(uuid) from public, anon;
grant execute on function private.can_answer_enquiry(uuid) to authenticated;

alter table public.enquiries enable row level security;
revoke all on public.enquiries from public, anon, authenticated;
grant select on public.enquiries to authenticated;
grant insert (id, property_id, message) on public.enquiries to authenticated;
grant update (reply) on public.enquiries to authenticated;

create policy enquiries_read on public.enquiries for select to authenticated using (
  buyer_id = (select auth.uid()) or private.can_answer_enquiry(property_id)
);
create policy enquiries_buyer_insert on public.enquiries for insert to authenticated with check (
  buyer_id = (select auth.uid())
  and (select private.current_profile_role()) = 'buyer'
  and exists (
    select 1 from public.properties p where p.id = property_id and p.status = 'active'
  )
);
create policy enquiries_recipient_reply on public.enquiries for update to authenticated
using (status = 'new' and private.can_answer_enquiry(property_id))
with check (status = 'answered' and private.can_answer_enquiry(property_id));

create function private.record_enquiry_reply() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.reply is null or new.reply !~ '[^[:space:]]' then
    raise exception 'A reply is required' using errcode = '23514';
  end if;
  new.status := 'answered';
  new.replied_at := now();
  return new;
end;
$$;
revoke all on function private.record_enquiry_reply() from public, anon, authenticated;
create trigger record_enquiry_reply before update of reply on public.enquiries
for each row execute function private.record_enquiry_reply();

-- Profiles are private. Return a display name only for an enquiry the caller may read.
-- Keep the privileged implementation outside the API schemas.
create function private.list_property_enquiries(p_offset integer, p_limit integer)
returns table (
  id uuid, property_title text, buyer_name text, message text, reply text,
  status text, created_at timestamptz, replied_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select e.id, p.title, coalesce(b.full_name, b.username, 'Buyer'),
         e.message, e.reply, e.status, e.created_at, e.replied_at
  from public.enquiries e
  join public.properties p on p.id = e.property_id
  join public.profiles b on b.id = e.buyer_id
  where e.buyer_id = (select auth.uid()) or private.can_answer_enquiry(e.property_id)
  order by e.created_at desc, e.id desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 50)
$$;
revoke all on function private.list_property_enquiries(integer, integer) from public, anon;
grant execute on function private.list_property_enquiries(integer, integer) to authenticated;

create function public.list_property_enquiries(p_offset integer, p_limit integer)
returns table (
  id uuid, property_title text, buyer_name text, message text, reply text,
  status text, created_at timestamptz, replied_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select * from private.list_property_enquiries(p_offset, p_limit)
$$;
revoke all on function public.list_property_enquiries(integer, integer) from public, anon;
grant execute on function public.list_property_enquiries(integer, integer) to authenticated;

commit;
