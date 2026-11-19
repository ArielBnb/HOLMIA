// Inbox + conversation view for property messages (Supabase).
// Controlled: the parent owns which conversation is open (`active`), so a
// listing card can open "Message agent" directly.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  MESSAGE_MAX,
  getMyConversations,
  getThread,
  markThreadRead,
  sendPropertyMessage,
} from '../services/messageService';
import { colors } from '../styles/theme';

const INBOX_REFRESH_MS = 15000;
const THREAD_REFRESH_MS = 5000;
const border = '#DBE1DC';
const danger = '#B3261E';

const ROLE_LABELS = { agent: 'Agent', buyer: 'Buyer', seller: 'Seller' };

function formatTime(iso) {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function useConversations(enabled) {
  const [conversations, setConversations] = useState([]);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setConversations(await getMyConversations());
    } catch {
      // Keep the last known inbox; the next refresh retries.
    }
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return undefined;
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, INBOX_REFRESH_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [enabled, refresh]);
  return { conversations, refresh, unread: conversations.reduce((sum, c) => sum + (c.unread || 0), 0) };
}

function Thread({ meId, active, onBack, onChanged }) {
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const rows = await getThread(active.propertyId, meId, active.otherId);
      setMessages(rows);
      if (rows.some((m) => m.recipient_id === meId && !m.read_at)) {
        await markThreadRead(active.propertyId, meId, active.otherId);
        onChanged();
      }
    } catch (failure) {
      setError(failure.message || 'Unable to load messages.');
      setMessages((current) => current ?? []);
    }
  }, [active.propertyId, active.otherId, meId, onChanged]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, THREAD_REFRESH_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  const send = async () => {
    if (sending || !draft.trim()) return;
    setSending(true);
    setError('');
    try {
      const row = await sendPropertyMessage(active.propertyId, active.otherId, draft);
      setMessages((current) => [...(current ?? []), row]);
      setDraft('');
      onChanged();
    } catch (failure) {
      setError(failure.message || 'Message not sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
        <Text style={styles.link}>‹ All conversations</Text>
      </Pressable>
      <Text style={styles.threadTitle}>{active.otherName}{active.otherRole ? ` · ${ROLE_LABELS[active.otherRole] || active.otherRole}` : ''}</Text>
      <Text style={styles.meta} numberOfLines={1}>About: {active.propertyTitle}</Text>

      <View style={styles.thread}>
        {messages === null && <ActivityIndicator color={colors.primary} />}
        {messages?.length === 0 && <Text style={styles.meta}>No messages yet. Say hello!</Text>}
        {messages?.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <View key={m.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.body}</Text>
              <Text style={[styles.bubbleTime, mine && styles.bubbleTextMine]}>
                {formatTime(m.created_at)}{mine && m.read_at ? ' · Read' : ''}
              </Text>
            </View>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message…"
          multiline
          maxLength={MESSAGE_MAX}
          accessibilityLabel="Message"
        />
        <Pressable
          accessibilityRole="button"
          style={[styles.send, (sending || !draft.trim()) && styles.disabled]}
          onPress={send}
          disabled={sending || !draft.trim()}
        >
          {sending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.sendText}>Send</Text>}
        </Pressable>
      </View>
    </View>
  );
}

export default function PropertyMessages({ meId, conversations, onRefresh, active, onOpen, onClose }) {
  if (active) {
    return <Thread key={`${active.propertyId}:${active.otherId}`} meId={meId} active={active} onBack={onClose} onChanged={onRefresh} />;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Messages</Text>
      <Text style={styles.meta}>
        With an agent you talk to your agent. On a direct listing, buyers write to you and you reply here.
      </Text>
      {conversations.length === 0 && <Text style={styles.empty}>No conversations yet.</Text>}
      {conversations.map((c) => (
        <Pressable
          key={`${c.property_id}:${c.other_id}`}
          accessibilityRole="button"
          style={styles.row}
          onPress={() => onOpen({
            propertyId: c.property_id,
            propertyTitle: c.property_title,
            otherId: c.other_id,
            otherName: c.other_name,
            otherRole: c.other_role,
          })}
        >
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {c.other_name} · {ROLE_LABELS[c.other_role] || c.other_role}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>{c.property_title}</Text>
            <Text style={[styles.preview, c.unread > 0 && styles.previewUnread]} numberOfLines={1}>{c.last_body}</Text>
          </View>
          <View style={styles.rowSide}>
            <Text style={styles.meta}>{formatTime(c.last_at)}</Text>
            {c.unread > 0 && <Text style={styles.badge}>{c.unread}</Text>}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: border, borderWidth: 1, borderRadius: 18, padding: 18, gap: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.primary },
  meta: { color: colors.secondary, fontSize: 13 },
  empty: { color: colors.secondary, fontSize: 14, marginTop: 8 },
  link: { color: colors.primary, fontWeight: '700' },
  back: { paddingVertical: 4 },
  threadTitle: { fontSize: 17, fontWeight: '700', color: colors.primary },
  thread: { gap: 8, marginVertical: 10 },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: '#EEF2EF' },
  bubbleText: { fontSize: 15, color: '#1B1B1B' },
  bubbleTextMine: { color: '#FFFFFF' },
  bubbleTime: { fontSize: 11, color: colors.secondary, marginTop: 2 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, maxHeight: 120, backgroundColor: '#FBFBF8' },
  send: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  sendText: { color: '#FFFFFF', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  error: { color: danger, fontSize: 13 },
  row: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: border, paddingVertical: 10, gap: 10 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.primary },
  preview: { fontSize: 13, color: '#555555' },
  previewUnread: { fontWeight: '700', color: '#1B1B1B' },
  rowSide: { alignItems: 'flex-end', gap: 4 },
  badge: { backgroundColor: danger, color: '#FFFFFF', fontSize: 12, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
});
