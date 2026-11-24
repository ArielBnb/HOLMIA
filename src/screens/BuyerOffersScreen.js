import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { getBuyerSubmissions } from '../services/submissionService';
import { buyerColors as c, buyerStyles as s } from '../styles/buyerTheme';

export default function BuyerOffersScreen({ submitted }) {
  const [kind, setKind] = useState(submitted || 'offer');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const sequence = useRef({ version: 0 });
  const load = useCallback(async () => {
    const ticket = ++sequence.current.version;
    setRefreshing(true);
    try {
      const data = await getBuyerSubmissions();
      if (ticket === sequence.current.version) { setRows(data); setError(''); }
    } catch (failure) {
      if (ticket === sequence.current.version) setError(failure.message || 'Unable to load your activity.');
    } finally {
      if (ticket === sequence.current.version) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    const current = sequence.current;
    const first = setTimeout(load, 0);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') load(); });
    return () => { ++current.version; clearTimeout(first); listener.remove(); };
  }, [load]);
  const visible = rows?.filter((row) => row.kind === kind);
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={!!rows && refreshing} onRefresh={load} />}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text style={s.heading}>My activity</Text>
        <Pressable accessibilityRole="button" onPress={load} disabled={refreshing} hitSlop={8}>
          <Text style={s.label}>Refresh</Text>
        </Pressable>
      </View>
      <View style={s.row}>
        {['offer', 'rental'].map((type) => <Pressable key={type} accessibilityRole="tab"
          accessibilityState={{ selected: kind === type }} onPress={() => setKind(type)}
          style={[s.button, { flex: 1 }, kind === type && s.primary]}>
          <Text style={kind === type ? s.primaryText : s.text}>{type === 'offer' ? 'Offers' : 'Applications'}</Text>
        </Pressable>)}
      </View>
      {submitted === kind && <Text accessibilityRole="alert" style={s.text}>
        {kind === 'offer' ? 'Offer submitted.' : 'Application submitted.'}
      </Text>}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {!rows && !error && <ActivityIndicator accessibilityLabel="Loading activity" color={c.red} />}
      {visible?.length === 0 && !error &&
        <Text style={s.text}>{kind === 'offer' ? 'No offers yet.' : 'No rental applications yet.'}</Text>}
      {visible?.map((row) => <View key={row.id} style={s.summary}>
        <View style={s.row}>
          <Text style={[s.text, { flex: 1, fontWeight: '700' }]}>{row.title}</Text>
          <View style={s.badge}><Text style={[s.label, { textTransform: 'capitalize' }]}>{row.status}</Text></View>
        </View>
        <Text style={s.label}>{kind === 'offer' ? '£' + Number(row.amount).toLocaleString('en-GB')
          : 'Move-in ' + row.move_in_date}</Text>
        {!!row.notes && <Text style={s.label}>{row.notes}</Text>}
      </View>)}
    </ScrollView>
  );
}
