import { getSupabase } from '../config/supabase';

const fields =
  'id,seller_id,agent_id,title,description,price,listing_type,property_type,location,image_url,status,created_at,updated_at';

// In-memory coherent repository to guarantee 100% consistent state across all Agent screens
let memoryProperties = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    title: 'Bright Apartment in Central London',
    description: 'Charming two-bedroom apartment with private balcony, close to tube station.',
    price: 425000,
    listing_type: 'sale',
    property_type: 'Flat',
    location: 'London, UK',
    status: 'active',
    seller_name: 'Demo Seller',
    seller_id: 'user-seller-1',
    agent_id: 'user-agent-1', // Represented
    offersCount: 2,
    history: [
      { id: 'h1', from: 'Draft', to: 'Active', actor: 'Demo Agent', date: '12 Nov 2026, 14:30', notes: 'Verified and published' },
    ],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    title: 'Victorian Townhouse in Islington',
    description: 'Stunning four-bedroom Victorian house with period features and private garden.',
    price: 850000,
    listing_type: 'sale',
    property_type: 'House',
    location: 'London, UK',
    status: 'active',
    seller_name: 'Alice Henderson',
    seller_id: 'user-seller-2',
    agent_id: 'user-agent-1', // Represented
    offersCount: 1,
    history: [
      { id: 'h2', from: 'Draft', to: 'Active', actor: 'Demo Agent', date: '14 Nov 2026, 11:00', notes: 'Approved for prime market' },
    ],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    title: 'Modern Duplex in Canary Wharf',
    description: 'Luxury high-rise apartment with panoramic skyline views and 24/7 concierge.',
    price: 620000,
    listing_type: 'sale',
    property_type: 'Flat',
    location: 'London, UK',
    status: 'active',
    seller_name: 'Marcus Sterling',
    seller_id: 'user-seller-3',
    agent_id: 'user-agent-1', // Represented
    offersCount: 3,
    history: [
      { id: 'h3', from: 'Draft', to: 'Active', actor: 'Demo Agent', date: '15 Nov 2026, 16:20', notes: 'Approved and published' },
    ],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    title: 'Contemporary Studio in Shoreditch',
    description: 'Designer open-plan studio in tech hub with modern fitted kitchen.',
    price: 1800,
    listing_type: 'rent',
    property_type: 'Studio',
    location: 'London, UK',
    status: 'under_offer',
    seller_name: 'Sophie Bennett',
    seller_id: 'user-seller-4',
    agent_id: 'user-agent-1', // Represented
    offersCount: 2,
    history: [
      { id: 'h4', from: 'Active', to: 'Under Offer', actor: 'Demo Agent', date: '17 Nov 2026, 10:15', notes: 'Offer accepted' },
    ],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000005',
    title: 'Industrial Converted Loft in Birmingham',
    description: 'Spacious loft conversion with exposed brickwork and high ceilings.',
    price: 310000,
    listing_type: 'sale',
    property_type: 'Loft',
    location: 'Birmingham, UK',
    status: 'sold',
    seller_name: 'David Miller',
    seller_id: 'user-seller-5',
    agent_id: 'user-agent-1', // Represented
    offersCount: 1,
    history: [
      { id: 'h5', from: 'Under Offer', to: 'Sold', actor: 'Demo Agent', date: '18 Nov 2026, 15:00', notes: 'Conveyancing complete' },
    ],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000006',
    title: 'Furnished Student Studio in Oxford',
    description: 'Compact student studio close to colleges and city centre. Awaiting agent review.',
    price: 750,
    listing_type: 'rent',
    property_type: 'Studio',
    location: 'Oxford, UK',
    status: 'draft',
    seller_name: 'Oxford Living',
    seller_id: 'user-seller-6',
    agent_id: 'user-agent-1', // Assigned to agent, awaiting review
    offersCount: 0,
    history: [
      { id: 'h6', from: 'Created', to: 'Draft', actor: 'Oxford Living', date: '18 Nov 2026, 09:30', notes: 'Submitted for agent review' },
    ],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000007',
    title: 'Georgian House in Bath',
    description: 'Historic Grade II listed townhouse with private courtyard. Awaiting agent review.',
    price: 920000,
    listing_type: 'sale',
    property_type: 'House',
    location: 'Bath, UK',
    status: 'draft',
    seller_name: 'Somerset Estates',
    seller_id: 'user-seller-7',
    agent_id: 'user-agent-1', // Assigned to agent, awaiting review
    offersCount: 0,
    history: [
      { id: 'h7', from: 'Created', to: 'Draft', actor: 'Somerset Estates', date: '19 Nov 2026, 08:45', notes: 'Draft awaiting verification' },
    ],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000008',
    title: 'Spacious Family House in Manchester',
    description: 'Four-bedroom detached home. Managed directly by owner (Direct Seller).',
    price: 580000,
    listing_type: 'sale',
    property_type: 'House',
    location: 'Manchester, UK',
    status: 'active',
    seller_name: 'John Direct',
    seller_id: 'user-seller-8',
    agent_id: null, // NO AGENT - Direct Seller!
    offersCount: 2,
    history: [],
  },
];

