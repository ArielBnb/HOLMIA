// Status-change service and history (supabase/migrations/20261124130000_property_transitions.sql).
// The database validates every transition; the app only shows its explicit error.
import { getSupabase } from '../config/supabase';

const fields = 'id,seller_id,agent_id,title,price,listing_type,property_type,location,status,created_at,updated_at';

function explain(error) {
  if (error?.code === 'PGRST202') {
    return new Error('Status changes are not set up yet: apply migration 20261124130000_property_transitions.sql in Supabase.');
  }
  return new Error(error?.message || 'Something went wrong. Please try again.');
}

// Seller: own listings. Agent: assigned listings. (RLS returns exactly these rows.)
export async function getManagedProperties(profile) {
  const column = profile?.role === 'agent' ? 'agent_id' : 'seller_id';
  const { data, error } = await getSupabase().from('properties').select(fields)
    .eq(column, profile.id).order('created_at', { ascending: false }).limit(100);
  if (error) throw explain(error);
  return data ?? [];
}

export async function changePropertyStatus(propertyId, status, note) {
  const { data, error } = await getSupabase().rpc('change_property_status', {
    p_property: propertyId, p_status: status, p_note: note?.trim() || null,
  });
  if (error) throw explain(error);
  return data;
}

export async function getPropertyHistory(propertyId) {
  const { data, error } = await getSupabase().rpc('property_history', { p_property: propertyId });
  if (error) throw explain(error);
  return data ?? [];
}
