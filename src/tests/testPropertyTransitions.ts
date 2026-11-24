// Lifecycle screen wiring: actions adapted to role and status, Sold / Rented
// final, explicit error on a forbidden transition, readable history
// (local SQLite status-change service + pure rules used by the screen).
import { SQLiteDatabase } from '../database/db.ts';
import { seedDatabase } from '../database/seed.ts';
import { SessionService, AccessDeniedError } from '../services/sessionService.ts';
import {
  availableActions,
  historyLine,
  historyWho,
  isFinalStatus,
  statusGuidance,
  transitionError,
} from '../services/transitionRules.js';

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
const actionTargets = (p: any, role: string) => availableActions(p, role).map((a: any) => a.to).join(',');

console.log('=== HOLMIA - Status transitions & history (ABD) ===\n');

console.log('--- 1. Actions adapted to role and status (screen rules) ---');
check(actionTargets({ status: 'draft', listing_type: 'sale' }, 'seller') === 'active', 'Draft: Publish only');
check(actionTargets({ status: 'active', listing_type: 'sale' }, 'agent') === 'draft', 'Active: Unpublish only (Under Offer comes from accepting)');
check(actionTargets({ status: 'under_offer', listing_type: 'sale' }, 'seller') === 'active,sold', 'Under Offer (sale): Back to Active or Sold');
check(actionTargets({ status: 'under_offer', listing_type: 'rent' }, 'agent') === 'active,rented', 'Under Offer (rent): Back to Active or Rented');
check(actionTargets({ status: 'sold', listing_type: 'sale' }, 'seller') === '' && actionTargets({ status: 'rented', listing_type: 'rent' }, 'agent') === '', 'Sold / Rented: no action');
check(actionTargets({ status: 'active', listing_type: 'sale' }, 'buyer') === '', 'Buyer: no action at all');
check(statusGuidance({ status: 'active', listing_type: 'rent' }, 'seller').includes('rental application'), 'Guidance explains how to reach Under Offer');
check(isFinalStatus('sold') && isFinalStatus('rented') && !isFinalStatus('under_offer'), 'Sold and Rented are final');
check(transitionError('sold', 'active', 'sale').includes('final'), 'Explicit error: Sold -> Active');
check(transitionError('under_offer', 'sold', 'rent').includes('cannot be Sold'), 'Explicit error: rental cannot be Sold');
check(transitionError('draft', 'sold', 'sale').includes('not allowed'), 'Explicit error: Draft -> Sold');
check(transitionError('active', 'draft', 'sale') === '', 'Allowed transition has no error');

const db = new SQLiteDatabase(':memory:');
seedDatabase(db);
db.run(`INSERT INTO users (id, username, full_name, email, role, created_at) VALUES
  ('other-agent', 'other_agent', 'Other Agent', 'other.agent@example.com', 'agent', datetime('now'))`);
const session = new SessionService(db);
const propStatus = (id: string) => db.get<any>(`SELECT status FROM properties WHERE id = ?`, [id]).status;

console.log('\n--- 2. Rights on the status-change service ---');
session.login('other.agent@example.com');
expectThrow(() => session.changePropertyStatus('prop-1', 'draft'), AccessDeniedError, 'assigned', 'Unassigned agent cannot change status');
expectThrow(() => session.getPropertyHistory('prop-1'), AccessDeniedError, 'assigned', 'Unassigned agent cannot read history');
session.logout();
session.login('buyer@holmia.example');
expectThrow(() => session.changePropertyStatus('prop-1', 'draft'), AccessDeniedError, '', 'Buyer cannot change status');
session.logout();
check(propStatus('prop-1') === 'active', 'Status unchanged after refused attempts');

console.log('\n--- 3. Allowed transitions, explicit errors ---');
session.login('agent@holmia.example');
check(session.changePropertyStatus('prop-1', 'draft', 'Photos to redo').status === 'draft', 'Assigned agent: Active -> Draft');
check(session.changePropertyStatus('prop-1', 'active').status === 'active', 'Assigned agent: Draft -> Active (publish)');
expectThrow(() => session.changePropertyStatus('prop-1', 'under_offer'), Error, 'accept an offer', 'Manual Under Offer refused with explanation');
expectThrow(() => session.changePropertyStatus('prop-1', 'sold'), Error, "Invalid status transition from 'active' to 'sold'", 'Active -> Sold refused');
expectThrow(() => session.changePropertyStatus('prop-1', 'active'), Error, 'already', 'Same status refused');
session.logout();

console.log('\n--- 4. Sale: accept, fall-through, accept again, Sold is final ---');
session.login('seller@holmia.example');
session.acceptOffer('offer-1'); // prop-1 -> under_offer
check(propStatus('prop-1') === 'under_offer', 'Accepting the offer moved prop-1 to Under Offer');
const back = session.changePropertyStatus('prop-1', 'active', 'Buyer withdrew');
check(back.status === 'active' && db.get<any>(`SELECT status FROM offers WHERE id = 'offer-1'`).status === 'rejected', 'Back to Active releases the accepted offer');
session.logout();
session.login('buyer@holmia.example');
const offer2 = session.submitOffer('prop-1', 430000);
session.logout();
session.login('seller@holmia.example');
session.acceptOffer(offer2.id); // possible again: no accepted offer left
expectThrow(() => session.changePropertyStatus('prop-1', 'rented'), Error, "'sale' property cannot have status 'rented'", 'Sale cannot be Rented');
check(session.changePropertyStatus('prop-1', 'sold', 'Completion signed').status === 'sold', 'Under Offer -> Sold');
expectThrow(() => session.changePropertyStatus('prop-1', 'active'), Error, 'Terminal state', 'Sold is final (no Sold -> Active)');
expectThrow(() => session.changePropertyStatus('prop-1', 'under_offer'), Error, 'Terminal state', 'Sold is final (no Sold -> Under Offer)');
check(propStatus('prop-1') === 'sold', 'Status still Sold');

console.log('\n--- 5. Rental: Rented is final ---');
session.decideRentalApplication('rental-1', 'accepted'); // prop-3 -> under_offer
check(session.changePropertyStatus('prop-3', 'rented').status === 'rented', 'Under Offer -> Rented');
expectThrow(() => session.changePropertyStatus('prop-3', 'active'), Error, 'Terminal state', 'Rented is final');

console.log('\n--- 6. Readable history ---');
const history = session.getPropertyHistory('prop-1');
const lines = history.map((h) => historyLine(h));
check(lines[0] === 'Under Offer → Sold', 'Newest first: Under Offer → Sold');
check(lines.includes('Active → Draft') && lines.includes('Draft → Active') && lines.includes('Under Offer → Active'), 'Every change is recorded');
check(history[0].notes === 'Completion signed' && history.some((h) => h.notes === 'Buyer withdrew'), 'Notes kept in history');
check(history.every((h) => !!h.changed_at), 'Each entry has a date');
check(historyLine({ old_status: null, new_status: 'draft' }) === 'Created as Draft', 'Creation line is readable');
check(historyWho({ changed_by_name: 'Demo Agent', changed_by_role: 'agent' }) === 'Demo Agent (agent)' && historyWho({}) === 'System', 'Author shown with role');
session.logout();

console.log(`\n${passed} tests passed`);
