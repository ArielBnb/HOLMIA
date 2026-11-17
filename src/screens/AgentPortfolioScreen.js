import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  RefreshControl,
} from 'react-native';
import { authColors as colors } from '../styles/authTheme';

export default function AgentPortfolioScreen({ currentSession, onEditProperty, onAddProperty }) {
  const [properties, setProperties] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const loadPortfolio = useCallback(() => {
    const sample = [
      {
        id: 'prop-1',
        title: 'Central London Flat',
        description: 'Charming two-bedroom apartment with private balcony, close to tube station.',
        price: 425000,
        listing_type: 'sale',
        property_type: 'Flat',
        location: 'London (SW1)',
        status: 'active',
        offersCount: 2,
      },
      {
        id: 'prop-2',
        title: 'Oxford Student Studio',
        description: 'Compact fully furnished modern studio near university campus.',
        price: 650,
        listing_type: 'rent',
        property_type: 'Studio',
        location: 'Oxford (City Centre)',
        status: 'draft',
        offersCount: 0,
      },
      {
        id: 'prop-3',
        title: 'Manchester Family House',
        description: 'Four-bedroom detached family home with private landscaped garden.',
        price: 580000,
        listing_type: 'sale',
        property_type: 'House',
        location: 'Manchester (Didsbury)',
        status: 'under_offer',
        offersCount: 3,
      },
      {
        id: 'prop-4',
        title: 'Birmingham Converted Loft',
        description: 'Open-plan warehouse conversion with exposed brickwork and mezzanine.',
        price: 310000,
        listing_type: 'sale',
        property_type: 'Loft',
        location: 'Birmingham (B1)',
        status: 'sold',
        offersCount: 1,
      },
      {
        id: 'prop-5',
        title: 'Bristol Riverside Flat',
        description: 'Contemporary two-bedroom apartment with river views and parking.',
        price: 1150,
        listing_type: 'rent',
        property_type: 'Flat',
        location: 'Bristol (Harbourside)',
        status: 'rented',
        offersCount: 4,
      },
      {
        id: 'prop-6',
        title: 'Cambridge Detached House',
        description: 'Three-bedroom house with large south-facing garden.',
        price: 1250000,
        listing_type: 'sale',
        property_type: 'House',
        location: 'Cambridge (CB3)',
        status: 'active',
        offersCount: 1,
      },
    ];
    setProperties(sample);
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPortfolio();
    setTimeout(() => setRefreshing(false), 400);
  }, [loadPortfolio]);

  const filtered = filter === 'all' ? properties : properties.filter((p) => p.status === filter);

  const statusLabel = {
    draft: 'Draft',
    active: 'Active',
    under_offer: 'Under Offer',
    sold: 'Sold',
    rented: 'Rented',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Figma Header (10 - My listings) */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>My listings</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.addIconBtn}
            onPress={() => onAddProperty && onAddProperty()}
          >
            <Text style={styles.addIconText}>+</Text>
          </Pressable>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {['all', 'active', 'draft', 'under_offer', 'sold', 'rented'].map((st) => (
            <Pressable
              key={st}
              style={[styles.filterPill, filter === st && styles.filterPillActive]}
              onPress={() => setFilter(st)}
            >
              <Text style={[styles.filterPillText, filter === st && styles.filterPillTextActive]}>
                {st === 'all' ? 'All' : statusLabel[st]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Property Cards matching Figma Wireframe 10 */}
        {filtered.map((item) => (
          <View key={item.id} style={styles.card}>
            {/* Top Row: Property Name + Status Badge */}
            <View style={styles.cardHeader}>
              <Text style={styles.propertyName} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={[styles.statusBadge, item.status === 'active' && styles.statusBadgeActive]}>
                <Text style={styles.statusText}>{statusLabel[item.status] || item.status}</Text>
              </View>
            </View>

            {/* Subtitle: Price · Type · nb offers */}
            <Text style={styles.propertySubtitle}>
              £{Number(item.price).toLocaleString('en-GB')}
              {item.listing_type === 'rent' ? '/mo' : ''} · {item.listing_type === 'sale' ? 'Sale' : 'Rent'} · {item.offersCount} offer{item.offersCount !== 1 ? 's' : ''}
            </Text>

            {/* Two Side-by-Side Action Buttons: Edit / Moderate */}
            <View style={styles.cardActions}>
              <Pressable
                accessibilityRole="button"
                style={styles.actionBtn}
                onPress={() => onEditProperty && onEditProperty(item)}
              >
                <Text style={styles.actionBtnText}>Edit</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.actionBtn}
                onPress={() => onEditProperty && onEditProperty(item)}
              >
                <Text style={styles.actionBtnText}>Moderate</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {filtered.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No properties in this category.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F5F0',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2A2424',
  },
  addIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconText: {
    fontSize: 30,
    lineHeight: 32,
    color: '#2A2424',
    fontWeight: '400',
  },
  filterRow: {
    gap: 8,
    paddingBottom: 16,
  },
  filterPill: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#F6F5F0',
  },
  filterPillActive: {
    backgroundColor: '#2A2424',
  },
  filterPillText: {
    fontSize: 12,
    color: '#2A2424',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Figma Card (Wireframe 10)
  card: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  propertyName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A2424',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: '#FFFFFF',
  },
  statusBadgeActive: {
    backgroundColor: '#F6F5F0',
  },
  statusText: {
    fontSize: 11,
    color: '#2A2424',
    fontWeight: '600',
  },
  propertySubtitle: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 14,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2A2424',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666666',
    fontSize: 14,
  },
});
