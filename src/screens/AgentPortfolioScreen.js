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
import { colors } from '../styles/theme';

// Status display helpers
const statusConfig = {
  draft:       { label: 'Brouillon',    color: '#757575', bg: '#EEEEEE', icon: '📝' },
  active:      { label: 'Actif',        color: '#2E7D32', bg: '#E8F5E9', icon: '✅' },
  under_offer: { label: 'Sous offre',   color: '#E65100', bg: '#FFF3E0', icon: '🤝' },
  sold:        { label: 'Vendu',        color: '#1565C0', bg: '#E3F2FD', icon: '🏷️' },
  rented:      { label: 'Loué',         color: '#6A1B9A', bg: '#F3E5F5', icon: '🔑' },
};

const listingTypeLabel = { sale: 'Vente', rent: 'Location' };

export default function AgentPortfolioScreen({ currentSession }) {
  // Demo data simulating sessionService.getMyPortfolio() for agent
  const [properties, setProperties] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all | draft | active | under_offer | sold | rented

  const loadPortfolio = useCallback(() => {
    // Simulated data — in production, calls sessionService.getMyPortfolio()
    const demoProperties = [
      {
        id: 'prop-1',
        title: 'Bright Apartment in Central London',
        description: 'Charming two-bedroom apartment with private balcony, close to tube station.',
        price: 850000,
        listing_type: 'sale',
        property_type: 'Flat',
        location: 'London (Westminster)',
        status: 'active',
        seller_id: 'seller-1',
        seller_name: 'Mary Smith',
        agent_id: 'agent-1',
        created_at: '2026-11-10T10:00:00',
        updated_at: '2026-11-15T14:30:00',
      },
      {
        id: 'prop-2',
        title: 'Furnished Student Studio in Oxford',
        description: 'Compact fully furnished studio near the university campus.',
        price: 650,
        listing_type: 'rent',
        property_type: 'Studio',
        location: 'Oxford (City Centre)',
        status: 'draft',
        seller_id: 'seller-2',
        seller_name: 'John Martin',
        agent_id: 'agent-1',
        created_at: '2026-11-12T09:00:00',
        updated_at: '2026-11-12T09:00:00',
      },
      {
        id: 'prop-3',
        title: 'Spacious Family House in Manchester',
        description: 'Four-bedroom detached family home with private garden.',
        price: 420000,
        listing_type: 'sale',
        property_type: 'House',
        location: 'Manchester (Didsbury)',
        status: 'under_offer',
        seller_id: 'seller-1',
        seller_name: 'Mary Smith',
        agent_id: 'agent-1',
        created_at: '2026-11-08T11:30:00',
        updated_at: '2026-11-16T16:00:00',
      },
      {
        id: 'prop-4',
        title: 'Industrial Converted Loft in Birmingham',
        description: 'Open-plan loft in a former warehouse with exposed brickwork.',
        price: 310000,
        listing_type: 'sale',
        property_type: 'Loft',
        location: 'Birmingham (Jewellery Quarter)',
        status: 'sold',
        seller_id: 'seller-3',
        seller_name: 'Paul Taylor',
        agent_id: 'agent-1',
        created_at: '2026-10-20T08:00:00',
        updated_at: '2026-11-14T10:00:00',
      },
      {
        id: 'prop-5',
        title: 'Modern Two-Bed Flat in Bristol',
        description: 'Contemporary flat with river views and private parking.',
        price: 890,
        listing_type: 'rent',
        property_type: 'Flat',
        location: 'Bristol (Harbourside)',
        status: 'rented',
        seller_id: 'seller-2',
        seller_name: 'John Martin',
        agent_id: 'agent-1',
        created_at: '2026-10-25T14:00:00',
        updated_at: '2026-11-10T09:30:00',
      },
      {
        id: 'prop-6',
        title: 'Detached Country House in Cambridge',
        description: 'Three-bedroom house with large garden in quiet residential area.',
        price: 1250000,
        listing_type: 'sale',
        property_type: 'House',
        location: 'Cambridge (Newnham)',
        status: 'active',
        seller_id: 'seller-3',
        seller_name: 'Paul Taylor',
        agent_id: 'agent-1',
        created_at: '2026-11-14T16:00:00',
        updated_at: '2026-11-16T11:00:00',
      },
    ];
    setProperties(demoProperties);
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPortfolio();
    setTimeout(() => setRefreshing(false), 500);
  }, [loadPortfolio]);

  const filteredProperties = filter === 'all'
    ? properties
    : properties.filter((p) => p.status === filter);

  const statusCounts = properties.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const formatPrice = (price, listingType) => {
    if (listingType === 'rent') {
      return `${price.toLocaleString('fr-FR')} €/mois`;
    }
    return `${price.toLocaleString('fr-FR')} €`;
  };

  const filterButtons = [
    { id: 'all', label: 'Tous', count: properties.length },
    { id: 'draft', label: 'Brouillons', count: statusCounts.draft || 0 },
    { id: 'active', label: 'Actifs', count: statusCounts.active || 0 },
    { id: 'under_offer', label: 'Sous offre', count: statusCounts.under_offer || 0 },
    { id: 'sold', label: 'Vendus', count: statusCounts.sold || 0 },
    { id: 'rented', label: 'Loués', count: statusCounts.rented || 0 },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.brand}>HOLMIA</Text>
        <Text style={styles.heading}>Portefeuille Agent</Text>
        <Text style={styles.subheading}>
          Biens assignés · {currentSession?.username || 'demo_agent'}
        </Text>

        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{properties.length}</Text>
            <Text style={styles.statLabel}>Total biens</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#2E7D32' }]}>
              {statusCounts.active || 0}
            </Text>
            <Text style={styles.statLabel}>Actifs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#E65100' }]}>
              {statusCounts.under_offer || 0}
            </Text>
            <Text style={styles.statLabel}>Sous offre</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#757575' }]}>
              {statusCounts.draft || 0}
            </Text>
            <Text style={styles.statLabel}>Brouillons</Text>
          </View>
        </View>

        {/* Filter Buttons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
          contentContainerStyle={styles.filterRow}
        >
          {filterButtons.map((btn) => (
            <Pressable
              key={btn.id}
              style={[
                styles.filterBtn,
                filter === btn.id && styles.filterBtnActive,
              ]}
              onPress={() => setFilter(btn.id)}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  filter === btn.id && styles.filterBtnTextActive,
                ]}
              >
                {btn.label} ({btn.count})
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Property List */}
        {filteredProperties.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Aucun bien dans cette catégorie</Text>
          </View>
        ) : (
          filteredProperties.map((prop) => {
            const st = statusConfig[prop.status] || statusConfig.draft;
            return (
              <View key={prop.id} style={styles.propertyCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={styles.statusIcon}>{st.icon}</Text>
                    <Text style={[styles.statusText, { color: st.color }]}>
                      {st.label}
                    </Text>
                  </View>
                  <Text style={styles.listingTypeBadge}>
                    {listingTypeLabel[prop.listing_type]}
                  </Text>
                </View>

                <Text style={styles.propertyTitle}>{prop.title}</Text>
                <Text style={styles.propertyDesc} numberOfLines={2}>
                  {prop.description}
                </Text>

                <View style={styles.propertyMeta}>
                  <Text style={styles.metaItem}>📍 {prop.location}</Text>
                  <Text style={styles.metaItem}>🏠 {prop.property_type}</Text>
                </View>

                <View style={styles.priceSellerRow}>
                  <Text style={styles.priceText}>
                    {formatPrice(prop.price, prop.listing_type)}
                  </Text>
                  <Text style={styles.sellerText}>
                    👤 {prop.seller_name}
                  </Text>
                </View>

                <Text style={styles.dateText}>
                  Mise à jour : {new Date(prop.updated_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            );
          })
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>📋 Fonctionnalité — Semaine 3</Text>
          <Text style={styles.infoCardItem}>
            • L'agent voit tous ses biens assignés via{' '}
            <Text style={styles.bold}>sessionService.getMyPortfolio()</Text>
          </Text>
          <Text style={styles.infoCardItem}>
            • Filtrage par statut (Brouillon, Actif, Sous offre, Vendu, Loué)
          </Text>
          <Text style={styles.infoCardItem}>
            • Informations vendeur et dernière mise à jour affichées
          </Text>
          <Text style={styles.infoCardItem}>
            • Pull-to-refresh pour recharger le portefeuille
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 60,
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 3,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 6,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    color: colors.secondary,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E7E3',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '600',
    marginTop: 2,
  },
  filterScrollView: {
    marginBottom: 16,
  },
  filterRow: {
    gap: 8,
    paddingRight: 8,
  },
  filterBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCD6D1',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterBtnText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E7E3',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    color: colors.secondary,
    fontWeight: '600',
  },
  propertyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7E3',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusIcon: {
    fontSize: 14,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listingTypeBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
    backgroundColor: '#F0F4F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  propertyDesc: {
    fontSize: 13,
    color: colors.secondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  propertyMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    fontSize: 13,
    color: colors.secondary,
  },
  priceSellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  sellerText: {
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7E3',
    marginTop: 10,
    marginBottom: 40,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  infoCardItem: {
    fontSize: 13,
    color: colors.secondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
  },
});

