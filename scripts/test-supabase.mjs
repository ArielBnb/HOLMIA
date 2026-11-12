import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key?.startsWith('sb_publishable_'), 'Use public client configuration');
const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = makeClient();
const clients = {};
const report = [];
const pass = (name) => { report.push(name); console.log(`PASS ${name}`); };
async function rows(client, filter = {}) {
  let query = client.from('properties').select('*').order('id');
  for (const [column, value] of Object.entries(filter)) query = query.eq(column, value);
  const { data, error } = await query;
  assert.ifError(error);
  return data;
}
async function deniedMutation(client, table, id, changes) {
  const { data, error } = await client.from(table).update(changes).eq('id', id).select();
  assert.ok(error || data.length === 0, 'Mutation unexpectedly allowed');
}
try {
  const baseline = await rows(anon);
  assert.equal(baseline.length, 6);
  assert.ok(baseline.every(p => p.status === 'active'));
  pass('Anonymous catalogue: 6 persisted active listings');
  for (const role of ['buyer', 'seller', 'agent']) {
    const client = makeClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: `${role}@holmia.example`, password: process.env[`HOLMIA_${role.toUpperCase()}_PASSWORD`],
    });
    assert.ifError(error);
    const profile = await client.from('profiles').select('*').single();
    assert.ifError(profile.error);
    assert.equal(profile.data.role, role);
    clients[role] = { client, user: data.user };
    pass(`${role}: real Auth login and own profile`);
    await deniedMutation(client, 'profiles', data.user.id, { role: role === 'agent' ? 'seller' : 'agent' });
    pass(`${role}: self role escalation denied`);
  }
  const { client: seller } = clients.seller;
  const { client: buyer, user: buyerUser } = clients.buyer;
  const { client: agent } = clients.agent;
  assert.equal((await rows(buyer)).length, 6);
  const profileLeak = await buyer.from('profiles').select('id').neq('id', buyerUser.id);
  assert.ifError(profileLeak.error);
  assert.equal(profileLeak.data.length, 0);
  pass('Buyer reads active listings but cannot read other profiles');
  const assigned = baseline.find(p => p.agent_id);
  const unassigned = baseline.find(p => !p.agent_id);
  await deniedMutation(buyer, 'properties', assigned.id, { price: 1 });
  await deniedMutation(anon, 'properties', assigned.id, { price: 1 });
  await deniedMutation(agent, 'properties', unassigned.id, { price: 1 });
  pass('Buyer/anonymous writes and unassigned Agent writes denied');
  const deniedInsert = await buyer.from('properties').insert({
    seller_id: buyerUser.id, title: 'Forbidden buyer listing', price: 100, listing_type: 'sale', property_type: 'flat', location: 'Paris',
  });
  assert.ok(deniedInsert.error);
  pass('Buyer property insertion denied');
  // No extra rows or deletions: exercise authorized writes on the six demo rows.
  const changed = await seller.from('properties').update({ description: `${unassigned.description} Test Seller vérifié.` }).eq('id', unassigned.id).select().single();
  assert.ifError(changed.error);
  assert.notEqual(changed.data.description, unassigned.description);
  const fresh = makeClient();
  assert.equal((await rows(fresh, { id: unassigned.id }))[0].description, changed.data.description);
  pass('Seller update persisted across a fresh client');
  const restored = await seller.from('properties').update({ description: unassigned.description }).eq('id', unassigned.id);
  assert.ifError(restored.error);
  const agentWrite = await agent.from('properties').update({ description: assigned.description }).eq('id', assigned.id).select().single();
  assert.ifError(agentWrite.error);
  await deniedMutation(agent, 'properties', assigned.id, { agent_id: null });
  pass('Assigned Agent update allowed; reassignment denied');
  const draft = await seller.from('properties').update({ status: 'draft' }).eq('id', unassigned.id).select().single();
  assert.ifError(draft.error);
  try {
    assert.equal((await rows(buyer, { id: unassigned.id })).length, 0);
    assert.equal((await rows(anon, { id: unassigned.id })).length, 0);
    assert.equal((await rows(seller, { id: unassigned.id })).length, 1);
    assert.equal((await rows(agent, { id: unassigned.id })).length, 0);
    pass('Draft visible only to owner (unassigned Agent/Buyer/anonymous hidden)');
  } finally {
    const restoredStatus = await seller.from('properties').update({ status: 'active' }).eq('id', unassigned.id);
    assert.ifError(restoredStatus.error);
  }
  const draftAssigned = await seller.from('properties').update({ status: 'draft' }).eq('id', assigned.id).select().single();
  assert.ifError(draftAssigned.error);
  try {
    assert.equal((await rows(agent, { id: assigned.id })).length, 1);
    assert.equal((await rows(buyer, { id: assigned.id })).length, 0);
    pass('Assigned Agent can read draft; Buyer cannot');
  } finally {
    const restore = await seller.from('properties').update({ status: 'active' }).eq('id', assigned.id);
    assert.ifError(restore.error);
  }
  const invalid = await seller.from('properties').update({ price: -1 }).eq('id', unassigned.id);
  assert.ok(invalid.error);
  const invalidStatus = await seller.from('properties').update({ status: assigned.listing_type === 'sale' ? 'rented' : 'sold' }).eq('id', assigned.id);
  assert.ok(invalidStatus.error);
  const invalidAgent = await seller.from('properties').update({ agent_id: buyerUser.id }).eq('id', assigned.id);
  assert.ok(invalidAgent.error);
  pass('Invalid price/status/Agent role rejected');
  assert.equal((await rows(makeClient())).length, 6);
  pass('Final state: 6 active listings; demo content restored');
  console.log(JSON.stringify({ passed: report.length, tests: report }, null, 2));
} finally {
  for (const { client } of Object.values(clients)) await client.auth.signOut({ scope: 'local' });
}
