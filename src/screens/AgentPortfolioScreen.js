import React, { useState, useEffect, useCallback } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  RefreshControl,
} from 'react-native';
import { deleteOwnProperty, getProperties } from '../services/propertyService';
import { getOffersReceived } from '../services/offerService';

export default function AgentPortfolioScreen({
  currentSession,
  onEditProperty,
  onViewDetails,
  onAddProperty,
  onOpenChat,
}) {
  const userRole = currentSession?.role || 'buyer';
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const loadPortfolio = useCallback(async () => {
    // The query also returns the public catalogue (other owners' active
    // listings): keep only the signed-in user's own / assigned listings.
    const me = currentSession?.id;
    const filterByRole = (list) => {
      if (userRole === 'agent') return list.filter((p) => p.agent_id === me && p.status !== 'draft');
      if (userRole === 'seller') return list.filter((p) => p.seller_id === me);
      return list;
    };

    try {
      const data = await getProperties({ activeOnly: false });
      // Real offer counts (public.offers_received: own / assigned listings only).
      let counts = {};
      try {
        counts = (await getOffersReceived()).reduce((acc, o) => ({ ...acc, [o.property_id]: (acc[o.property_id] || 0) + 1 }), {});
      } catch {
        // Offers not available yet: show 0 rather than an estimate.
      }
      setProperties(filterByRole(data ?? []).map((p) => ({ ...p, offersCount: counts[p.id] || 0 })));
    } catch {
      // Keep current list on failure
    } finally {
      setLoading(false);
    }
  }, [userRole, currentSession?.id]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (alive) await loadPortfolio();
    };
    const first = setTimeout(run, 0);
    // Keep Seller / Agent portfolio synced live when another role approves or updates a listing
    const interval = setInterval(run, 4000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [loadPortfolio]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPortfolio();
    setRefreshing(false);
  }, [loadPortfolio]);

  const handleDelete = async (item) => {
    setDeleteError('');
    if (['under_offer', 'sold', 'rented'].includes(item.status)) {
      setDeleteError(`Cannot delete "${item.title}": listing is ${statusLabel[item.status] || item.status}.`);
      setConfirmDeleteId(null);
      return;
    }
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      return;
    }
    try {
      await deleteOwnProperty(item.id);
      setProperties((prev) => prev.filter((p) => p.id !== item.id));
      setConfirmDeleteId(null);
    } catch (failure) {
      setDeleteError(failure.message || 'Unable to delete this listing.');
      setConfirmDeleteId(null);
    }
  };

  const statusLabel = {
    draft: 'Draft',
    active: 'Active',
    under_offer: 'Under offer',
    sold: 'Sold',
    rented: 'Rented',
  };

  // Figma 14 exact 4 pills for Agent: [All, Active, Under offer, Sold]
  const filterOptions =
    userRole === 'agent'
      ? ['all', 'active', 'under_offer', 'sold']
      : ['all', 'active', 'draft', 'under_offer', 'sold'];

  const filteredBySearch = properties.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      (p.seller_name && p.seller_name.toLowerCase().includes(q))
    );
  });

  const filtered =
    filter === 'all'
      ? filteredBySearch
      : filteredBySearch.filter((p) => p.status === filter);

  const formatPrice = (item) => {
    const val = Number(item.price || 0).toLocaleString('en-GB');
    return item.listing_type === 'rent' ? `£${val} / month` : `£${val}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Figma 14 Header */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>
            {userRole === 'agent' ? 'Managed properties' : 'My listings'}
          </Text>
          {userRole === 'seller' && (
            <Pressable
              accessibilityRole="button"
              style={styles.addIconBtn}
              onPress={() => onAddProperty && onAddProperty()}
            >
              <Text style={styles.addIconText}>+</Text>
            </Pressable>
          )}
        </View>

        {/* Figma 14 Search Input */}
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#7A736D"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Figma 14 Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filterOptions.map((st) => {
            const active = filter === st;
            return (
              <Pressable
                key={st}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setFilter(st)}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {st === 'all' ? 'All' : statusLabel[st] || st}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {deleteError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{deleteError}</Text>
          </View>
        ) : null}

        {/* Figma 14 Property Cards */}
        {loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Loading properties...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No properties match this filter.</Text>
          </View>
        ) : (
          filtered.map((item) => (
            <View key={item.id} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  onViewDetails
                    ? onViewDetails(item)
                    : onEditProperty?.(item)
                }
              >
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={{
                      width: '100%',
                      height: 110,
                      borderRadius: 6,
                      marginBottom: 8,
                      backgroundColor: 'rgba(182, 51, 30, 0.1)',
                    }}
                    resizeMode="cover"
                  />
                ) : null}
                <View style={styles.cardHeader}>
                  <Text style={styles.propertyName} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>
                      {statusLabel[item.status] || item.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.propertySubtitle} numberOfLines={1}>
                  {userRole === 'agent'
                    ? `${item.seller_name || item.location || 'UK'} · ${formatPrice(item)}`
                    : `${formatPrice(item)} · ${item.listing_type === 'sale' ? 'Sale' : 'Rent'} · ${item.offersCount} offer${item.offersCount !== 1 ? 's' : ''}`}
                </Text>
              </Pressable>

              {userRole === 'seller' && (
                <View style={styles.inlineActions}>
                  {onViewDetails && (
                    <Pressable
                      style={styles.inlineBtn}
                      onPress={() => onViewDetails(item)}
                    >
                      <Text style={styles.inlineBtnText}>Status</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.inlineBtn}
                    onPress={() => onEditProperty && onEditProperty(item)}
                  >
                    <Text style={styles.inlineBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.inlineBtn}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={[styles.inlineBtnText, { color: '#B6331E' }]}>
                      {confirmDeleteId === item.id ? 'Confirm delete' : 'Delete'}
                    </Text>
                  </Pressable>
                  {confirmDeleteId === item.id && (
                    <Pressable
                      style={styles.inlineBtn}
                      onPress={() => setConfirmDeleteId(null)}
                    >
                      <Text style={styles.inlineBtnText}>Cancel</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          ))
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
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#292424',
  },
  addIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#292424',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F5F0',
  },
  addIconText: {
    fontSize: 20,
    color: '#292424',
    lineHeight: 22,
  },
  searchBox: {
    height: 48,
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#F6F5F0',
  },
  searchInput: {
    fontSize: 14,
    color: '#292424',
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    backgroundColor: '#F6F5F0',
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillActive: {
    backgroundColor: '#292424',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#292424',
  },
  pillTextActive: {
    color: '#F6F5F0',
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 12,
    gap: 6,
    backgroundColor: '#F6F5F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  propertyName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#292424',
  },
  statusPill: {
    backgroundColor: '#F6F5F0',
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#292424',
  },
  propertySubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#292424',
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 14,
    paddingTop: 6,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(41, 36, 36, 0.12)',
  },
  inlineBtn: {
    paddingVertical: 2,
  },
  inlineBtnText: {
    fontSize: 12,
    color: '#292424',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#66605A',
  },
  errorBanner: {
    borderWidth: 1,
    borderColor: '#B6331E',
    backgroundColor: 'rgba(182, 51, 30, 0.1)',
    borderRadius: 8,
    padding: 10,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#B6331E',
  },
});
