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

export async function createProperty(property) {
  const { data, error } = await getSupabase().from('properties').insert(property).select(fields).single();
  if (error) throw error;
  return data;
}

export async function updateProperty(id, changes) {
  const { data, error } = await getSupabase().from('properties').update(changes).eq('id', id).select(fields).single();
  if (error) throw error;
  return data;
}
