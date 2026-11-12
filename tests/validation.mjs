import assert from 'node:assert/strict';
import { normalizeUsername, validateRegistration } from '../src/services/authValidation.js';
assert.equal(normalizeUsername('  ARIEL_1  '), 'ariel_1');
const form = { fullName: 'Ariel Test', username: 'ariel_test', password: 'TestPassword123', confirmPassword: 'TestPassword123', role: 'buyer' };
for (const role of ['buyer', 'seller', 'agent']) assert.equal(validateRegistration({ ...form, role }), '');
for (const field of ['fullName', 'username', 'password', 'confirmPassword', 'role']) assert.notEqual(validateRegistration({ ...form, [field]: '' }), '');
assert.notEqual(validateRegistration({ ...form, username: 'bad@username' }), '');
assert.notEqual(validateRegistration({ ...form, role: 'admin' }), '');
console.log('PASS normalized usernames, all roles, required fields, password confirmation and invalid roles');
