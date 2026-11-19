-- Seller representation (direct or with an Agent) and real property messaging.
-- Requires 20261119120000_seller_edit_delete_rules.sql.
--
-- Who can talk to whom, per property (same rules as src/services/chatService.js):
--   with an Agent : Seller <-> Agent, Agent <-> Buyer
--   no Agent      : Seller <-> Buyer (direct)
-- Buyers can only start a conversation on a published (non-draft) listing.
begin;

-- 1. Sellers may read the list of Agents (id + display name only) to choose one.
--    profiles stays readable only by its owner; this exposes no email or role change.
create function public.list_agents() returns table (id uuid, full_name text, username text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.username
  from public.profiles p
  where p.role = 'agent' and (select auth.uid()) is not null
  order by coalesce(p.full_name, p.username)
$$;
revoke all on function public.list_agents() from public, anon;
grant execute on function public.list_agents() to authenticated;

-- 2. The representing Agent is frozen with the commercial terms once an offer is accepted.
create or replace function private.protect_property_terms() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.status in ('under_offer', 'sold', 'rented') and (
       new.price is distinct from old.price
    or new.listing_type is distinct from old.listing_type
    or new.property_type is distinct from old.property_type
    or new.agent_id is distinct from old.agent_id
  ) then
    raise exception 'Price, transaction type, property type and agent are locked once a property is %', old.status
      using errcode = '42501';
  end if;
  return new;
end $$;

-- 3. Messages. Deleted with their listing (only possible before Under Offer).
create table public.property_messages (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index property_messages_thread_idx on public.property_messages(property_id, sender_id, recipient_id, created_at);
create index property_messages_unread_idx on public.property_messages(recipient_id) where read_at is null;

create function private.can_message(p_property uuid, p_sender uuid, p_recipient uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.properties p
    join public.profiles s on s.id = p_sender
    join public.profiles r on r.id = p_recipient
    where p.id = p_property and p_sender <> p_recipient and (
      (p.agent_id is not null and (
           (p_sender in (p.seller_id, p.agent_id) and p_recipient in (p.seller_id, p.agent_id))
        or (p_sender = p.agent_id and r.role = 'buyer')
        or (p_recipient = p.agent_id and s.role = 'buyer' and p.status <> 'draft')
      ))
      or (p.agent_id is null and (
           (p_sender = p.seller_id and r.role = 'buyer')
        or (p_recipient = p.seller_id and s.role = 'buyer' and p.status <> 'draft')
      ))
    )
  )
$$;
revoke all on function private.can_message(uuid, uuid, uuid) from public;
grant execute on function private.can_message(uuid, uuid, uuid) to authenticated;

alter table public.property_messages enable row level security;
revoke all on public.property_messages from anon, authenticated;
grant select, insert on public.property_messages to authenticated;
grant update (read_at) on public.property_messages to authenticated;

create policy property_messages_read on public.property_messages for select to authenticated using (
  sender_id = (select auth.uid()) or recipient_id = (select auth.uid())
);
create policy property_messages_send on public.property_messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and private.can_message(property_id, sender_id, recipient_id)
);
-- Only the recipient marks a message as read (read_at is the only updatable column).
create policy property_messages_mark_read on public.property_messages for update to authenticated
using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

-- 4. Inbox: one row per (property, other participant), with display names the
--    caller could not read directly from profiles.
create function public.my_conversations() returns table (
  property_id uuid, property_title text, other_id uuid, other_name text, other_role text,
  last_body text, last_at timestamptz, unread integer
)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select m.property_id, m.body, m.created_at, m.recipient_id, m.read_at,
           case when m.sender_id = (select auth.uid()) then m.recipient_id else m.sender_id end as other_id
    from public.property_messages m
    where m.sender_id = (select auth.uid()) or m.recipient_id = (select auth.uid())
  ), latest as (
    select distinct on (property_id, other_id) property_id, other_id, body, created_at
    from mine order by property_id, other_id, created_at desc
  )
  select l.property_id, p.title, l.other_id,
         coalesce(pr.full_name, pr.username, 'User'), pr.role, l.body, l.created_at,
         (select count(*)::int from mine u
           where u.property_id = l.property_id and u.other_id = l.other_id
             and u.recipient_id = (select auth.uid()) and u.read_at is null)
  from latest l
  join public.properties p on p.id = l.property_id
  join public.profiles pr on pr.id = l.other_id
  order by l.created_at desc
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

comment on table public.property_messages is 'Property-scoped messages. Seller<->Agent and Agent<->Buyer with an Agent; Seller<->Buyer when direct.';
commit;
