-- Bridge the deployed enquiries table to the Seller/Agent and Buyer screens.
-- Requires 20261119121911_property_enquiries.sql.
begin;

alter table public.enquiries
  add column replied_by uuid references public.profiles(id) on delete restrict,
  add constraint enquiries_replier_requires_response check (replied_by is null or status = 'answered');

create index enquiries_pending_idx on public.enquiries(property_id) where reply is null;

-- Use the checked RPC for new replies and corrections. The existing trigger
-- still sets status and replied_at from the stored reply.
revoke update (reply) on public.enquiries from authenticated;
alter policy enquiries_recipient_reply on public.enquiries using (false) with check (false);

-- Seller (own listings) / Agent (assigned listings): enquiries received.
create function public.enquiries_received() returns table (
  id uuid, property_id uuid, property_title text, buyer_name text, message text,
  reply text, replied_by_name text, replied_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select e.id, p.id, p.title, coalesce(b.full_name, b.username, 'Buyer'), e.message,
         e.reply, coalesce(r.full_name, r.username), e.replied_at, e.created_at
  from public.enquiries e
  join public.properties p on p.id = e.property_id
  join public.profiles b on b.id = e.buyer_id
  left join public.profiles r on r.id = e.replied_by
  join public.profiles me on me.id = (select auth.uid())
  where (p.seller_id = me.id and me.role = 'seller') or (p.agent_id = me.id and me.role = 'agent')
  order by (e.reply is null) desc, e.created_at desc
$$;
revoke all on function public.enquiries_received() from public, anon;
grant execute on function public.enquiries_received() to authenticated;

-- Buyer: own enquiries with the reply and who answered.
create function public.my_enquiries() returns table (
  id uuid, property_id uuid, property_title text, message text,
  reply text, replied_by_name text, replied_by_role text, replied_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select e.id, p.id, p.title, e.message, e.reply,
         coalesce(r.full_name, r.username), r.role, e.replied_at, e.created_at
  from public.enquiries e
  join public.properties p on p.id = e.property_id
  left join public.profiles r on r.id = e.replied_by
  where e.buyer_id = (select auth.uid())
  order by e.created_at desc
$$;
revoke all on function public.my_enquiries() from public, anon;
grant execute on function public.my_enquiries() to authenticated;

-- Reply (or correct a reply). Only the owner Seller or the assigned Agent.
create function public.reply_enquiry(p_enquiry uuid, p_reply text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_property uuid; v_text text := btrim(coalesce(p_reply, ''));
begin
  select p.id into v_property
  from public.enquiries e
  join public.properties p on p.id = e.property_id
  where e.id = p_enquiry and private.can_answer_enquiry(e.property_id)
  for share of p;
  if v_property is null or not private.can_answer_enquiry(v_property) then
    raise exception 'Only the owner or the assigned agent can reply to this enquiry' using errcode = '42501';
  end if;
  if char_length(v_text) not between 1 and 2000 or v_text !~ '[^[:space:]]' then
    raise exception 'A reply must be between 1 and 2000 characters' using errcode = '23514';
  end if;
  update public.enquiries set reply = v_text, replied_by = auth.uid()
  where id = p_enquiry;
  if not found then
    raise exception 'Enquiry is no longer available' using errcode = 'P0002';
  end if;
  return jsonb_build_object('enquiry', p_enquiry, 'status', 'handled');
end $$;
revoke all on function public.reply_enquiry(uuid, text) from public, anon;
grant execute on function public.reply_enquiry(uuid, text) to authenticated;

comment on table public.enquiries is 'Buyer enquiries. Pending until the owner Seller or assigned Agent replies via reply_enquiry.';
commit;
