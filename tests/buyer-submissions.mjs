import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localDate, submissionValues } from '../src/services/submissionRules.js';
const sale = { listing_type: 'sale', status: 'active' };
const rent = { ...sale, listing_type: 'rent' };
const today = '2026-11-24';
test('purchase amount uses the database precision and limits', () => {
  for (const invalid of ['', '0', '-1', '2.009', '1e5', '£300', 'Infinity', '1000000000000']) {
    assert.throws(() => submissionValues(sale, invalid, ''), /amount/);
  }
  assert.deepEqual(submissionValues(sale, ' 15,50 ', ' hi '), { amount: 15.5, message: 'hi' });
  assert.deepEqual(submissionValues(sale, '0.01', ' '), { amount: 0.01, message: null });
});
test('rental dates are calendar dates from today onward', () => {
  for (const invalid of ['', '2026-11-23', '2026-11-31', '2027-02-29', '24/11/2026']) {
    assert.throws(() => submissionValues(rent, invalid, '', today), /date/);
  }
  assert.deepEqual(submissionValues(rent, today, ' ', today), { move_in_date: today, notes: '' });
  assert.equal(submissionValues(rent, '2028-02-29', ' note ', today).notes, 'note');
  assert.equal(localDate(new Date(2027, 0, 1)), '2027-01-01');
});
test('unavailable listings and overly long notes are rejected', () => {
  for (const listing of [{ ...sale, status: 'under_offer' }, { ...rent, status: 'draft' }, { ...sale, listing_type: 'other' }]) {
    assert.throws(() => submissionValues(listing, '100', ''), /available/);
  }
  assert.throws(() => submissionValues(sale, '100', 'a'.repeat(2001)), /2,000/);
});
