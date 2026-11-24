// HOLMIA - End-to-end journeys on ONE local database.
// Three app sessions (Buyer, Seller, Agent) share the same SQLite file, like
// three phones on the same backend. The file is then closed and reopened to
// prove every decision was persisted.
//   - at least three functions per role
//   - a sale and a rental from creation to the final status
//   - an Agent portfolio spanning several listings and statuses
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { SQLiteDatabase } from '../database/db.ts';
import { seedDatabase } from '../database/seed.ts';
import { SessionService, AccessDeniedError } from '../services/sessionService.ts';
import { PropertyRepository } from '../repositories/propertyRepository.ts';

let passed = 0;
const demonstrated: Record<string, Set<string>> = { buyer: new Set(), seller: new Set(), agent: new Set() };
function check(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passed++;
  console.log(`  [PASS] ${message}`);
}
function uses(role: 'buyer' | 'seller' | 'agent', fn: string) {
  demonstrated[role].add(fn);
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

console.log('=== HOLMIA - End-to-end journeys: Buyer, Seller, Agent on one local database (ABD) ===\n');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'holmia-e2e-'));
const file = path.join(dir, 'holmia-e2e.db');
let db = new SQLiteDatabase(file);
seedDatabase(db);
db.run(`INSERT INTO users (id, username, full_name, email, role, created_at)
        VALUES ('buyer-2', 'olivia_b', 'Olivia Brown', 'olivia@example.com', 'buyer', datetime('now'))`);

// Three "devices", one database.
const buyerApp = new SessionService(db);
const buyer2App = new SessionService(db);
const sellerApp = new SessionService(db);
const agentApp = new SessionService(db);
buyerApp.login('buyer@holmia.example');
buyer2App.login('olivia@example.com');
sellerApp.login('seller@holmia.example');
agentApp.login('agent@holmia.example');

