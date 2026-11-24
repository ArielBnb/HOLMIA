import { getSupabase } from '../config/supabase';

export async function submitPropertyRequest(property, id, values) {
  const offers = property.listing_type === 'sale';
  const table = offers ? 'offers' : 'rental_applications';
  const client = getSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Please log in again.');
  // buyer_id and status are set by Postgres. Only a committed row confirms delivery.
  const payload = { id, property_id: property.id, ...values };
  const { data, error } = await client.from(table).insert(payload).select('id').single();
  if (!error && data?.id === id) return id;

  // The first response may have been lost, or a decision may already have closed
  // the listing. Match the same buyer, listing, payload and request ID on retry.
  const fields = offers ? 'id,amount,message' : 'id,move_in_date,notes';
  const { data: existing } = await client.from(table).select(fields).eq('id', id)
    .eq('buyer_id', auth.user.id).eq('property_id', property.id).maybeSingle();
  if (existing && (offers
    ? Number(existing.amount) === values.amount && existing.message === values.message
    : existing.move_in_date === values.move_in_date && existing.notes === values.notes)) return id;
  if (error?.code === '42501') throw new Error('Only a signed-in Buyer can submit this request.');
  throw new Error(error?.message || 'Unable to confirm delivery. Check your connection and retry.');
}

export async function getBuyerSubmissions() {
  const rows = [];
  const size = 200;
  for (let start = 0; ; start += size) {
    const { data, error } = await getSupabase().rpc('buyer_submissions')
      .order('created_at', { ascending: false }).order('id').order('kind').range(start, start + size - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < size) return rows;
  }
}

async function rpc(name, args) {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) throw error;
  return data;
}
export const getRentalsReceived = () => rpc('rentals_received');
export const decideRental = (id, accept) => rpc('decide_rental', { p_application: id, p_accept: accept });
