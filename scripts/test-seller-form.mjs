// End-to-end check of the Seller listing form against Supabase.
// Usage (PowerShell): $env:HOLMIA_SELLER_PASSWORD='...'; npm run test:seller-form:supabase
// Creates one draft as seller@holmia.example, verifies it, then deletes it.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { EMPTY_FORM, buildPropertyPayload, validatePropertyForm } from '../src/services/propertyFormValidation.js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.HOLMIA_SELLER_PASSWORD;
assert.ok(url && key?.startsWith('sb_publishable_'), 'Use public client configuration (.env)');
assert.ok(password, 'Set HOLMIA_SELLER_PASSWORD');

const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const signIn = async (client) => {
  const { data, error } = await client.auth.signInWithPassword({ email: 'seller@holmia.example', password });
  assert.ifError(error);
  return data.user;
};

const seller = makeClient();
const user = await signIn(seller);
const form = {
  ...EMPTY_FORM,
  title: 'E2E seller form check (auto-deleted)',
  description: 'Automated check of the Seller listing form payload.',
  price: '199 000',
  listingType: 'sale',
  propertyType: 'flat',
  location: 'Lyon, France',
};
assert.deepEqual(validatePropertyForm(form), {});

let createdId;
try {
  const { data: row, error } = await seller.from('properties').insert(buildPropertyPayload(form, user.id)).select().single();
  assert.ifError(error);
  createdId = row.id;
  assert.equal(row.status, 'draft');
  assert.equal(row.seller_id, user.id);
  assert.equal(row.price, 199000);
  console.log('PASS draft created and linked to the Seller');

  const fresh = makeClient();
  await signIn(fresh);
  const { data: persisted } = await fresh.from('properties').select('id,status').eq('id', row.id);
  assert.deepEqual(persisted, [{ id: row.id, status: 'draft' }]);
  console.log('PASS draft persisted (read back from a new session)');

  const { data: anonRows } = await makeClient().from('properties').select('id').eq('id', row.id);
  assert.equal(anonRows.length, 0);
  console.log('PASS draft hidden from the public catalogue');

  const forged = await seller.from('properties')
    .insert(buildPropertyPayload(form, '00000000-0000-4000-8000-000000000000')).select();
  assert.ok(forged.error);
  console.log('PASS listing for another owner rejected');
} finally {
  if (createdId) {
    const { error } = await seller.from('properties').delete().eq('id', createdId);
    assert.ifError(error);
    console.log('Cleanup: test draft deleted');
  }
  await seller.auth.signOut({ scope: 'local' });
}
