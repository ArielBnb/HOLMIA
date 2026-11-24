// Buyer: send an enquiry about a published listing and see the stored reply
// from the Seller or the assigned Agent, with a Pending / Handled indicator.
import { useCallback, useEffect, useRef, useState } from 'react';
import { randomUUID } from '../utils/uuid';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getProperties } from '../services/propertyService';
import { getMyEnquiries, sendEnquiry } from '../services/enquiryService';
import { ENQUIRY_MAX, ENQUIRY_STATUS, enquiryStatus } from '../services/enquiryRules';
import { colors } from '../styles/theme';

const border = '#DBE1DC';
const danger = '#B3261E';
const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function BuyerEnquiriesScreen() {
  const [listings, setListings] = useState([]);
  const [enquiries, setEnquiries] = useState(null);
  const [propertyId, setPropertyId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const request = useRef(null);

  const load = useCallback(async () => {
    try {
      const [mine, active] = await Promise.all([getMyEnquiries(), getProperties({ activeOnly: true })]);
      setEnquiries(mine);
      setListings(active);
      setError('');
    } catch (failure) {
      setError(failure.message);
      setEnquiries((current) => current ?? []);
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

  const submit = async () => {
    if (inFlight.current || !message.trim()) return;
    if (!propertyId) {
      setError('Choose a listing first.');
      return;
    }
    inFlight.current = true;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const question = message.trim();
      if (request.current?.propertyId !== propertyId || request.current.message !== question) {
        request.current = { id: randomUUID(), propertyId, message: question };
      }
      await sendEnquiry(propertyId, question, request.current.id);
      request.current = null;
      setMessage('');
      setPropertyId('');
      setNotice('Enquiry sent. You will see the reply here.');
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  };

  const pending = (enquiries ?? []).filter((e) => enquiryStatus(e) === 'pending').length;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.heading}>My enquiries</Text>
        <Text style={styles.meta}>Ask a question about a listing. The seller or their agent replies here.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Listing</Text>
          <View style={styles.choices}>
            {listings.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: propertyId === p.id }}
                style={[styles.choice, propertyId === p.id && styles.choiceActive]}
                onPress={() => setPropertyId(p.id)}
              >
                <Text style={[styles.choiceText, propertyId === p.id && styles.choiceTextActive]} numberOfLines={1}>{p.title}</Text>
              </Pressable>
            ))}
            {listings.length === 0 && <Text style={styles.meta}>No published listings right now.</Text>}
          </View>
          <Text style={styles.label}>Your question</Text>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="e.g. Is the garden south-facing? When can I visit?"
            multiline
            maxLength={ENQUIRY_MAX}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.success}>{notice}</Text> : null}
          <Pressable
            accessibilityRole="button"
            style={[styles.primary, (sending || !message.trim()) && styles.disabled]}
            onPress={submit}
            disabled={sending || !message.trim()}
          >
            {sending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Send enquiry</Text>}
          </Pressable>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Sent ({enquiries?.length ?? 0}) · {pending} pending</Text>
          <Pressable accessibilityRole="button" onPress={refresh}>
            <Text style={styles.link}>↻ Refresh</Text>
          </Pressable>
        </View>
        {enquiries === null && <ActivityIndicator color={colors.primary} />}
        {enquiries?.length === 0 && <Text style={styles.meta}>No enquiries yet.</Text>}
        {enquiries?.map((e) => {
          const s = ENQUIRY_STATUS[enquiryStatus(e)];
          return (
            <View key={e.id} style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.title} numberOfLines={1}>{e.property_title}</Text>
                <Text style={[styles.badge, { backgroundColor: s.bg, color: s.fg }]}>{s.label}</Text>
              </View>
              <Text style={styles.meta}>You · {when(e.created_at)}</Text>
              <Text style={styles.message}>{e.message}</Text>
              {e.reply ? (
                <View style={styles.replyBox}>
                  <Text style={styles.replyLabel}>
                    {e.replied_by_name || 'Reply'}{e.replied_by_role ? ` (${e.replied_by_role})` : ''} · {when(e.replied_at)}
                  </Text>
                  <Text style={styles.replyText}>{e.reply}</Text>
                </View>
              ) : (
                <Text style={styles.meta}>Waiting for a reply…</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 20, paddingTop: 32, paddingBottom: 40, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  heading: { fontSize: 24, fontWeight: '700', color: colors.primary },
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.primary },
  meta: { color: colors.secondary, fontSize: 13, lineHeight: 19 },
  label: { fontSize: 14, fontWeight: '600', color: colors.primary, marginTop: 4 },
  link: { color: colors.primary, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: border, borderRadius: 16, padding: 14, gap: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.primary },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '100%' },
  choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  choiceTextActive: { color: '#FFFFFF' },
  input: { borderWidth: 1, borderColor: border, borderRadius: 10, padding: 10, minHeight: 80, fontSize: 15, backgroundColor: '#FBFBF8', textAlignVertical: 'top' },
  message: { fontSize: 15, color: '#1B1B1B' },
  replyBox: { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10, gap: 4 },
  replyLabel: { fontSize: 12, color: '#1B5E20', fontWeight: '700' },
  replyText: { fontSize: 14, color: '#1B1B1B' },
  primary: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  error: { color: danger, fontSize: 13 },
  success: { color: '#1B5E20', fontSize: 13 },
});
