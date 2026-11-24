// Seller / Agent: rental applications received, grouped by listing, with the
// move-in date, the applicant's notes and Accept / Reject actions.
// Decisions go through the transactional service (rentalService) and the list
// is always reloaded from Supabase afterwards, so the applicant's status (also
// shown to the Buyer in "My activity") and the listing status are the stored ones.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { decideRentalApplication, getRentalApplicationsReceived, startTenancy } from '../services/rentalService';
import {
  APPLICATION_STATUS,
  canDecideApplication,
  canStartTenancy,
  formatMoveIn,
  groupApplicationsByProperty,
} from '../services/rentalRules';
import { statusLabel } from '../services/propertyEditRules';

const ink = '#292424';
const red = '#B6331E';
const paper = '#F6F5F0';
const money = (value) => `£${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;

function Badge({ text, bg, fg }) {
  return <Text style={[styles.badge, { backgroundColor: bg, color: fg }]}>{text}</Text>;
}

function confirmText(confirm, group) {
  const { application: a, action } = confirm;
  if (action === 'accept') {
    const others = group.pendingCount - 1;
    return `Accept ${a.buyer_name} (move-in ${formatMoveIn(a.move_in_date)})? ${others} other pending application${others === 1 ? '' : 's'} will be rejected and the listing becomes Under Offer.`;
  }
  if (action === 'tenancy') {
    return `Confirm that ${a.buyer_name}'s tenancy has started? The listing becomes Rented and leaves the catalogue.`;
  }
  return `Reject ${a.buyer_name}'s application?`;
}

const CONFIRM_LABEL = { accept: 'Yes, accept', reject: 'Yes, reject', tenancy: 'Yes, mark as rented' };

