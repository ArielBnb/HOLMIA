import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { decideViewing, getViewingsForRole } from '../services/viewingService';

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
};

/**
 * Seller / Agent view of requested property viewings with Confirm / Decline actions.
 */
export default function ViewingsReceivedScreen({ role, userId }) {
  const [rows, setRows] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const list = await getViewingsForRole(role, userId);
      setRows(list);
      setError('');
    } catch (failure) {
      setError(failure.message || 'Unable to load viewing requests.');
    }
  }, [role, userId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const interval = setInterval(load, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [load]);

  const handleDecision = async (item, decision) => {
    setBusyId(item.id);
    setNotice('');
    setError('');
    try {
      await decideViewing(item, decision);
      setNotice(
        `Viewing for "${item.property_title}" (${item.date} at ${item.time}) ${decision}.`
      );
      await load();
    } catch (failure) {
      setError(failure.message || 'Unable to save decision.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.meta, styles.flex]}>
          Requested property viewings from buyers.
        </Text>
        <Pressable accessibilityRole="button" onPress={load}>
          <Text style={styles.link}>↻ Refresh</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorBox}>{error}</Text> : null}
      {notice ? <Text style={styles.success}>{notice}</Text> : null}

      {rows.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.meta}>No viewing requests yet.</Text>
        </View>
      ) : (
        rows.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.title} numberOfLines={1}>
                {item.property_title}
              </Text>
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  {STATUS_LABELS[item.status] || item.status}
                </Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {item.buyer_name} · {item.date} at {item.time}
              {item.property_location ? ` · ${item.property_location}` : ''}
            </Text>

            {item.status === 'pending' && (
              role === 'agent' || (role === 'seller' && !item.has_agent) ? (
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busyId === item.id}
                    style={styles.primary}
                    onPress={() => handleDecision(item, 'confirmed')}
                  >
                    <Text style={styles.primaryText}>Confirm</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busyId === item.id}
                    style={styles.secondary}
                    onPress={() => handleDecision(item, 'declined')}
                  >
                    <Text style={styles.secondaryText}>Decline</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.delegatedNote}>
                  Handled by your assigned Agent (they confirm viewing slots).
                </Text>
              )
            )}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { color: '#292424', fontSize: 13, lineHeight: 19 },
  link: { color: '#292424', fontWeight: '700', fontSize: 13 },
  success: {
    backgroundColor: 'rgba(182, 51, 30, 0.1)',
    color: '#292424',
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: 'rgba(182, 51, 30, 0.1)',
    color: '#B6331E',
    borderWidth: 1,
    borderColor: '#B6331E',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    backgroundColor: '#F6F5F0',
  },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#292424' },
  pill: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#F6F5F0',
  },
  pillText: { fontSize: 12, color: '#292424' },
  actions: { flexDirection: 'row', gap: 12 },
  primary: {
    flex: 1,
    height: 44,
    backgroundColor: '#B6331E',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#F6F5F0', fontWeight: '700', fontSize: 14 },
  secondary: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    backgroundColor: '#F6F5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: '#292424', fontWeight: '400', fontSize: 14 },
  delegatedNote: { color: '#66605A', fontSize: 12, fontStyle: 'italic' },
});
