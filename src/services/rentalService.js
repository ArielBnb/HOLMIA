// Rental applications received by a Seller (own listings) or an Agent (assigned
// listings). Decisions run in one database transaction
// (supabase/migrations/20261124120000_rental_decisions.sql), mirroring
// RentalRepository.acceptApplication / completeRental on the local SQLite layer.
import { getSupabase } from '../config/supabase';

function explain(error) {
  if (error?.code === 'PGRST202') {
    return new Error('Rental decisions are not set up yet: apply migration 20261124120000_rental_decisions.sql in Supabase.');
  }
  if (error?.code === '23505') {
    return new Error('Another application on this listing has just been accepted. Refresh to see the latest status.');
  }
  return new Error(error?.message || 'Something went wrong. Please try again.');
}

async function rpc(name, args) {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) throw explain(error);
  return data;
}

export async function getRentalApplicationsReceived() {
  return (await rpc('rental_applications_received')) ?? [];
}

export const decideRentalApplication = (applicationId, accept) =>
  rpc('decide_rental_application', { p_application: applicationId, p_accept: accept });

export const startTenancy = (applicationId) => rpc('start_tenancy', { p_application: applicationId });
