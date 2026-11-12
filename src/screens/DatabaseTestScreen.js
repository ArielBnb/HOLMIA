import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getProperties } from '../services/propertyService';
import { watchAuthRefresh } from '../config/supabase';
import { colors } from '../styles/theme';

export default function DatabaseTestScreen() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProperties(await getProperties());
      setCheckedAt(new Date().toLocaleTimeString());
    } catch (failure) {
      setProperties([]);
      setError(failure.message || 'Connexion impossible.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let mounted = true;
    getProperties().then((data) => {
      if (mounted) { setProperties(data); setCheckedAt(new Date().toLocaleTimeString()); }
    }).catch((failure) => {
      if (mounted) setError(failure.message || 'Connexion impossible.');
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => watchAuthRefresh(), []);
  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="dark" />
      <FlatList
        data={properties} keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View>
          <Text style={styles.brand}>HOLMIA</Text>
          <Text style={styles.heading}>Annonces de démonstration</Text>
          <Text style={styles.meta}>Mission 2 · Supabase</Text>
          {loading ? <ActivityIndicator color={colors.primary} /> :
            <Text accessibilityRole="status" style={styles.meta}>{error || `${properties.length} annonces actives · connexion vérifiée à ${checkedAt}`}</Text>}
          <Pressable accessibilityRole="button" onPress={load} disabled={loading} style={styles.button}>
            <Text style={styles.buttonText}>Actualiser les données</Text>
          </Pressable>
        </View>}
        ListEmptyComponent={!loading && !error ? <Text>Aucune annonce active accessible.</Text> : null}
        renderItem={({ item }) => <View style={styles.card}>
          <Text style={styles.meta}>{item.listing_type === 'sale' ? 'VENTE' : 'LOCATION'} · {item.property_type}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>{item.location}</Text>
          <Text style={styles.price}>{Number(item.price).toLocaleString('fr-FR')} €{item.listing_type === 'rent' ? ' / mois' : ''}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 54, gap: 16, maxWidth: 800, width: '100%', alignSelf: 'center' },
  brand: { fontSize: 34, fontWeight: '800', color: colors.primary, letterSpacing: 3 },
  heading: { fontSize: 23, fontWeight: '600', color: colors.primary, marginVertical: 12 },
  meta: { color: colors.secondary, fontSize: 14, marginBottom: 8 },
  button: { backgroundColor: colors.primary, borderRadius: 12, padding: 15, marginVertical: 12 },
  buttonText: { color: colors.background, textAlign: 'center', fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', borderColor: '#DBE1DC', borderWidth: 1, borderRadius: 18, padding: 20 },
  title: { fontSize: 20, fontWeight: '600', color: colors.primary, marginBottom: 8 },
  price: { fontSize: 23, color: colors.primary, fontWeight: '700', marginVertical: 8 },
  description: { color: colors.secondary, lineHeight: 22 },
});
