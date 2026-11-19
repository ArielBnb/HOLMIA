// Enquiries in Supabase (supabase/migrations/20261122120000_enquiries.sql).
// Buyers ask about a published listing; the owner Seller or assigned Agent replies.
import { getSupabase } from '../config/supabase';
import { validateEnquiryText } from './enquiryRules';

function explain(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01') {
    return new Error('Enquiries are not set up yet: apply migration 20261122120000_enquiries.sql in Supabase.');
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

export async function sendEnquiry(propertyId, message) {
  const problem = validateEnquiryText(message);
  if (problem) throw new Error(problem);
  const { error } = await getSupabase().from('enquiries')
    .insert({ property_id: propertyId, message: message.trim() });
  if (error) throw explain(error);
}

export async function replyToEnquiry(enquiryId, reply) {
  const problem = validateEnquiryText(reply, 'Reply');
  if (problem) throw new Error(problem);
  const { data, error } = await getSupabase().rpc('reply_enquiry', { p_enquiry: enquiryId, p_reply: reply.trim() });
  if (error) throw explain(error);
  return data;
}
