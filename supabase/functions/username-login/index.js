/* global Deno */
// This pre-session endpoint authenticates the username/password in its body.
// A user JWT cannot be required before login. Never return the target email.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const started = Date.now();
  const denied = async (status = 401) => {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 650 - (Date.now() - started))));
    return json({ error: 'Unable to log in with these credentials.' }, status);
  };
  try {
    if (Number(req.headers.get('content-length')) > 2048) return denied(400);
    const raw = await req.text();
    if (raw.length > 2048) return denied(400);
    const body = JSON.parse(raw);
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    if (!/^[a-z0-9_]{3,40}$/.test(username) || typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 128) return denied(400);
    const url = Deno.env.get('SUPABASE_URL');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !service || !anon) return denied(503);
    const lookup = await fetch(`${url}/rest/v1/rpc/holmia_login_target`, {
      method: 'POST', headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username_input: username }), signal: AbortSignal.timeout(8000),
    });
    if (!lookup.ok) return denied(503);
    const target = await lookup.json();
    if (!target.allowed) return denied(429);
    if (!target.email) return denied();
    const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: target.email, password: body.password }), signal: AbortSignal.timeout(8000),
    });
    if (!auth.ok) return denied();
    const session = await auth.json();
    if (!session.access_token || !session.refresh_token) return denied(503);
    return json({ access_token: session.access_token, refresh_token: session.refresh_token });
  } catch { return denied(); }
});
