// Seller / Agent view of received offers, grouped by listing.
// Accept and reject go through the transactional service (offerService);
// the list is always reloaded from Supabase afterwards so the other offers'
// rejection and the listing status shown are the ones stored in the database.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { acceptOffer, getOffersReceived, rejectOffer } from '../services/offerService';
import { canDecide, groupOffersByProperty } from '../services/offerRules';
import { statusLabel } from '../services/propertyEditRules';
import { colors } from '../styles/theme';

const border = '#DBE1DC';
const danger = '#B3261E';
const OFFER_STATUS = {
  pending: { label: 'Pending', bg: '#FFF4E5', fg: '#8A5300' },
  accepted: { label: 'Accepted', bg: '#E8F5E9', fg: '#1B5E20' },
  rejected: { label: 'Rejected', bg: '#FDECEA', fg: danger },
};

const money = (value) => `£${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function Badge({ text, bg, fg }) {
  return <Text style={[styles.badge, { backgroundColor: bg, color: fg }]}>{text}</Text>;
}

export default function OffersReceivedScreen({ currentSession }) {
  const role = currentSession?.role;
  const [groups, setGroups] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(null); // { offer, action: 'accept' | 'reject' }
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setGroups(groupOffersByProperty(await getOffersReceived()));
      setError('');
    } catch (failure) {
      setError(failure.message);
      setGroups((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const decide = async () => {
    const { offer, action } = confirm;
    setBusyId(offer.id);
    setError('');
    setNotice('');
    try {
      if (action === 'accept') {
        const result = await acceptOffer(offer.id);
        const others = result?.rejected_count ?? 0;
        setNotice(`Offer of ${money(offer.amount)} from ${offer.buyer_name} accepted. ${others} other pending offer${others === 1 ? ' was' : 's were'} rejected. "${offer.property_title}" is now Under Offer.`);
      } else {
        await rejectOffer(offer.id);
        setNotice(`Offer of ${money(offer.amount)} from ${offer.buyer_name} rejected.`);
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setConfirm(null);
      setBusyId(null);
      // Always show what the database now holds (also after a refused decision).
      await load();
    }
  };

  if (role !== 'seller' && role !== 'agent') {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.content}>
          <Text style={styles.error}>Only Sellers and Agents receive offers.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.heading}>Offers received</Text>
            <Text style={styles.meta}>
              {role === 'seller' ? 'Offers on your listings.' : 'Offers on the listings assigned to you.'} Accepting one offer rejects the other pending offers and moves the listing to Under Offer.
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={refresh} style={styles.refresh} disabled={refreshing}>
            <Text style={styles.link}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</Text>
          </Pressable>
        </View>

        {notice ? <Text style={styles.success} accessibilityRole="alert">{notice}</Text> : null}
        {error ? <Text style={styles.errorBox} accessibilityRole="alert">{error}</Text> : null}
        {groups === null && <ActivityIndicator color={colors.primary} />}
        {groups?.length === 0 && !error && <Text style={styles.meta}>No offers yet.</Text>}

        {groups?.map((group) => (
          <View key={group.propertyId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.title} numberOfLines={2}>{group.title}</Text>
              <Badge text={statusLabel(group.status).toUpperCase()} bg={group.status === 'active' ? '#E7EFEA' : '#EEEEEE'} fg={group.status === 'active' ? colors.primary : '#444444'} />
            </View>
            <Text style={styles.meta}>
              Asking {money(group.price)} · {group.offers.length} offer{group.offers.length === 1 ? '' : 's'} · {group.pendingCount} pending
            </Text>
            {group.accepted && (
              <Text style={styles.acceptedLine}>✓ Accepted: {money(group.accepted.amount)} from {group.accepted.buyer_name}</Text>
            )}

            {group.offers.map((offer) => {
              const s = OFFER_STATUS[offer.status] || OFFER_STATUS.pending;
              const confirming = confirm?.offer.id === offer.id;
              return (
                <View key={offer.id} style={styles.offer}>
                  <View style={styles.offerRow}>
                    <View style={styles.flex}>
                      <Text style={styles.amount}>{money(offer.amount)}</Text>
                      <Text style={styles.meta}>{offer.buyer_name} · {day(offer.created_at)}</Text>
                    </View>
                    <Badge text={s.label} bg={s.bg} fg={s.fg} />
                  </View>

                  {confirming ? (
                    <View style={styles.confirm}>
                      <Text style={styles.confirmText}>
                        {confirm.action === 'accept'
                          ? `Accept ${money(offer.amount)} from ${offer.buyer_name}? ${group.pendingCount - 1} other pending offer(s) will be rejected and the listing becomes Under Offer.`
                          : `Reject ${money(offer.amount)} from ${offer.buyer_name}?`}
                      </Text>
                      <View style={styles.actions}>
                        <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => setConfirm(null)} disabled={busyId === offer.id}>
                          <Text style={styles.secondaryText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          style={confirm.action === 'accept' ? styles.primary : styles.dangerFill}
                          onPress={decide}
                          disabled={busyId === offer.id}
                        >
                          {busyId === offer.id
                            ? <ActivityIndicator color="#FFFFFF" />
                            : <Text style={styles.primaryText}>{confirm.action === 'accept' ? 'Yes, accept' : 'Yes, reject'}</Text>}
                        </Pressable>
                      </View>
                    </View>
                  ) : canDecide(group, offer) ? (
                    <View style={styles.actions}>
                      <Pressable accessibilityRole="button" style={styles.dangerOutline} onPress={() => setConfirm({ offer, action: 'reject' })} disabled={!!busyId}>
                        <Text style={styles.dangerText}>Reject</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" style={styles.primary} onPress={() => setConfirm({ offer, action: 'accept' })} disabled={!!busyId}>
                        <Text style={styles.primaryText}>Accept</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 20, paddingTop: 32, paddingBottom: 40, gap: 14, maxWidth: 800, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heading: { fontSize: 24, fontWeight: '700', color: colors.primary },
  meta: { color: colors.secondary, fontSize: 13, lineHeight: 19 },
  link: { color: colors.primary, fontWeight: '700' },
  refresh: { paddingVertical: 6, paddingHorizontal: 8 },
  success: { backgroundColor: '#E8F5E9', color: '#1B5E20', borderRadius: 12, padding: 12 },
  errorBox: { backgroundColor: '#FDECEA', color: danger, borderRadius: 12, padding: 12 },
  error: { color: danger },
  card: { borderWidth: 1, borderColor: border, borderRadius: 16, padding: 16, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.primary },
  acceptedLine: { color: '#1B5E20', fontWeight: '600' },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  offer: { borderTopWidth: 1, borderTopColor: border, paddingTop: 10, marginTop: 4, gap: 8 },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { fontSize: 17, fontWeight: '700', color: '#1B1B1B' },
  actions: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  secondary: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontWeight: '700' },
  dangerOutline: { flex: 1, borderWidth: 1, borderColor: danger, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  dangerText: { color: danger, fontWeight: '700' },
  dangerFill: { flex: 1, backgroundColor: danger, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  confirm: { backgroundColor: '#F4F7F5', borderRadius: 10, padding: 10, gap: 8 },
  confirmText: { color: '#1B1B1B', fontWeight: '600' },
});
