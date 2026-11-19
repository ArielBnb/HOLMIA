import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Modal,
} from 'react-native';
import { authColors as colors } from '../styles/authTheme';
import { getProperties } from '../services/propertyService';
import { startOrFindConversation } from '../services/chatService';

export default function BuyerExploreScreen({ currentSession, onOpenChat }) {
  const [properties, setProperties] = useState([]);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'sale' | 'rent'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerFeedback, setOfferFeedback] = useState('');
  const [submittedOffers, setSubmittedOffers] = useState([
    {
      id: 'mock-off-1',
      propertyTitle: 'Bright Apartment in Central London',
      amount: '£415,000',
      type: 'Offer',
      status: 'pending',
      date: 'Today',
    },
  ]);
  const [activeSubTab, setActiveSubTab] = useState('browse'); // 'browse' | 'my_offers'

  const defaultProps = [
    {
      id: 'a0000000-0000-4000-8000-000000000001',
      seller_id: 'user-seller-1',
      agent_id: 'user-agent-1',
      title: 'Bright Apartment in Central London',
      description: 'Charming two-bedroom apartment with private balcony, close to tube station and amenities.',
      price: 425000,
      listing_type: 'sale',
      property_type: 'Flat',
      location: 'London, UK',
      status: 'active',
    },
    {
      id: 'a0000000-0000-4000-8000-000000000002',
      seller_id: 'user-seller-1',
      agent_id: null, // NO AGENT - Direct Seller!
      title: 'Spacious Family House in Manchester',
      description: 'Detached four-bedroom family home with private garden, garage and modern kitchen. Direct from owner.',
      price: 580000,
      listing_type: 'sale',
      property_type: 'House',
      location: 'Manchester, UK',
      status: 'active',
    },
    {
      id: 'a0000000-0000-4000-8000-000000000003',
      seller_id: 'user-seller-1',
      agent_id: 'user-agent-1',
      title: 'Furnished Student Studio in Oxford',
      description: 'Compact fully furnished modern studio located within walking distance of university colleges.',
      price: 650,
      listing_type: 'rent',
      property_type: 'Studio',
      location: 'Oxford, UK',
      status: 'active',
    },
    {
      id: 'a0000000-0000-4000-8000-000000000004',
      seller_id: 'user-seller-1',
      agent_id: null, // NO AGENT - Direct Seller!
      title: 'Riverside Apartment with Terrace in Bristol',
      description: 'Stylish two-bedroom apartment featuring a large river-view terrace and secure parking space. Direct landlord listing.',
      price: 1150,
      listing_type: 'rent',
      property_type: 'Flat',
      location: 'Bristol, UK',
      status: 'active',
    },
  ];

  useEffect(() => {
    async function loadData() {
      try {
        const live = await getProperties({ activeOnly: true });
        if (live && live.length > 0) {
          setProperties(live);
          return;
        }
      } catch (err) {
        console.warn('Using offline properties fallback for buyer:', err);
      }
      setProperties(defaultProps);
    }
    loadData();
  }, []);

  const filtered = properties.filter((p) => {
    if (filterType !== 'all' && p.listing_type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      const matchLoc = (p.location || '').toLowerCase().includes(q);
      return matchTitle || matchLoc;
    }
    return true;
  });

  const handleStartChat = async (prop) => {
    try {
      const conv = await startOrFindConversation({
        property: prop,
        userRole: 'buyer',
        userName: currentSession?.full_name || currentSession?.username || 'Demo Buyer',
      });
      if (onOpenChat) onOpenChat(conv.id);
    } catch (err) {
      console.warn('Error starting chat:', err);
    }
  };

  const handleSubmitOffer = () => {
    if (!offerAmount.trim() || !selectedProperty) return;
    const newOffer = {
      id: `off-${Date.now()}`,
      propertyTitle: selectedProperty.title,
      amount: `£${offerAmount.trim()}`,
      type: selectedProperty.listing_type === 'sale' ? 'Purchase Offer' : 'Rental Application',
      status: 'pending',
      date: 'Just now',
    };
    setSubmittedOffers([newOffer, ...submittedOffers]);
    setOfferFeedback(`✅ ${newOffer.type} submitted for £${offerAmount.trim()}!`);
    setTimeout(() => {
      setSelectedProperty(null);
      setOfferAmount('');
      setOfferFeedback('');
      setActiveSubTab('my_offers');
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar Switcher between Browse & My Offers */}
      <View style={styles.topNav}>
        <Pressable
          style={[styles.topNavTab, activeSubTab === 'browse' && styles.topNavTabActive]}
          onPress={() => setActiveSubTab('browse')}
        >
          <Text style={[styles.topNavLabel, activeSubTab === 'browse' && styles.topNavLabelActive]}>
            Explore Catalogue
          </Text>
        </Pressable>
        <Pressable
          style={[styles.topNavTab, activeSubTab === 'my_offers' && styles.topNavTabActive]}
          onPress={() => setActiveSubTab('my_offers')}
        >
          <Text style={[styles.topNavLabel, activeSubTab === 'my_offers' && styles.topNavLabelActive]}>
            My Applications ({submittedOffers.length})
          </Text>
        </Pressable>
      </View>

      {activeSubTab === 'browse' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Search Bar */}
          <TextInput
            style={styles.searchInput}
            placeholder="Search by city or title (e.g. London, Oxford)..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {['all', 'sale', 'rent'].map((t) => (
              <Pressable
                key={t}
                style={[styles.filterPill, filterType === t && styles.filterPillActive]}
                onPress={() => setFilterType(t)}
              >
                <Text
                  style={[styles.filterPillText, filterType === t && styles.filterPillTextActive]}
                >
                  {t === 'all' ? 'All Properties' : t === 'sale' ? 'For Sale' : 'For Rent'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* List */}
          <View style={styles.list}>
            {filtered.map((item) => {
              const hasAgent = Boolean(item.agent_id);
              const formattedPrice =
                item.listing_type === 'rent'
                  ? `£${Number(item.price).toLocaleString()} / mo`
                  : `£${Number(item.price).toLocaleString()}`;

              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.priceText}>{formattedPrice}</Text>
                    <View
                      style={[
                        styles.badge,
                        hasAgent ? styles.agentBadge : styles.directBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          hasAgent ? styles.agentBadgeText : styles.directBadgeText,
                        ]}
                      >
                        {hasAgent ? 'Represented by Agent' : 'Direct from Seller'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.titleText}>{item.title}</Text>
                  <Text style={styles.metaText}>
                    {item.location} · {item.property_type || 'Property'} · {item.listing_type.toUpperCase()}
                  </Text>
                  <Text style={styles.descText} numberOfLines={2}>
                    {item.description}
                  </Text>

                  {/* Actions */}
                  <View style={styles.btnRow}>
                    <Pressable
                      style={styles.viewBtn}
                      onPress={() => setSelectedProperty(item)}
                    >
                      <Text style={styles.viewBtnText}>Details & Offer</Text>
                    </Pressable>

                    <Pressable
                      style={styles.chatBtn}
                      onPress={() => handleStartChat(item)}
                    >
                      <Text style={styles.chatBtnText}>
                        {hasAgent ? '💬 Chat with Agent' : '💬 Chat with Seller'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        /* MY SUBMITTED OFFERS & APPLICATIONS */
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionTitle}>My Submitted Applications & Offers</Text>
          <Text style={styles.sectionSub}>
            Track real-time responses from Agents and Sellers.
          </Text>

          <View style={styles.list}>
            {submittedOffers.map((off) => (
              <View key={off.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.priceText}>{off.amount}</Text>
                  <View style={[styles.badge, styles.statusPending]}>
                    <Text style={styles.statusPendingText}>
                      {off.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.titleText}>{off.propertyTitle}</Text>
                <Text style={styles.metaText}>{off.type} submitted · {off.date}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* PROPERTY DETAIL & OFFER MODAL */}
      <Modal
        visible={Boolean(selectedProperty)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedProperty(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedProperty && (
              <ScrollView>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedProperty.title}</Text>
                  <Pressable onPress={() => setSelectedProperty(null)}>
                    <Text style={styles.closeBtn}>✕</Text>
                  </Pressable>
                </View>

                <Text style={styles.modalPrice}>
                  {selectedProperty.listing_type === 'rent'
                    ? `£${Number(selectedProperty.price).toLocaleString()} / month`
                    : `£${Number(selectedProperty.price).toLocaleString()}`}
                </Text>

                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Location: <Text style={styles.infoVal}>{selectedProperty.location}</Text></Text>
                  <Text style={styles.infoLabel}>Type: <Text style={styles.infoVal}>{selectedProperty.property_type}</Text></Text>
                  <Text style={styles.infoLabel}>
                    Listing Model:{' '}
                    <Text style={{ fontWeight: '700', color: selectedProperty.agent_id ? '#B6311E' : '#2A2424' }}>
                      {selectedProperty.agent_id ? 'Represented by Agent' : 'Direct Owner (No Agent)'}
                    </Text>
                  </Text>
                </View>

                <Text style={styles.descFull}>{selectedProperty.description}</Text>

                {/* Make Offer / Apply */}
                <View style={styles.offerSection}>
                  <Text style={styles.offerTitle}>
                    {selectedProperty.listing_type === 'sale' ? 'Submit Purchase Offer' : 'Apply for Rental'}
                  </Text>
                  <TextInput
                    style={styles.offerInput}
                    placeholder="Enter amount in £ (e.g. 420000)"
                    placeholderTextColor="#888"
                    keyboardType="numeric"
                    value={offerAmount}
                    onChangeText={setOfferAmount}
                  />

                  {offerFeedback ? (
                    <Text style={styles.offerFeedbackText}>{offerFeedback}</Text>
                  ) : null}

                  <View style={styles.modalActions}>
                    <Pressable style={styles.submitBtn} onPress={handleSubmitOffer}>
                      <Text style={styles.submitBtnText}>
                        {selectedProperty.listing_type === 'sale' ? 'Submit Offer' : 'Submit Application'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.modalChatBtn}
                      onPress={() => {
                        const p = selectedProperty;
                        setSelectedProperty(null);
                        handleStartChat(p);
                      }}
                    >
                      <Text style={styles.modalChatBtnText}>
                        {selectedProperty.agent_id ? '💬 Chat with Agent' : '💬 Chat directly with Seller'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topNav: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2424',
    backgroundColor: '#FFFFFF',
  },
  topNavTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  topNavTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#B6311E',
  },
  topNavLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  topNavLabelActive: {
    color: '#B6311E',
  },
  scroll: { padding: 16, paddingBottom: 40, backgroundColor: '#FFFFFF' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#2A2424',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
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
  list: { gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2A2424',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  agentBadge: {
    borderColor: '#B6311E',
    backgroundColor: '#FFF5F4',
  },
  agentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B6311E',
  },
  directBadge: {
    borderColor: '#2A2424',
    backgroundColor: '#F7F7F7',
  },
  directBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2A2424',
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  descText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#444',
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
  },
  viewBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2A2424',
  },
  chatBtn: {
    flex: 1.2,
    backgroundColor: '#B6311E',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  chatBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  statusPending: {
    borderColor: '#B6311E',
    backgroundColor: '#FFF4F2',
  },
  statusPendingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B6311E',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2A2424',
    flex: 1,
    marginRight: 10,
  },
  closeBtn: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2A2424',
    padding: 4,
  },
  modalPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: '#B6311E',
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 4,
  },
  infoLabel: { fontSize: 12, color: '#666' },
  infoVal: { fontWeight: '600', color: '#2A2424' },
  descFull: {
    fontSize: 13,
    lineHeight: 19,
    color: '#333',
    marginBottom: 16,
  },
  offerSection: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 14,
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 8,
  },
  offerInput: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#2A2424',
    marginBottom: 10,
  },
  offerFeedbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#008000',
    marginBottom: 10,
  },
  modalActions: {
    gap: 8,
  },
  submitBtn: {
    backgroundColor: '#B6311E',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modalChatBtn: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  modalChatBtnText: {
    color: '#2A2424',
    fontWeight: '600',
    fontSize: 13,
  },
});
