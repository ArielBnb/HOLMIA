// Seller edit/delete rules. Same rules as the local repository
// (src/repositories/propertyRepository.ts) and the Supabase triggers
// (supabase/migrations/20261119120000_seller_edit_delete_rules.sql).
import { agentIdFromForm, parsePrice } from './propertyFormValidation.js';

// Once an offer is accepted the commercial terms are frozen.
export const LOCKED_STATUSES = ['under_offer', 'sold', 'rented'];

// Form keys whose database columns are frozen in LOCKED_STATUSES.
export const LOCKED_FIELDS = ['price', 'listingType', 'propertyType', 'agentId'];

const COLUMN_FOR = {
  title: 'title',
  description: 'description',
  price: 'price',
  listingType: 'listing_type',
  propertyType: 'property_type',
  location: 'location',
  imageUrl: 'image_url',
  agentId: 'agent_id',
};

const STATUS_LABELS = {
  draft: 'Draft',
  active: 'Active',
  under_offer: 'Under Offer',
  sold: 'Sold',
  rented: 'Rented',
};

export const statusLabel = (status) => STATUS_LABELS[status] || status;

export function areTermsLocked(property) {
  return LOCKED_STATUSES.includes(property?.status);
}

export function canDeleteProperty(property) {
  return !!property && !LOCKED_STATUSES.includes(property.status);
}

export function deleteBlockedReason(property) {
  if (canDeleteProperty(property)) return '';
  return `A listing that is ${statusLabel(property.status)} cannot be deleted.`;
}

export function formValuesFromProperty(property) {
  return {
    title: property.title ?? '',
    description: property.description ?? '',
    price: property.price == null ? '' : String(Number(property.price)),
    listingType: property.listing_type ?? '',
    propertyType: property.property_type ?? '',
    location: property.location ?? '',
    imageUrl: property.image_url ?? '',
    representation: property.agent_id ? 'agent' : 'direct',
    agentId: property.agent_id ?? '',
  };
}

// Returns only the columns that actually changed. Throws if a locked field
// was changed on a listing that is Under Offer / Sold / Rented. Never touches
// seller_id or status: ownership and lifecycle are handled elsewhere.
export function buildPropertyChanges(original, values) {
  const next = {
    title: values.title.trim(),
    description: values.description.trim(),
    price: parsePrice(values.price),
    listingType: values.listingType,
    propertyType: values.propertyType,
    location: values.location.trim(),
    imageUrl: values.imageUrl || null,
    agentId: agentIdFromForm(values),
  };
  const current = {
    title: original.title,
    description: original.description ?? '',
    price: Number(original.price),
    listingType: original.listing_type,
    propertyType: original.property_type,
    location: original.location,
    imageUrl: original.image_url ?? null,
    agentId: original.agent_id ?? null,
  };

  const changes = {};
  for (const key of Object.keys(COLUMN_FOR)) {
    if (next[key] !== current[key]) changes[COLUMN_FOR[key]] = next[key];
  }

  if (areTermsLocked(original)) {
    const blocked = LOCKED_FIELDS.filter((key) => COLUMN_FOR[key] in changes);
    if (blocked.length > 0) {
      throw new Error(`Price, transaction type, property type and agent are locked while the listing is ${statusLabel(original.status)}.`);
    }
  }
  return changes;
}