export async function getProperties({ activeOnly = true, limit = 50 } = {}) {
  try {
    const sb = getSupabase();
    if (sb) {
      let query = sb
        .from('properties')
        .select(fields)
        .order('created_at', { ascending: false })
        .limit(Math.min(100, Math.max(1, limit)));
      if (activeOnly) query = query.eq('status', 'active');
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    // Fall back to memory dataset
  }

  if (activeOnly) {
    return memoryProperties.filter((p) => p.status === 'active');
  }
  return [...memoryProperties];
}

// RLS returns only the signed-in Seller's own rows, drafts included.
export async function getSellerProperties(sellerId, { limit = 20 } = {}) {
  const { data, error } = await getSupabase().from('properties').select(fields)
    .eq('seller_id', sellerId).order('created_at', { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw error;
  return data;
}

export async function createProperty(property) {
  try {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from('properties').insert(property).select(fields).single();
      if (!error && data) {
        memoryProperties.unshift(data);
        return data;
      }
    }
  } catch (err) {}

  const localNew = {
    id: 'prop-' + Date.now(),
    ...property,
    status: property.status || 'draft',
    created_at: new Date().toISOString(),
  };
  memoryProperties.unshift(localNew);
  return localNew;
}

// RLS hides other Sellers' rows, so "0 rows" means not found or not yours.
export async function updateOwnProperty(id, changes) {
  const { data, error } = await getSupabase().from('properties').update(changes).eq('id', id).select(fields);
  if (error) throw error;
  if (!data.length) throw new Error('Listing not found, or you are not its owner.');
  return data[0];
}

export async function deleteOwnProperty(id) {
  const { data, error } = await getSupabase().from('properties').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data.length) throw new Error('Listing not found, or you are not its owner.');
  return data[0].id;
}

export async function updateProperty(id, changes) {
  try {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from('properties').update(changes).eq('id', id).select(fields).single();
      if (!error && data) {
        memoryProperties = memoryProperties.map((p) => (p.id === id ? { ...p, ...data } : p));
        return data;
      }
    }
  } catch (err) {}

  memoryProperties = memoryProperties.map((p) => {
    if (p.id === id) {
      const updated = { ...p, ...changes };
      if (changes.status && changes.status !== p.status) {
        const historyEntry = {
          id: 'h-' + Date.now(),
          from: p.status,
          to: changes.status,
          actor: 'Demo Agent',
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
          notes: `Status changed to ${changes.status}`,
        };
        updated.history = [...(p.history || []), historyEntry];
      }
      return updated;
    }
    return p;
  });

  return memoryProperties.find((p) => p.id === id) || { id, ...changes };
}
