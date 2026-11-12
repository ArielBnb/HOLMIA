import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const isSupabaseConfigured = Boolean(url && key);
// A missing .env keeps the welcome screen usable and displays a setup message.
export const supabase = isSupabaseConfigured ? createClient(url, key, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
}) : null;

export function getSupabase() {
  if (!supabase) throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans .env.');
  return supabase;
}

// App owns the subscription so Fast Refresh / unmount can clean it up.
export function watchAuthRefresh() {
  if (!supabase || Platform.OS === 'web') return () => {};
  const refresh = (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  };
  refresh(AppState.currentState);
  const subscription = AppState.addEventListener('change', refresh);
  return () => { subscription.remove(); supabase.auth.stopAutoRefresh(); };
}
