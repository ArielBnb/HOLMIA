import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getSupabase, isSupabaseConfigured, watchAuthRefresh } from '../config/supabase';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [state, setState] = useState({ session: null, profile: null, loading: isSupabaseConfigured, error: '' });
  const generation = useRef(0);
  const loadSession = useCallback(async (session) => {
    const ticket = ++generation.current;
    if (!session) { setState({ session: null, profile: null, loading: false, error: '' }); return; }
    setState({ session, profile: null, loading: true, error: '' });
    try {
      const client = getSupabase();
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user || user.id !== session.user.id) throw new Error('Session expired. Please log in again.');
      const { data, error } = await client.from('profiles').select('id,username,full_name,role,requested_role').eq('id', user.id).single();
      if (error || !data || !['buyer', 'seller', 'agent'].includes(data.role)) throw new Error('Unable to load your profile.');
      if (ticket === generation.current) setState({ session, profile: data, loading: false, error: '' });
    } catch (failure) {
      if (ticket === generation.current) setState({ session, profile: null, loading: false, error: failure.message });
    }
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const client = getSupabase();
    // Defer work outside the synchronous auth callback to avoid the SDK's session lock.
    let disposed = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => { if (!disposed) void loadSession(session); }, 0);
    });
    const stopRefresh = watchAuthRefresh();
    const version = generation.current;
    client.auth.getSession().then(({ data, error }) => {
      if (!disposed && version === generation.current) {
        if (error) setState({ session: null, profile: null, loading: false, error: error.message });
        else void loadSession(data.session);
      }
    }).catch(() => { if (!disposed) setState({ session: null, profile: null, loading: false, error: 'Unable to restore session.' }); });
    const invalidate = () => { ++generation.current; };
    return () => { disposed = true; invalidate(); subscription.unsubscribe(); stopRefresh(); };
  }, [loadSession]);
  const signOut = useCallback(async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
    await loadSession(null);
  }, [loadSession]);
  return <AuthContext.Provider value={{ ...state, signOut, retry: () => loadSession(state.session) }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
