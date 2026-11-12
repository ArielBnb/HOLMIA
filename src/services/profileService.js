import { getSupabase } from '../config/supabase';

export async function getMyProfile() {
  const client = getSupabase();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) return null;
  const { data, error } = await client.from('profiles').select('id,username,full_name,role,created_at').eq('id', user.id).single();
  if (error) throw error;
  return data;
}

export async function updateMyProfile({ username, full_name }) {
  const client = getSupabase();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Connexion requise.');
  const changes = {};
  if (username !== undefined) changes.username = username;
  if (full_name !== undefined) changes.full_name = full_name;
  const { data, error } = await client.from('profiles').update(changes).eq('id', user.id).select().single();
  if (error) throw error;
  return data;
}
