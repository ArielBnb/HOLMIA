// Pure lifecycle rules for the status screen (no Supabase import, testable in Node).
// Same state machine as PropertyRepository and public.change_property_status:
//   draft -> active ; active -> draft | under_offer ; under_offer -> active | sold (sale) | rented (rent)
//   sold, rented: final

export const STATUS_LABELS = {
  draft: 'Draft',
  active: 'Active',
  under_offer: 'Under Offer',
  sold: 'Sold',
  rented: 'Rented',
};
export const statusName = (status) => STATUS_LABELS[status] || status || '—';

export const FINAL_STATUSES = ['sold', 'rented'];
export const isFinalStatus = (status) => FINAL_STATUSES.includes(status);

export function nextStatuses(status, listingType) {
  switch (status) {
    case 'draft': return ['active'];
    case 'active': return ['draft', 'under_offer'];
    case 'under_offer': return ['active', listingType === 'rent' ? 'rented' : 'sold'];
    default: return [];
  }
}

export function isAllowedTransition(from, to, listingType) {
  return nextStatuses(from, listingType).includes(to);
}

// Explicit reason why a transition is refused (shown to the user).
export function transitionError(from, to, listingType) {
  if (isFinalStatus(from)) return `${statusName(from)} is a final status: this listing can no longer change status.`;
  if (to === 'sold' && listingType === 'rent') return 'A listing for rent cannot be Sold (use Rented).';
  if (to === 'rented' && listingType === 'sale') return 'A listing for sale cannot be Rented (use Sold).';
  if (from === to) return `The listing is already ${statusName(from)}.`;
  if (!isAllowedTransition(from, to, listingType)) return `Transition from ${statusName(from)} to ${statusName(to)} is not allowed.`;
  return '';
}

const ACTION_COPY = {
  'draft>active': { label: 'Publish', hint: 'Visible to Buyers in the catalogue.' },
  'active>draft': { label: 'Unpublish (back to Draft)', hint: 'Hidden from the catalogue until published again.' },
  'under_offer>active': { label: 'Back to Active (deal fell through)', hint: 'The accepted offer or application is released.' },
  'under_offer>sold': { label: 'Mark as Sold', hint: 'Final: the listing can no longer change status.' },
  'under_offer>rented': { label: 'Mark as Rented', hint: 'Final: the listing can no longer change status.' },
};

// Actions shown for a role and a status. Under Offer is never a manual action:
// it is reached by accepting an offer / application (Received tab).
export function availableActions(property, role) {
  if (!property || !['seller', 'agent'].includes(role)) return [];
  return nextStatuses(property.status, property.listing_type)
    .filter((to) => to !== 'under_offer')
    .map((to) => ({ to, ...ACTION_COPY[`${property.status}>${to}`] }));
}

// Short guidance under the actions, per status and role.
export function statusGuidance(property, role) {
  if (!property) return '';
  if (!['seller', 'agent'].includes(role)) return 'Only the owner or the assigned agent can change the status.';
  if (isFinalStatus(property.status)) return `${statusName(property.status)} is final: no further status change is possible.`;
  if (property.status === 'active') {
    return `To move to Under Offer, accept ${property.listing_type === 'rent' ? 'a rental application' : 'an offer'} in the Received tab.`;
  }
  if (property.status === 'draft') return 'Publish the listing to start receiving offers and enquiries.';
  return '';
}

// "Active → Under Offer" style line for a history row.
export function historyLine(entry) {
  return entry.old_status ? `${statusName(entry.old_status)} → ${statusName(entry.new_status)}` : `Created as ${statusName(entry.new_status)}`;
}

export function historyWho(entry) {
  if (!entry.changed_by_name) return 'System';
  return entry.changed_by_role ? `${entry.changed_by_name} (${entry.changed_by_role})` : entry.changed_by_name;
}

export function historyWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso ?? '');
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
