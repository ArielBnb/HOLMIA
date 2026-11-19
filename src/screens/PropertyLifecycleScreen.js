import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { updateProperty } from '../services/propertyService';
import { notifyOfferAction, startOrFindConversation } from '../services/chatService';
import { authColors as colors } from '../styles/authTheme';

export default function PropertyLifecycleScreen({ currentSession, onBack, onOpenChat }) {
  const [activeTab, setActiveTab] = useState('lifecycle'); // 'lifecycle' | 'offers'
  const [selectedPropId, setSelectedPropId] = useState('prop-1');
  const [message, setMessage] = useState('');

  // Sample properties with full lifecycle history
  const [properties, setProperties] = useState([
    {
      id: 'prop-1',
      title: 'Central London Flat',
      listing_type: 'sale',
      price: 425000,
      status: 'under_offer',
      history: [
        {
          id: 'h1',
          from: 'Created',
          to: 'Draft',
          actor: 'Demo Seller',
          date: '10 Nov 2026, 10:00',
          notes: 'Listing created by seller.',
        },
        {
          id: 'h2',
          from: 'Draft',
          to: 'Active',
          actor: 'Demo Agent',
          date: '12 Nov 2026, 14:30',
          notes: 'Listing approved and activated by agent.',
        },
        {
          id: 'h3',
          from: 'Active',
          to: 'Under Offer',
          actor: 'System',
          date: '16 Nov 2026, 09:15',
          notes: 'Offer of £420,000 accepted by seller.',
        },
      ],
    },
    {
      id: 'prop-2',
      title: 'Oxford Student Studio',
      listing_type: 'rent',
      price: 650,
      status: 'active',
      history: [
        {
          id: 'h4',
          from: 'Created',
          to: 'Draft',
          actor: 'Demo Seller',
          date: '12 Nov 2026, 09:00',
          notes: 'Rental studio draft submitted.',
        },
        {
          id: 'h5',
          from: 'Draft',
          to: 'Active',
          actor: 'Demo Agent',
          date: '13 Nov 2026, 11:20',
          notes: 'Verified and activated for student market.',
        },
      ],
    },
    {
      id: 'prop-3',
      title: 'Birmingham Converted Loft',
      listing_type: 'sale',
      price: 310000,
      status: 'sold',
      history: [
        {
          id: 'h6',
          from: 'Created',
          to: 'Draft',
          actor: 'Demo Seller',
          date: '15 Oct 2026, 11:00',
          notes: 'Property created.',
        },
        {
          id: 'h7',
          from: 'Draft',
          to: 'Active',
          actor: 'Demo Agent',
          date: '18 Oct 2026, 15:45',
          notes: 'Published to public catalogue.',
        },
        {
          id: 'h8',
          from: 'Active',
          to: 'Under Offer',
          actor: 'System',
          date: '02 Nov 2026, 10:30',
          notes: 'Offer of £305,000 accepted.',
        },
        {
          id: 'h9',
          from: 'Under Offer',
          to: 'Sold',
          actor: 'Demo Agent',
          date: '14 Nov 2026, 16:00',
          notes: 'Conveyancing finalized, deed signed. Status is now terminal.',
        },
      ],
    },
  ]);

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

  const selectedProp = properties.find((p) => p.id === selectedPropId) || properties[0];

  const handleTransition = async (newStatus, notes) => {
    const fromStatus = selectedProp.status;
    const newEntry = {
      id: 'h-' + Date.now(),
      from: fromStatus.charAt(0).toUpperCase() + fromStatus.slice(1).replace('_', ' '),
      to: newStatus.charAt(0).toUpperCase() + newStatus.slice(1).replace('_', ' '),
      actor: currentSession?.username || 'Demo Agent',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      notes: notes || `Status changed by agent to ${newStatus}.`,
    };

    setProperties((prev) =>
      prev.map((p) =>
        p.id === selectedProp.id
          ? {
              ...p,
              status: newStatus,
              history: [...p.history, newEntry],
            }
          : p
      )
    );

    setMessage(`Status updated to "${newStatus.replace('_', ' ')}"! Recorded in audit trail.`);

    // Persist to Supabase if UUID format
    if (selectedProp.id.includes('-')) {
      try {
        await updateProperty(selectedProp.id, { status: newStatus });
      } catch (e) {
        // Handled gracefully
      }
    }
  };

  const handleAcceptOffer = async (offerId) => {
    const target = offers.find((o) => o.id === offerId);
    if (!target) return;

    setOffers((prev) =>
      prev.map((o) => {
        if (o.id === offerId) return { ...o, status: 'accepted' };
        if (o.property_id === target.property_id && o.status === 'pending') {
          return { ...o, status: 'rejected' };
        }
        return o;
      })
    );

    // Automatically transition property to Under Offer
    setSelectedPropId(target.property_id);
    await handleTransition('under_offer', `Offer of £${target.amount.toLocaleString('en-GB')} accepted by ${target.buyer_name}.`);

    // Automatically send notification in Messages to Buyer and Seller
    try {
      await notifyOfferAction({
        propertyId: target.property_id,
        propertyTitle: target.property_title,
        buyerName: target.buyer_name,
        amount: target.amount,
        action: 'accepted',
        agentName: currentSession?.full_name || currentSession?.username || 'Demo Agent',
      });
    } catch (e) {}

    setMessage(`Offer accepted: "${target.property_title}" transitioned to Under Offer! Notification sent in Messages.`);
  };

  const handleRejectOffer = async (offerId) => {
    const target = offers.find((o) => o.id === offerId);
    setOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, status: 'rejected' } : o))
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
      } catch (e) {}
    }
    setMessage('Offer rejected. Notification sent to Buyer in Messages.');
  };

  const isTerminal = ['sold', 'rented'].includes(selectedProp.status);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header matching Figma wireframes */}
        <View style={styles.headerRow}>
          {onBack && (
            <Pressable onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </Pressable>
          )}
          <Text style={styles.headerTitle}>Lifecycle & Offers</Text>
        </View>

        {/* Sub-tab toggle matching Wireframe Pills */}
        <View style={styles.tabToggleRow}>
          <Pressable
            style={[styles.tabTogglePill, activeTab === 'lifecycle' && styles.tabToggleActive]}
            onPress={() => setActiveTab('lifecycle')}
          >
            <Text style={[styles.tabToggleText, activeTab === 'lifecycle' && styles.tabToggleTextActive]}>
              Status History
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabTogglePill, activeTab === 'offers' && styles.tabToggleActive]}
            onPress={() => setActiveTab('offers')}
          >
            <Text style={[styles.tabToggleText, activeTab === 'offers' && styles.tabToggleTextActive]}>
              Offers ({offers.filter((o) => o.status === 'pending').length} pending)
            </Text>
          </Pressable>
        </View>

        {message ? <Text style={styles.bannerText}>{message}</Text> : null}

        {activeTab === 'lifecycle' ? (
          <>
            {/* Property Selector */}
            <Text style={styles.sectionSubtitle}>Select property:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propSelectorScroll}>
              {properties.map((p) => {
                const isSelected = p.id === selectedProp.id;
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.propPill, isSelected && styles.propPillActive]}
                    onPress={() => {
                      setSelectedPropId(p.id);
                      setMessage('');
                    }}
                  >
                    <Text style={[styles.propPillText, isSelected && styles.propPillTextActive]}>
                      {p.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Current Status Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{selectedProp.title}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    {selectedProp.status.toUpperCase().replace('_', ' ')}
                  </Text>
                </View>
              </View>
              <Text style={styles.propertyInfo}>
                {selectedProp.listing_type === 'sale' ? 'Sale' : 'Rent'} · £{selectedProp.price.toLocaleString('en-GB')}{selectedProp.listing_type === 'rent' ? '/mo' : ''}
              </Text>

              {/* Status Transition Actions for Agent */}
              {!isTerminal ? (
                <View style={styles.transitionActions}>
                  <Text style={styles.transitionLabel}>Transition to next state:</Text>
                  <View style={styles.actionBtnRow}>
                    {selectedProp.status === 'draft' && (
                      <Pressable
                        style={styles.terracottaBtn}
                        onPress={() => handleTransition('active', 'Activated by agent.')}
                      >
                        <Text style={styles.btnTextWhite}>Activate (Active)</Text>
                      </Pressable>
                    )}

                    {selectedProp.status === 'active' && (
                      <>
                        <Pressable
                          style={styles.whiteBtn}
                          onPress={() => handleTransition('draft', 'Returned to draft by agent.')}
                        >
                          <Text style={styles.btnTextDark}>Revert to Draft</Text>
                        </Pressable>
                        <Pressable
                          style={styles.terracottaBtn}
                          onPress={() => handleTransition('under_offer', 'Manual offer negotiation.')}
                        >
                          <Text style={styles.btnTextWhite}>Under Offer</Text>
                        </Pressable>
                      </>
                    )}

                    {selectedProp.status === 'under_offer' && (
                      <>
                        <Pressable
                          style={styles.whiteBtn}
                          onPress={() => handleTransition('active', 'Offer collapsed, back on market.')}
                        >
                          <Text style={styles.btnTextDark}>Back to Active</Text>
                        </Pressable>
                        {selectedProp.listing_type === 'sale' ? (
                          <Pressable
                            style={styles.terracottaBtn}
                            onPress={() => handleTransition('sold', 'Contracts exchanged and completed.')}
                          >
                            <Text style={styles.btnTextWhite}>Finalize Sale (Sold)</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={styles.terracottaBtn}
                            onPress={() => handleTransition('rented', 'Tenancy agreement signed.')}
                          >
                            <Text style={styles.btnTextWhite}>Finalize Let (Rented)</Text>
                          </Pressable>
                        )}
                      </>
                    )}
                  </View>

                  {/* Direct Chat with Seller regarding this Property */}
                  <Pressable
                    style={styles.discussStatusBtn}
                    onPress={async () => {
                      const conv = await startOrFindConversation({
                        property: selectedProp,
                        userRole: 'agent',
                        userName: currentSession?.full_name || 'Agent',
                        targetChannel: 'agent_seller',
                      });
                      if (onOpenChat) onOpenChat(conv.id);
                    }}
                  >
                    <Text style={styles.discussStatusBtnText}>
                      💬 Discuss Property & Status with Seller
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.terminalBox}>
                  <Text style={styles.terminalText}>
                    🔒 Status is terminal ({selectedProp.status.toUpperCase()}). Modifications are locked.
                  </Text>
                </View>
              )}
            </View>

            {/* Audit Trail Timeline */}
            <Text style={styles.sectionHeading}>Audit Trail & History</Text>
            <View style={styles.timelineCard}>
              {selectedProp.history.map((entry, idx) => {
                const isLast = idx === selectedProp.history.length - 1;
                return (
                  <View key={entry.id} style={styles.timelineRow}>
                    <View style={styles.timelineLeftCol}>
                      <View style={styles.timelineDot} />
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineBody}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.transitionText}>
                          {entry.from} → <Text style={{ fontWeight: '700' }}>{entry.to}</Text>
                        </Text>
                        <Text style={styles.timelineDate}>{entry.date}</Text>
                      </View>
                      <Text style={styles.timelineNotes}>{entry.notes}</Text>
                      <Text style={styles.timelineActor}>By: {entry.actor}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Business Constraints summary */}
            <View style={styles.notesContainer}>
              <Text style={styles.noteItem}>• Sold & Rented are terminal states (irreversible).</Text>
              <Text style={styles.noteItem}>• Price and property type are locked once Under Offer.</Text>
              <Text style={styles.noteItem}>• Accepting an offer automatically rejects concurrent pending offers.</Text>
            </View>
          </>
        ) : (
          /* Offers View matching Wireframe 12 */
          <>
            <Text style={styles.sectionSubtitle}>Received Offers & Applications:</Text>
            {offers.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.buyer_name}</Text>
                  <View style={[styles.statusBadge, item.status === 'accepted' && styles.statusBadgeActive]}>
                    <Text style={styles.statusBadgeText}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.propertyInfo}>
                  £{item.amount.toLocaleString('en-GB')} · {item.date} · {item.property_title}
                </Text>

                {item.status === 'pending' ? (
                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.terracottaBtn}
                      onPress={() => handleAcceptOffer(item.id)}
                    >
                      <Text style={styles.btnTextWhite}>Accept</Text>
                    </Pressable>
                    <Pressable
                      style={styles.whiteBtn}
                      onPress={() => handleRejectOffer(item.id)}
                    >
                      <Text style={styles.btnTextDark}>Reject</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.resolvedText}>
                    Status: <Text style={{ fontWeight: '700' }}>{item.status}</Text>
                  </Text>
                )}

                {/* Direct Discussion Buttons for Agent */}
                <View style={styles.offerChatRow}>
                  <Pressable
                    style={styles.offerChatBtn}
                    onPress={async () => {
                      const conv = await startOrFindConversation({
                        property: { id: item.property_id, title: item.property_title, agent_id: 'user-agent-1', buyer_name: item.buyer_name },
                        userRole: 'agent',
                        userName: currentSession?.full_name || 'Demo Agent',
                        targetChannel: 'agent_buyer',
                      });
                      if (onOpenChat) onOpenChat(conv.id);
                    }}
                  >
                    <Text style={styles.offerChatBtnText}>💬 Discuss with Buyer</Text>
                  </Pressable>
                  <Pressable
                    style={styles.offerChatBtn}
                    onPress={async () => {
                      const conv = await startOrFindConversation({
                        property: { id: item.property_id, title: item.property_title, agent_id: 'user-agent-1' },
                        userRole: 'agent',
                        userName: currentSession?.full_name || 'Demo Agent',
                        targetChannel: 'agent_seller',
                      });
                      if (onOpenChat) onOpenChat(conv.id);
                    }}
                  >
                    <Text style={styles.offerChatBtnText}>💬 Discuss with Seller</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            <View style={styles.notesContainer}>
              <Text style={styles.noteItem}>note: accept 1 offer = others rejected + status Under Offer</Text>
              <Text style={styles.noteItem}>note: same for rental applications (move-in date)</Text>
            </View>
          </>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backArrow: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2A2424',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2A2424',
  },
  tabToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tabTogglePill: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabToggleActive: {
    backgroundColor: '#2A2424',
  },
  tabToggleText: {
    fontSize: 13,
    color: '#2A2424',
    fontWeight: '600',
  },
  tabToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bannerText: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    fontSize: 12,
    color: '#2A2424',
    fontStyle: 'italic',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555555',
    marginBottom: 8,
  },
  propSelectorScroll: {
    gap: 8,
    paddingBottom: 16,
  },
  propPill: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  propPillActive: {
    backgroundColor: '#2A2424',
  },
  propPillText: {
    fontSize: 12,
    color: '#2A2424',
    fontWeight: '500',
  },
  propPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
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
    backgroundColor: '#EBE8DF',
  },
  statusBadgeText: {
    fontSize: 11,
    color: '#2A2424',
    fontWeight: '700',
  },
  propertyInfo: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 12,
  },
  transitionActions: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5DFD9',
    paddingTop: 12,
  },
  transitionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2A2424',
    marginBottom: 8,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  discussStatusBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#B6311E',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#FFF5F4',
  },
  discussStatusBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B6311E',
  },
  terracottaBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#B6311E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  whiteBtn: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnTextDark: {
    color: '#2A2424',
    fontWeight: '600',
    fontSize: 13,
  },
  terminalBox: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2424',
    marginTop: 8,
  },
  terminalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2A2424',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 10,
  },
  timelineCard: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineLeftCol: {
    width: 20,
    alignItems: 'center',
    marginRight: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#B6311E',
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#2A2424',
    marginTop: 4,
  },
  timelineBody: {
    flex: 1,
    paddingBottom: 8,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  transitionText: {
    fontSize: 14,
    color: '#2A2424',
  },
  timelineDate: {
    fontSize: 11,
    color: '#777777',
  },
  timelineNotes: {
    fontSize: 12,
    color: '#555555',
    marginBottom: 2,
  },
  timelineActor: {
    fontSize: 11,
    color: '#888888',
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  offerChatRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 8,
  },
  offerChatBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  offerChatBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2A2424',
  },
  resolvedText: {
    fontSize: 13,
    color: '#555555',
    fontStyle: 'italic',
  },
  notesContainer: {
    marginTop: 8,
  },
  noteItem: {
    fontSize: 12,
    color: '#555555',
    fontStyle: 'italic',
    marginBottom: 4,
  },
});
