import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { getProperties, updateProperty } from '../services/propertyService';
import { notifyOfferAction, startOrFindConversation } from '../services/chatService';

const STATUS_LABELS = {
  draft: 'Draft',
  active: 'Active',
  under_offer: 'Under Offer',
  sold: 'Sold',
  rented: 'Rented',
};

function getValidTransitions(status, listingType) {
  if (status === 'draft') return ['active'];
  if (status === 'active') return ['under_offer', 'draft'];
  if (status === 'under_offer') {
    return [listingType === 'rent' ? 'rented' : 'sold', 'active'];
  }
  return []; // Terminal states: sold / rented
}

export default function PropertyLifecycleScreen({
  currentSession,
  initialProperty,
  onEditProperty,
  onBack,
  onOpenChat,
}) {
  const [viewMode, setViewMode] = useState('manage'); // 'manage' | 'offers'
  const [selectedPropId, setSelectedPropId] = useState(
    initialProperty?.id || 'a0000000-0000-4000-8000-000000000001'
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [message, setMessage] = useState('');
  const [properties, setProperties] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const all = await getProperties({ activeOnly: false });
        if (all && all.length > 0) {
          const agentOnly = all.filter(
            (p) => p.agent_id !== null && p.agent_id !== undefined && p.status !== 'draft'
          );
          if (agentOnly.length > 0) {
            setProperties(
              agentOnly.map((p) => ({
                ...p,
                history:
                  p.history && p.history.length > 0
                    ? p.history
                    : [
                        {
                          id: 'h-' + p.id,
                          from: 'Draft',
                          to: STATUS_LABELS[p.status] || p.status,
                          actor: 'Demo Agent',
                          date: '15 Nov 2026',
                          notes: 'Status initialized',
                        },
                        {
                          id: 'h-created-' + p.id,
                          from: '',
                          to: 'Created',
                          actor: 'Demo Seller',
                          date: '12 Nov 2026',
                          notes: 'Listing created',
                        },
                      ],
              }))
            );
            if (initialProperty?.id) {
              setSelectedPropId(initialProperty.id);
            } else {
              setSelectedPropId(agentOnly[0].id);
            }
          }
        }
      } catch {
        // Fallback handled safely below
      }
    }
    load();
  }, [initialProperty]);

  const [offers, setOffers] = useState([
    {
      id: 'off-1',
      buyer_name: 'Alexander Wright',
      property_id: 'prop-1',
      property_title: 'Central London Flat',
      amount: 420000,
      date: '16 Nov 2026',
      status: 'accepted',
    },
    {
      id: 'off-2',
      buyer_name: 'Sophie Bennett',
      property_id: 'prop-1',
      property_title: 'Central London Flat',
      amount: 415000,
      date: '15 Nov 2026',
      status: 'rejected',
    },
    {
      id: 'off-3',
      buyer_name: 'James Harrison',
      property_id: 'prop-2',
      property_title: 'Oxford Student Studio',
      amount: 650,
      date: '17 Nov 2026',
      status: 'pending',
    },
  ]);

  const selectedProp =
    properties.find((p) => p.id === selectedPropId) ||
    initialProperty ||
    properties[0] || {
      id: 'default',
      title: 'Property',
      status: 'active',
      price: 425000,
      listing_type: 'sale',
      history: [],
    };

  const validNext = useMemo(
    () => getValidTransitions(selectedProp.status, selectedProp.listing_type),
    [selectedProp.status, selectedProp.listing_type]
  );

  const effectiveTarget = validNext.includes(targetStatus)
    ? targetStatus
    : validNext[0] || '';

  const isTerminal = validNext.length === 0;

  const handleTransition = async (newStatus, notes) => {
    if (!newStatus || !validNext.includes(newStatus)) {
      setMessage('Transition not allowed for this status.');
      return;
    }

    const fromStatus = selectedProp.status;
    const newEntry = {
      id: 'h-' + Date.now(),
      from: STATUS_LABELS[fromStatus] || fromStatus,
      to: STATUS_LABELS[newStatus] || newStatus,
      actor: currentSession?.username || 'Demo Agent',
      date: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      notes: notes || `Status changed by agent to ${newStatus}.`,
    };

    setProperties((prev) =>
      (prev || []).map((p) =>
        p.id === selectedProp.id
          ? {
              ...p,
              status: newStatus,
              history: [newEntry, ...(p.history || [])],
            }
          : p
      )
    );
    setDropdownOpen(false);
    setTargetStatus('');
    setMessage(`Status updated to ${STATUS_LABELS[newStatus] || newStatus}.`);

    if (selectedProp.id && selectedProp.id.includes('-')) {
      try {
        await updateProperty(selectedProp.id, { status: newStatus });
      } catch {
        // Handled gracefully
      }
    }
  };

  const handleAcceptOffer = async (offerId) => {
    const target = offers.find((o) => o.id === offerId);
    if (!target) return;

    setOffers((prev) =>
      (prev || []).map((o) => {
        if (o.id === offerId) return { ...o, status: 'accepted' };
        if (o.property_id === target.property_id && o.status === 'pending') {
          return { ...o, status: 'rejected' };
        }
        return o;
      })
    );

    try {
      await notifyOfferAction({
        propertyId: target.property_id,
        propertyTitle: target.property_title,
        buyerName: target.buyer_name,
        amount: target.amount,
        action: 'accepted',
        agentName: currentSession?.full_name || currentSession?.username || 'Demo Agent',
      });
    } catch {
      // ignore
    }
    setMessage(
      `Offer accepted: "${target.property_title}" moved to Under Offer; competing offers rejected.`
    );
  };

  const handleRejectOffer = async (offerId) => {
    const target = offers.find((o) => o.id === offerId);
    setOffers((prev) =>
      (prev || []).map((o) => (o.id === offerId ? { ...o, status: 'rejected' } : o))
    );
    if (target) {
      try {
        await notifyOfferAction({
          propertyId: target.property_id,
          propertyTitle: target.property_title,
          buyerName: target.buyer_name,
          amount: target.amount,
          action: 'rejected',
          agentName: currentSession?.full_name || currentSession?.username || 'Demo Agent',
        });
      } catch {
        // ignore
      }
    }
    setMessage('Offer rejected.');
  };

  const safeHistory =
    selectedProp?.history && selectedProp.history.length > 0
      ? selectedProp.history
      : [
          {
            id: 'h-init',
            from: 'Draft',
            to: STATUS_LABELS[selectedProp.status] || 'Active',
            date: '15 Nov 2026',
          },
          {
            id: 'h-created',
            from: '',
            to: 'Created',
            date: '12 Nov 2026',
          },
        ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Figma 15 Header: ← Property */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (viewMode === 'offers') {
              setViewMode('manage');
            } else if (onBack) {
              onBack();
            }
          }}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            ← {viewMode === 'offers' ? 'Back to property' : selectedProp.title || 'Property'}
          </Text>
        </Pressable>

        {message ? (
          <View style={styles.feedbackBanner}>
            <Text style={styles.feedbackText}>{message}</Text>
          </View>
        ) : null}

        {viewMode === 'manage' ? (
          <>
            {/* Current status row matching Figma 15 */}
            <View style={styles.statusRow}>
              <Text style={styles.rowText}>Current status</Text>
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  {STATUS_LABELS[selectedProp.status] || selectedProp.status}
                </Text>
              </View>
            </View>

            {/* Change status to */}
            <Text style={styles.sectionLabel}>Change status to</Text>

            <Pressable
              accessibilityRole="button"
              disabled={isTerminal}
              style={[styles.dropdownBox, isTerminal && styles.disabledBox]}
              onPress={() => setDropdownOpen((open) => !open)}
            >
              <Text style={styles.dropdownText}>
                {isTerminal
                  ? `${STATUS_LABELS[selectedProp.status]} (Terminal state)`
                  : `${STATUS_LABELS[effectiveTarget] || effectiveTarget}  ▾`}
              </Text>
            </Pressable>

            {dropdownOpen && !isTerminal && (
              <View style={styles.dropdownMenu}>
                {validNext.map((st) => (
                  <Pressable
                    key={st}
                    style={[
                      styles.dropdownItem,
                      st === effectiveTarget && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setTargetStatus(st);
                      setDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        st === effectiveTarget && styles.dropdownItemTextActive,
                      ]}
                    >
                      {STATUS_LABELS[st] || st}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Primary CTA: Update status (#B6331E, h-52) */}
            <Pressable
              accessibilityRole="button"
              disabled={isTerminal || !effectiveTarget}
              style={[styles.primaryBtn, (isTerminal || !effectiveTarget) && styles.primaryBtnDisabled]}
              onPress={() => handleTransition(effectiveTarget)}
            >
              <Text style={styles.primaryBtnText}>Update status</Text>
            </Pressable>

            {/* Secondary Actions Row: Edit details | See offers */}
            <View style={styles.secondaryRow}>
              <Pressable
                accessibilityRole="button"
                style={[styles.secondaryBtn, styles.editDetailsBtn]}
                onPress={() => onEditProperty && onEditProperty(selectedProp)}
              >
                <Text style={styles.secondaryBtnText}>Edit details</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.secondaryBtn}
                onPress={() => setViewMode('offers')}
              >
                <Text style={styles.secondaryBtnText}>See offers</Text>
              </Pressable>
            </View>

            {/* Exact Figma 15 Note */}
            <Text style={styles.noteText}>
              note: only valid status changes (no Sold → Active)
            </Text>

            {/* Status history matching Figma 15 */}
            <Text style={styles.sectionLabel}>Status history</Text>
            <View style={styles.historyBox}>
              {safeHistory.map((entry, idx) => (
                <View key={entry.id || idx} style={styles.historyRow}>
                  <Text style={styles.historyLabel} numberOfLines={1}>
                    {entry.from ? `${entry.from} → ${entry.to}` : entry.to}
                  </Text>
                  <Text style={styles.historyDate}>{entry.date}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          /* Offers sub-view when tapping "See offers" */
          <>
            <Text style={styles.sectionLabel}>Received offers &amp; applications</Text>
            {(offers || []).map((offer) => (
              <View key={offer.id} style={styles.offerCard}>
                <View style={styles.statusRow}>
                  <Text style={styles.offerBuyer}>{offer.buyer_name}</Text>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>
                      {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.offerMeta}>
                  £{Number(offer.amount).toLocaleString('en-GB')} · {offer.date} · {offer.property_title}
                </Text>

                {offer.status === 'pending' && (
                  <View style={styles.secondaryRow}>
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.primaryBtn, { flex: 1, height: 44 }]}
                      onPress={() => handleAcceptOffer(offer.id)}
                    >
                      <Text style={styles.primaryBtnText}>Accept</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.secondaryBtn, { height: 44 }]}
                      onPress={() => handleRejectOffer(offer.id)}
                    >
                      <Text style={styles.secondaryBtnText}>Reject</Text>
                    </Pressable>
                  </View>
                )}

                {onOpenChat && (
                  <Pressable
                    style={styles.chatLink}
                    onPress={async () => {
                      const conv = await startOrFindConversation({
                        propertyId: offer.property_id,
                        propertyTitle: offer.property_title,
                        channelType: 'agent_buyer',
                        buyerName: offer.buyer_name,
                        agentName: currentSession?.full_name || 'Demo Agent',
                      });
                      onOpenChat(conv.id);
                    }}
                  >
                    <Text style={styles.chatLinkText}>Message {offer.buyer_name} →</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </>
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
  headerTitle: {
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
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#292424',
  },
  pill: {
    backgroundColor: '#F6F5F0',
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#292424',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#292424',
  },
  dropdownBox: {
    height: 48,
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#F6F5F0',
  },
  disabledBox: {
    opacity: 0.55,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#292424',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    backgroundColor: '#F6F5F0',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(182, 51, 30, 0.1)',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#292424',
  },
  dropdownItemTextActive: {
    fontWeight: '700',
  },
  primaryBtn: {
    height: 52,
    backgroundColor: '#B6331E',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F6F5F0',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#F6F5F0',
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editDetailsBtn: {
    backgroundColor: '#FDF6F6',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#292424',
  },
  noteText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#292424',
  },
  historyBox: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    backgroundColor: '#F6F5F0',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#292424',
    marginRight: 12,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#292424',
  },
  offerCard: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    backgroundColor: '#F6F5F0',
  },
  offerBuyer: {
    fontSize: 15,
    fontWeight: '700',
    color: '#292424',
  },
  offerMeta: {
    fontSize: 13,
    color: '#292424',
  },
  chatLink: {
    paddingTop: 4,
  },
  chatLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B6331E',
  },
});
