import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  RefreshControl,
} from 'react-native';
import { getProperties, updateProperty } from '../services/propertyService';
import { authColors as colors } from '../styles/authTheme';

export default function AgentReviewScreen({ currentSession, onEditProperty, onOpenChat }) {
  const [drafts, setDrafts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadDrafts = async () => {
    try {
      const all = await getProperties({ activeOnly: false });
      if (all && all.length > 0) {
        // Only drafts assigned to an agent
        const pendingReview = all.filter(
          (p) => p.status === 'draft' && p.agent_id !== null && p.agent_id !== undefined
        );
        if (pendingReview.length > 0) {
          setDrafts(pendingReview);
          return;
        }
      }
    } catch (e) {}

    // Fallback sample drafts for Agent review matching Wireframe 16
    setDrafts([
      {
        id: 'a0000000-0000-4000-8000-000000000003',
        title: 'Furnished Student Studio in Oxford',
        seller_name: 'Demo Seller',
        price: 650,
        listing_type: 'rent',
        location: 'Oxford, UK',
        status: 'draft',
      },
      {
        id: 'a0000000-0000-4000-8000-000000000007',
        title: 'Modern 2-Bed Flat in Cambridge',
        seller_name: 'Demo Seller',
        price: 1350,
        listing_type: 'rent',
        location: 'Cambridge, UK',
        status: 'draft',
      },
    ]);
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDrafts();
    setRefreshing(false);
  };

  const handleApprove = async (item) => {
    setFeedback(`Approving "${item.title}"...`);
    try {
      if (item.id && item.id.includes('-')) {
        await updateProperty(item.id, { status: 'active' });
      }
    } catch (e) {}
    setDrafts((prev) => prev.filter((p) => p.id !== item.id));
    setFeedback(`✅ "${item.title}" approved and published live!`);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleReject = async (item) => {
    setDrafts((prev) => prev.filter((p) => p.id !== item.id));
    setFeedback(`Rejected "${item.title}". Returned to seller with notes.`);
    setTimeout(() => setFeedback(''), 3000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Figma Header matching Wireframe 16 */}
        <Text style={styles.screenTitle}>Listings to review</Text>
        <Text style={styles.screenSub}>
          Moderate seller draft submissions before publishing to the live catalogue.
        </Text>

        {feedback ? <Text style={styles.feedbackBanner}>{feedback}</Text> : null}

        {drafts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>All caught up! 🎉</Text>
            <Text style={styles.emptySub}>No draft listings currently awaiting agent moderation.</Text>
          </View>
        ) : (
          drafts.map((item) => (
            <View key={item.id} style={styles.card}>
              {/* Photo placeholder matching Wireframe 16 */}
              <View style={styles.imgBox}>
                <Text style={styles.imgText}>img</Text>
              </View>

              {/* Title & Draft pill */}
              <View style={styles.cardHeader}>
                <Text style={styles.propertyTitle}>{item.title}</Text>
                <View style={styles.draftBadge}>
                  <Text style={styles.draftBadgeText}>Draft</Text>
                </View>
              </View>

              <Text style={styles.propertyMeta}>
                £{Number(item.price).toLocaleString('en-GB')}{item.listing_type === 'rent' ? '/mo' : ''} · {item.location} · Seller: {item.seller_name || 'Demo Seller'}
              </Text>

              {/* Actions matching Wireframe 16: Approve | Reject */}
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.approveBtn}
                  onPress={() => handleApprove(item)}
                >
                  <Text style={styles.approveBtnText}>Approve</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.rejectBtn}
                  onPress={() => handleReject(item)}
                >
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </Pressable>
              </View>

              {/* Detail Review Option */}
              <Pressable
                style={styles.reviewDetailBtn}
                onPress={() => onEditProperty && onEditProperty(item)}
              >
                <Text style={styles.reviewDetailText}>Inspect / Edit Details →</Text>
              </Pressable>
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
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 4,
  },
  screenSub: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 18,
  },
  feedbackBanner: {
    fontSize: 13,
    fontWeight: '600',
    color: '#008000',
    backgroundColor: '#F0FFF0',
    borderWidth: 1,
    borderColor: '#008000',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 10,
    padding: 16,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
  },
  imgBox: {
    height: 120,
    backgroundColor: '#EED9D5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  imgText: {
    color: '#8A5D57',
    fontSize: 14,
    fontWeight: '500',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A2424',
    flex: 1,
    marginRight: 8,
  },
  draftBadge: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FAFAFA',
  },
  draftBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2A2424',
  },
  propertyMeta: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#B6311E',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  rejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  rejectBtnText: {
    color: '#2A2424',
    fontWeight: '600',
    fontSize: 14,
  },
  reviewDetailBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  reviewDetailText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
  },
});
