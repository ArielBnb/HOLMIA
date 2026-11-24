import { getSupabase } from '../config/supabase';

export async function getFavourites() {
  const rows = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await getSupabase().from('favourites')
      .select('property_id,properties(id,title,price,listing_type,location,image_url)')
      .order('created_at', { ascending: false }).order('property_id')
      .range(offset, offset + 199);
    if (error) throw error;
    rows.push(...(data ?? []).filter((r) => r.properties !== null));
    if ((data ?? []).length < 200) return rows;
  }
}

export async function setFavourite(propertyId, saved) {
  const client = getSupabase();
  const table = client.from('favourites');
  if (saved) {
    const { error } = await table.upsert({ property_id: propertyId }, { onConflict: 'buyer_id,property_id', ignoreDuplicates: true });
    if (error) throw error;
    return;
  }
  let del = table.delete().eq('property_id', propertyId);
  try {
    const { data } = await client.auth.getUser();
    if (data?.user?.id) del = del.eq('buyer_id', data.user.id);
  } catch {
    // RLS still enforces buyer_id = auth.uid()
  }
  const { error } = await del;
  if (error) throw error;
}
