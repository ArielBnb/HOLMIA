import assert from 'node:assert/strict';
import {
  EMPTY_FORM,
  buildPropertyPayload,
  parsePrice,
  validatePropertyForm,
} from '../services/propertyFormValidation.js';

const valid = {
  ...EMPTY_FORM,
  title: 'Bright flat in Lyon',
  description: 'Two bedrooms, balcony, close to public transport.',
  price: '425 000',
  listingType: 'sale',
  propertyType: 'flat',
  location: 'Lyon, France',
};

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

test('valid form has no errors', () => {
  assert.deepEqual(validatePropertyForm(valid), {});
});

test('empty form flags every required field', () => {
  const errors = validatePropertyForm(EMPTY_FORM);
  for (const key of ['title', 'description', 'price', 'listingType', 'propertyType', 'location']) {
    assert.ok(errors[key], `missing error for ${key}`);
  }
});

test('whitespace-only fields count as empty', () => {
  const errors = validatePropertyForm({ ...valid, title: '   ', location: '  ', description: '    ' });
  assert.equal(errors.title, 'Title is required.');
  assert.equal(errors.location, 'Location is required.');
  assert.equal(errors.description, 'Description is required.');
});

test('length limits match the database constraints', () => {
  assert.ok(validatePropertyForm({ ...valid, title: 'ab' }).title);
  assert.ok(validatePropertyForm({ ...valid, title: 'x'.repeat(161) }).title);
  assert.equal(validatePropertyForm({ ...valid, title: 'x'.repeat(160) }).title, undefined);
  assert.ok(validatePropertyForm({ ...valid, location: 'x' }).location);
  assert.ok(validatePropertyForm({ ...valid, location: 'x'.repeat(201) }).location);
  assert.ok(validatePropertyForm({ ...valid, description: 'too short' }).description);
  assert.ok(validatePropertyForm({ ...valid, description: 'x'.repeat(10001) }).description);
});

test('price parsing and validation', () => {
  assert.equal(parsePrice('425 000'), 425000);
  assert.equal(parsePrice('1150,50'), 1150.5);
  assert.equal(parsePrice('1150.5'), 1150.5);
  assert.ok(Number.isNaN(parsePrice('12.345')));
  assert.ok(Number.isNaN(parsePrice('-5')));
  assert.ok(Number.isNaN(parsePrice('abc')));
  assert.ok(validatePropertyForm({ ...valid, price: '0' }).price);
  assert.ok(validatePropertyForm({ ...valid, price: '-10' }).price);
  assert.ok(validatePropertyForm({ ...valid, price: '1000000000000' }).price);
  assert.equal(validatePropertyForm({ ...valid, price: '999999999999.99' }).price, undefined);
});

test('transaction and property types must come from the lists', () => {
  assert.ok(validatePropertyForm({ ...valid, listingType: 'lease' }).listingType);
  assert.ok(validatePropertyForm({ ...valid, propertyType: 'castle' }).propertyType);
  assert.equal(validatePropertyForm({ ...valid, listingType: 'rent' }).listingType, undefined);
});

test('image must be https', () => {
  assert.ok(validatePropertyForm({ ...valid, imageUrl: 'http://example.com/a.jpg' }).imageUrl);
  assert.equal(validatePropertyForm({ ...valid, imageUrl: '' }).imageUrl, undefined);
});

test('payload is linked to the seller and created as draft', () => {
  const payload = buildPropertyPayload({ ...valid, title: '  Bright flat in Lyon  ' }, 'seller-uuid');
  assert.equal(payload.seller_id, 'seller-uuid');
  assert.equal(payload.status, 'draft');
  assert.equal(payload.title, 'Bright flat in Lyon');
  assert.equal(payload.price, 425000);
  assert.equal(payload.listing_type, 'sale');
  assert.equal(payload.property_type, 'flat');
  assert.match(payload.image_url, /^https:\/\//);
  assert.equal('agent_id' in payload, false);
});

test('payload requires an owner', () => {
  assert.throws(() => buildPropertyPayload(valid, null), /Seller/);
});

console.log(`${passed} tests passed`);
