import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase, isSupabaseConfigured } from '../config/supabase';
import { getEnquiriesReceived, getMyEnquiries, replyToEnquiry, sendEnquiry } from './enquiryService';
import { emitNotification } from './notificationService';
import { randomUUID } from '../utils/uuid';

const STORAGE_KEY = '@holmia_viewings_v1';
export const VIEWING_SLOTS = ['10:00', '14:00', '17:00'];

const VIEWING_TAG = '[Viewing Request]';
const CONFIRMED_TAG = '[Viewing Confirmed]';
const DECLINED_TAG = '[Viewing Declined]';

export function isViewingEnquiry(row) {
  return String(row?.message || '').startsWith(VIEWING_TAG);
}

function encodeViewingMessage(date, time, location) {
  return `${VIEWING_TAG} ${date} at ${time}${location ? ` (${location})` : ''}`;
}

function parseViewingFromEnquiry(row) {
  const msg = row?.message || '';
  if (!msg.startsWith(VIEWING_TAG)) return null;
  const match = msg.match(/\[Viewing Request\]\s+(\d{4}-\d{2}-\d{2})\s+at\s+(\d{2}:\d{2})(?:\s+\(([^)]+)\))?/);
  if (!match) return null;

  let status = 'pending';
  const reply = row.reply || '';
  if (reply.startsWith(CONFIRMED_TAG)) status = 'confirmed';
  else if (reply.startsWith(DECLINED_TAG)) status = 'declined';

  return {
    id: row.id,
    enquiry_id: row.id,
    source: 'supabase',
    property_id: row.property_id,
    property_title: row.property_title || 'Property',
    property_location: match[3] || '',
    buyer_id: row.buyer_id || null,
    buyer_name: row.buyer_name || 'Buyer',
    date: match[1],
    time: match[2],
    status,
    reply: row.reply || null,
    created_at: row.created_at,
  };
}

async function readStore() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeStore(list) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

