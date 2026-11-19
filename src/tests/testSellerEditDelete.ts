// Seller edit & delete: ownership, status locks and linked-data consistency
// on the local SQLite layer (SessionService + PropertyRepository).
import { SQLiteDatabase } from '../database/db.ts';
import { seedDatabase } from '../database/seed.ts';
import { SessionService, AccessDeniedError } from '../services/sessionService.ts';

let passed = 0;
function check(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passed++;
  console.log(`  [PASS] ${message}`);
}
function expectThrow(fn: () => unknown, type: any, part: string, message: string) {
  try {
    fn();
  } catch (error: any) {
    check(error instanceof type && error.message.includes(part), `${message} ("${error.message}")`);
    return;
  }
  check(false, `${message} (no error thrown)`);
}
const count = (db: SQLiteDatabase, sql: string, params: unknown[]) =>
  (db.get<{ n: number }>(sql, params as any[]) as { n: number }).n;

console.log('=== HOLMIA - Seller edit & delete (ABD) ===\n');
const db = new SQLiteDatabase(':memory:');
seedDatabase(db);
db.run(
  `INSERT INTO users (id, username, full_name, email, role, created_at)
   VALUES ('other-seller', 'other_seller', 'Other Seller', 'other@example.com', 'seller', datetime('now'))`
);
const session = new SessionService(db);

console.log('--- 1. Another Seller is blocked ---');
session.login('other@example.com');
const before = db.get<any>(`SELECT title, price FROM properties WHERE id = 'prop-2'`);
expectThrow(() => session.updateProperty('prop-2', { title: 'Hijacked' }), AccessDeniedError, 'own properties', 'Other Seller cannot edit');
expectThrow(() => session.deleteProperty('prop-2'), AccessDeniedError, 'own properties', 'Other Seller cannot delete');
const after = db.get<any>(`SELECT title, price FROM properties WHERE id = 'prop-2'`);
check(after.title === before.title && after.price === before.price, 'Property unchanged after blocked attempts');
session.logout();

console.log('\n--- 2. Owner edits a draft/active listing ---');
session.login('seller@holmia.example');
const edited = session.updateProperty('prop-2', { title: 'Maison familiale rénovée', price: 590000, property_type: 'villa' });
check(edited.title === 'Maison familiale rénovée' && edited.price === 590000 && edited.property_type === 'villa', 'Owner can edit all fields while active');

console.log('\n--- 3. Fields protected after Under Offer ---');
const prop = session.updateProperty('prop-2', { status: 'under_offer' });
check(prop.status === 'under_offer', 'Listing moved to Under Offer');
expectThrow(() => session.updateProperty('prop-2', { price: 1 }), Error, 'locked', 'Price locked under offer');
expectThrow(() => session.updateProperty('prop-2', { listing_type: prop.listing_type === 'sale' ? 'rent' : 'sale' }), Error, 'locked', 'Transaction type locked under offer');
expectThrow(() => session.updateProperty('prop-2', { property_type: 'loft' }), Error, 'locked', 'Property type locked under offer');
const stillSame = db.get<any>(`SELECT price, property_type FROM properties WHERE id = 'prop-2'`);
check(stillSame.price === 590000 && stillSame.property_type === 'villa', 'Locked values unchanged in the database');
const descOk = session.updateProperty('prop-2', { description: 'Visite possible le samedi.' });
check(descOk.description === 'Visite possible le samedi.', 'Description still editable under offer');

console.log('\n--- 4. Delete rules ---');
expectThrow(() => session.deleteProperty('prop-2'), Error, 'Cannot delete', 'Cannot delete a listing Under Offer');
check(count(db, `SELECT count(*) AS n FROM properties WHERE id = 'prop-2'`, []) === 1, 'Under Offer listing still exists');

console.log('\n--- 5. Linked data stays consistent after deletion ---');
// prop-1 is active with a pending offer and status history in the seed.
check(count(db, `SELECT count(*) AS n FROM offers WHERE property_id = 'prop-1'`, []) > 0, 'prop-1 has offers before deletion');
check(count(db, `SELECT count(*) AS n FROM status_history WHERE property_id = 'prop-1'`, []) > 0, 'prop-1 has history before deletion');
session.deleteProperty('prop-1');
check(count(db, `SELECT count(*) AS n FROM properties WHERE id = 'prop-1'`, []) === 0, 'Owner deleted active listing');
check(count(db, `SELECT count(*) AS n FROM offers WHERE property_id = 'prop-1'`, []) === 0, 'Its pending offers were removed (no orphans)');
check(count(db, `SELECT count(*) AS n FROM status_history WHERE property_id = 'prop-1'`, []) === 0, 'Its status history was removed (no orphans)');
// prop-3 is a rental with a pending application.
session.deleteProperty('prop-3');
check(count(db, `SELECT count(*) AS n FROM rental_applications WHERE property_id = 'prop-3'`, []) === 0, 'Rental applications removed with their listing');
const orphans = count(db, `SELECT
  (SELECT count(*) FROM offers o LEFT JOIN properties p ON p.id = o.property_id WHERE p.id IS NULL) +
  (SELECT count(*) FROM rental_applications r LEFT JOIN properties p ON p.id = r.property_id WHERE p.id IS NULL) +
  (SELECT count(*) FROM status_history h LEFT JOIN properties p ON p.id = h.property_id WHERE p.id IS NULL) AS n`, []);
check(orphans === 0, 'No orphan rows anywhere in the database');
const fk = db.query(`PRAGMA foreign_key_check`);
check(fk.length === 0, 'SQLite foreign key check passes');
session.logout();

console.log(`\n${passed} tests passed`);
