import { SQLiteDatabase } from '../database/db.ts';
import { seedDatabase } from '../database/seed.ts';
import {
  SessionService,
  AuthenticationError,
  AuthenticationRequiredError,
  AccessDeniedError
} from '../services/sessionService.ts';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  [PASS] ${message}`);
}

function expectError(fn: () => void, expectedErrorType: any, expectedMessagePart?: string, testName?: string) {
  totalTests++;
  try {
    fn();
    console.error(`  [FAIL] ${testName || 'Expected error but none was thrown'}`);
    throw new Error('Expected function to throw an error');
  } catch (error: any) {
    const isInstance = error instanceof expectedErrorType;
    const matchesMessage = expectedMessagePart ? error.message.includes(expectedMessagePart) : true;
    if (isInstance && matchesMessage) {
      passedTests++;
      console.log(`  [PASS] ${testName || `Caught expected ${expectedErrorType.name}`}: "${error.message}"`);
    } else {
      console.error(`  [FAIL] ${testName}: Unexpected error:`, error);
      throw error;
    }
  }
}

console.log('====================================================');
console.log('   HOLMIA - TESTS GESTION DE SESSION & ACCÈS (ABD)  ');
console.log('====================================================\n');

// Initialize isolated in-memory test database and seed it
const db = new SQLiteDatabase(':memory:');
seedDatabase(db);
const session = new SessionService(db);

// -------------------------------------------------------------
// 1. Tests Session Management (Login / Logout / Persistence)
// -------------------------------------------------------------
console.log('--- 1. Tests Session Management (Login & Logout) ---');

assert(!session.isAuthenticated(), 'User is initially not authenticated');
assert(session.getCurrentUser() === null, 'Current user is null initially');

// Test login by email
const buyer = session.login('buyer@holmia.example');
assert(session.isAuthenticated(), 'User is authenticated after login');
assert(buyer.role === 'buyer', 'Logged in user has role buyer');
assert(session.getCurrentUser()?.email === 'buyer@holmia.example', 'Current user matches buyer email');

// Test logout
session.logout();
assert(!session.isAuthenticated(), 'User is logged out successfully');
assert(session.getCurrentUser() === null, 'Current user is null after logout');

// Test login by username
const seller = session.login('demo_seller');
assert(session.isAuthenticated(), 'Login by username succeeds');
assert(seller.role === 'seller', 'Logged in user has role seller');

// Test login by user ID
session.logout();
const agent = session.login('user-agent-1');
assert(session.isAuthenticated(), 'Login by user ID succeeds');
assert(agent.role === 'agent', 'Logged in user has role agent');

// Test login with invalid identifier
expectError(
  () => session.login('non_existent_user'),
  AuthenticationError,
  "User 'non_existent_user' not found",
  'Reject login for non-existent user'
);

expectError(
  () => session.login('   '),
  AuthenticationError,
  'Identifier (email, username or ID) is required',
  'Reject empty login identifier'
);

// -------------------------------------------------------------
// 2. Tests Buyer: Consultation & Offres (Interdictions respectées)
// -------------------------------------------------------------
console.log('\n--- 2. Tests Rôle Buyer (Consultation permise, écritures vendeurs bloquées) ---');

session.login('buyer@holmia.example');

// 2.1 Buyer can browse active catalog
const publicCatalog = session.getPublicCatalog();
assert(publicCatalog.length > 0, `Buyer can view public active catalog (${publicCatalog.length} properties)`);
assert(publicCatalog.every(p => p.status === 'active'), 'All catalog properties are active');

// 2.2 Buyer CANNOT have a portfolio
expectError(
  () => session.getMyPortfolio(),
  AccessDeniedError,
  "Role 'buyer' does not have a property portfolio",
  'Buyer cannot access property portfolio'
);

// 2.3 Buyer CANNOT create property
expectError(
  () => session.createProperty({
    title: 'Tentative Buyer',
    price: 300000,
    listing_type: 'sale',
    property_type: 'flat',
    location: 'Paris'
  }),
  AccessDeniedError,
  "Action forbidden for role 'buyer'. Required role(s): seller",
  'Buyer CANNOT create a property'
);

// 2.4 Buyer CANNOT edit property
expectError(
  () => session.updateProperty('prop-1', { price: 350000 }),
  AccessDeniedError,
  "Action forbidden for role 'buyer'",
  'Buyer CANNOT edit a property'
);

// 2.5 Buyer CANNOT delete property
expectError(
  () => session.deleteProperty('prop-1'),
  AccessDeniedError,
  "Action forbidden for role 'buyer'",
  'Buyer CANNOT delete a property'
);

// 2.6 Buyer CANNOT moderate/activate draft property
expectError(
  () => session.activateProperty('prop-1'),
  AccessDeniedError,
  "Action forbidden for role 'buyer'",
  'Buyer CANNOT activate a property'
);

// 2.7 Buyer CAN submit purchase offer on sale property
const offer = session.submitOffer('prop-1', 410000);
assert(offer.amount === 410000, 'Buyer can submit an offer on a sale property');
assert(offer.buyer_id === buyer.id, 'Offer is tied to buyer id');

// 2.8 Buyer CAN submit rental application on rent property
const rentalApp = session.submitRentalApplication('prop-3', '2026-12-01', 'Dossier complet');
assert(rentalApp.property_id === 'prop-3', 'Buyer can submit a rental application');

// 2.9 Buyer CANNOT review offers
expectError(
  () => session.getPropertyOffers('prop-1'),
  AccessDeniedError,
  "Action forbidden for role 'buyer'",
  'Buyer CANNOT view property offers'
);

// -------------------------------------------------------------
// 3. Tests Rôle Seller (Gestion de ses biens & offres, isolation des autres)
// -------------------------------------------------------------
console.log('\n--- 3. Tests Rôle Seller (Gestion de ses biens, isolation des autres vendeurs) ---');

session.login('seller@holmia.example');

// 3.1 Seller can create property (automatically bound to seller_id)
const newProp = session.createProperty({
  title: 'Nouvelle Maison Seller',
  description: 'Belle maison de test',
  price: 490000,
  listing_type: 'sale',
  property_type: 'house',
  location: 'Bordeaux',
  status: 'draft'
});
assert(newProp.seller_id === seller.id, 'New property is automatically bound to current seller ID');
assert(newProp.status === 'draft', 'New property is created in draft status');

// 3.2 Seller can view portfolio
const sellerPortfolio = session.getMyPortfolio();
assert(sellerPortfolio.length > 0, `Seller sees their own portfolio (${sellerPortfolio.length} properties)`);
assert(sellerPortfolio.every(p => p.seller_id === seller.id), 'All portfolio properties belong to this seller');

// 3.3 Seller can edit their own property
const updatedProp = session.updateProperty(newProp.id, { price: 500000 }, 'Ajustement de prix vendeur');
assert(updatedProp.price === 500000, 'Seller can edit their own property price');

// 3.4 Seller CANNOT edit another seller\'s property
// Create another seller in DB to test isolation
db.run(
  `INSERT INTO users (id, username, full_name, email, role, created_at)
   VALUES ('other-seller', 'other_seller', 'Other Seller', 'other@example.com', 'seller', datetime('now'))`
);
db.run(
  `INSERT INTO properties (id, seller_id, title, price, listing_type, property_type, location, status, created_at, updated_at)
   VALUES ('prop-other', 'other-seller', 'Villa Other', 990000, 'sale', 'house', 'Nice', 'active', datetime('now'), datetime('now'))`
);

expectError(
  () => session.updateProperty('prop-other', { price: 900000 }),
  AccessDeniedError,
  'Seller can only modify their own properties',
  'Seller CANNOT edit another seller property'
);

// 3.5 Seller CANNOT delete another seller\'s property
expectError(
  () => session.deleteProperty('prop-other'),
  AccessDeniedError,
  'Seller can only delete their own properties',
  'Seller CANNOT delete another seller property'
);

// 3.6 Seller can view and accept offers on their own property
const sellerOffers = session.getPropertyOffers('prop-1');
assert(sellerOffers.length > 0, 'Seller can view offers on their own property');

const acceptResult = session.acceptOffer(offer.id);
assert(acceptResult.acceptedOffer.status === 'accepted', 'Seller can accept an offer on their property');
assert(acceptResult.property.status === 'under_offer', 'Property is moved to under_offer');

// 3.7 Seller CANNOT view offers on another seller\'s property
expectError(
  () => session.getPropertyOffers('prop-other'),
  AccessDeniedError,
  'Seller can only view offers for their own properties',
  'Seller CANNOT view offers on another seller property'
);

// 3.8 Seller CANNOT submit purchase offers (only buyers)
expectError(
  () => session.submitOffer('prop-2', 400000),
  AccessDeniedError,
  "Action forbidden for role 'seller'. Required role(s): buyer",
  'Seller CANNOT submit purchase offers'
);

// -------------------------------------------------------------
// 4. Tests Rôle Agent (Gestion du portefeuille assigné, modération)
// -------------------------------------------------------------
console.log('\n--- 4. Tests Rôle Agent (Portefeuille assigné, modération & blocage non-assigné) ---');

session.login('agent@holmia.example');

// 4.1 Agent can view assigned portfolio
const agentPortfolio = session.getMyPortfolio();
assert(agentPortfolio.length > 0, `Agent sees their assigned portfolio (${agentPortfolio.length} properties)`);
assert(agentPortfolio.every(p => p.agent_id === agent.id), 'All portfolio properties are assigned to this agent');

// 4.2 Agent CANNOT create property as a seller
expectError(
  () => session.createProperty({
    title: 'Tentative Agent',
    price: 250000,
    listing_type: 'sale',
    property_type: 'flat',
    location: 'Lille'
  }),
  AccessDeniedError,
  "Action forbidden for role 'agent'. Required role(s): seller",
  'Agent CANNOT create properties as a seller'
);

// 4.3 Agent can update an assigned property
const agentUpdated = session.updateProperty('prop-1', { description: 'Description enrichie par agent' });
assert(agentUpdated.description === 'Description enrichie par agent', 'Agent can update assigned property');

// 4.4 Agent CANNOT update a property not assigned to them (prop-2 has agent_id null)
expectError(
  () => session.updateProperty('prop-2', { description: 'Tentative non assigné' }),
  AccessDeniedError,
  'Agent can only modify properties assigned to them',
  'Agent CANNOT update unassigned property'
);

// 4.5 Agent CANNOT delete properties (deletion reserved to seller)
expectError(
  () => session.deleteProperty('prop-1'),
  AccessDeniedError,
  "Action forbidden for role 'agent'. Required role(s): seller",
  'Agent CANNOT delete properties'
);

// 4.6 Agent can moderate and activate assigned draft property
// Assign newProp to this agent and activate
db.run(`UPDATE properties SET agent_id = ? WHERE id = ?`, [agent.id, newProp.id]);
const activatedProp = session.activateProperty(newProp.id, 'Validé après revue agent');
assert(activatedProp.status === 'active', 'Agent can activate assigned draft property');

// -------------------------------------------------------------
// 5. Tests Déconnexion & Sécurité Hors-Session
// -------------------------------------------------------------
console.log('\n--- 5. Tests Déconnexion & Blocage Non-Authentifié ---');

session.logout();
assert(!session.isAuthenticated(), 'User is cleanly logged out');

// Anonymous can still browse public catalog
const publicAnon = session.getPublicCatalog();
assert(publicAnon.length > 0, 'Anonymous users can view public active catalog');

// Protected actions MUST throw AuthenticationRequiredError
expectError(
  () => session.getMyPortfolio(),
  AuthenticationRequiredError,
  'Authentication required',
  'Anonymous blocked from portfolio'
);

expectError(
  () => session.createProperty({ title: 'Test', price: 100, listing_type: 'sale', property_type: 'flat', location: 'X' }),
  AuthenticationRequiredError,
  'Authentication required',
  'Anonymous blocked from creating property'
);

expectError(
  () => session.submitOffer('prop-1', 100000),
  AuthenticationRequiredError,
  'Authentication required',
  'Anonymous blocked from submitting offer'
);

expectError(
  () => session.submitRentalApplication('prop-3', '2026-12-01'),
  AuthenticationRequiredError,
  'Authentication required',
  'Anonymous blocked from rental application'
);

console.log('\n====================================================');
console.log(`   RÉSULTAT: ${passedTests}/${totalTests} tests réussis (0 échec)`);
console.log('====================================================\n');

