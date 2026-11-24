import { SQLiteDatabase, getDatabase } from './db.ts';

export function seedDatabase(db: SQLiteDatabase): void {
  db.transaction(() => {
    // Clean existing records in reverse dependency order
    db.exec(`
      DELETE FROM enquiries;
      DELETE FROM offers;
      DELETE FROM rental_applications;
      DELETE FROM status_history;
      DELETE FROM properties;
      DELETE FROM users;
    `);

    // Insert Users (Buyer, Seller, Agent)
    const insertUser = `
      INSERT INTO users (id, username, full_name, email, role, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'));
    `;
    db.run(insertUser, ['user-buyer-1', 'demo_buyer', 'Demo Buyer', 'buyer@holmia.example', 'buyer']);
    db.run(insertUser, ['user-seller-1', 'demo_seller', 'Demo Seller', 'seller@holmia.example', 'seller']);
    db.run(insertUser, ['user-agent-1', 'demo_agent', 'Demo Agent', 'agent@holmia.example', 'agent']);

    // Insert Properties (3 Sales, 3 Rentals matching team specs)
    const insertProperty = `
      INSERT INTO properties (
        id, seller_id, agent_id, title, description, price, listing_type,
        property_type, location, image_url, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'));
    `;

    const sampleProperties = [
      {
        id: 'prop-1',
        seller_id: 'user-seller-1',
        agent_id: 'user-agent-1',
        title: 'Bright Apartment in Central London',
        description: 'Charming two-bedroom apartment with private balcony, close to tube station and amenities.',
        price: 425000,
        listing_type: 'sale',
        property_type: 'flat',
        location: 'London, UK',
        image_url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
        status: 'active'
      },
      {
        id: 'prop-2',
        seller_id: 'user-seller-1',
        agent_id: null,
        title: 'Spacious Family House in Manchester',
        description: 'Detached four-bedroom family home with private garden, garage and modern kitchen.',
        price: 580000,
        listing_type: 'sale',
        property_type: 'house',
        location: 'Manchester, UK',
        image_url: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233',
        status: 'active'
      },
      {
        id: 'prop-3',
        seller_id: 'user-seller-1',
        agent_id: 'user-agent-1',
        title: 'Furnished Student Studio in Oxford',
        description: 'Compact fully furnished modern studio located within walking distance of university colleges.',
        price: 650,
        listing_type: 'rent',
        property_type: 'studio',
        location: 'Oxford, UK',
        image_url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267',
        status: 'active'
      },
      {
        id: 'prop-4',
        seller_id: 'user-seller-1',
        agent_id: null,
        title: 'Riverside Apartment with Terrace in Bristol',
        description: 'Stylish two-bedroom apartment featuring a large river-view terrace and secure parking space.',
        price: 1150,
        listing_type: 'rent',
        property_type: 'flat',
        location: 'Bristol, UK',
        image_url: 'https://images.unsplash.com/photo-1502005229762-ae1b46b19280',
        status: 'active'
      },
      {
        id: 'prop-5',
        seller_id: 'user-seller-1',
        agent_id: 'user-agent-1',
        title: 'Industrial Converted Loft in Birmingham',
        description: 'Open-plan loft in a former warehouse with exposed brickwork, high ceilings and industrial character.',
        price: 310000,
        listing_type: 'sale',
        property_type: 'loft',
        location: 'Birmingham, UK',
        image_url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2',
        status: 'active'
      },
      {
        id: 'prop-6',
        seller_id: 'user-seller-1',
        agent_id: null,
        title: 'Detached House with Garden in Cambridge',
        description: 'Peaceful three-bedroom house situated in a quiet cul-de-sac with landscaped garden and driveway.',
        price: 1450,
        listing_type: 'rent',
        property_type: 'house',
        location: 'Cambridge, UK',
        image_url: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994',
        status: 'active'
      }
    ];

    const insertHistory = `
      INSERT INTO status_history (id, property_id, old_status, new_status, changed_by, notes, changed_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'));
    `;

    for (const prop of sampleProperties) {
      db.run(insertProperty, [
        prop.id,
        prop.seller_id,
        prop.agent_id,
        prop.title,
        prop.description,
        prop.price,
        prop.listing_type,
        prop.property_type,
        prop.location,
        prop.image_url,
        prop.status
      ]);

      db.run(insertHistory, [
        `hist-init-${prop.id}`,
        prop.id,
        'draft',
        'active',
        prop.seller_id,
        'Initial publication during seed'
      ]);
    }

    // Insert sample Offer on prop-1
    db.run(
      `INSERT INTO offers (id, property_id, buyer_id, amount, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['offer-1', 'prop-1', 'user-buyer-1', 420000, 'pending']
    );

    // Insert sample Rental Application on prop-3
    db.run(
      `INSERT INTO rental_applications (id, property_id, buyer_id, move_in_date, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ['rental-1', 'prop-3', 'user-buyer-1', '2026-12-01', 'Etudiant sérieux avec garant solide', 'pending']
    );
  });
}

// Allow direct execution: node --experimental-strip-types src/database/seed.ts
if (process.argv[1]?.endsWith('seed.ts')) {
  const db = getDatabase();
  seedDatabase(db);
  console.log('HOLMIA SQLite database seeded successfully.');
}