export default function RentalsReceivedScreen() {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(null); // { application, action: 'accept' | 'reject' | 'tenancy' }
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setGroups(groupApplicationsByProperty(await getRentalApplicationsReceived()));
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

  const run = async () => {
    const { application: a, action } = confirm;
    setBusyId(a.id);
    setError('');
    setNotice('');
    try {
      if (action === 'tenancy') {
        await startTenancy(a.id);
        setNotice(`Tenancy started for ${a.buyer_name}. "${a.property_title}" is now Rented.`);
      } else {
        const result = await decideRentalApplication(a.id, action === 'accept');
        if (action === 'accept') {
          const others = result?.rejected_count ?? 0;
          setNotice(`${a.buyer_name}'s application accepted (move-in ${formatMoveIn(a.move_in_date)}). ${others} other pending application${others === 1 ? ' was' : 's were'} rejected. "${a.property_title}" is now Under Offer.`);
        } else {
          setNotice(`${a.buyer_name}'s application rejected.`);
        }
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

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.meta, styles.flex]}>
          Accepting an application rejects the other pending ones and moves the listing to Under Offer. Mark it as rented when the tenancy starts.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => { setNotice(''); load(); }}>
          <Text style={styles.link}>↻ Refresh</Text>
        </Pressable>
      </View>

      {notice ? <Text style={styles.success} accessibilityRole="alert">{notice}</Text> : null}
      {error ? <Text style={styles.errorBox} accessibilityRole="alert">{error}</Text> : null}
      {groups === null && <ActivityIndicator color={red} accessibilityLabel="Loading applications" />}
      {groups?.length === 0 && !error && <Text style={styles.meta}>No rental applications yet.</Text>}

      {groups?.map((group) => (
        <View key={group.propertyId} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.title} numberOfLines={2}>{group.title}</Text>
            <Badge text={statusLabel(group.status).toUpperCase()} bg={paper} fg={ink} />
          </View>
          <Text style={styles.meta}>
            {money(group.price)} / month · {group.applications.length} application{group.applications.length === 1 ? '' : 's'} · {group.pendingCount} pending
          </Text>
          {group.accepted && (
            <Text style={styles.acceptedLine}>
              ✓ Tenant: {group.accepted.buyer_name} · move-in {formatMoveIn(group.accepted.move_in_date)}
            </Text>
          )}

          {group.applications.map((a) => {
            const s = APPLICATION_STATUS[a.status] || APPLICATION_STATUS.pending;
            const confirming = confirm?.application.id === a.id;
            return (
              <View key={a.id} style={styles.item}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.name}>{a.buyer_name}</Text>
                    <Text style={styles.meta}>Move-in {formatMoveIn(a.move_in_date)}</Text>
                  </View>
                  <Badge text={s.label} bg={s.bg} fg={s.fg} />
                </View>
                <Text style={a.notes ? styles.notes : styles.meta}>{a.notes ? `“${a.notes}”` : 'No notes from the applicant.'}</Text>

                {confirming ? (
                  <View style={styles.confirm}>
                    <Text style={styles.confirmText}>{confirmText(confirm, group)}</Text>
                    <View style={styles.actions}>
                      <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => setConfirm(null)} disabled={busyId === a.id}>
                        <Text style={styles.secondaryText}>Cancel</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" style={styles.primary} onPress={run} disabled={busyId === a.id}>
                        {busyId === a.id
                          ? <ActivityIndicator color={paper} />
                          : <Text style={styles.primaryText}>{CONFIRM_LABEL[confirm.action]}</Text>}
                      </Pressable>
                    </View>
                  </View>
                ) : canDecideApplication(group, a) ? (
                  <View style={styles.actions}>
                    <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => setConfirm({ application: a, action: 'reject' })} disabled={!!busyId}>
                      <Text style={styles.secondaryText}>Reject</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" style={styles.primary} onPress={() => setConfirm({ application: a, action: 'accept' })} disabled={!!busyId}>
                      <Text style={styles.primaryText}>Accept</Text>
                    </Pressable>
                  </View>
                ) : canStartTenancy(group, a) ? (
                  <Pressable accessibilityRole="button" style={styles.primaryWide} onPress={() => setConfirm({ application: a, action: 'tenancy' })} disabled={!!busyId}>
                    <Text style={styles.primaryText}>Mark as rented</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { color: ink, fontSize: 13, lineHeight: 19 },
  link: { color: ink, fontWeight: '700', fontSize: 13 },
  success: { backgroundColor: 'rgba(182, 51, 30, 0.1)', color: ink, borderWidth: 1, borderColor: ink, borderRadius: 8, padding: 12 },
  errorBox: { backgroundColor: 'rgba(182, 51, 30, 0.1)', color: red, borderWidth: 1, borderColor: red, borderRadius: 8, padding: 12 },
  card: { borderWidth: 1, borderColor: ink, borderRadius: 8, padding: 12, gap: 8, backgroundColor: paper },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: ink },
  acceptedLine: { color: ink, fontWeight: '600', fontSize: 13 },
  badge: { fontSize: 12, fontWeight: '400', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: ink, overflow: 'hidden' },
  item: { borderTopWidth: 1, borderTopColor: 'rgba(41, 36, 36, 0.15)', paddingTop: 10, marginTop: 4, gap: 8 },
  name: { fontSize: 15, fontWeight: '700', color: ink },
  notes: { fontSize: 14, color: ink, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 12 },
  primary: { flex: 1, height: 48, backgroundColor: red, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  primaryWide: { height: 48, backgroundColor: red, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: paper, fontWeight: '700', fontSize: 15 },
  secondary: { flex: 1, height: 48, borderWidth: 1, borderColor: ink, borderRadius: 8, backgroundColor: paper, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: ink, fontWeight: '400', fontSize: 15 },
  confirm: { backgroundColor: 'rgba(182, 51, 30, 0.1)', borderRadius: 8, padding: 12, gap: 8 },
  confirmText: { color: ink, fontWeight: '600', fontSize: 13 },
});
