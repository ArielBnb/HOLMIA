// Seller / Agent: enquiries received on own or assigned listings, with an
// in-app reply. A reply is stored in Supabase, marks the enquiry "Handled" and
// is shown to the Buyer in their Enquiries tab.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getEnquiriesReceived, replyToEnquiry } from '../services/enquiryService';
import { ENQUIRY_MAX, ENQUIRY_STATUS, countByStatus, enquiryStatus, filterEnquiries } from '../services/enquiryRules';
import { colors } from '../styles/theme';

const border = '#DBE1DC';
const danger = '#B3261E';
const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function EnquiryCard({ item, onSaved }) {
  const status = enquiryStatus(item);
  const [editing, setEditing] = useState(status === 'pending');
  const [draft, setDraft] = useState(item.reply || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const s = ENQUIRY_STATUS[status];

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await replyToEnquiry(item.id, draft);
      setEditing(false);
      await onSaved();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>{item.property_title}</Text>
        <Text style={[styles.badge, { backgroundColor: s.bg, color: s.fg }]}>{s.label}</Text>
      </View>
      <Text style={styles.meta}>{item.buyer_name} · {when(item.created_at)}</Text>
      <Text style={styles.message}>{item.message}</Text>

      {item.reply && !editing ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Reply{item.replied_by_name ? ` by ${item.replied_by_name}` : ''} · {when(item.replied_at)}</Text>
          <Text style={styles.replyText}>{item.reply}</Text>
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)}>
            <Text style={styles.link}>Edit reply</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Write your reply to the buyer…"
            multiline
            maxLength={ENQUIRY_MAX}
            accessibilityLabel={`Reply to ${item.buyer_name}`}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            {item.reply ? (
              <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => { setDraft(item.reply); setEditing(false); }} disabled={busy}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              style={[styles.primary, (busy || !draft.trim()) && styles.disabled]}
              onPress={save}
              disabled={busy || !draft.trim()}
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{item.reply ? 'Save reply' : 'Send reply'}</Text>}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export default function EnquiriesReceivedScreen({ role }) {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await getEnquiriesReceived());
      setError('');
    } catch (failure) {
      setError(failure.message);
      setRows((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  const counts = countByStatus(rows ?? []);
  const visible = filterEnquiries(rows ?? [], filter);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.meta, styles.flex]}>
          {role === 'agent' ? 'Enquiries on the listings assigned to you.' : 'Enquiries on your listings.'} Your reply is shown to the buyer.
        </Text>
        <Pressable accessibilityRole="button" onPress={load}>
          <Text style={styles.link}>↻ Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.filters}>
        {[
          { id: 'pending', label: `Pending (${counts.pending})` },
          { id: 'handled', label: `Handled (${counts.handled})` },
          { id: 'all', label: `All (${counts.all})` },
        ].map((f) => (
          <Pressable
            key={f.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f.id }}
            style={[styles.filter, filter === f.id && styles.filterActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.errorBox}>{error}</Text> : null}
      {rows === null && <ActivityIndicator color={colors.primary} />}
      {rows !== null && visible.length === 0 && !error && (
        <Text style={styles.meta}>{filter === 'pending' ? 'No pending enquiries. 🎉' : 'No enquiries here.'}</Text>
      )}
      {visible.map((item) => (
        <EnquiryCard key={`${item.id}:${item.replied_at || ''}`} item={item} onSaved={load} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { color: '#292424', fontSize: 13, lineHeight: 19 },
  link: { color: '#292424', fontWeight: '700', fontSize: 13 },
  filters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filter: { borderWidth: 1, borderColor: '#292424', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F6F5F0' },
  filterActive: { backgroundColor: '#292424', borderColor: '#292424' },
  filterText: { color: '#292424', fontWeight: '400', fontSize: 12 },
  filterTextActive: { color: '#F6F5F0', fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#292424', borderRadius: 8, padding: 12, gap: 6, backgroundColor: '#F6F5F0' },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#292424' },
  badge: { fontSize: 12, fontWeight: '400', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#292424', overflow: 'hidden' },
  message: { fontSize: 14, color: '#292424' },
  replyBox: { backgroundColor: 'rgba(182, 51, 30, 0.1)', borderRadius: 8, padding: 10, gap: 4 },
  replyLabel: { fontSize: 12, color: '#292424', fontWeight: '700' },
  replyText: { fontSize: 13, color: '#292424' },
  composer: { gap: 8 },
  input: { borderWidth: 1, borderColor: '#292424', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, minHeight: 48, fontSize: 14, color: '#292424', backgroundColor: '#F6F5F0', textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 12 },
  primary: { flex: 1, height: 48, backgroundColor: '#B6331E', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#F6F5F0', fontWeight: '700', fontSize: 15 },
  secondary: { flex: 1, height: 48, borderWidth: 1, borderColor: '#292424', borderRadius: 8, backgroundColor: '#F6F5F0', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#292424', fontWeight: '400', fontSize: 15 },
  disabled: { opacity: 0.45 },
  error: { color: '#B6331E', fontSize: 13 },
  errorBox: { backgroundColor: 'rgba(182, 51, 30, 0.1)', color: '#B6331E', borderWidth: 1, borderColor: '#B6331E', borderRadius: 8, padding: 12 },
});
