import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function RoleAccessScreen({ currentSession, onSwitchRole }) {
  const currentRole = currentSession?.role || 'buyer';

  const roleFeatures = {
    buyer: {
      title: 'Buyer & Tenant Workspace',
      description: 'Read-only catalogue access and offer / application submissions.',
      permissions: [
        { label: 'Browse active property catalogue', allowed: true },
        { label: 'Search and filter listings', allowed: true },
        { label: 'Submit purchase offer', allowed: true },
        { label: 'Submit rental application', allowed: true },
        { label: 'Create a property listing', allowed: false },
        { label: 'Edit catalogue listings', allowed: false },
        { label: 'Moderate / activate listings', allowed: false },
      ],
      sampleData: [
        { title: 'Bright Apartment in Central London', price: '£425,000', status: 'Active', action: 'Offer submitted: £410,000' },
        { title: 'Spacious Family House in Manchester', price: '£580,000', status: 'Active', action: 'Saved to favourites' },
      ],
    },
    seller: {
      title: 'Seller Workspace',
      description: 'Manage owned listings, direct sales, and incoming offers.',
      permissions: [
        { label: 'Create a listing (Sale or Rent)', allowed: true },
        { label: 'Edit owned properties', allowed: true },
        { label: 'Delete owned properties', allowed: true },
        { label: 'Review and accept received offers', allowed: true },
        { label: 'Edit another seller’s property', allowed: false },
        { label: 'Submit buyer purchase offers', allowed: false },
        { label: 'Moderate public catalogue', allowed: false },
      ],
      sampleData: [
        { title: 'My Listing: Studio in Oxford', price: '£650 / mo', status: 'Draft', action: 'Ready for review' },
        { title: 'My Listing: Apartment in London', price: '£425,000', status: 'Under Offer', action: '1 offer accepted' },
      ],
    },
    agent: {
      title: 'Estate Agent Workspace',
      description: 'Assigned property portfolio, moderation, lifecycle and transactions.',
      permissions: [
        { label: 'View assigned property portfolio', allowed: true },
        { label: 'Moderate and activate assigned drafts', allowed: true },
        { label: 'Edit assigned property details', allowed: true },
        { label: 'Calculate performance metrics', allowed: true },
        { label: 'Create properties as seller', allowed: false },
        { label: 'Modify unassigned properties', allowed: false },
        { label: 'Delete seller properties', allowed: false },
      ],
      sampleData: [
        { title: 'Assigned: Converted Loft in Birmingham', price: '£310,000', status: 'Assigned to Agent', action: 'Draft moderated & activated' },
        { title: 'Assigned: Riverside Flat in Bristol', price: '£1,150 / mo', status: 'Assigned to Agent', action: 'Active portfolio' },
      ],
    },
  };

  const activeInfo = roleFeatures[currentRole] || roleFeatures.buyer;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>HOLMIA</Text>
        <Text style={styles.heading}>Session & Access Control</Text>
        <Text style={styles.subheading}>Team Deliverable · Roles: Buyer, Seller & Agent</Text>

        {/* Role Switcher Toolbar */}
        <View style={styles.roleTabs}>
          {['buyer', 'seller', 'agent'].map((r) => {
            const active = currentRole === r;
            return (
              <Pressable
                key={r}
                style={[styles.roleTab, active && styles.roleTabActive]}
                onPress={() => onSwitchRole && onSwitchRole(r)}
              >
                <Text style={[styles.roleTabText, active && styles.roleTabTextActive]}>
                  {r.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Current Role Card */}
        <View style={styles.card}>
          <Text style={styles.roleTitle}>{activeInfo.title}</Text>
          <Text style={styles.roleDesc}>{activeInfo.description}</Text>

          <Text style={styles.sectionHeader}>Permissions Matrix:</Text>
          {activeInfo.permissions.map((p, index) => (
            <View key={index} style={styles.permRow}>
              <Text style={p.allowed ? styles.checkIcon : styles.crossIcon}>
                {p.allowed ? '✓' : '✕'}
              </Text>
              <Text style={[styles.permLabel, !p.allowed && styles.permDisabled]}>
                {p.label}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeader}>Role Demonstration Data:</Text>
          {activeInfo.sampleData.map((d, index) => (
            <View key={index} style={styles.dataRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dataTitle}>{d.title}</Text>
                <Text style={styles.dataAction}>{d.action}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dataPrice}>{d.price}</Text>
                <Text style={styles.dataBadge}>{d.status}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Validated by 101 automated tests (SQLite CRUD + SessionService).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 24, paddingTop: 40, maxWidth: 600, width: '100%', alignSelf: 'center' },
  brand: { fontSize: 32, fontWeight: '800', color: '#2A2424', letterSpacing: 3 },
  heading: { fontSize: 22, fontWeight: '700', color: '#2A2424', marginTop: 6 },
  subheading: { fontSize: 14, color: '#666666', marginBottom: 18 },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2424',
    padding: 3,
    marginBottom: 20,
    gap: 4,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  roleTabActive: {
    backgroundColor: '#2A2424',
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2A2424',
  },
  roleTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2424',
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 6,
  },
  roleDesc: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A2424',
    marginTop: 14,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 14,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2E7D32',
    width: 20,
  },
  crossIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: '#B6311E',
    width: 20,
  },
  permLabel: {
    fontSize: 14,
    color: '#2A2424',
  },
  permDisabled: {
    color: '#888888',
    textDecorationLine: 'line-through',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  dataTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2A2424',
  },
  dataAction: {
    fontSize: 12,
    color: '#666666',
    marginTop: 3,
  },
  dataPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A2424',
  },
  dataBadge: {
    fontSize: 11,
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  footerNote: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#777777',
  },
});
