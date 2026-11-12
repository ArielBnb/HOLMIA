import assert from 'node:assert/strict';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const headers = { apikey: key, 'Content-Type': 'application/json' };
async function request(path, body, method = 'POST') {
 const r = await fetch(url + path, { method, headers, ...(method !== 'GET' ? {body:JSON.stringify(body)} : {}) });
 return { status:r.status, body:await r.json() };
}
const path = '/functions/v1/username-login';
const invalid = await request(path, { username:'buyer',password:'deliberately-incorrect-password' });
assert.equal(invalid.status,401); assert.equal('email' in invalid.body,false);
console.log('PASS existing username: wrong password rejected without email');
const absent = await request(path, { username:'unknown_auth_test_26485',password:'deliberately-incorrect-password' });
assert.equal(absent.status,401); assert.deepEqual(absent.body,invalid.body);
console.log('PASS absent username: same status/body, no enumeration response');
const malformed = await request(path,{username:'x',password:''}); assert.equal(malformed.status,400);
console.log('PASS malformed credentials rejected');
const deniedLookup = await request('/rest/v1/rpc/holmia_login_target',{username_input:'buyer'});
assert.ok([401,403,404].includes(deniedLookup.status)); assert.equal('email' in deniedLookup.body,false);
console.log('PASS anonymous client cannot resolve emails');
const anonymousProfiles = await request('/rest/v1/profiles?select=id,username',null,'GET');
assert.ok([401,403].includes(anonymousProfiles.status) || JSON.stringify(anonymousProfiles.body)==='[]');
console.log('PASS profiles are not public');
for(let i=0;i<4;i++) assert.equal((await request(path,{username:'unknown_auth_test_26485',password:'wrong'})).status,401);
assert.equal((await request(path,{username:'unknown_auth_test_26485',password:'wrong'})).status,429);
console.log('PASS server rate gate blocks sixth username attempt');
const settings = await request('/auth/v1/settings',null,'GET'); assert.equal(settings.body.mailer_autoconfirm,false);
console.log('PASS email confirmation remains enabled');
