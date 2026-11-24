// Rental applications: rights, decision stored and visible to the Buyer,
// listing status coherent with the rental lifecycle
// (active -> under_offer -> rented), on the local SQLite layer + view helpers.
import { SQLiteDatabase } from '../database/db.ts';
import { seedDatabase } from '../database/seed.ts';
import { SessionService, AccessDeniedError } from '../services/sessionService.ts';
import { canDecideApplication, canStartTenancy, formatMoveIn, groupApplicationsByProperty } from '../services/rentalRules.js';

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

console.log('=== HOLMIA - Rental applications: accept / reject (ABD) ===\n');
const db = new SQLiteDatabase(':memory:');
seedDatabase(db);
const insertUser = `INSERT INTO users (id, username, full_name, email, role, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`;
db.run(insertUser, ['other-seller', 'other_seller', 'Other Seller', 'other.seller@example.com', 'seller']);
db.run(insertUser, ['other-agent', 'other_agent', 'Other Agent', 'other.agent@example.com', 'agent']);
db.run(insertUser, ['buyer-2', 'buyer_two', 'Buyer Two', 'buyer2@example.com', 'buyer']);
db.run(insertUser, ['buyer-3', 'buyer_three', 'Buyer Three', 'buyer3@example.com', 'buyer']);
const session = new SessionService(db);
const appStatus = (id: string) => db.get<any>(`SELECT status FROM rental_applications WHERE id = ?`, [id]).status;
const propStatus = (id: string) => db.get<any>(`SELECT status FROM properties WHERE id = ?`, [id]).status;

// prop-3: rent, seller-1 + agent-1, active; rental-1 (buyer-1, pending) comes from the seed.
session.login('buyer2@example.com');
const app2 = session.submitRentalApplication('prop-3', '2027-01-15', 'Two guarantors, permanent contract');
session.logout();
session.login('buyer3@example.com');
const app3 = session.submitRentalApplication('prop-3', '2027-02-01', null);
session.logout();

console.log('--- 1. Rights ---');
session.login('other.seller@example.com');
expectThrow(() => session.getPropertyRentalApplications('prop-3'), AccessDeniedError, 'own properties', 'Other Seller cannot read the applications');
expectThrow(() => session.decideRentalApplication(app2.id, 'accepted'), AccessDeniedError, 'own properties', 'Other Seller cannot accept');
session.logout();
session.login('other.agent@example.com');
expectThrow(() => session.decideRentalApplication(app2.id, 'rejected'), AccessDeniedError, 'assigned', 'Unassigned Agent cannot reject');
session.logout();
session.login('buyer@holmia.example');
expectThrow(() => session.decideRentalApplication(app2.id, 'accepted'), AccessDeniedError, '', 'Buyer cannot decide');
session.logout();
check(['rental-1', app2.id, app3.id].every((id) => appStatus(id) === 'pending') && propStatus('prop-3') === 'active',
  'Nothing changed after blocked attempts');

console.log('\n--- 2. View: move-in date and notes ---');
session.login('agent@holmia.example');
const listed = session.getPropertyRentalApplications('prop-3');
check(listed.length === 3, 'Assigned Agent sees the 3 applications');
const fromBuyer2 = listed.find((a) => a.id === app2.id)!;
check(fromBuyer2.move_in_date === '2027-01-15' && fromBuyer2.notes === 'Two guarantors, permanent contract', 'Move-in date and notes are returned');
check(formatMoveIn('2027-01-15') === '15 Jan 2027', 'Move-in date displayed without timezone shift');

console.log('\n--- 3. Reject: stored, listing unchanged ---');
const rejected = session.decideRentalApplication(app3.id, 'rejected');
check(rejected.status === 'rejected' && propStatus('prop-3') === 'active', 'Agent rejects; listing stays Active');
session.logout();

