// "Ask HOLMIA" assistant: floating button + full-screen chat, for every role.
// Buyers get listing recommendations (tappable cards), Sellers and Agents get
// help with pricing, offers, applications and replies. The conversation stays
// on the device for the session; nothing is stored server-side.
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ASSISTANT_INTRO, ASSISTANT_MAX_CHARS, ASSISTANT_SUGGESTIONS, askAssistant } from '../services/assistantService';

const ink = '#292424';
const red = '#B6331E';
const paper = '#F6F5F0';

const money = (l) => `£${Number(l.price).toLocaleString('en-GB')}${l.listing_type === 'rent' ? ' / month' : ''}`;

function ListingCard({ listing, onOpen }) {
  return (
    <Pressable accessibilityRole="button" style={styles.card} onPress={() => onOpen?.(listing)} disabled={!onOpen}>
      <Text style={styles.cardTitle} numberOfLines={2}>{listing.title}</Text>
      <Text style={styles.cardMeta}>{money(listing)} · {listing.property_type} · {listing.location}</Text>
      {onOpen ? <Text style={styles.cardLink}>Open listing →</Text> : null}
    </Pressable>
  );
}

export default function AssistantChat({ profile, onOpenListing }) {
  const role = ['buyer', 'seller', 'agent'].includes(profile?.role) ? profile.role : 'buyer';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role, content, listings? }
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  const send = async (text) => {
    const content = String(text ?? draft).trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setDraft('');
    setError('');
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const { reply, listings } = await askAssistant(next);
      setMessages((current) => [...current, { role: 'assistant', content: reply, listings }]);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const openListing = onOpenListing
    ? (listing) => { setOpen(false); onOpenListing(listing); }
    : null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask the HOLMIA assistant"
        style={styles.fab}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.fabText}>✨ Ask HOLMIA</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.page}>
          <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
              <View style={styles.flex}>
                <Text style={styles.title}>HOLMIA assistant</Text>
                <Text style={styles.subtitle}>AI · answers can be wrong, check before deciding</Text>
              </View>
              {messages.length > 0 && (
                <Pressable accessibilityRole="button" onPress={() => { setMessages([]); setError(''); }} style={styles.headerBtn}>
                  <Text style={styles.link}>New chat</Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel="Close the assistant" onPress={() => setOpen(false)} style={styles.headerBtn}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            <ScrollView ref={scrollRef} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
              {messages.length === 0 && (
                <View style={styles.intro}>
                  <Text style={styles.introText}>{ASSISTANT_INTRO[role]}</Text>
                  {ASSISTANT_SUGGESTIONS[role].map((s) => (
                    <Pressable key={s} accessibilityRole="button" style={styles.suggestion} onPress={() => send(s)}>
                      <Text style={styles.suggestionText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {messages.map((m, i) => (
                <View key={i} style={m.role === 'user' ? styles.mineWrap : styles.theirsWrap}>
                  <View style={[styles.bubble, m.role === 'user' ? styles.mine : styles.theirs]}>
                    <Text style={m.role === 'user' ? styles.mineText : styles.theirsText}>{m.content}</Text>
                  </View>
                  {m.listings?.map((l) => (
                    <ListingCard key={l.id} listing={l} onOpen={openListing} />
                  ))}
                </View>
              ))}

              {busy && (
                <View style={styles.theirsWrap}>
                  <View style={[styles.bubble, styles.theirs, styles.typing]}>
                    <ActivityIndicator color={red} />
                    <Text style={styles.theirsText}>Thinking…</Text>
                  </View>
                </View>
              )}
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            </ScrollView>

            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask anything about properties…"
                multiline
                maxLength={ASSISTANT_MAX_CHARS}
                accessibilityLabel="Message to the assistant"
              />
              <Pressable
                accessibilityRole="button"
                style={[styles.send, (busy || !draft.trim()) && styles.disabled]}
                onPress={() => send()}
                disabled={busy || !draft.trim()}
              >
                <Text style={styles.sendText}>Send</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fab: {
    position: 'absolute', right: 16, bottom: 76, zIndex: 50,
    backgroundColor: red, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 11,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  fabText: { color: paper, fontWeight: '700', fontSize: 14 },
  page: { flex: 1, backgroundColor: paper },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(41,36,36,0.15)' },
  title: { fontSize: 18, fontWeight: '700', color: ink },
  subtitle: { fontSize: 11, color: ink, opacity: 0.7 },
  headerBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  link: { color: ink, fontWeight: '700', fontSize: 13 },
  close: { color: ink, fontSize: 20 },
  thread: { padding: 20, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  intro: { gap: 10 },
  introText: { fontSize: 15, color: ink, lineHeight: 21 },
  suggestion: { borderWidth: 1, borderColor: ink, borderRadius: 12, padding: 12, backgroundColor: '#FFFFFF' },
  suggestionText: { color: ink, fontSize: 14 },
  mineWrap: { alignItems: 'flex-end', gap: 6 },
  theirsWrap: { alignItems: 'flex-start', gap: 6 },
  bubble: { maxWidth: '88%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  mine: { backgroundColor: ink },
  theirs: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(41,36,36,0.2)' },
  mineText: { color: paper, fontSize: 15, lineHeight: 21 },
  theirsText: { color: ink, fontSize: 15, lineHeight: 21 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { width: '88%', borderWidth: 1, borderColor: red, borderRadius: 10, padding: 10, backgroundColor: 'rgba(182,51,30,0.06)', gap: 2 },
  cardTitle: { color: ink, fontWeight: '700', fontSize: 14 },
  cardMeta: { color: ink, fontSize: 12 },
  cardLink: { color: red, fontWeight: '700', fontSize: 12, marginTop: 2 },
  error: { color: red, borderWidth: 1, borderColor: red, borderRadius: 8, padding: 10, backgroundColor: 'rgba(182,51,30,0.1)' },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(41,36,36,0.15)' },
  input: { flex: 1, borderWidth: 1, borderColor: ink, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, maxHeight: 120, backgroundColor: '#FFFFFF', color: ink },
  send: { backgroundColor: red, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  sendText: { color: paper, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
