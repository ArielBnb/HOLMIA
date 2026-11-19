// Received offers: who decides, at most one accepted offer, other offers
// rejected and property status updated (local SQLite transactional service +
// the pure helpers used by OffersReceivedScreen).
import { SQLiteDatabase } from '../database/db.ts';
import { seedDatabase } from '../database/seed.ts';
import { SessionService, AccessDeniedError } from '../services/sessionService.ts';
import { canDecide, groupOffersByProperty } from '../services/offerRules.js';

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

console.log('=== HOLMIA - Offers received: accept / reject (ABD) ===\n');
const db = new SQLiteDatabase(':memory:');
seedDatabase(db);
const insertUser = `INSERT INTO users (id, username, full_name, email, role, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`;
db.run(insertUser, ['other-seller', 'other_seller', 'Other Seller', 'other.seller@example.com', 'seller']);
db.run(insertUser, ['other-agent', 'other_agent', 'Other Agent', 'other.agent@example.com', 'agent']);
db.run(insertUser, ['buyer-2', 'buyer_two', 'Buyer Two', 'buyer2@example.com', 'buyer']);
db.run(insertUser, ['buyer-3', 'buyer_three', 'Buyer Three', 'buyer3@example.com', 'buyer']);
const session = new SessionService(db);
const offerStatus = (id: string) => db.get<any>(`SELECT status FROM offers WHERE id = ?`, [id]).status;
const propStatus = (id: string) => db.get<any>(`SELECT status FROM properties WHERE id = ?`, [id]).status;

// prop-1 (seller-1, agent-1, active, sale) already has offer-1 from the seed.
session.login('buyer2@example.com');
const offer2 = session.submitOffer('prop-1', 430000);
session.logout();
session.login('buyer3@example.com');
const offer3 = session.submitOffer('prop-1', 410000);
session.logout();

console.log('--- 1. Only the owner or the assigned agent decides ---');
session.login('other.seller@example.com');
expectThrow(() => session.acceptOffer(offer2.id), AccessDeniedError, 'own properties', 'Other Seller cannot accept');
expectThrow(() => session.rejectOffer(offer2.id), AccessDeniedError, 'own properties', 'Other Seller cannot reject');
session.logout();
session.login('other.agent@example.com');
expectThrow(() => session.acceptOffer(offer2.id), AccessDeniedError, 'assigned', 'Unassigned Agent cannot accept');
expectThrow(() => session.rejectOffer(offer2.id), AccessDeniedError, 'assigned', 'Unassigned Agent cannot reject');
session.logout();
session.login('buyer@holmia.example');
expectThrow(() => session.acceptOffer(offer2.id), AccessDeniedError, '', 'Buyer cannot accept');
expectThrow(() => session.rejectOffer(offer2.id), AccessDeniedError, '', 'Buyer cannot reject');
session.logout();
check(['offer-1', offer2.id, offer3.id].every((id) => offerStatus(id) === 'pending') && propStatus('prop-1') === 'active',
  'Nothing changed after blocked attempts');

console.log('\n--- 2. Assigned agent rejects one offer ---');
session.login('agent@holmia.example');
const rejected = session.rejectOffer(offer3.id);
check(rejected.status === 'rejected', 'Assigned Agent can reject');
check(propStatus('prop-1') === 'active', 'Rejecting does not change the property status');
expectThrow(() => session.rejectOffer(offer3.id), Error, "status 'rejected'", 'Cannot reject twice');
session.logout();

console.log('\n--- 3. Owner accepts: others rejected, property Under Offer ---');
session.login('seller@holmia.example');
const result = session.acceptOffer(offer2.id);
check(result.acceptedOffer.status === 'accepted', 'Owner accepts the 430k offer');
check(offerStatus('offer-1') === 'rejected', 'Other pending offer rejected automatically');
check(result.property.status === 'under_offer' && propStatus('prop-1') === 'under_offer', 'Property moved to Under Offer');
const history = db.get<any>(`SELECT new_status FROM status_history WHERE property_id = 'prop-1' ORDER BY rowid DESC LIMIT 1`);
check(history.new_status === 'under_offer', 'Transition recorded in status history');

console.log('\n--- 4. At most one accepted offer ---');
expectThrow(() => session.acceptOffer('offer-1'), Error, "expected 'pending'", 'A rejected offer cannot be accepted');
session.logout();
session.login('agent@holmia.example');
expectThrow(() => session.acceptOffer(offer2.id), Error, "expected 'pending'", 'Accepted offer cannot be accepted again');
session.logout();
let blocked = false;
try {
  db.run(`INSERT INTO offers (id, property_id, buyer_id, amount, status) VALUES ('forced', 'prop-1', 'buyer-3', 1, 'accepted')`);
} catch {
  blocked = true;
}
check(blocked, 'Database refuses a second accepted offer even when written directly');
check(db.get<any>(`SELECT count(*) AS n FROM offers WHERE property_id = 'prop-1' AND status = 'accepted'`).n === 1, 'Exactly one accepted offer on the property');

console.log('\n--- 5. View after refresh (helpers used by the screen) ---');
const rows = db.query<any>(`SELECT o.id, o.property_id, p.title AS property_title, p.status AS property_status, p.price AS property_price,
  u.full_name AS buyer_name, o.amount, o.status, o.created_at FROM offers o JOIN properties p ON p.id = o.property_id
  JOIN users u ON u.id = o.buyer_id WHERE p.id = 'prop-1' ORDER BY o.created_at DESC`);
const [group] = groupOffersByProperty(rows);
check(group.status === 'under_offer', 'Listing status shown as Under Offer');
check(group.accepted?.id === offer2.id && group.pendingCount === 0, 'Accepted offer shown, no pending left');
check(group.offers.filter((o: any) => o.status === 'rejected').length === 2, 'Both other offers shown as rejected');
check(group.offers.every((o: any) => !canDecide(group, o)), 'No accept/reject buttons once Under Offer');
check(canDecide({ status: 'active' }, { status: 'pending' }) && !canDecide({ status: 'active' }, { status: 'rejected' }),
  'Buttons only for pending offers on active listings');

console.log(`\n${passed} tests passed`);
