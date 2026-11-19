-- Real-Time Messaging & Enquiries Table for HOLMIA
-- Run this in Supabase Dashboard > SQL Editor to enable live multi-device chat.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  property_id text not null,
  property_title text not null default '',
  sender_role text not null check (sender_role in ('agent', 'seller', 'buyer', 'admin')),
  sender_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);

-- Indices for rapid conversation queries
create index if not exists idx_messages_conv on public.messages(conversation_id, created_at asc);
create index if not exists idx_messages_prop on public.messages(property_id);

-- Row Level Security (RLS)
alter table public.messages enable row level security;
grant select, insert on public.messages to anon, authenticated;

drop policy if exists "Allow read messages" on public.messages;
create policy "Allow read messages" on public.messages
  for select to anon, authenticated using (true);

drop policy if exists "Allow insert messages" on public.messages;
create policy "Allow insert messages" on public.messages
  for insert to anon, authenticated with check (true);

-- Enable Supabase Realtime broadcast for multi-device sync
alter publication supabase_realtime add table public.messages;

