import { SQLiteDatabase } from '../database/db.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { PropertyRepository } from '../repositories/propertyRepository.ts';
import { OfferRepository } from '../repositories/offerRepository.ts';
import { RentalRepository } from '../repositories/rentalRepository.ts';

// Test statistics
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}${details ? ' - ' + details : ''}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

function assertThrows(fn: () => void, testName: string, expectedErrorSnippet?: string): void {
  totalTests++;
  try {
    fn();
    failedTests++;
    console.error(`  [FAIL] ${testName} - Expected error was not thrown`);
    throw new Error(`Expected function to throw for: ${testName}`);
  } catch (err: any) {
    if (expectedErrorSnippet && !err.message.toLowerCase().includes(expectedErrorSnippet.toLowerCase())) {
      failedTests++;
      console.error(
        `  [FAIL] ${testName} - Got error "${err.message}", expected snippet "${expectedErrorSnippet}"`
      );
      throw err;
    }
    passedTests++;
    console.log(`  [PASS] ${testName} (caught expected error: "${err.message}")`);
  }
}

async function runAllTests(): Promise<void> {
  console.log('====================================================');
  console.log('   HOLMIA - SUITE DE TESTS DES DEPOTS CRUD (SQLite)  ');
  console.log('====================================================\n');

  // Use an isolated in-memory SQLite database for clean reproducible tests
  const db = new SQLiteDatabase(':memory:');
  const userRepo = new UserRepository(db);
  const propertyRepo = new PropertyRepository(db);
  const offerRepo = new OfferRepository(db);
  const rentalRepo = new RentalRepository(db);

  // ----------------------------------------------------
  // SECTION 1: UserRepository CRUD & Roles
  // ----------------------------------------------------
  console.log('--- 1. Tests UserRepository (CRUD & Roles) ---');

  const buyer = userRepo.create({
    id: 'user-b1',
    username: 'buyer_alice',
    full_name: 'Alice Buyer',
    email: 'alice@example.com',
    role: 'buyer'
  });
  assert(buyer.id === 'user-b1' && buyer.role === 'buyer', 'Create Buyer user');

  const seller = userRepo.create({
    id: 'user-s1',
    username: 'seller_bob',
    full_name: 'Bob Seller',
    email: 'bob@example.com',
    role: 'seller'
  });
  assert(seller.id === 'user-s1' && seller.role === 'seller', 'Create Seller user');

  const agent = userRepo.create({
    id: 'user-a1',
    username: 'agent_clara',
    full_name: 'Clara Agent',
    email: 'clara@example.com',
    role: 'agent'
  });
  assert(agent.id === 'user-a1' && agent.role === 'agent', 'Create Agent user');

  // Read tests
  const foundById = userRepo.findById('user-b1');
  assert(foundById?.full_name === 'Alice Buyer', 'Find user by ID');

  const foundByEmail = userRepo.findByEmail('alice@example.com');
  assert(foundByEmail?.id === 'user-b1', 'Find user by Email (case-insensitive)');

  const foundByUsername = userRepo.findByUsername('seller_bob');
  assert(foundByUsername?.id === 'user-s1', 'Find user by Username');

  // Filter by role
  const allBuyers = userRepo.findAll({ role: 'buyer' });
  assert(allBuyers.length === 1 && allBuyers[0].id === 'user-b1', 'Filter users by role buyer');

  // Update test
  const updatedBuyer = userRepo.update('user-b1', { full_name: 'Alice B. Smith' });
  assert(updatedBuyer.full_name === 'Alice B. Smith', 'Update user full name');

  // Error integrity: duplicate email rejected
  assertThrows(
    () => userRepo.create({ full_name: 'Fake', email: 'alice@example.com', role: 'buyer' }),
    'Reject duplicate user email',
    'already exists'
  );

  // Error integrity: invalid role rejected
  assertThrows(
    () => userRepo.create({ full_name: 'Invalid Role', email: 'inv@example.com', role: 'admin' as any }),
    'Reject invalid user role',
    'Invalid role'
  );

  // Delete unused user
  const tempUser = userRepo.create({ full_name: 'Temp', email: 'temp@example.com', role: 'buyer' });
  const deleted = userRepo.delete(tempUser.id);
  assert(deleted && userRepo.findById(tempUser.id) === null, 'Delete user without relations');

  console.log('\n--- 2. Tests PropertyRepository (CRUD, Filters & Lifecycle) ---');

  // Create property for Sale
  const propSale = propertyRepo.create({
    id: 'prop-sale-1',
    seller_id: 'user-s1',
    agent_id: 'user-a1',
    title: 'Bel appartement haussmannien',
    description: '4 pièces, parquet, moulures, cheminées',
    price: 450000,
    listing_type: 'sale',
    property_type: 'flat',
    location: 'Paris 08, France'
  });
  assert(propSale.status === 'draft', 'Property created with default status draft');

  // Create property for Rent
  const propRent = propertyRepo.create({
    id: 'prop-rent-1',
    seller_id: 'user-s1',
    agent_id: 'user-a1',
    title: 'Studio moderne quartier latin',
    description: 'Idéal étudiant',
    price: 850,
    listing_type: 'rent',
    property_type: 'studio',
    location: 'Paris 05, France',
    status: 'active'
  });
  assert(propRent.status === 'active', 'Rental property created with status active');

  // Additional property for filters test
  propertyRepo.create({
    id: 'prop-sale-2',
    seller_id: 'user-s1',
    title: 'Villa contemporaine avec piscine',
    description: 'Grand jardin',
    price: 980000,
    listing_type: 'sale',
    property_type: 'house',
    location: 'Lyon, France',
    status: 'active'
  });

  // Filters check
  const searchParis = propertyRepo.findAll({ location: 'paris' });
  assert(searchParis.length === 2, 'Filter properties by location substring');

  const searchPriceRange = propertyRepo.findAll({ minPrice: 400000, maxPrice: 500000 });
  assert(
    searchPriceRange.length === 1 && searchPriceRange[0].id === 'prop-sale-1',
    'Filter properties by price range'
  );

  const searchRentals = propertyRepo.findAll({ listingType: 'rent' });
  assert(
    searchRentals.length === 1 && searchRentals[0].id === 'prop-rent-1',
    'Filter properties by listing type rent'
  );

  const searchHouses = propertyRepo.findAll({ propertyType: 'house' });
  assert(
    searchHouses.length === 1 && searchHouses[0].id === 'prop-sale-2',
    'Filter properties by property type house'
  );

  // Seller integrity check: buyer cannot be seller
  assertThrows(
    () =>
      propertyRepo.create({
        seller_id: 'user-b1',
        title: 'Illégal',
        price: 100000,
        listing_type: 'sale',
        property_type: 'flat',
        location: 'Paris'
      }),
    'Reject property creation if seller_id is not a seller',
    'must be \'seller\''
  );

  // Agent cannot be the same user as seller
  assertThrows(
    () =>
      propertyRepo.create({
        seller_id: 'user-s1',
        agent_id: 'user-s1',
        title: 'Auto-assignation',
        price: 100000,
        listing_type: 'sale',
        property_type: 'flat',
        location: 'Paris'
      }),
    'Reject agent being the same as seller',
    'Agent cannot be the same user as the seller'
  );

  // ----------------------------------------------------
  // Lifecycle transitions & constraints
  // ----------------------------------------------------
  console.log('\n--- 3. Tests Cycle de Vie & Verrouillages (Draft -> Active -> Under Offer -> Sold) ---');

  // 1. draft -> active
  const activatedProp = propertyRepo.updateStatus('prop-sale-1', 'active', 'user-a1', 'Mise en ligne par agent');
  assert(activatedProp.status === 'active', 'Transition draft -> active');

  // Verify status_history was logged
  let history = propertyRepo.getStatusHistory('prop-sale-1');
  assert(
    history.length === 2 && history[1].old_status === 'draft' && history[1].new_status === 'active',
    'status_history logged transition draft -> active'
  );

  // 2. active -> under_offer
  const underOfferProp = propertyRepo.updateStatus('prop-sale-1', 'under_offer', 'user-a1', 'Offre reçue');
  assert(underOfferProp.status === 'under_offer', 'Transition active -> under_offer');

  // VERIFICATION: Price and Type locking after Under Offer
  assertThrows(
    () => propertyRepo.update('prop-sale-1', { price: 500000 }),
    'Block price update once property is Under Offer',
    'locked'
  );

  assertThrows(
    () => propertyRepo.update('prop-sale-1', { property_type: 'house' }),
    'Block property_type update once property is Under Offer',
    'locked'
  );

  assertThrows(
    () => propertyRepo.update('prop-sale-1', { listing_type: 'rent' }),
    'Block listing_type update once property is Under Offer',
    'locked'
  );

  // Normal updates (e.g. description) are still permitted
  const descUpdated = propertyRepo.update('prop-sale-1', { description: 'Description mise à jour sous offre' });
  assert(descUpdated.description === 'Description mise à jour sous offre', 'Allow editing non-locked fields under offer');

  // 3. under_offer -> sold
  const soldProp = propertyRepo.updateStatus('prop-sale-1', 'sold', 'user-s1', 'Acte de vente signé chez le notaire');
  assert(soldProp.status === 'sold', 'Transition under_offer -> sold');

  // FORBIDDEN RULE: "interdiction de repasser Sold -> Active"
  assertThrows(
    () => propertyRepo.updateStatus('prop-sale-1', 'active'),
    'BLOCK forbidden transition sold -> active',
    'terminal state'
  );

  // Cannot delete a sold property
  assertThrows(
    () => propertyRepo.delete('prop-sale-1'),
    'Block deletion of sold property',
    'Cannot delete property'
  );

  // Verify full history
  history = propertyRepo.getStatusHistory('prop-sale-1');
  assert(history.length === 4, 'Full audit trail of 4 events recorded in status_history');
  assert(history[3].old_status === 'under_offer' && history[3].new_status === 'sold', 'Audit trail matches sold transition');

  // Rented lifecycle & constraint check
  propertyRepo.updateStatus('prop-rent-1', 'under_offer', 'user-a1');
  propertyRepo.updateStatus('prop-rent-1', 'rented', 'user-s1');
  assertThrows(
    () => propertyRepo.updateStatus('prop-rent-1', 'active'),
    'BLOCK forbidden transition rented -> active',
    'terminal state'
  );

  // Agent metrics test
  const activeCount = propertyRepo.countActiveListingsByUser('user-s1');
  assert(activeCount === 1, 'Agent metric: count active listings for seller user');

  const avgPrice = propertyRepo.getAveragePropertyPrice('sale');
  assert(avgPrice === 980000, 'Agent metric: average active sale property price');

  // ----------------------------------------------------
  // SECTION 4: OfferRepository & Atomic Acceptance
  // ----------------------------------------------------
  console.log('\n--- 4. Tests OfferRepository & Acceptation Atomique ---');

  // Create another buyer for competitive bidding
  const buyer2 = userRepo.create({
    id: 'user-b2',
    username: 'buyer_david',
    full_name: 'David Buyer',
    email: 'david@example.com',
    role: 'buyer'
  });

  // Create 3 competitive offers on prop-sale-2 (active, price 980000)
  const offerA = offerRepo.create({
    property_id: 'prop-sale-2',
    buyer_id: 'user-b1',
    amount: 920000
  });
  const offerB = offerRepo.create({
    id: 'offer-target-win',
    property_id: 'prop-sale-2',
    buyer_id: 'user-b2',
    amount: 960000
  });
  const offerC = offerRepo.create({
    property_id: 'prop-sale-2',
    buyer_id: 'user-b1',
    amount: 940000
  });

  assert(offerA.status === 'pending' && offerB.status === 'pending' && offerC.status === 'pending', '3 Offers submitted with pending status');

  const offersForProp = offerRepo.findByPropertyId('prop-sale-2');
  assert(offersForProp.length === 3, 'Find 3 offers for property');

  // Cannot submit offer on a rental property
  assertThrows(
    () => offerRepo.create({ property_id: 'prop-rent-1', buyer_id: 'user-b1', amount: 900 }),
    'Reject offer on rental property',
    'not \'sale\''
  );

  // ATOMIC ACCEPTANCE TEST:
  // Accepting offerB should:
  // 1. Mark offerB as accepted
  // 2. Reject offerA and offerC
  // 3. Move prop-sale-2 to 'under_offer'
  // 4. Log in status_history
  const acceptanceResult = offerRepo.acceptOffer(offerB.id, 'user-s1', 'Accepted best offer of 960k');

  assert(acceptanceResult.acceptedOffer.status === 'accepted', 'Winning offer marked as accepted');
  assert(acceptanceResult.rejectedOffersCount === 2, '2 concurrent offers rejected');
  assert(acceptanceResult.property.status === 'under_offer', 'Property moved atomically to under_offer');

  // Verify competitors are rejected
  const refreshedA = offerRepo.findById(offerA.id);
  const refreshedC = offerRepo.findById(offerC.id);
  assert(refreshedA?.status === 'rejected', 'Concurrent offer A rejected automatically');
  assert(refreshedC?.status === 'rejected', 'Concurrent offer C rejected automatically');

  // Verify status history of property
  const prop2History = propertyRepo.getStatusHistory('prop-sale-2');
  const lastHistory = prop2History[prop2History.length - 1];
  assert(
    lastHistory.old_status === 'active' && lastHistory.new_status === 'under_offer',
    'Property status history records automatic transition to under_offer upon offer acceptance'
  );

  // Cannot accept an already accepted/rejected offer
  assertThrows(
    () => offerRepo.acceptOffer(offerA.id),
    'Cannot accept already rejected offer',
    'expected \'pending\''
  );

  // ----------------------------------------------------
  // SECTION 5: RentalRepository CRUD
  // ----------------------------------------------------
  console.log('\n--- 5. Tests RentalRepository (CRUD & Applications) ---');

  // Create an active rental property for application tests
  const propRent2 = propertyRepo.create({
    id: 'prop-rent-2',
    seller_id: 'user-s1',
    agent_id: 'user-a1',
    title: 'T2 Meublé Gambetta',
    price: 950,
    listing_type: 'rent',
    property_type: 'flat',
    location: 'Lille, France',
    status: 'active'
  });

  const rentalApp = rentalRepo.create({
    id: 'rental-app-1',
    property_id: 'prop-rent-2',
    buyer_id: 'user-b1',
    move_in_date: '2026-12-01',
    notes: 'CDI confirmé, dossier complet'
  });
  assert(rentalApp.status === 'pending', 'Create rental application with status pending');

  // Cannot apply to rent a sale property
  assertThrows(
    () =>
      rentalRepo.create({
        property_id: 'prop-sale-2',
        buyer_id: 'user-b1',
        move_in_date: '2026-12-01'
      }),
    'Reject rental application on sale property',
    'not \'rent\''
  );

  // Read application
  const foundApp = rentalRepo.findById('rental-app-1');
  assert(foundApp?.notes === 'CDI confirmé, dossier complet', 'Find rental application by ID');

  const appsByProp = rentalRepo.findByPropertyId('prop-rent-2');
  assert(appsByProp.length === 1, 'Find rental applications by property');

  // Update application
  const updatedApp = rentalRepo.update('rental-app-1', { notes: 'Dossier avec deux garants' });
  assert(updatedApp.notes === 'Dossier avec deux garants', 'Update rental application notes');

  // Accept application
  const acceptedApp = rentalRepo.acceptApplication('rental-app-1');
  assert(acceptedApp.status === 'accepted', 'Accept rental application');

  // Create another application and reject it
  const rentalApp2 = rentalRepo.create({
    property_id: 'prop-rent-2',
    buyer_id: 'user-b2',
    move_in_date: '2027-01-01'
  });
  const rejectedApp = rentalRepo.rejectApplication(rentalApp2.id);
  assert(rejectedApp.status === 'rejected', 'Reject rental application');

  // Delete rejected application
  const deletedApp = rentalRepo.delete(rentalApp2.id);
  assert(deletedApp && rentalRepo.findById(rentalApp2.id) === null, 'Delete rental application');

  db.close();

  console.log('\n====================================================');
  console.log(`   RÉSULTAT: ${passedTests}/${totalTests} tests réussis (0 échec)`);
  console.log('====================================================\n');
}

runAllTests().catch((err) => {
  console.error('\nERREUR DANS LA SUITE DE TESTS :', err);
  process.exit(1);
});
