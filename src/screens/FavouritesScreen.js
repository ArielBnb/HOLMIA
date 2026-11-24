import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { FavouriteButton, PropertyImage } from '../components/PropertyCard';
import { formatPrice } from '../services/buyerFilters';
import { buyerColors as c, buyerStyles as s } from '../styles/buyerTheme';

export default function FavouritesScreen({ rows, loading, onOpen, onRemove, busy }) {
  return (
    <ScrollView style={s.page} contentContainerStyle={[s.content, { paddingTop: 54 }]}>
      <Text style={s.heading}>Favourites</Text>
      {loading && <ActivityIndicator color={c.red} accessibilityLabel="Loading favourites" />}
      {!loading && rows?.length === 0 && <Text style={s.text}>Your saved properties will appear here.</Text>}
      {rows?.map(({ property_id: id, properties: property }) => (
        <View key={id} style={[s.row, { padding: 10, borderWidth: 1, borderColor: c.border, borderRadius: 8, minHeight: 78 }]}>
          <Pressable accessibilityRole="button" disabled={!property} onPress={() => onOpen(id)} style={[s.row, { flex: 1 }]}>
            <View style={{ width: 72 }}>
              {property
                ? <PropertyImage property={property} height={56} />
                : <View style={{ height: 56, borderRadius: 6, backgroundColor: c.image }} />}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[s.text, { fontWeight: '700' }]}>{property?.title || 'Property unavailable'}</Text>
              {property && <Text style={s.label}>{formatPrice(property)}</Text>}
            </View>
          </Pressable>
          <FavouriteButton saved disabled={busy.has(id)} onPress={() => onRemove(id)} />
        </View>
      ))}
    </ScrollView>
  );
}
