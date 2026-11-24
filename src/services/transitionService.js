// Status-change service and history (supabase/migrations/20261124130000_property_transitions.sql).
// Uses server-side RPCs when the migration is applied, and falls back gracefully
// to direct RLS-protected `properties` updates + local audit log if the RPC is not deployed yet.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../config/supabase';
import { transitionError } from './transitionRules';

const fields = 'id,seller_id,agent_id,title,price,listing_type,property_type,location,status,created_at,updated_at';
const HISTORY_KEY = '@holmia_status_history_v1';

async function readLocalHistory() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function appendLocalHistory(propertyId, entry) {
  const map = await readLocalHistory();
  const list = Array.isArray(map[propertyId]) ? map[propertyId] : [];
  map[propertyId] = [entry, ...list];
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

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
  const client = getSupabase();
  const { data, error } = await client.rpc('change_property_status', {
    p_property: propertyId, p_status: status, p_note: note?.trim() || null,
  });

  if (!error) return data;

  // Graceful fallback when migration 20261124130000_property_transitions.sql is not yet applied in Supabase
  if (error.code === 'PGRST202') {
    const { data: current, error: fetchErr } = await client
      .from('properties')
      .select(fields)
      .eq('id', propertyId)
      .single();
    if (fetchErr || !current) throw new Error('Listing not found, or you are not allowed to change it.');

    const problem = transitionError(current.status, status, current.listing_type);
    if (problem) throw new Error(problem);

    const { data: updated, error: updErr } = await client
      .from('properties')
      .update({ status })
      .eq('id', propertyId)
      .select(fields);
    if (updErr) throw new Error(updErr.message || 'Unable to update status.');
    if (!updated?.length) throw new Error('Listing not found, or you are not allowed to change it.');

    let actorName = 'Assigned user';
    let actorRole = 'agent';
    try {
      const { data: authData } = await client.auth.getUser();
      if (authData?.user?.id) {
        const { data: prof } = await client
          .from('profiles')
          .select('full_name,username,role')
          .eq('id', authData.user.id)
          .maybeSingle();
        if (prof) {
          actorName = prof.full_name || prof.username || actorName;
          actorRole = prof.role || actorRole;
        }
      }
    } catch {
      // keep defaults
    }

    await appendLocalHistory(propertyId, {
      id: `local-h-${Date.now()}`,
      property_id: propertyId,
      old_status: current.status,
      new_status: status,
      changed_by_name: actorName,
      changed_by_role: actorRole,
      notes: note?.trim() || null,
      changed_at: new Date().toISOString(),
    });

    return { property: updated[0], released_deals: 0 };
  }

  throw explain(error);
}

export async function getPropertyHistory(propertyId) {
  const client = getSupabase();
  const { data, error } = await client.rpc('property_history', { p_property: propertyId });
  if (!error) return data ?? [];

  if (error.code === 'PGRST202') {
    const map = await readLocalHistory();
    const localEntries = Array.isArray(map[propertyId]) ? map[propertyId] : [];
    if (localEntries.length > 0) return localEntries;

    // Synthesize initial creation entry from the live property row
    const { data: prop } = await client
      .from('properties')
      .select('id,status,created_at,updated_at')
      .eq('id', propertyId)
      .maybeSingle();
    if (!prop) return [];
    return [
      {
        id: `init-${prop.id}`,
        property_id: prop.id,
        old_status: null,
        new_status: prop.status,
        changed_by_name: 'HOLMIA',
        changed_by_role: null,
        notes: 'Current listing status',
        changed_at: prop.updated_at || prop.created_at,
      },
    ];
  }

  throw explain(error);
}
