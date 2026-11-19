import { getSupabase } from '../config/supabase';
import { normalizeUsername, validateRegistration } from './authValidation';

export async function loginUser(identifier, password) {
  const trimmed = (identifier || '').trim();
  if (!trimmed) throw new Error('Enter your username or email.');
  if (!password) throw new Error('Enter your password.');

  const client = getSupabase();

  // If input contains @, use direct Supabase email authentication
  if (trimmed.includes('@')) {
    const { data, error } = await client.auth.signInWithPassword({
      email: trimmed.toLowerCase(),
      password,
    });
    if (error) throw new Error(error.message || 'Invalid email or password.');
    return data;
  }

  // Otherwise, use username login
  return loginWithUsername(trimmed, password);
}

export async function loginWithUsername(username, password) {
  const client = getSupabase();
  const { data, error } = await client.functions.invoke('username-login', {
    body: { username: normalizeUsername(username), password },
  });
  if (error || !data?.access_token || !data?.refresh_token) {
    throw new Error('Unable to log in with these credentials. Please try again shortly.');
  }
  const { data: result, error: sessionError } = await client.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionError) throw sessionError;
  return result;
}

export async function registerAccount({ fullName, username, password, role, email }) {
  const validation = validateRegistration({ fullName, username, password, confirmPassword: password, role });
  if (validation) throw new Error(validation);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email address.');
  const { data, error } = await getSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: { data: {
      full_name: fullName.trim(),
      username: normalizeUsername(username),
      requested_role: role,
    } },
  });
  if (error) throw error;
  return data;
}

// Used by SellerPropertyFormScreen (seller edit & delete).
export async function signInWithEmail(email, password) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}
