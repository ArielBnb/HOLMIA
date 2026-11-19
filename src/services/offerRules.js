// Pure helpers for the received-offers view (no Supabase import, testable in Node).

// One group per listing, listings in server order, offers newest first.
export function groupOffersByProperty(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.property_id)) {
      groups.set(row.property_id, {
        propertyId: row.property_id,
        title: row.property_title,
        status: row.property_status,
        price: Number(row.property_price),
        offers: [],
      });
    }
    groups.get(row.property_id).offers.push({ ...row, amount: Number(row.amount) });
  }
  return [...groups.values()].map((group) => ({
    ...group,
    pendingCount: group.offers.filter((o) => o.status === 'pending').length,
    accepted: group.offers.find((o) => o.status === 'accepted') || null,
  }));
}

// Accept/reject buttons only while the offer is pending and the listing is active.
export const canDecide = (group, offer) => group.status === 'active' && offer.status === 'pending';
