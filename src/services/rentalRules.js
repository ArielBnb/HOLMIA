// Pure helpers for the Seller/Agent rental applications view (no Supabase
// import, testable in Node). Rental lifecycle shown in the app:
//   active (applications pending) -> under_offer (one accepted) -> rented (tenancy started)

export const APPLICATION_STATUS = {
  pending: { label: 'Pending', bg: '#FFF4E5', fg: '#8A5300' },
  accepted: { label: 'Accepted', bg: '#E8F5E9', fg: '#1B5E20' },
  rejected: { label: 'Rejected', bg: '#FDECEA', fg: '#B6331E' },
};

// "2026-12-01" -> "1 Dec 2026" without timezone shifts (move_in_date is a date).
export function formatMoveIn(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  if (!match) return String(value ?? '');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

// One group per listing (server order kept), applications as received.
export function groupApplicationsByProperty(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.property_id)) {
      groups.set(row.property_id, {
        propertyId: row.property_id,
        title: row.property_title,
        status: row.property_status,
        price: Number(row.property_price),
        applications: [],
      });
    }
    groups.get(row.property_id).applications.push(row);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    pendingCount: group.applications.filter((a) => a.status === 'pending').length,
    accepted: group.applications.find((a) => a.status === 'accepted') || null,
  }));
}

// Accept / reject only while the application is pending and the listing active.
export const canDecideApplication = (group, application) =>
  group.status === 'active' && application.status === 'pending';

// "Mark as rented" only for the accepted applicant while the listing is Under Offer.
export const canStartTenancy = (group, application) =>
  group.status === 'under_offer' && application.status === 'accepted';
