import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { SQLiteDatabase } from '../database/db.ts';
import { seedDatabase } from '../database/seed.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { PropertyRepository } from '../repositories/propertyRepository.ts';
import { OfferRepository } from '../repositories/offerRepository.ts';
import { RentalRepository } from '../repositories/rentalRepository.ts';
import { EnquiryRepository } from '../repositories/enquiryRepository.ts';

let passed = 0;

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`  [FAIL] ${label}`);
    process.exit(1);
  }
  passed++;
  console.log(`  [PASS] ${label}`);
}

console.log('===========================================================');
console.log('   HOLMIA - LOCAL SQLITE PERSISTENCE & INTEGRITY SUITE     ');
console.log('===========================================================\n');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holmia-persist-'));
const dbFile = path.join(tmpDir, 'holmia-test.db');
let db: SQLiteDatabase | null = null;

try {
  // --- Phase 1: Initial creation, seed reproducibility & full entity writes ---
  console.log('--- 1. Reproducible Seed & Entity Writes on Disk ---');
  db = new SQLiteDatabase(dbFile);
  const fkPragma = db.get<{ foreign_keys: number }>('PRAGMA foreign_keys;');
  assert(fkPragma?.foreign_keys === 1, 'PRAGMA foreign_keys is enabled (1)');

  seedDatabase(db);
  const propsFirstSeed = db.query('SELECT id FROM properties');
  assert(propsFirstSeed.length === 6, 'First seed inserts 6 demo properties');

  // Add an enquiry and re-run seedDatabase to prove idempotency with FK constraints
  const enquiryRepo1 = new EnquiryRepository(db);
  enquiryRepo1.create({
    property_id: 'prop-1',
    buyer_id: 'user-buyer-1',
    message: 'Is the balcony south-facing?',
  });
  seedDatabase(db);
  const propsSecondSeed = db.query('SELECT id FROM properties');
  assert(propsSecondSeed.length === 6, 'Re-running seedDatabase is clean and idempotent even with enquiries');

  const userRepo1 = new UserRepository(db);
  const propRepo1 = new PropertyRepository(db);
  const offerRepo1 = new OfferRepository(db);
  const rentalRepo1 = new RentalRepository(db);

  // Create a fresh buyer & draft property, move through lifecycle, submit offers & rental app
  const buyer2 = userRepo1.create({
    id: 'user-buyer-persist',
    username: 'persist_buyer',
    full_name: 'Persist Buyer',
    email: 'persist.buyer@holmia.example',
    role: 'buyer',
  });
  assert(buyer2.id === 'user-buyer-persist', 'Created persistent buyer user');

  const createdProp = propRepo1.create({
    id: 'prop-persist-sale',
    seller_id: 'user-seller-1',
    agent_id: 'user-agent-1',
    title: 'Georgian Townhouse in Bath',
    description: 'Restored period townhouse with garden.',
    price: 750000,
    listing_type: 'sale',
    property_type: 'house',
    location: 'Bath, UK',
    status: 'draft',
  });
  propRepo1.updateStatus(createdProp.id, 'active', 'user-agent-1', 'Approved after moderation');

  const offerA = offerRepo1.create({ property_id: createdProp.id, buyer_id: 'user-buyer-1', amount: 740000 });
  const offerB = offerRepo1.create({ property_id: createdProp.id, buyer_id: buyer2.id, amount: 755000 });
  offerRepo1.acceptOffer(offerB.id, 'user-agent-1');

  const rentalApp = rentalRepo1.create({
    property_id: 'prop-3',
    buyer_id: buyer2.id,
    move_in_date: '2027-01-15',
    notes: 'Postgraduate student, references ready.',
  });
  const enq = enquiryRepo1.create({
    property_id: createdProp.id,
    buyer_id: buyer2.id,
    message: 'When can we arrange a viewing?',
  });
  enquiryRepo1.reply(enq.id, 'Thursday afternoon works well.', 'user-agent-1');

  // Close the SQLite database completely to simulate app restart
  db.close();
  db = null;
  assert(fs.existsSync(dbFile), 'SQLite database file exists on disk after close()');

  // --- Phase 2: Reopen database from disk and verify full persistence ---
  console.log('\n--- 2. Persistence Verification After Close & Reopen ---');
  db = new SQLiteDatabase(dbFile);
  const userRepo2 = new UserRepository(db);
  const propRepo2 = new PropertyRepository(db);
  const offerRepo2 = new OfferRepository(db);
  const rentalRepo2 = new RentalRepository(db);
  const enquiryRepo2 = new EnquiryRepository(db);

  const reopenedBuyer = userRepo2.findById('user-buyer-persist');
  assert(reopenedBuyer?.email === 'persist.buyer@holmia.example', 'Buyer persisted across restart');

  const reopenedProp = propRepo2.findById('prop-persist-sale');
  assert(reopenedProp?.status === 'under_offer', 'Property status (under_offer) persisted across restart');

  const history = propRepo2.getStatusHistory('prop-persist-sale');
  assert(history.length === 3, `Full status history (3 transitions) persisted across restart (found ${history.length})`);
  assert(
    history[0].new_status === 'draft' && history[1].new_status === 'active' && history[2].new_status === 'under_offer',
    'Status history chronological chain intact after restart'
  );

  const reopenedOfferA = offerRepo2.findById(offerA.id);
  const reopenedOfferB = offerRepo2.findById(offerB.id);
  assert(reopenedOfferB?.status === 'accepted', 'Accepted offer persisted after restart');
  assert(reopenedOfferA?.status === 'rejected', 'Auto-rejected competing offer persisted after restart');

  const reopenedRental = rentalRepo2.findById(rentalApp.id);
  assert(reopenedRental?.move_in_date === '2027-01-15', 'Rental application persisted after restart');

  const reopenedEnquiries = enquiryRepo2.findByBuyer(buyer2.id);
  assert(
    reopenedEnquiries.length === 1 && reopenedEnquiries[0].reply === 'Thursday afternoon works well.',
    'Enquiry and stored agent reply persisted after restart'
  );

  // --- Phase 3: Cascade Deletes & Zero-Orphan Foreign Key Check ---
  console.log('\n--- 3. Cascade Deletion & Zero-Orphan Integrity ---');
  const deletableProp = propRepo2.create({
    id: 'prop-cascade-check',
    seller_id: 'user-seller-1',
    agent_id: 'user-agent-1',
    title: 'Temporary Active Flat',
    description: 'Used to verify cascading deletes.',
    price: 200000,
    listing_type: 'sale',
    property_type: 'flat',
    location: 'Leeds, UK',
    status: 'active',
  });
  enquiryRepo2.create({
    property_id: deletableProp.id,
    buyer_id: buyer2.id,
    message: 'Active test enquiry',
  });
  offerRepo2.create({
    property_id: deletableProp.id,
    buyer_id: buyer2.id,
    amount: 195000,
  });

  const deleted = propRepo2.delete(deletableProp.id);
  assert(deleted === true, 'Active property deleted cleanly');

  const orphanHistory = db.query('SELECT id FROM status_history WHERE property_id = ?', [deletableProp.id]);
  const orphanOffers = db.query('SELECT id FROM offers WHERE property_id = ?', [deletableProp.id]);
  const orphanEnquiries = db.query('SELECT id FROM enquiries WHERE property_id = ?', [deletableProp.id]);
  assert(orphanHistory.length === 0, 'No orphan status_history rows after property deletion');
  assert(orphanOffers.length === 0, 'No orphan offer rows after property deletion');
  assert(orphanEnquiries.length === 0, 'No orphan enquiry rows after property deletion');

  const fkViolations = db.query('PRAGMA foreign_key_check;');
  assert(fkViolations.length === 0, 'PRAGMA foreign_key_check reports 0 integrity violations');

  db.close();
  db = null;
  console.log(`\n${passed} persistence & integrity tests passed`);
} finally {
  try {
    db?.close();
  } catch {
    // ignore close error
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore Windows cleanup race
  }
}
