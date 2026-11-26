import { Platform } from 'react-native';
import { getSupabase, isSupabaseConfigured } from '../config/supabase';
import { randomUUID } from '../utils/uuid';

export const PROPERTY_IMAGE_BUCKET = 'property-images';

// Curated realistic UK real-estate photography (stable https:// URLs satisfying DB constraints).
export const CURATED_PROPERTY_PHOTOS = [
  {
    id: 'london-flat',
    label: 'London Flat',
    url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'uk-brick-house',
    label: 'Brick House',
    url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'student-studio',
    label: 'Cosy Studio',
    url: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'brick-loft',
    label: 'Brick Loft',
    url: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'riverside-flat',
    label: 'City Flat',
    url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'garden-cottage',
    label: 'Garden House',
    url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=900&q=80',
  },
];

function pickFileOnWeb() {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('File upload is only available in the browser.'));
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) resolve(null);
      else resolve(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/**
 * Simple Supabase Storage upload: uploads an image file to the public
 * `property-images` bucket and returns its public `https://` URL to store in
 * `public.properties.image_url`.
 */
export async function uploadPropertyPhoto() {
  if (Platform.OS !== 'web') {
    throw new Error('Device upload is available on Web. On mobile, pick a gallery photo or paste an https:// URL.');
  }
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Pick a gallery photo instead.');
  }

  const file = await pickFileOnWeb();
  if (!file) return null; // User cancelled

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image is too large (maximum 5 MB).');
  }

  const client = getSupabase();
  const { data: authData } = await client.auth.getUser();
  const uid = authData?.user?.id || 'uploads';
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${uid}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await client.storage
    .from(PROPERTY_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });

  if (uploadError) {
    if (/bucket not found/i.test(uploadError.message || '')) {
      throw new Error(
        'Storage bucket "property-images" is not set up yet: run migration 20261126120000_storage_property_images.sql in Supabase (or pick a gallery photo below).'
      );
    }
    throw new Error(uploadError.message || 'Unable to upload image.');
  }

  const { data: urlData } = client.storage.from(PROPERTY_IMAGE_BUCKET).getPublicUrl(path);
  if (!urlData?.publicUrl) {
    throw new Error('Image uploaded, but public URL could not be generated.');
  }
  return urlData.publicUrl;
}
