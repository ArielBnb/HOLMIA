// Offers received by a Seller (own listings) or an Agent (assigned listings).
// Decisions run in one database transaction (public.accept_offer / reject_offer,
// supabase/migrations/20261121120000_offers_decisions.sql), mirroring
// OfferRepository.acceptOffer on the local SQLite layer.
import { getSupabase } from '../config/supabase';

function explain(error) {
  if (error?.code === 'PGRST202') {
    return new Error('Offers are not set up yet: apply migration 20261121120000_offers_decisions.sql in Supabase.');
  }
  if (error?.code === '23505') {
    // Unique index: another offer on this listing was accepted at the same moment.
    return new Error('Another offer on this listing has just been accepted. Refresh to see the latest status.');
  }
  return new Error(error?.message || 'Something went wrong. Please try again.');
}

export async function getOffersReceived() {
  const { data, error } = await getSupabase().rpc('offers_received');
  if (error) throw explain(error);
  return data ?? [];
}

export async function acceptOffer(offerId) {
  const { data, error } = await getSupabase().rpc('accept_offer', { p_offer: offerId });
  if (error) throw explain(error);
  return data;
}

export async function rejectOffer(offerId) {
  const { data, error } = await getSupabase().rpc('reject_offer', { p_offer: offerId });
  if (error) throw explain(error);
  return data;
}
