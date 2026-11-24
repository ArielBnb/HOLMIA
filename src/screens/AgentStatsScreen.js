import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { getSupabase } from '../config/supabase';
import { getProperties } from '../services/propertyService';
import { getOffersReceived } from '../services/offerService';

const EMPTY_STATS = { activeCount: 0, avgPrice: 0, listingsPerUser: [], offersPerProperty: [] };

// Figma 13. Uses public.agent_dashboard() when deployed, or computes the exact
// same live stats for the signed-in Agent's assigned listings if RPC is pending.
export default function AgentStatsScreen({ currentSession }) {
  const agentId = currentSession?.id;
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const client = getSupabase();
      const { data, error: rpcError } = await client.rpc('agent_dashboard');
      if (!rpcError && data) {
        setStats({
          activeCount: Number(data?.active_count ?? 0),
          avgPrice: Number(data?.avg_active_price ?? 0),
          listingsPerUser: data?.listings_per_seller ?? [],
          offersPerProperty: data?.offers_per_property ?? [],
        });
        setError('');
        return;
      }

      // Live fallback computed directly from the Agent's real assigned rows
      let me = agentId;
      if (!me) {
        try {
          const { data: authData } = await client.auth.getUser();
          me = authData?.user?.id;
        } catch {
          // keep undefined
        }
      }

      const all = await getProperties({ activeOnly: false });
      const mine = me
        ? (all ?? []).filter((p) => p.agent_id === me)
        : (all ?? []).filter((p) => p.agent_id !== null && p.agent_id !== undefined);
      const active = mine.filter((p) => p.status === 'active');
      const avg = active.length
        ? Math.round(active.reduce((sum, p) => sum + (Number(p.price) || 0), 0) / active.length)
        : 0;

      const bySeller = {};
      active.forEach((p) => {
        const key = p.seller_name || `Seller ${(p.seller_id || '').slice(0, 6)}`;
        bySeller[key] = (bySeller[key] || 0) + 1;
      });
      const listingsPerUser = Object.entries(bySeller)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      let offerCounts = {};
      try {
        const received = await getOffersReceived();
        offerCounts = (received ?? []).reduce((acc, o) => {
          acc[o.property_id] = (acc[o.property_id] || 0) + 1;
          return acc;
        }, {});
      } catch {
        // offers RPC optional
      }

      const offersPerProperty = mine
        .filter((p) => p.status !== 'draft')
        .map((p) => ({ title: p.title, count: offerCounts[p.id] || 0 }))
        .sort((a, b) => b.count - a.count);

      setStats({
        activeCount: active.length,
        avgPrice: avg,
        listingsPerUser,
        offersPerProperty,
      });
      setError('');
    } catch (failure) {
      setError(failure.message || 'Unable to load statistics.');
    } finally {
      setLoaded(true);
    }
  }, [agentId]);

  useEffect(() => {
    const first = setTimeout(loadStats, 0);
    const interval = setInterval(loadStats, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
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
        {!loaded && <ActivityIndicator color="#B6331E" accessibilityLabel="Loading statistics" />}
        {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}

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
  errorText: {
    color: '#B6331E',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#B6331E',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'rgba(182, 51, 30, 0.1)',
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