export function formatLocalISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function requestViewing({ property, date, time, buyerId, buyerName }) {
  if (!property?.id) throw new Error('Property is required.');
  if (property.status && property.status !== 'active') {
    throw new Error('Viewings can only be requested on active listings.');
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Please pick a valid viewing date.');
  if (!VIEWING_SLOTS.includes(time)) throw new Error('Please pick a valid time slot.');

  const now = new Date();
  const today = formatLocalISO(now);
  if (date < today) throw new Error('Viewing date must be today or later.');
  if (date === today) {
    const [slotH, slotM] = time.split(':').map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (slotH * 60 + slotM <= nowMinutes) {
      throw new Error(`The ${time} slot for today has already passed. Pick a later slot or another date.`);
    }
  }

  let resolvedBuyerId = buyerId || null;
  const resolvedBuyerName = buyerName || 'Demo Buyer';

  if (isSupabaseConfigured && !resolvedBuyerId) {
    try {
      const { data } = await getSupabase().auth.getUser();
      if (data?.user?.id) resolvedBuyerId = data.user.id;
    } catch {
      // keep fallback
    }
  }

  if (resolvedBuyerId && property.seller_id && resolvedBuyerId === property.seller_id) {
    throw new Error('You cannot book a viewing on your own listing.');
  }

  // Prevent the same Buyer from booking two viewings at the exact same date & time
  // (even across two different properties / locations).
  const existingForBuyer = await getViewingsForRole('buyer', resolvedBuyerId);
  const buyerTimeConflict = existingForBuyer.find(
    (v) => v.date === date && v.time === time && v.status !== 'declined'
  );
  if (buyerTimeConflict) {
    throw new Error(
      `You already have a viewing scheduled on ${date} at ${time} (${buyerTimeConflict.property_title}). Pick another slot.`
    );
  }

  const current = await readStore();
  // Prevent the same Agent from being double-booked on the same date & time
  if (property.agent_id) {
    const agentConflict = current.find(
      (v) =>
        v.agent_id === property.agent_id &&
        v.date === date &&
        v.time === time &&
        v.status !== 'declined'
    );
    if (agentConflict) {
      throw new Error(`The assigned agent is already booked on ${date} at ${time}. Pick another time slot.`);
    }
  }

  const requestId = randomUUID();
  let storedEnquiryId = null;

  // Store live in Supabase `public.enquiries` so Seller & assigned Agent receive it across devices
  if (isSupabaseConfigured) {
    const payload = encodeViewingMessage(date, time, property.location);
    storedEnquiryId = await sendEnquiry(property.id, payload, requestId);
  }

  const record = {
    id: storedEnquiryId || requestId,
    enquiry_id: storedEnquiryId,
    source: storedEnquiryId ? 'supabase' : 'local',
    property_id: property.id,
    property_title: property.title || 'Property',
    property_location: property.location || '',
    seller_id: property.seller_id || null,
    agent_id: property.agent_id || null,
    buyer_id: resolvedBuyerId,
    buyer_name: resolvedBuyerName,
    date,
    time,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  await writeStore([record, ...current]);

  emitNotification({
    badge: 'VIEWING',
    title: 'Viewing requested',
    body: `${record.property_title} · ${date} at ${time}`,
    targetTab: 'buyer_offers',
  });

  return record;
}

export async function getViewingsForRole(role, userId) {
  const remoteList = [];

  if (isSupabaseConfigured) {
    try {
      const rows = role === 'buyer' ? await getMyEnquiries() : await getEnquiriesReceived();
      const propIds = [...new Set((rows ?? []).map((r) => r.property_id).filter(Boolean))];
      const agentByProp = {};
      if (propIds.length > 0) {
        try {
          const { data: propRows } = await getSupabase()
            .from('properties')
            .select('id,agent_id')
            .in('id', propIds);
          for (const p of propRows ?? []) {
            agentByProp[p.id] = p.agent_id || null;
          }
        } catch {
          // optional enrichment
        }
      }
      for (const row of rows ?? []) {
        const parsed = parseViewingFromEnquiry(row);
        if (parsed) {
          parsed.agent_id = agentByProp[row.property_id] ?? null;
          parsed.has_agent = Boolean(parsed.agent_id);
          remoteList.push(parsed);
        }
      }
    } catch {
      // Fall back to local store if enquiries RPC is unavailable
    }
  }

  const localAll = await readStore();
  const localScoped = localAll.filter((v) => {
    if (role === 'buyer') return userId ? v.buyer_id === userId : true;
    if (role === 'seller') return userId ? v.seller_id === userId : true;
    if (role === 'agent') return Boolean(v.agent_id) && (userId ? v.agent_id === userId : true);
    return false;
  });

  // Merge remote Supabase viewings (source of truth) with any local-only records
  const merged = new Map();
  for (const item of remoteList) merged.set(item.id, item);
  for (const item of localScoped) {
    if (!merged.has(item.id)) merged.set(item.id, item);
  }

  return Array.from(merged.values()).sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  );
}

export async function decideViewing(viewing, decision) {
  if (!['confirmed', 'declined'].includes(decision)) {
    throw new Error('Decision must be confirmed or declined.');
  }
  if (typeof viewing === 'object' && viewing?.status && viewing.status !== 'pending') {
    throw new Error('This viewing request has already been decided.');
  }
  if (decision === 'confirmed' && typeof viewing === 'object' && viewing?.date) {
    const today = formatLocalISO(new Date());
    if (viewing.date < today) {
      throw new Error('Cannot confirm a viewing scheduled in the past.');
    }
  }

  const id = typeof viewing === 'string' ? viewing : viewing.id;
  const enquiryId = typeof viewing === 'string' ? null : viewing.enquiry_id || (viewing.source === 'supabase' ? viewing.id : null);

  // Persist decision directly in Supabase via `reply_enquiry` so Buyer sees it live across devices
  if (isSupabaseConfigured && enquiryId) {
    const replyText =
      decision === 'confirmed'
        ? `${CONFIRMED_TAG} Your viewing on ${viewing.date} at ${viewing.time} is confirmed.`
        : `${DECLINED_TAG} Sorry, this slot (${viewing.date} at ${viewing.time}) is unavailable. Please choose another time.`;
    await replyToEnquiry(enquiryId, replyText);
  }

  const all = await readStore();
  let updated = typeof viewing === 'object' ? { ...viewing, status: decision } : null;
  const next = all.map((v) => {
    if (v.id !== id) return v;
    updated = { ...v, status: decision, decided_at: new Date().toISOString() };
    return updated;
  });
  await writeStore(next);

  if (updated) {
    emitNotification({
      badge: 'VIEWING',
      title: decision === 'confirmed' ? 'Viewing confirmed' : 'Viewing declined',
      body: `${updated.property_title} · ${updated.date} at ${updated.time}`,
    });
  }
  return updated;
}
