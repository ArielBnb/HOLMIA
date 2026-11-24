import { getSupabase } from '../config/supabase';

export async function getFavourites() {
  const rows = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await getSupabase().from('favourites')
      .select('property_id,properties(id,title,price,listing_type,location,image_url)')
      .order('created_at', { ascending: false }).order('property_id')
      .range(offset, offset + 199);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 200) return rows;
  }
}

export async function setFavourite(propertyId, saved) {
  const table = getSupabase().from('favourites');
  const { error } = await (saved
    ? table.upsert({ property_id: propertyId }, { onConflict: 'buyer_id,property_id', ignoreDuplicates: true })
    : table.delete().eq('property_id', propertyId));
  if (error) throw error;
}
