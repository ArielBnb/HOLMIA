// Enquiries: isolation by rights, reply stored and visible to the Buyer,
// pending / handled indicator (local SQLite layer + helpers used by the screens).
import { SQLiteDatabase } from '../database/db.ts';
import { seedDatabase } from '../database/seed.ts';
import { SessionService, AccessDeniedError } from '../services/sessionService.ts';
import { countByStatus, enquiryStatus, filterEnquiries, validateEnquiryText } from '../services/enquiryRules.js';

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

console.log('=== HOLMIA - Enquiries received & replies (ABD) ===\n');
const db = new SQLiteDatabase(':memory:');
seedDatabase(db);
const insertUser = `INSERT INTO users (id, username, full_name, email, role, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`;
db.run(insertUser, ['other-seller', 'other_seller', 'Other Seller', 'other.seller@example.com', 'seller']);
db.run(insertUser, ['other-agent', 'other_agent', 'Other Agent', 'other.agent@example.com', 'agent']);
db.run(insertUser, ['buyer-2', 'buyer_two', 'Buyer Two', 'buyer2@example.com', 'buyer']);
// A listing owned by the other seller, to prove isolation.
db.run(`INSERT INTO properties (id, seller_id, title, description, price, listing_type, property_type, location, status)
        VALUES ('prop-other', 'other-seller', 'Other seller flat', '', 200000, 'sale', 'flat', 'Leeds', 'active')`);
const session = new SessionService(db);

console.log('--- 1. Buyers send enquiries ---');
session.login('buyer@holmia.example');
const onAgentListing = session.submitEnquiry('prop-1', 'Is the balcony south-facing?'); // prop-1: seller-1 + agent-1
const onDirectListing = session.submitEnquiry('prop-2', 'Can I visit on Saturday?');   // prop-2: seller-1, no agent
session.logout();
session.login('buyer2@example.com');
const onOtherListing = session.submitEnquiry('prop-other', 'Is parking included?');
expectThrow(() => session.submitEnquiry('prop-1', '   '), Error, 'cannot be empty', 'Empty enquiry refused');
session.logout();
session.login('seller@holmia.example');
expectThrow(() => session.submitEnquiry('prop-1', 'Hi'), AccessDeniedError, '', 'Seller cannot send an enquiry');
session.logout();
check(enquiryStatus(onAgentListing) === 'pending' && onAgentListing.reply === null, 'New enquiry is pending');

console.log('\n--- 2. Enquiries isolated by rights ---');
session.login('seller@holmia.example');
const sellerIds = session.getReceivedEnquiries().map((e) => e.id);
check(sellerIds.includes(onAgentListing.id) && sellerIds.includes(onDirectListing.id), 'Owner sees enquiries on own listings');
check(!sellerIds.includes(onOtherListing.id), "Owner does not see another seller's enquiries");
expectThrow(() => session.replyToEnquiry(onOtherListing.id, 'Yes'), AccessDeniedError, 'own properties', "Owner cannot reply on another seller's listing");
session.logout();
session.login('agent@holmia.example');
const agentIds = session.getReceivedEnquiries().map((e) => e.id);
check(agentIds.includes(onAgentListing.id), 'Assigned agent sees enquiries on assigned listing');
check(!agentIds.includes(onDirectListing.id) && !agentIds.includes(onOtherListing.id), 'Agent does not see unassigned listings');
expectThrow(() => session.replyToEnquiry(onDirectListing.id, 'Yes'), AccessDeniedError, 'assigned', 'Agent cannot reply on an unassigned listing');
session.logout();
session.login('other.agent@example.com');
check(session.getReceivedEnquiries().length === 0, 'Unassigned agent sees nothing');
session.logout();
session.login('buyer@holmia.example');
expectThrow(() => session.getReceivedEnquiries(), AccessDeniedError, '', 'Buyer cannot read the received inbox');
expectThrow(() => session.replyToEnquiry(onAgentListing.id, 'x'), AccessDeniedError, '', 'Buyer cannot reply');
session.logout();

console.log('\n--- 3. Reply stored and visible to the Buyer ---');
session.login('agent@holmia.example');
const replied = session.replyToEnquiry(onAgentListing.id, '  Yes, fully south-facing.  ');
check(replied.reply === 'Yes, fully south-facing.' && replied.replied_by === 'user-agent-1' && !!replied.replied_at, 'Agent reply stored (trimmed, author, date)');
expectThrow(() => session.replyToEnquiry(onAgentListing.id, ''), Error, 'cannot be empty', 'Empty reply refused');
session.logout();
session.login('seller@holmia.example');
session.replyToEnquiry(onDirectListing.id, 'Saturday 10am works.');
session.logout();
const fresh = new SessionService(db); // new session: the reply comes from the database
fresh.login('buyer@holmia.example');
const mine = fresh.getMyEnquiries();
check(mine.length === 2, 'Buyer sees only own enquiries');
check(mine.find((e) => e.id === onAgentListing.id)?.reply === 'Yes, fully south-facing.', 'Buyer sees the agent reply');
check(mine.find((e) => e.id === onDirectListing.id)?.reply === 'Saturday 10am works.', 'Buyer sees the seller reply');
fresh.logout();
fresh.login('buyer2@example.com');
check(fresh.getMyEnquiries().every((e) => e.reply === null), "Other buyer's enquiry still pending, sees no other replies");
fresh.logout();

console.log('\n--- 4. Pending / handled indicator ---');
session.login('seller@holmia.example');
const inbox = session.getReceivedEnquiries();
check(inbox.every((e) => enquiryStatus(e) === 'handled'), 'Both enquiries now handled');
const counts = countByStatus([...inbox, { reply: null }]);
check(counts.pending === 1 && counts.handled === 2 && counts.all === 3, 'Counts per status');
check(filterEnquiries(inbox, 'pending').length === 0 && filterEnquiries(inbox, 'handled').length === 2, 'Filters Pending / Handled');
const edited = session.replyToEnquiry(onDirectListing.id, 'Saturday 11am instead.');
check(edited.reply === 'Saturday 11am instead.' && enquiryStatus(edited) === 'handled', 'Reply can be corrected, stays handled');
check(validateEnquiryText('x'.repeat(2001)) !== '' && validateEnquiryText('ok') === '', 'Length validation (2000 max)');
session.logout();

console.log(`\n${passed} tests passed`);