let saleId = '';
let rentId = '';
try {
  // ---------------------------------------------------------------- SALE
  console.log('--- 1. Sale, end to end ---');
  const sale = sellerApp.createProperty({
    title: 'Victorian terrace in Bristol', description: 'Three bedrooms, garden, near Clifton.',
    price: 515000, listing_type: 'sale', property_type: 'house', location: 'Bristol, UK',
    agent_id: 'user-agent-1',
  });
  saleId = sale.id;
  uses('seller', 'createProperty');
  check(sale.status === 'draft', 'Seller creates a sale listing (Draft, agent assigned)');
  check(!buyerApp.getPublicCatalog().some((p) => p.id === saleId), 'Draft is not in the Buyer catalogue');

  sellerApp.updateProperty(saleId, { price: 509000, description: 'Three bedrooms, south garden, near Clifton.' });
  uses('seller', 'updateProperty');
  agentApp.activateProperty(saleId, 'Reviewed and published by the agent');
  uses('agent', 'activateProperty');
  check(buyerApp.getPublicCatalog({ location: 'bristol', listingType: 'sale' }).some((p) => p.id === saleId), 'Agent publishes; Buyer finds it with filters');
  uses('buyer', 'getPublicCatalog');

  const enquiry = buyerApp.submitEnquiry(saleId, 'Is the loft convertible?');
  uses('buyer', 'submitEnquiry');
  check(agentApp.getReceivedEnquiries().some((e) => e.id === enquiry.id), 'Assigned agent receives the enquiry');
  uses('agent', 'getReceivedEnquiries');
  agentApp.replyToEnquiry(enquiry.id, 'Yes, planning permission was granted in 2024.');
  uses('agent', 'replyToEnquiry');
  check(buyerApp.getMyEnquiries().find((e) => e.id === enquiry.id)?.reply?.includes('planning') === true, 'Buyer reads the reply');
  uses('buyer', 'getMyEnquiries');

  const low = buyerApp.submitOffer(saleId, 490000);
  const high = buyer2App.submitOffer(saleId, 505000);
  uses('buyer', 'submitOffer');
  check(sellerApp.getPropertyOffers(saleId).length === 2, 'Seller sees both offers');
  uses('seller', 'getPropertyOffers');
  expectThrow(() => buyerApp.acceptOffer(high.id), AccessDeniedError, '', 'A Buyer cannot accept an offer');
  sellerApp.acceptOffer(high.id);
  uses('seller', 'acceptOffer');
  check(buyer2App.getMyOffers()[0].status === 'accepted', 'Winning Buyer sees Accepted');
  check(buyerApp.getMyOffers().find((o) => o.id === low.id)?.status === 'rejected', 'Other Buyer sees Rejected');
  uses('buyer', 'getMyOffers');
  expectThrow(() => sellerApp.updateProperty(saleId, { price: 1 }), Error, 'locked', 'Price locked once Under Offer');
  expectThrow(() => sellerApp.deleteProperty(saleId), Error, 'Cannot delete', 'Under Offer listing cannot be deleted');

  agentApp.changePropertyStatus(saleId, 'sold', 'Completion signed');
  uses('agent', 'changePropertyStatus');
  expectThrow(() => sellerApp.changePropertyStatus(saleId, 'active'), Error, 'Terminal', 'Sold is final');
  const saleHistory = sellerApp.getPropertyHistory(saleId).map((h) => `${h.old_status}->${h.new_status}`);
  uses('seller', 'getPropertyHistory');
  check(saleHistory.join(',') === 'under_offer->sold,active->under_offer,draft->active,none->draft', 'Sale history: Draft → Active → Under Offer → Sold');

  // -------------------------------------------------------------- RENTAL
  console.log('\n--- 2. Rental, end to end ---');
  const rent = sellerApp.createProperty({
    title: 'Riverside studio in Leeds', description: 'Furnished studio, bills included.',
    price: 950, listing_type: 'rent', property_type: 'studio', location: 'Leeds, UK',
    agent_id: 'user-agent-1', status: 'active',
  });
  rentId = rent.id;
  check(buyerApp.getPublicCatalog({ listingType: 'rent', maxPrice: 1000 }).some((p) => p.id === rentId), 'Rental listed and found by price filter');

  const a1 = buyerApp.submitRentalApplication(rentId, '2027-01-10', 'Nurse at Leeds General, references available');
  const a2 = buyer2App.submitRentalApplication(rentId, '2027-02-01', null);
  uses('buyer', 'submitRentalApplication');
  const received = agentApp.getPropertyRentalApplications(rentId);
  uses('agent', 'getPropertyRentalApplications');
  check(received.length === 2 && received.some((a) => a.notes?.startsWith('Nurse') && a.move_in_date === '2027-01-10'), 'Agent sees both applications with move-in date and notes');
  agentApp.decideRentalApplication(a1.id, 'accepted');
  uses('agent', 'decideRentalApplication');
  check(buyerApp.getMyRentalApplications().find((a) => a.id === a1.id)?.status === 'accepted', 'Chosen tenant sees Accepted');
  check(buyer2App.getMyRentalApplications().find((a) => a.id === a2.id)?.status === 'rejected', 'Other applicant sees Rejected');
  uses('buyer', 'getMyRentalApplications');
  expectThrow(() => buyer2App.submitRentalApplication(rentId, '2027-03-01'), Error, "must be 'active'", 'No new application once Under Offer');
  agentApp.completeRental(a1.id);
  uses('agent', 'completeRental');
  check(sellerApp.getMyPortfolio().find((p) => p.id === rentId)?.status === 'rented', 'Seller sees the studio Rented');
  uses('seller', 'getMyPortfolio');
  expectThrow(() => agentApp.changePropertyStatus(rentId, 'active'), Error, 'Terminal', 'Rented is final');
  check(!buyerApp.getPublicCatalog().some((p) => p.id === rentId || p.id === saleId), 'Sold and Rented listings left the catalogue');

  // ------------------------------------------------------- AGENT PORTFOLIO
  console.log('\n--- 3. Agent portfolio across several listings ---');
  const portfolio = agentApp.getMyPortfolio();
  uses('agent', 'getMyPortfolio');
  const statuses = new Set(portfolio.map((p) => p.status));
  check(portfolio.length >= 5 && portfolio.every((p) => p.agent_id === 'user-agent-1'), `Portfolio holds ${portfolio.length} assigned listings, only the agent's`);
  check(statuses.has('active') && statuses.has('sold') && statuses.has('rented'), 'Portfolio mixes Active, Sold and Rented listings');
  check(!portfolio.some((p) => p.agent_id === null), 'Direct (no-agent) listings are not in the agent portfolio');
  agentApp.updateProperty('prop-5', { description: 'Open-plan loft, new photos added by the agent.' });
  uses('agent', 'updateProperty');
  expectThrow(() => agentApp.updateProperty('prop-2', { title: 'Not mine' }), AccessDeniedError, 'assigned', 'Agent cannot edit an unassigned listing');
  expectThrow(() => agentApp.deleteProperty('prop-5'), AccessDeniedError, '', 'Agent cannot delete a listing (owner only)');
  const metrics = new PropertyRepository(db);
  check(metrics.countActiveListingsByUser('user-agent-1') === portfolio.filter((p) => p.status === 'active').length, 'Active-listing metric matches the portfolio');

  // Clean-up journey: a Seller deletes an unwanted draft, linked rows stay consistent.
  const draft = sellerApp.createProperty({ title: 'Duplicate draft', price: 1000, listing_type: 'rent', property_type: 'flat', location: 'Leeds' });
  sellerApp.deleteProperty(draft.id);
  uses('seller', 'deleteProperty');
  check(sellerApp.getMyPortfolio().every((p) => p.id !== draft.id), 'Seller deletes an unwanted draft');

  console.log('\n--- 4. Same database after restart ---');
  for (const app of [buyerApp, buyer2App, sellerApp, agentApp]) app.logout();
  db.close();
  db = new SQLiteDatabase(file);
  const reopened = new SessionService(db);
  reopened.login('seller@holmia.example');
  const after = reopened.getMyPortfolio();
  check(after.find((p) => p.id === saleId)?.status === 'sold' && after.find((p) => p.id === rentId)?.status === 'rented', 'Sold and Rented statuses persisted on disk');
  check(reopened.getPropertyOffers(saleId).filter((o) => o.status === 'accepted').length === 1, 'Exactly one accepted offer persisted');
  reopened.logout();
  reopened.login('buyer@holmia.example');
  check(reopened.getMyEnquiries().some((e) => e.reply?.includes('planning')), 'Enquiry reply persisted for the Buyer');
  reopened.logout();
  check(db.query(`PRAGMA foreign_key_check`).length === 0, 'No orphan rows (foreign key check)');

  console.log('\n--- 5. Functions demonstrated per role ---');
  for (const role of ['buyer', 'seller', 'agent']) {
    const list = [...demonstrated[role]];
    console.log(`  ${role.padEnd(6)} (${list.length}): ${list.join(', ')}`);
    check(list.length >= 3, `${role}: at least three functions demonstrated`);
  }
} finally {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${passed} tests passed`);
