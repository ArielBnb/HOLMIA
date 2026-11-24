import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  RefreshControl,
} from 'react-native';
import { getProperties, updateProperty } from '../services/propertyService';

export default function AgentReviewScreen({ currentSession, onEditProperty }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const agentId = currentSession?.id;

  const loadDrafts = useCallback(async () => {
    try {
      const all = await getProperties({ activeOnly: false });
      const pendingReview = (all ?? []).filter(
        (p) => p.status === 'draft' && p.agent_id === agentId
      );
      setDrafts(pendingReview);
    } catch {
      // Keep state on failure
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (alive) await loadDrafts();
    };
    const first = setTimeout(run, 0);
    const interval = setInterval(run, 5000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [loadDrafts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDrafts();
    setRefreshing(false);
  };

  const handleApprove = async (item) => {
    setFeedback(`Approving "${item.title}"...`);
    try {
      await updateProperty(item.id, { status: 'active' });
    } catch (err) {
      // Show the database's reason; the draft stays in the list.
      setFeedback(`❌ "${item.title}" was not published: ${err.message}`);
      return;
    }
    setDrafts((prev) => prev.filter((p) => p.id !== item.id));
    setFeedback(`✅ "${item.title}" approved and published.`);
  };

  const handleReject = async (item) => {
    setFeedback(`Returning "${item.title}" to seller...`);
    try {
      await updateProperty(item.id, { agent_id: null });
    } catch (err) {
      setFeedback(`❌ Could not reject "${item.title}": ${err.message}`);
      return;
    }
    setDrafts((prev) => prev.filter((p) => p.id !== item.id));
    setFeedback(`✅ "${item.title}" rejected and returned to seller.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Figma 16 Header */}
        <Text style={styles.screenTitle}>Listings to review</Text>

        {feedback ? (
          <View style={styles.feedbackBanner}>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color="#B6331E" accessibilityLabel="Loading drafts" />
        ) : drafts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptySub}>
              No draft listings currently awaiting agent moderation.
            </Text>
          </View>
        ) : (
          drafts.map((item) => (
            <View key={item.id} style={styles.card}>
              {/* Image box matching Figma 16: h-[80px] rounded-[6px] rgba(182,51,30,0.1) */}
              <Pressable
                style={styles.imgBox}
                onPress={() => onEditProperty && onEditProperty(item)}
              >
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.imgFill}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.imgText}>img</Text>
                )}
              </Pressable>

              {/* Title + Draft Pill */}
              <Pressable
                style={styles.cardHeader}
                onPress={() => onEditProperty && onEditProperty(item)}
              >
                <Text style={styles.propertyTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.draftPill}>
                  <Text style={styles.draftPillText}>Draft</Text>
                </View>
              </Pressable>

              {/* Actions matching Figma 16: Approve (Primary #B6331E) | Reject (Secondary) */}
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
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#292424',
  },
  feedbackBanner: {
    borderWidth: 1,
    borderColor: '#292424',
    backgroundColor: 'rgba(182, 51, 30, 0.1)',
    borderRadius: 8,
    padding: 10,
  },
  feedbackText: {
    fontSize: 13,
    color: '#292424',
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    backgroundColor: '#F6F5F0',
  },
  imgBox: {
    height: 80,
    backgroundColor: 'rgba(182, 51, 30, 0.1)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imgFill: {
    width: '100%',
    height: '100%',
  },
  imgText: {
    color: '#292424',
    fontSize: 13,
    fontWeight: '400',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  propertyTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#292424',
  },
  draftPill: {
    backgroundColor: '#F6F5F0',
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  draftPillText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#292424',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  approveBtn: {
    flex: 1,
    height: 52,
    backgroundColor: '#B6331E',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtnText: {
    color: '#F6F5F0',
    fontWeight: '700',
    fontSize: 16,
  },
  rejectBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F5F0',
  },
  rejectBtnText: {
    color: '#292424',
    fontWeight: '400',
    fontSize: 15,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#292424',
  },
  emptySub: {
    fontSize: 13,
    color: '#66605A',
    textAlign: 'center',
  },
});
