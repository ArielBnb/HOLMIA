// Real property messaging backed by Supabase (public.property_messages).
// Access rules live in supabase/migrations/20261120120000_seller_agent_messaging.sql:
// with an Agent, Seller <-> Agent and Agent <-> Buyer; without, Seller <-> Buyer.
import { getSupabase } from '../config/supabase';

export const MESSAGE_MAX = 2000;
const fields = 'id,property_id,sender_id,recipient_id,body,created_at,read_at';

export async function listAgents() {
  const { data, error } = await getSupabase().rpc('list_agents');
  if (error) throw error;
  return data ?? [];
}

export async function getMyConversations() {
  const { data, error } = await getSupabase().rpc('my_conversations');
  if (error) throw error;
  return data ?? [];
}

// Both directions of one conversation, oldest first.
export async function getThread(propertyId, meId, otherId) {
  const { data, error } = await getSupabase().from('property_messages').select(fields)
    .eq('property_id', propertyId)
    .or(`and(sender_id.eq.${meId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${meId})`)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function sendPropertyMessage(propertyId, recipientId, body) {
  const text = String(body ?? '').trim();
  if (!text) throw new Error('Write a message first.');
  if (text.length > MESSAGE_MAX) throw new Error(`Messages are limited to ${MESSAGE_MAX} characters.`);
  const { data, error } = await getSupabase().from('property_messages')
    .insert({ property_id: propertyId, recipient_id: recipientId, body: text })
    .select(fields).single();
  if (error) {
    // RLS rejection: the pair is not allowed to talk about this listing.
    if (error.code === '42501') throw new Error('You cannot message this person about this listing.');
    throw error;
  }
  return data;
}

export async function markThreadRead(propertyId, meId, otherId) {
  const { error } = await getSupabase().from('property_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('property_id', propertyId).eq('sender_id', otherId).eq('recipient_id', meId)
    .is('read_at', null);
  if (error) throw error;
}
