import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured } from '../config/supabase';
import { getProperties } from './propertyService';
import { getOffersReceived } from './offerService';
import { getRentalApplicationsReceived } from './rentalService';
import { getEnquiriesReceived, getMyEnquiries } from './enquiryService';
import { getBuyerSubmissions } from './submissionService';
import { getViewingsForRole, isViewingEnquiry } from './viewingService';

const keyFor = (userId) => `@holmia_tab_seen_v1_${userId || 'anon'}`;

async function readSeenMap(userId) {
  if (!userId) return {};
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function markTabSeen(userId, tabId) {
  if (!userId || !tabId) return;
  try {
    const map = await readSeenMap(userId);
    map[tabId] = new Date().toISOString();
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function isNewer(isoDate, seenIso) {
  if (!isoDate) return false;
  if (!seenIso) return true;
  return String(isoDate) > String(seenIso);
}

/**
 * Computes unread / pending notification badge counts per bottom tab for the
 * signed-in user so any change that happened while they were offline shows up
 * immediately as a red badge (1, 2, ...) on their next login.
 */
export async function getTabBadges(profile) {
  const badges = {};
  if (!profile?.id || !isSupabaseConfigured) return badges;

  const userId = profile.id;
  const role = profile.role || 'buyer';
  const seen = await readSeenMap(userId);

  if (role === 'agent') {
    const [allProps, offers, rentals, enquiries, viewings] = await Promise.all([
      getProperties({ activeOnly: false, limit: 100 }).catch(() => []),
      getOffersReceived().catch(() => []),
      getRentalApplicationsReceived().catch(() => []),
      getEnquiriesReceived().catch(() => []),
      getViewingsForRole('agent', userId).catch(() => []),
    ]);

    const mine = (allProps ?? []).filter((p) => p.agent_id === userId);
    const pendingDrafts = mine.filter((p) => p.status === 'draft').length;
    if (pendingDrafts > 0) badges.review = pendingDrafts;

    const updatedProps = mine.filter(
      (p) => p.status !== 'draft' && isNewer(p.updated_at || p.created_at, seen.properties)
    ).length;
    if (seen.properties && updatedProps > 0) badges.properties = updatedProps;

    const pendingOffers = (offers ?? []).filter((o) => o.status === 'pending').length;
    const pendingRentals = (rentals ?? []).filter((r) => r.status === 'pending').length;
    const pendingEnquiries = (enquiries ?? []).filter((e) => !isViewingEnquiry(e) && !e.reply).length;
    const pendingViewings = (viewings ?? []).filter((v) => v.status === 'pending').length;
    const totalReceived = pendingOffers + pendingRentals + pendingEnquiries + pendingViewings;
    if (totalReceived > 0) badges.offers = totalReceived;
    return badges;
  }

  if (role === 'seller') {
    const [allProps, offers, rentals, enquiries, viewings] = await Promise.all([
      getProperties({ activeOnly: false, limit: 100 }).catch(() => []),
      getOffersReceived().catch(() => []),
      getRentalApplicationsReceived().catch(() => []),
      getEnquiriesReceived().catch(() => []),
      getViewingsForRole('seller', userId).catch(() => []),
    ]);

    const mine = (allProps ?? []).filter((p) => p.seller_id === userId);
    const updatedProps = mine.filter(
      (p) => isNewer(p.updated_at || p.created_at, seen.listings)
    ).length;
    if (seen.listings && updatedProps > 0) badges.listings = updatedProps;

    const pendingOffers = (offers ?? []).filter((o) => o.status === 'pending').length;
    const pendingRentals = (rentals ?? []).filter((r) => r.status === 'pending').length;
    const pendingEnquiries = (enquiries ?? []).filter((e) => !isViewingEnquiry(e) && !e.reply).length;
    const pendingDirectViewings = (viewings ?? []).filter(
      (v) => v.status === 'pending' && !v.has_agent
    ).length;
    const totalReceived = pendingOffers + pendingRentals + pendingEnquiries + pendingDirectViewings;
    if (totalReceived > 0) badges.received = totalReceived;
    return badges;
  }

  if (role === 'buyer') {
    const [submissions, myEnqs, viewings] = await Promise.all([
      getBuyerSubmissions().catch(() => []),
      getMyEnquiries().catch(() => []),
      getViewingsForRole('buyer', userId).catch(() => []),
    ]);

    const decidedSubs = (submissions ?? []).filter(
      (s) =>
        (s.status === 'accepted' || s.status === 'rejected') &&
        isNewer(s.decided_at || s.updated_at || s.created_at, seen.Offers)
    ).length;
    const decidedViewings = (viewings ?? []).filter(
      (v) =>
        (v.status === 'confirmed' || v.status === 'declined') &&
        isNewer(v.decided_at || v.created_at, seen.Offers)
    ).length;
    if (decidedSubs + decidedViewings > 0) badges.Offers = decidedSubs + decidedViewings;

    const repliedEnqs = (myEnqs ?? []).filter(
      (e) => !isViewingEnquiry(e) && e.reply && isNewer(e.replied_at || e.created_at, seen.enquiries)
    ).length;
    if (repliedEnqs > 0) badges.Profile = repliedEnqs;
    return badges;
  }

  return badges;
}
