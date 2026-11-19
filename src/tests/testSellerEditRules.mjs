import assert from 'node:assert/strict';
import {
  areTermsLocked,
  buildPropertyChanges,
  canDeleteProperty,
  deleteBlockedReason,
  formValuesFromProperty,
} from '../services/propertyEditRules.js';

const base = {
  id: 'p1',
  seller_id: 's1',
  agent_id: null,
  title: 'Bright flat in Lyon',
  description: 'Two bedrooms, balcony, close to public transport.',
  price: 425000,
  listing_type: 'sale',
  property_type: 'flat',
  location: 'Lyon, France',
  image_url: null,
  status: 'active',
};

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

test('unchanged form produces no changes', () => {
  assert.deepEqual(buildPropertyChanges(base, formValuesFromProperty(base)), {});
});

test('only changed columns are sent, trimmed and typed', () => {
  const values = { ...formValuesFromProperty(base), title: '  New title  ', price: '430 000' };
  assert.deepEqual(buildPropertyChanges(base, values), { title: 'New title', price: 430000 });
});

test('numeric price from Supabase as string compares correctly', () => {
  const fromDb = { ...base, price: '425000.00' };
  assert.deepEqual(buildPropertyChanges(fromDb, formValuesFromProperty(fromDb)), {});
});

test('ownership and status are never part of the changes', () => {
  const changes = buildPropertyChanges(base, { ...formValuesFromProperty(base), title: 'Other' });
  for (const key of ['seller_id', 'agent_id', 'status', 'id']) assert.equal(key in changes, false);
});

test('draft and active: all fields editable, deletion allowed', () => {
  for (const status of ['draft', 'active']) {
    const p = { ...base, status };
    assert.equal(areTermsLocked(p), false);
    assert.equal(canDeleteProperty(p), true);
    const changes = buildPropertyChanges(p, { ...formValuesFromProperty(p), price: '1', listingType: 'rent', propertyType: 'house' });
    assert.deepEqual(changes, { price: 1, listing_type: 'rent', property_type: 'house' });
  }
});

test('under offer / sold / rented: price and types locked', () => {
  for (const status of ['under_offer', 'sold', 'rented']) {
    const p = { ...base, status, listing_type: status === 'rented' ? 'rent' : 'sale' };
    assert.equal(areTermsLocked(p), true);
    const values = formValuesFromProperty(p);
    assert.throws(() => buildPropertyChanges(p, { ...values, price: '1' }), /locked/);
    assert.throws(() => buildPropertyChanges(p, { ...values, listingType: p.listing_type === 'sale' ? 'rent' : 'sale' }), /locked/);
    assert.throws(() => buildPropertyChanges(p, { ...values, propertyType: 'house' }), /locked/);
  }
});

test('under offer: description, title, location and photo stay editable', () => {
  const p = { ...base, status: 'under_offer' };
  const changes = buildPropertyChanges(p, {
    ...formValuesFromProperty(p),
    title: 'Updated title',
    description: 'Updated description while under offer.',
    location: 'Lyon 3e, France',
    imageUrl: 'https://picsum.photos/seed/holmia-kitchen/800/600',
  });
  assert.deepEqual(Object.keys(changes).sort(), ['description', 'image_url', 'location', 'title']);
});

test('deletion blocked once under offer, sold or rented', () => {
  for (const status of ['under_offer', 'sold', 'rented']) {
    assert.equal(canDeleteProperty({ ...base, status }), false);
    assert.match(deleteBlockedReason({ ...base, status }), /cannot be deleted/);
  }
  assert.equal(deleteBlockedReason(base), '');
});

console.log(`${passed} tests passed`);
