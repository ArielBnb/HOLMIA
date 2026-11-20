// Enquiries in Supabase (supabase/migrations/20261122120000_enquiries.sql).
// Buyers ask about a published listing; the owner Seller or assigned Agent replies.
import { getSupabase } from '../config/supabase';
import { validateEnquiryText } from './enquiryRules';

function explain(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01') {
    return new Error('Enquiries are not set up yet: apply migration 20261122120000_enquiries.sql in Supabase.');
  }
  if (['PGRST301', 'PGRST303'].includes(error?.code)) {
    return new Error('Your session has expired. Please log in again.');
  }
  return new Error(error?.message || 'Something went wrong. Please try again.');
}

export async function getEnquiriesReceived() {
  const { data, error } = await getSupabase().rpc('enquiries_received');
  if (error) throw explain(error);
  return data ?? [];
}

export async function getMyEnquiries() {
  const { data, error } = await getSupabase().rpc('my_enquiries');
  if (error) throw explain(error);
  return data ?? [];
}

export async function sendEnquiry(propertyId, message, requestId) {
  const problem = validateEnquiryText(message, 'Question');
  if (problem) throw new Error(problem);

  const question = message.trim();
  const client = getSupabase();
  const { data, error } = await client.from('enquiries')
    .insert({ ...(requestId ? { id: requestId } : {}), property_id: propertyId, message: question })
    .select('id')
    .single();
  if (!error && data?.id) return data.id;

  // The same request ID confirms the original insert after an interrupted response.
  if (requestId && (error?.code === '23505' || error?.code === '42501')) {
    const { data: existing } = await client.from('enquiries').select('id')
      .eq('id', requestId).eq('property_id', propertyId).eq('message', question).maybeSingle();
    if (existing?.id === requestId) return requestId;
  }
  if (error?.code === '42501' || error?.code === '23503') {
    throw new Error('This listing cannot receive enquiries or your session has expired.');
  }
  if (!error?.code) throw new Error('Unable to confirm delivery. Check your connection and try again.');
  throw explain(error);
}

export async function replyToEnquiry(enquiryId, reply) {
  const problem = validateEnquiryText(reply, 'Reply');
  if (problem) throw new Error(problem);
  const { data, error } = await getSupabase().rpc('reply_enquiry', { p_enquiry: enquiryId, p_reply: reply.trim() });
  if (error) throw explain(error);
  return data;
}