console.log('\n--- 4. Accept: others rejected, listing Under Offer ---');
session.login('seller@holmia.example');
const accepted = session.decideRentalApplication(app2.id, 'accepted');
check(accepted.status === 'accepted', 'Owner accepts Buyer Two');
check(appStatus('rental-1') === 'rejected', 'Other pending application rejected automatically');
check(propStatus('prop-3') === 'under_offer', 'Listing moved to Under Offer');
expectThrow(() => session.decideRentalApplication('rental-1', 'accepted'), Error, "status 'rejected'", 'A rejected application cannot be accepted');
let blocked = false;
try {
  db.run(`UPDATE rental_applications SET status = 'accepted' WHERE id = ?`, [app3.id]);
} catch {
  blocked = true;
}
check(blocked, 'Database refuses a second accepted application even when written directly');
session.logout();
session.login('buyer@holmia.example');
expectThrow(() => session.submitRentalApplication('prop-3', '2027-03-01'), Error, "must be 'active'", 'No new application once Under Offer');
session.logout();

console.log('\n--- 5. Decision visible to the Buyer ---');
const fresh = new SessionService(db); // new session: statuses come from the database
fresh.login('buyer2@example.com');
const mine2 = fresh.getMyRentalApplications();
check(mine2.length === 1 && mine2[0].status === 'accepted' && mine2[0].move_in_date === '2027-01-15', 'Buyer Two sees Accepted (with move-in date)');
fresh.logout();
fresh.login('buyer@holmia.example');
check(fresh.getMyRentalApplications().find((a) => a.property_id === 'prop-3')?.status === 'rejected', 'Demo Buyer sees Rejected');
fresh.logout();
fresh.login('seller@holmia.example');
expectThrow(() => fresh.getMyRentalApplications(), AccessDeniedError, '', 'Only Buyers list their own applications');
fresh.logout();

console.log('\n--- 6. Tenancy starts: Under Offer -> Rented ---');
session.login('other.agent@example.com');
expectThrow(() => session.completeRental(app2.id), AccessDeniedError, 'assigned', 'Unassigned Agent cannot mark as rented');
session.logout();
session.login('agent@holmia.example');
expectThrow(() => session.completeRental('rental-1'), Error, 'Only an accepted application', 'A rejected applicant cannot start a tenancy');
const rentedProp = session.completeRental(app2.id);
check(rentedProp.status === 'rented' && propStatus('prop-3') === 'rented', 'Assigned Agent marks the listing Rented');
expectThrow(() => session.completeRental(app2.id), Error, "must be 'under_offer'", 'Cannot start the tenancy twice');
expectThrow(() => session.updateProperty('prop-3', { status: 'active' }), Error, 'Terminal', 'Rented is terminal (cannot go back to Active)');
const history = db.query<any>(`SELECT old_status, new_status FROM status_history WHERE property_id = 'prop-3' ORDER BY rowid`);
const last2 = history.slice(-2).map((h) => `${h.old_status}->${h.new_status}`).join(',');
check(last2 === 'active->under_offer,under_offer->rented', 'Lifecycle recorded in status history');
session.logout();

console.log('\n--- 7. Screen helpers ---');
const rows = [
  { id: 'a', property_id: 'p', property_title: 'Flat', property_status: 'active', property_price: 1200, status: 'pending' },
  { id: 'b', property_id: 'p', property_title: 'Flat', property_status: 'active', property_price: 1200, status: 'rejected' },
];
const [group] = groupApplicationsByProperty(rows);
check(group.pendingCount === 1 && group.accepted === null, 'Grouping counts pending applications');
check(canDecideApplication(group, rows[0]) && !canDecideApplication(group, rows[1]), 'Buttons only for pending applications on active listings');
check(!canDecideApplication({ status: 'under_offer' }, { status: 'pending' }), 'No decision once Under Offer');
check(canStartTenancy({ status: 'under_offer' }, { status: 'accepted' }) && !canStartTenancy({ status: 'rented' }, { status: 'accepted' }),
  '"Mark as rented" only for the accepted applicant while Under Offer');

console.log(`\n${passed} tests passed`);
