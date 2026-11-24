import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { decideRental, getRentalsReceived } from '../services/submissionService';
import { buyerColors as c, buyerStyles as s } from '../styles/buyerTheme';

export default function RentalsReceivedScreen() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await getRentalsReceived()); }
    catch (failure) { setError(failure.message); }
  }, []);
  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  async function decide(id, accept) {
    setBusy(true);
    setError('');
    try { await decideRental(id, accept); }
    catch (failure) { setError(failure.message); }
    finally { await load(); setBusy(false); }
  }

  return (
    <View style={{ gap: 12 }}>
      <Pressable accessibilityRole="button" style={s.button} onPress={() => { setError(''); load(); }}>
        <Text style={s.text}>Refresh applications</Text>
      </Pressable>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {!rows && !error && <ActivityIndicator color={c.red} />}
      {rows?.length === 0 && <Text style={s.text}>No rental applications yet.</Text>}
      {rows?.map((row) => (
        <View key={row.id} style={[s.input, { height: 'auto', paddingVertical: 12, gap: 6 }]}>
          <Text style={[s.text, { fontWeight: '700' }]}>{row.property_title}</Text>
          <Text style={[s.label, { textTransform: 'capitalize' }]}>{row.buyer_name} · {row.status}</Text>
          <Text style={s.label}>Move-in {row.move_in_date}</Text>
          {!!row.notes && <Text style={s.text}>{row.notes}</Text>}
          {row.status === 'pending' && (
            <View style={s.row}>
              <Pressable accessibilityRole="button" disabled={busy} style={[s.button, s.primary, { flex: 1 }]} onPress={() => decide(row.id, true)}>
                <Text style={s.primaryText}>Accept</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} style={[s.button, { flex: 1 }]} onPress={() => decide(row.id, false)}>
                <Text style={s.text}>Reject</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
