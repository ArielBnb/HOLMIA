import { getSupabase, isSupabaseConfigured, supabase } from '../config/supabase';

const localListeners = new Set();

export function emitNotification(notification) {
  const item = {
    id: notification.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    badge: notification.badge || 'HOLMIA',
    title: notification.title || 'New update',
    body: notification.body || '',
    targetTab: notification.targetTab || null,
    conversationId: notification.conversationId || null,
    createdAt: Date.now(),
  };
  localListeners.forEach((fn) => {
    try {
      fn(item);
    } catch {
      // ignore listener error
    }
  });
}

export function subscribeToLocalNotifications(callback) {
  localListeners.add(callback);
  return () => localListeners.delete(callback);
}

const STATUS_NAMES = {
  draft: 'Draft',
  active: 'Active',
  under_offer: 'Under Offer',
  sold: 'Sold',
  rented: 'Rented',
};

function formatGBP(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '';
  return `£${num.toLocaleString('en-GB')}`;
}

/**
 * Subscribes to live app events (Supabase Realtime + silent polling fallback)
 * for the signed-in user's role so pop-up notifications appear on every tab.
 */
export function subscribeToAppNotifications(profile, onNotify) {
  if (!profile || !onNotify) return () => {};
  const role = profile.role || 'buyer';
  const userId = profile.id;

  const seenKeys = new Map();
  const dispatch = (dedupeKey, payload) => {
    const now = Date.now();
    if (seenKeys.size > 200) {
      for (const [k, ts] of seenKeys.entries()) {
        if (now - ts >= 60000) seenKeys.delete(k);
      }
    }
    const prev = seenKeys.get(dedupeKey);
    if (prev && now - prev < 8000) return;
    seenKeys.set(dedupeKey, now);
    onNotify({
      id: `${dedupeKey}-${now}`,
      createdAt: now,
      ...payload,
    });
  };

  let disposed = false;
  let channel = null;

  // 1. Supabase Realtime listeners strictly scoped to the signed-in user
  if (isSupabaseConfigured && supabase && userId) {
    try {
      channel = supabase
        .channel(`holmia_popups_${userId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'property_messages',
            filter: `recipient_id=eq.${userId}`,
          },
          (payload) => {
            const msg = payload.new;
            if (!msg || msg.sender_id === userId) return;
            dispatch(`pmsg-${msg.id}`, {
              badge: 'MESSAGE',
              title: 'New message received',
              body: msg.body || 'Open to read the message',
              targetTab: role === 'agent' ? 'offers' : role === 'seller' ? 'received' : 'messages',
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'offers',
            filter: `buyer_id=eq.${userId}`,
          },
          (payload) => {
            const offer = payload.new;
            if (!offer || role !== 'buyer' || offer.buyer_id !== userId) return;
            if (offer.status === 'accepted' || offer.status === 'rejected') {
              dispatch(`offer-upd-${offer.id}-${offer.status}`, {
                badge: 'OFFER',
                title: offer.status === 'accepted' ? 'Your offer was accepted!' : 'Offer update',
                body: `Your ${formatGBP(offer.amount)} offer is now ${offer.status}.`,
                targetTab: 'buyer_offers',
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rental_applications',
            filter: `buyer_id=eq.${userId}`,
          },
          (payload) => {
            const app = payload.new;
            if (!app || role !== 'buyer' || app.buyer_id !== userId) return;
            if (app.status === 'accepted' || app.status === 'rejected') {
              dispatch(`rental-upd-${app.id}-${app.status}`, {
                badge: 'RENTAL',
                title:
                  app.status === 'accepted'
                    ? 'Rental application accepted!'
                    : 'Rental application update',
                body: `Your rental application is now ${app.status}.`,
                targetTab: 'buyer_offers',
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'enquiries',
            filter: `buyer_id=eq.${userId}`,
          },
          (payload) => {
            const enq = payload.new;
            if (!enq || role !== 'buyer' || enq.buyer_id !== userId || !enq.reply) return;
            const isViewing = String(enq.message || '').startsWith('[Viewing Request]');
            dispatch(`enq-reply-${enq.id}-${enq.replied_at || ''}`, {
              badge: isViewing ? 'VIEWING' : 'ENQUIRY',
              title: isViewing ? 'Viewing request updated' : 'New reply to your enquiry',
              body: enq.reply,
              targetTab: isViewing ? 'buyer_offers' : 'enquiries',
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'properties' },
          (payload) => {
            const prop = payload.new;
            if (!prop || role !== 'agent' || prop.status !== 'draft' || prop.agent_id !== userId) return;
            dispatch(`prop-draft-${prop.id}`, {
              badge: 'REVIEW',
              title: 'New draft listing to review',
              body: prop.title || 'A seller submitted a new draft.',
              targetTab: 'review',
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'properties' },
          (payload) => {
            const prop = payload.new;
            const old = payload.old;
            if (!prop || !old || prop.status === old.status) return;
            const isMine =
              (role === 'agent' && prop.agent_id === userId) ||
              (role === 'seller' && prop.seller_id === userId);
            if (!isMine) return;
            dispatch(`prop-st-${prop.id}-${prop.status}`, {
              badge: 'STATUS',
              title: 'Property status updated',
              body: `${prop.title || 'Listing'} is now ${STATUS_NAMES[prop.status] || prop.status}.`,
              targetTab: role === 'agent' ? 'properties' : 'listings',
            });
          }
        )
        .subscribe();
    } catch {
      // Realtime optional if unavailable
    }
  }

  // 2. Lightweight RLS-scoped polling fallback (never leaks across users)
  let initialized = false;
  const knownOffers = new Map();
  const knownEnquiries = new Map();
  const knownMessages = new Set();

  const pollChanges = async () => {
    if (disposed || !isSupabaseConfigured || !userId) return;
    try {
      const client = getSupabase();

      // Strictly scoped property_messages addressed to the signed-in user
      const { data: msgRows } = await client
        .from('property_messages')
        .select('id, property_id, sender_id, body')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (Array.isArray(msgRows)) {
        for (const m of msgRows) {
          if (initialized && !knownMessages.has(m.id) && m.sender_id !== userId) {
            dispatch(`pmsg-${m.id}`, {
              badge: 'MESSAGE',
              title: 'New message received',
              body: m.body || 'Open to read the message',
              targetTab: role === 'agent' ? 'offers' : role === 'seller' ? 'received' : 'messages',
            });
          }
          knownMessages.add(m.id);
        }
      }

      // Offers check
      if (role === 'seller' || role === 'agent') {
        const { data: offerRows } = await client.rpc('offers_received');
        if (Array.isArray(offerRows)) {
          for (const o of offerRows) {
            if (initialized && !knownOffers.has(o.id) && o.status === 'pending') {
              dispatch(`offer-new-${o.id}`, {
                badge: 'OFFER',
                title: `New offer on ${o.property_title || 'listing'}`,
                body: `${o.buyer_name || 'Buyer'} offered ${formatGBP(o.amount)}`,
                targetTab: role === 'agent' ? 'offers' : 'received',
              });
            }
            knownOffers.set(o.id, o.status);
          }
        }
      } else if (role === 'buyer' && userId) {
        const { data: myOffers } = await client
          .from('offers')
          .select('id, amount, status')
          .eq('buyer_id', userId);
        if (Array.isArray(myOffers)) {
          for (const o of myOffers) {
            const prevStatus = knownOffers.get(o.id);
            if (initialized && prevStatus && prevStatus !== o.status) {
              dispatch(`offer-upd-${o.id}-${o.status}`, {
                badge: 'OFFER',
                title: o.status === 'accepted' ? 'Your offer was accepted!' : 'Offer update',
                body: `Your ${formatGBP(o.amount)} offer is now ${o.status}.`,
                targetTab: 'buyer_offers',
              });
            }
            knownOffers.set(o.id, o.status);
          }
        }

        const { data: myEnqs } = await client
          .from('enquiries')
          .select('id, reply, replied_at')
          .eq('buyer_id', userId);
        if (Array.isArray(myEnqs)) {
          for (const e of myEnqs) {
            const prevReply = knownEnquiries.get(e.id);
            if (initialized && !prevReply && e.reply) {
              dispatch(`enq-reply-${e.id}-${e.replied_at || ''}`, {
                badge: 'ENQUIRY',
                title: 'New reply to your enquiry',
                body: e.reply,
                targetTab: 'enquiries',
              });
            }
            knownEnquiries.set(e.id, e.reply || '');
          }
        }
      }

      initialized = true;
    } catch {
      // Stay silent on network hiccups
    }
  };

  pollChanges();
  const interval = setInterval(pollChanges, 6000);

  return () => {
    disposed = true;
    clearInterval(interval);
    if (channel && supabase) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore cleanup error
      }
    }
  };
}
