import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  RefreshControl,
} from 'react-native';
import { getProperties } from '../services/propertyService';
import { contactAgentForTerms, startOrFindConversation } from '../services/chatService';
import { authColors as colors } from '../styles/authTheme';

export default function AgentPortfolioScreen({
  currentSession,
  onEditProperty,
  onViewDetails,
  onAddProperty,
  onOpenChat,
}) {
  const userRole = currentSession?.role || 'agent';
  const [properties, setProperties] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadPortfolio = useCallback(async () => {
    const filterByRole = (list) => {
      // In Agent mode (Wireframe 14):
      // 1. Direct Seller listings without agents MUST NOT appear in feed
      // 2. Draft listings belong to "Review" screen (Wireframe 16) and are excluded here
      if (userRole === 'agent') {
        return list.filter(
          (p) => p.agent_id !== null && p.agent_id !== undefined && p.status !== 'draft'
        );
      }
      return list;
    };

    try {
      const data = await getProperties({ activeOnly: false });
      if (data && data.length > 0) {
        setProperties(
          filterByRole(data).map((p) => ({
            ...p,
            offersCount:
              p.offersCount !== undefined
                ? p.offersCount
                : p.status === 'under_offer'
                ? 2
                : p.status === 'active'
                ? 1
                : 0,
          }))
        );
        return;
      }
    } catch (err) {}
  }, [userRole]);

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

  const statusLabel = {
    draft: 'Draft',
    active: 'Active',
    under_offer: 'Under offer',
    sold: 'Sold',
    rented: 'Rented',
  };

  // Filter Pills strictly matching Wireframe 14 for Agent: [All, Active, Under offer, Sold]
  const filterOptions =
    userRole === 'agent'
      ? ['all', 'active', 'under_offer', 'sold']
      : ['all', 'active', 'draft', 'under_offer', 'sold'];

  // Apply search query first, then status filter
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Figma Header matching Wireframe 14 for Agent */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>
              {userRole === 'agent' ? 'Managed properties' : 'My listings'}
            </Text>
            <Text style={styles.roleSubTitle}>
              {userRole === 'agent' ? 'Assigned listings portfolio' : 'Seller portfolio'}
            </Text>
          </View>
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

        {/* Search Bar matching Wireframe 14 */}
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#888888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter Pills matching Wireframe 14: (All) (Active) (Under offer) (Sold) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filterOptions.map((st) => (
            <Pressable
              key={st}
              style={[styles.filterPill, filter === st && styles.filterPillActive]}
              onPress={() => setFilter(st)}
            >
              <Text style={[styles.filterPillText, filter === st && styles.filterPillTextActive]}>
                {st === 'all' ? 'All' : statusLabel[st] || st}
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

              {/* Subtitle: Seller · Price matching Wireframe 14 */}
              <Text style={styles.propertySubtitle}>
                {userRole === 'agent'
                  ? `Seller: ${item.seller_name || 'Demo Seller'} · £${Number(item.price).toLocaleString('en-GB')}${item.listing_type === 'rent' ? '/mo' : ''} · ${item.offersCount} offer${item.offersCount !== 1 ? 's' : ''}`
                  : `£${Number(item.price).toLocaleString('en-GB')}${item.listing_type === 'rent' ? '/mo' : ''} · ${item.listing_type === 'sale' ? 'Sale' : 'Rent'} · ${item.offersCount} offer${item.offersCount !== 1 ? 's' : ''}`}
              </Text>

              {/* Representation Model Pill (Relevant for Seller only) */}
              {userRole === 'seller' && (
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
              )}

              {/* Action Buttons:
                  Seller: Edit | Delete
                  Agent: Property details (Wireframe 15) */}
              <View style={styles.cardActions}>
                {userRole === 'seller' ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.actionBtn}
                      onPress={() => onEditProperty && onEditProperty(item)}
                    >
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.actionBtn, styles.deleteBtn]}
                      onPress={() => handleDelete(item.id)}
                    >
                      <Text style={styles.actionBtnText}>Delete</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.agentActionRow}>
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.actionBtn, { flex: 1 }]}
                      onPress={() => onEditProperty && onEditProperty(item)}
                    >
                      <Text style={styles.actionBtnText}>Edit details</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.actionBtn, styles.detailsBtn, { flex: 1.2 }]}
                      onPress={() => (onViewDetails ? onViewDetails(item) : onEditProperty(item))}
                    >
                      <Text style={[styles.actionBtnText, styles.detailsBtnText]}>
                        Status & History →
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Direct Communication Buttons on Property Card */}
              {userRole === 'seller' ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.cardChatBtn}
                  onPress={async () => {
                    if (hasAgent) {
                      const conv = await contactAgentForTerms({
                        property: item,
                        sellerName: currentSession?.full_name || currentSession?.username || 'Seller',
                      });
                      if (onOpenChat) onOpenChat(conv.id);
                    } else {
                      const conv = await startOrFindConversation({
                        property: item,
                        userRole: 'seller',
                        userName: currentSession?.full_name || currentSession?.username || 'Seller (Owner)',
                        targetChannel: 'seller_buyer',
                      });
                      if (onOpenChat) onOpenChat(conv.id);
                    }
                  }}
                >
                  <Text style={styles.cardChatBtnText}>
                    {hasAgent ? '💬 Chat with Assigned Agent' : '💬 Chat with Buyers (Direct Inquiries)'}
                  </Text>
                </Pressable>
              ) : (
                /* For Agent: Discuss with Seller AND Discuss with Buyers */
                <View style={styles.agentChatRow}>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.cardChatBtn, { flex: 1 }]}
                    onPress={async () => {
                      const conv = await startOrFindConversation({
                        property: item,
                        userRole: 'agent',
                        userName: currentSession?.full_name || currentSession?.username || 'Agent',
                        targetChannel: 'agent_seller',
                      });
                      if (onOpenChat) onOpenChat(conv.id);
                    }}
                  >
                    <Text style={styles.cardChatBtnText}>💬 Chat with Seller</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    style={[styles.cardChatBtn, styles.buyerChatBtn, { flex: 1 }]}
                    onPress={async () => {
                      const conv = await startOrFindConversation({
                        property: item,
                        userRole: 'agent',
                        userName: currentSession?.full_name || currentSession?.username || 'Agent',
                        targetChannel: 'agent_buyer',
                      });
                      if (onOpenChat) onOpenChat(conv.id);
                    }}
                  >
                    <Text style={[styles.cardChatBtnText, styles.buyerChatBtnText]}>
                      💬 Chat with Buyers
                    </Text>
                  </Pressable>
                </View>
              )}
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
  searchBox: {
    marginBottom: 14,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#2A2424',
    backgroundColor: '#FFFFFF',
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
  agentActionRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  detailsBtn: {
    backgroundColor: '#FAEDE9',
    borderColor: '#B6311E',
  },
  detailsBtnText: {
    color: '#B6311E',
  },
  cardChatBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#B6311E',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#FFF5F4',
  },
  cardChatBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B6311E',
  },
  agentChatRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  buyerChatBtn: {
    marginTop: 0,
    borderColor: '#2A2424',
    backgroundColor: '#F7F7F7',
  },
  buyerChatBtnText: {
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
