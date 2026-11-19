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
import { getProperties } from '../services/propertyService';
import { authColors as colors } from '../styles/authTheme';

export default function AgentPortfolioScreen({
  currentSession,
  onEditProperty,
  onAddProperty,
  onOpenChat,
}) {
  const userRole = currentSession?.role || 'seller';
  const [properties, setProperties] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const loadPortfolio = useCallback(async () => {
    try {
      const remote = await getProperties({ activeOnly: false });
      if (remote && remote.length > 0) {
        setProperties(
          remote.map((p) => ({
            ...p,
            offersCount:
              p.offersCount ||
              (p.status === 'under_offer' ? 2 : p.status === 'active' ? 1 : 0),
          }))
        );
        return;
      }
    } catch (err) {
      // Fallback
    }

    const sample = [
      {
        id: 'a0000000-0000-4000-8000-000000000001',
        title: 'Bright Apartment in Central London',
        description: 'Charming two-bedroom apartment with private balcony, close to tube station.',
        price: 425000,
        listing_type: 'sale',
        property_type: 'Flat',
        location: 'London, UK',
        status: 'active',
        agent_id: 'user-agent-1', // Represented
        offersCount: 2,
      },
      {
        id: 'a0000000-0000-4000-8000-000000000002',
        title: 'Spacious Family House in Manchester',
        description: 'Four-bedroom detached family home with private landscaped garden. Direct from owner.',
        price: 580000,
        listing_type: 'sale',
        property_type: 'House',
        location: 'Manchester, UK',
        status: 'under_offer',
        agent_id: null, // NO AGENT - Direct Seller!
        offersCount: 3,
      },
      {
        id: 'a0000000-0000-4000-8000-000000000003',
        title: 'Furnished Student Studio in Oxford',
        description: 'Compact fully furnished modern studio near university campus.',
        price: 650,
        listing_type: 'rent',
        property_type: 'Studio',
        location: 'Oxford, UK',
        status: 'draft',
        agent_id: 'user-agent-1', // Represented
        offersCount: 0,
      },
      {
        id: 'a0000000-0000-4000-8000-000000000004',
        title: 'Riverside Apartment in Bristol',
        description: 'Contemporary two-bedroom apartment with river views and parking.',
        price: 1150,
        listing_type: 'rent',
        property_type: 'Flat',
        location: 'Bristol, UK',
        status: 'rented',
        agent_id: null, // Direct Seller
        offersCount: 4,
      },
      {
        id: 'a0000000-0000-4000-8000-000000000005',
        title: 'Industrial Converted Loft in Birmingham',
        description: 'Open-plan warehouse conversion with exposed brickwork and mezzanine.',
        price: 310000,
        listing_type: 'sale',
        property_type: 'Loft',
        location: 'Birmingham, UK',
        status: 'sold',
        agent_id: 'user-agent-1',
        offersCount: 1,
      },
    ];
    setProperties(sample);
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPortfolio();
    setRefreshing(false);
  }, [loadPortfolio]);

  const handleDelete = (id) => {
    setProperties((prev) => prev.filter((p) => p.id !== id));
  };

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
        {/* Figma Header (Screen 10 - My listings) */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>My listings</Text>
            <Text style={styles.roleSubTitle}>
              {userRole === 'seller' ? 'Seller Portfolio' : 'Agent Assigned Portfolio'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            style={styles.addIconBtn}
            onPress={() => onAddProperty && onAddProperty()}
          >
            <Text style={styles.addIconText}>+</Text>
          </Pressable>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
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
        {filtered.map((item) => {
          const hasAgent = Boolean(item.agent_id);
          return (
            <View key={item.id} style={styles.card}>
              {/* Top Row: Property Name + Status Badge */}
              <View style={styles.cardHeader}>
                <Text style={styles.propertyName} numberOfLines={1}>
                  {item.title}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    item.status === 'active' && styles.statusBadgeActive,
                  ]}
                >
                  <Text style={styles.statusText}>{statusLabel[item.status] || item.status}</Text>
                </View>
              </View>

              {/* Subtitle: Price · Type · nb offers */}
              <Text style={styles.propertySubtitle}>
                £{Number(item.price).toLocaleString('en-GB')}
                {item.listing_type === 'rent' ? '/mo' : ''} · {item.listing_type === 'sale' ? 'Sale' : 'Rent'} · {item.offersCount} offer{item.offersCount !== 1 ? 's' : ''}
              </Text>

              {/* Representation Model Pill */}
              <View style={styles.repRow}>
                <View
                  style={[
                    styles.repBadge,
                    hasAgent ? styles.repAgentBadge : styles.repDirectBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.repBadgeText,
                      hasAgent ? styles.repAgentText : styles.repDirectText,
                    ]}
                  >
                    {hasAgent ? 'With Agent' : 'Direct (No Agent)'}
                  </Text>
                </View>
                <Text style={styles.repExplain}>
                  {hasAgent ? 'Represented by Agent' : 'Managed directly by owner'}
                </Text>
              </View>

              {/* Action Buttons matching Wireframe 10:
                  Seller: Edit | Delete
                  Agent: Edit | Moderate */}
              <View style={styles.cardActions}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.actionBtn}
                  onPress={() => onEditProperty && onEditProperty(item)}
                >
                  <Text style={styles.actionBtnText}>Edit</Text>
                </Pressable>

                {userRole === 'seller' ? (
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Text style={styles.actionBtnText}>Delete</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.actionBtn}
                    onPress={() => onEditProperty && onEditProperty(item)}
                  >
                    <Text style={styles.actionBtnText}>Moderate</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}

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
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2A2424',
  },
  roleSubTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  addIconBtn: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  addIconText: {
    fontSize: 24,
    lineHeight: 26,
    color: '#2A2424',
    fontWeight: '400',
  },
  filterRow: {
    gap: 8,
    marginBottom: 18,
  },
  filterPill: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  filterPillActive: {
    backgroundColor: '#2A2424',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2A2424',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  card: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
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
    paddingVertical: 3,
    backgroundColor: '#FFFFFF',
  },
  statusBadgeActive: {
    borderColor: '#2A2424',
    backgroundColor: '#FAFAFA',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2A2424',
  },
  propertySubtitle: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 8,
  },
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  repBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  repAgentBadge: {
    borderColor: '#B6311E',
    backgroundColor: '#FFF5F4',
  },
  repAgentText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B6311E',
  },
  repDirectBadge: {
    borderColor: '#2A2424',
    backgroundColor: '#F5F5F5',
  },
  repDirectText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2A2424',
  },
  repExplain: {
    fontSize: 11,
    color: '#777',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  deleteBtn: {
    borderColor: '#888',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2A2424',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#777',
  },
});
