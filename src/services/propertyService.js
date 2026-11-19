import { getSupabase } from '../config/supabase';

const fields = 'id,seller_id,agent_id,title,description,price,listing_type,property_type,location,image_url,status,created_at,updated_at';

export async function getProperties({ activeOnly = true, limit = 50 } = {}) {
  let query = getSupabase().from('properties').select(fields)
    .order('created_at', { ascending: false }).limit(Math.min(100, Math.max(1, limit)));
  if (activeOnly) query = query.eq('status', 'active');
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// RLS returns only the signed-in Seller's own rows, drafts included.
export async function getSellerProperties(sellerId, { limit = 20 } = {}) {
  const { data, error } = await getSupabase().from('properties').select(fields)
    .eq('seller_id', sellerId).order('created_at', { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw error;
  return data;
}

export async function createProperty(property) {
  const { data, error } = await getSupabase().from('properties').insert(property).select(fields).single();
  if (error) throw error;
  return data;
}

// RLS hides other Sellers' rows, so "0 rows" means not found or not yours.
export async function updateOwnProperty(id, changes) {
  const { data, error } = await getSupabase().from('properties').update(changes).eq('id', id).select(fields);
  if (error) throw error;
  if (!data.length) throw new Error('Listing not found, or you are not its owner.');
  return data[0];
}

export async function deleteOwnProperty(id) {
  const { data, error } = await getSupabase().from('properties').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data.length) throw new Error('Listing not found, or you are not its owner.');
  return data[0].id;
}

export async function updateProperty(id, changes) {
  const { data, error } = await getSupabase().from('properties').update(changes).eq('id', id).select(fields).single();
  if (error) throw error;
  return data;
}
