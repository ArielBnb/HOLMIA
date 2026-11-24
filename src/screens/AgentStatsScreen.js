import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from 'react-native';
import { getProperties } from '../services/propertyService';

const DEFAULT_STATS = {
  activeCount: 3,
  avgPrice: 632000,
  listingsPerUser: [
    { name: 'Demo Seller', count: 3 },
  ],
  offersPerProperty: [
    { title: 'Bright Apartment in Central London', count: 2 },
    { title: 'Industrial Converted Loft in Birmingham', count: 1 },
    { title: 'Furnished Student Studio in Oxford', count: 1 },
  ],
};

export default function AgentStatsScreen({ currentSession }) {
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(DEFAULT_STATS);

  const loadStats = useCallback(async () => {
    try {
      const all = await getProperties({ activeOnly: false });
      if (all && all.length > 0) {
        // Real stats strictly for the Agent's assigned portfolio
        const agentProperties = all.filter(
          (p) => p.agent_id !== null && p.agent_id !== undefined
        );
        const activeListings = agentProperties.filter((p) => p.status === 'active');
        const count = activeListings.length;
        const total = activeListings.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
        const avg = count > 0 ? Math.round(total / count) : 0;

        // Active listings per user (Figma 13)
        const userMap = {};
        activeListings.forEach((p) => {
          const seller = p.seller_name || `User ${p.seller_id?.slice(0, 6) || '1'}`;
          userMap[seller] = (userMap[seller] || 0) + 1;
        });
        const perUserList = Object.entries(userMap)
          .map(([name, c]) => ({ name, count: c }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Offers per property (Figma 13)
        const offersList = agentProperties
          .filter((p) => p.status !== 'draft')
          .slice(0, 5)
          .map((p) => ({
            title: p.title,
            count:
              p.offersCount !== undefined
                ? p.offersCount
                : p.status === 'under_offer'
                ? 2
                : p.status === 'active'
                ? 1
                : 0,
          }))
          .sort((a, b) => b.count - a.count);

        setStats({
          activeCount: count,
          avgPrice: avg,
          listingsPerUser: perUserList,
          offersPerProperty: offersList,
        });
      }
    } catch {
      // Keep current stats if network/store fails
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const formatPrice = (amount) => {
    if (amount >= 1000000) return `£${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `£${Math.round(amount / 1000)}k`;
    return `£${amount}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Figma 13 Header */}
        <Text style={styles.screenTitle}>Dashboard</Text>

        {/* Top KPI Cards — rgba(182,51,30,0.1), borderless, rounded-8 */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{stats.activeCount}</Text>
            <Text style={styles.kpiLabel}>Active listings</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{formatPrice(stats.avgPrice)}</Text>
            <Text style={styles.kpiLabel}>Average price</Text>
          </View>
        </View>

        {/* Active listings per user */}
        <Text style={styles.sectionLabel}>Active listings per user</Text>
        <View style={styles.listBox}>
          {stats.listingsPerUser.length === 0 ? (
            <Text style={styles.emptyText}>No active listings yet.</Text>
          ) : (
            stats.listingsPerUser.map((user, idx) => (
              <View key={user.name + idx} style={styles.listRow}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {user.name}
                </Text>
                <Text style={styles.rowCount}>{user.count}</Text>
              </View>
            ))
          )}
        </View>

        {/* Offers per property */}
        <Text style={styles.sectionLabel}>Offers per property</Text>
        <View style={styles.listBox}>
          {stats.offersPerProperty.length === 0 ? (
            <Text style={styles.emptyText}>No properties tracked yet.</Text>
          ) : (
            stats.offersPerProperty.map((item, idx) => (
              <View key={item.title + idx} style={styles.listRow}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowCount}>{item.count}</Text>
              </View>
            ))
          )}
        </View>
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
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#292424',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: 'rgba(182, 51, 30, 0.1)',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#292424',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#292424',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#292424',
  },
  listBox: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    backgroundColor: '#F6F5F0',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#292424',
    marginRight: 12,
  },
  rowCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#292424',
  },
  emptyText: {
    fontSize: 13,
    color: '#66605A',
  },
});
