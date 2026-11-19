// Seller listing form rules. Limits mirror the constraints of public.properties
// (supabase/migrations/20261112120000_holmia_foundation.sql) so invalid input is
// caught in the app before Supabase rejects it.

export const LISTING_TYPES = [
  { value: 'sale', label: 'For sale' },
  { value: 'rent', label: 'For rent' },
];

export const PROPERTY_TYPES = [
  { value: 'flat', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'studio', label: 'Studio' },
  { value: 'loft', label: 'Loft' },
  { value: 'villa', label: 'Villa' },
  { value: 'land', label: 'Land' },
  { value: 'office', label: 'Office' },
];

// A Seller is never forced to use an Agent.
export const REPRESENTATIONS = [
  { value: 'direct', label: 'Direct (no agent)' },
  { value: 'agent', label: 'With an agent' },
];

// Simulated photos: stable placeholder URLs, no upload or storage bucket needed.
export const SIMULATED_IMAGES = [
  { id: 'living-room', label: 'Living room', url: 'https://picsum.photos/seed/holmia-living-room/800/600' },
  { id: 'kitchen', label: 'Kitchen', url: 'https://picsum.photos/seed/holmia-kitchen/800/600' },
  { id: 'bedroom', label: 'Bedroom', url: 'https://picsum.photos/seed/holmia-bedroom/800/600' },
  { id: 'facade', label: 'Facade', url: 'https://picsum.photos/seed/holmia-facade/800/600' },
  { id: 'garden', label: 'Garden', url: 'https://picsum.photos/seed/holmia-garden/800/600' },
  { id: 'view', label: 'View', url: 'https://picsum.photos/seed/holmia-view/800/600' },
];

export const LIMITS = {
  titleMin: 3,
  titleMax: 160,
  descriptionMin: 20,
  descriptionMax: 10000,
  locationMin: 2,
  locationMax: 200,
  priceMax: 1000000000000,
};

export const EMPTY_FORM = {
  title: '',
  description: '',
  price: '',
  listingType: '',
  propertyType: '',
  location: '',
  imageUrl: SIMULATED_IMAGES[0].url,
  representation: 'direct',
  agentId: '',
};

// Accepts "425000", "425 000", "1150.50" or "1150,50". Returns NaN when invalid.
export function parsePrice(raw) {
  const text = String(raw ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return NaN;
  return Number(text);
}

const length = (value) => String(value ?? '').trim().length;

export function validatePropertyForm(values) {
  const errors = {};

  const title = length(values.title);
  if (title === 0) errors.title = 'Title is required.';
  else if (title < LIMITS.titleMin) errors.title = `Title must be at least ${LIMITS.titleMin} characters.`;
  else if (title > LIMITS.titleMax) errors.title = `Title must be at most ${LIMITS.titleMax} characters.`;

  const description = length(values.description);
  if (description === 0) errors.description = 'Description is required.';
  else if (description < LIMITS.descriptionMin) errors.description = `Description must be at least ${LIMITS.descriptionMin} characters.`;
  else if (description > LIMITS.descriptionMax) errors.description = `Description must be at most ${LIMITS.descriptionMax} characters.`;

  if (length(values.price) === 0) errors.price = 'Price is required.';
  else {
    const price = parsePrice(values.price);
    if (Number.isNaN(price)) errors.price = 'Enter a valid amount (digits, up to 2 decimals).';
    else if (price <= 0) errors.price = 'Price must be greater than 0.';
    else if (price >= LIMITS.priceMax) errors.price = 'Price is too high.';
  }

  if (!LISTING_TYPES.some((t) => t.value === values.listingType)) {
    errors.listingType = 'Choose a transaction type.';
  }
  if (!PROPERTY_TYPES.some((t) => t.value === values.propertyType)) {
    errors.propertyType = 'Choose a property type.';
  }

  const location = length(values.location);
  if (location === 0) errors.location = 'Location is required.';
  else if (location < LIMITS.locationMin) errors.location = `Location must be at least ${LIMITS.locationMin} characters.`;
  else if (location > LIMITS.locationMax) errors.location = `Location must be at most ${LIMITS.locationMax} characters.`;

  if (values.imageUrl && !/^https:\/\/\S+$/.test(values.imageUrl)) {
    errors.imageUrl = 'Image must be an https URL.';
  }

  if (values.representation === 'agent' && !values.agentId) {
    errors.agentId = 'Choose an agent, or switch to Direct.';
  }

  return errors;
}

// agent_id column value for the chosen representation.
export const agentIdFromForm = (values) => (values.representation === 'agent' && values.agentId ? values.agentId : null);

// Row for public.properties. The owner comes from the authenticated session and
// every new listing starts as a draft; neither is editable in the form.
export function buildPropertyPayload(values, sellerId) {
  if (!sellerId) throw new Error('A signed-in Seller is required to create a listing.');
  return {
    seller_id: sellerId,
    title: values.title.trim(),
    description: values.description.trim(),
    price: parsePrice(values.price),
    listing_type: values.listingType,
    property_type: values.propertyType,
    location: values.location.trim(),
    image_url: values.imageUrl || null,
    status: 'draft',
    // Omitted for direct listings; Supabase checks the id belongs to an Agent.
    ...(agentIdFromForm(values) ? { agent_id: agentIdFromForm(values) } : {}),
  };
}
