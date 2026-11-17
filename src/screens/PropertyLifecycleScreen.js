import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { authColors as colors } from '../styles/authTheme';

export default function PropertyLifecycleScreen({ currentSession, onBack }) {
  const [offers, setOffers] = useState([
    {
      id: 'off-1',
      buyer_name: 'Alexander Wright',
      property_title: 'Central London Flat',
      amount: 420000,
      date: '16 Nov 2026',
      status: 'pending',
    },
    {
      id: 'off-2',
      buyer_name: 'Sophie Bennett',
      property_title: 'Central London Flat',
      amount: 415000,
      date: '15 Nov 2026',
      status: 'pending',
    },
    {
      id: 'off-3',
      buyer_name: 'James Harrison',
      property_title: 'Manchester Family House',
      amount: 575000,
      date: '14 Nov 2026',
      status: 'pending',
    },
  ]);

  const [message, setMessage] = useState('');

  const handleAccept = (offerId) => {
    setOffers((prev) =>
      prev.map((o) => {
        if (o.id === offerId) return { ...o, status: 'accepted' };
        if (o.property_title === prev.find((x) => x.id === offerId)?.property_title) {
          return { ...o, status: 'rejected' };
        }
        return o;
      })
    );
    setMessage('Offer accepted: Property moved to Under Offer and concurrent offers rejected.');
  };

  const handleReject = (offerId) => {
    setOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, status: 'rejected' } : o))
    );
    setMessage('Offer rejected.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Figma Wireframe 12 Header */}
        <View style={styles.headerRow}>
          {onBack && (
            <Pressable onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </Pressable>
          )}
          <Text style={styles.headerTitle}>Offers</Text>
        </View>

        {message ? <Text style={styles.bannerText}>{message}</Text> : null}

        {/* Offer Cards matching Wireframe 12 */}
        {offers.map((item) => (
          <View key={item.id} style={styles.card}>
            {/* Top row: Buyer Name + Status Pill */}
            <View style={styles.cardHeader}>
              <Text style={styles.buyerName}>{item.buyer_name}</Text>
              <View style={[styles.statusBadge, item.status === 'accepted' && styles.statusAccepted]}>
                <Text style={styles.statusText}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            </View>

            {/* Subtitle: Amount · date · property */}
            <Text style={styles.offerSubtitle}>
              £{item.amount.toLocaleString('en-GB')} · {item.date} · {item.property_title}
            </Text>

            {/* Action Buttons: Accept (Terracotta) | Reject (White border) */}
            {item.status === 'pending' ? (
              <View style={styles.cardActions}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.acceptBtn}
                  onPress={() => handleAccept(item.id)}
                >
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.rejectBtn}
                  onPress={() => handleReject(item.id)}
                >
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.resolvedText}>
                Status: <Text style={{ fontWeight: '700' }}>{item.status}</Text>
              </Text>
            )}
          </View>
        ))}

        {/* Figma Wireframe 12 Notes */}
        <View style={styles.notesContainer}>
          <Text style={styles.noteItem}>note: accept 1 offer = others rejected + status Under Offer</Text>
          <Text style={styles.noteItem}>note: same for rental applications (move-in date)</Text>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
  // Figma Wireframe 12 Card
  card: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  buyerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A2424',
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: '#FFFFFF',
  },
  statusAccepted: {
    backgroundColor: '#F6F5F0',
  },
  statusText: {
    fontSize: 11,
    color: '#2A2424',
    fontWeight: '600',
  },
  offerSubtitle: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 14,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#B6311E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rejectBtn: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2A2424',
  },
  resolvedText: {
    fontSize: 13,
    color: '#555555',
    fontStyle: 'italic',
  },
  notesContainer: {
    marginTop: 16,
    paddingTop: 8,
  },
  noteItem: {
    fontSize: 12,
    color: '#555555',
    fontStyle: 'italic',
    marginBottom: 6,
  },
});
