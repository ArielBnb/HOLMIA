import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { colors } from '../styles/theme';

const statusConfig = {
  draft:       { label: 'Draft',       color: '#757575', bg: '#EEEEEE', icon: '📝' },
  active:      { label: 'Active',      color: '#2E7D32', bg: '#E8F5E9', icon: '✅' },
  under_offer: { label: 'Under Offer', color: '#E65100', bg: '#FFF3E0', icon: '🤝' },
  sold:        { label: 'Sold',        color: '#1565C0', bg: '#E3F2FD', icon: '🏷️' },
  rented:      { label: 'Rented',      color: '#6A1B9A', bg: '#F3E5F5', icon: '🔑' },
};

const listingTypeLabel = { sale: 'For Sale', rent: 'For Rent' };

export default function AgentModerationScreen({ currentSession }) {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const loadAssignedProperties = useCallback(() => {
    // Simulated data — in production: sessionService.getMyPortfolio()
    const demoProperties = [
      {
        id: 'prop-1',
        title: 'Bright Apartment in Central London',
        description: 'Charming two-bedroom apartment with private balcony, close to tube station.',
        price: 850000,
        listing_type: 'sale',
        property_type: 'Flat',
        location: 'London (Westminster)',
        status: 'active',
        seller_id: 'seller-1',
        agent_id: 'agent-1',
        created_at: '2026-11-10T10:00:00',
        updated_at: '2026-11-15T14:30:00',
      },
      {
        id: 'prop-2',
        title: 'Furnished Student Studio in Oxford',
        description: 'Compact fully furnished studio near the university campus.',
        price: 650,
        listing_type: 'rent',
        property_type: 'Studio',
        location: 'Oxford (City Centre)',
        status: 'draft',
        seller_id: 'seller-2',
        agent_id: 'agent-1',
        created_at: '2026-11-12T09:00:00',
        updated_at: '2026-11-12T09:00:00',
      },
      {
        id: 'prop-3',
        title: 'Spacious Family House in Manchester',
        description: 'Four-bedroom detached family home with private garden.',
        price: 420000,
        listing_type: 'sale',
        property_type: 'House',
        location: 'Manchester (Didsbury)',
        status: 'draft',
        seller_id: 'seller-1',
        agent_id: 'agent-1',
        created_at: '2026-11-08T11:30:00',
        updated_at: '2026-11-16T16:00:00',
      },
      {
        id: 'prop-4',
        title: 'Detached Country House in Cambridge',
        description: 'Three-bedroom house with large garden in quiet residential area.',
        price: 1250000,
        listing_type: 'sale',
        property_type: 'House',
        location: 'Cambridge (Newnham)',
        status: 'active',
        seller_id: 'seller-3',
        agent_id: 'agent-1',
        created_at: '2026-11-14T16:00:00',
        updated_at: '2026-11-16T11:00:00',
      },
    ];
    setProperties(demoProperties);
  }, []);

  useEffect(() => {
    loadAssignedProperties();
  }, [loadAssignedProperties]);

  const handleSelectProperty = (prop) => {
    setSelectedProperty(prop);
    setEditForm({
      title: prop.title,
      description: prop.description,
      price: String(prop.price),
      location: prop.location,
      property_type: prop.property_type,
    });
    setFeedbackMessage('');
  };

  const handleBackToList = () => {
    setSelectedProperty(null);
    setEditForm({});
    setFeedbackMessage('');
  };

  const handleSaveChanges = () => {
    if (!editForm.title || editForm.title.trim().length < 3) {
      setFeedbackMessage('Error: Title must be at least 3 characters.');
      return;
    }
    const price = parseFloat(editForm.price);
    if (isNaN(price) || price <= 0) {
      setFeedbackMessage('Error: Price must be greater than 0.');
      return;
    }
    if (!editForm.location || editForm.location.trim().length === 0) {
      setFeedbackMessage('Error: Location cannot be empty.');
      return;
    }

    // In production: sessionService.updateProperty(selectedProperty.id, editForm)
    setProperties((prev) =>
      prev.map((p) =>
        p.id === selectedProperty.id
          ? {
              ...p,
              title: editForm.title.trim(),
              description: editForm.description.trim(),
              price: price,
              location: editForm.location.trim(),
              property_type: editForm.property_type.trim(),
              updated_at: new Date().toISOString(),
            }
          : p
      )
    );
    setSelectedProperty({
      ...selectedProperty,
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      price: price,
      location: editForm.location.trim(),
      property_type: editForm.property_type.trim(),
    });
    setFeedbackMessage('✅ Changes saved successfully!');
  };

  const handleActivateDraft = (prop) => {
    if (prop.status !== 'draft') {
      setFeedbackMessage('Error: Only draft listings can be activated.');
      return;
    }

    const confirmActivation = () => {
      // In production: sessionService.activateProperty(prop.id, 'Activated by agent')
      setProperties((prev) =>
        prev.map((p) =>
          p.id === prop.id
            ? { ...p, status: 'active', updated_at: new Date().toISOString() }
            : p
        )
      );
      if (selectedProperty && selectedProperty.id === prop.id) {
        setSelectedProperty({ ...selectedProperty, status: 'active' });
      }
      setFeedbackMessage(`✅ "${prop.title}" activated successfully!`);
    };

    if (Platform.OS === 'web') {
      confirmActivation();
    } else {
      Alert.alert(
        'Activate Listing?',
        `Confirm activation of "${prop.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Activate', onPress: confirmActivation },
        ]
      );
    }
  };

  const handleDeactivate = (prop) => {
    if (prop.status !== 'active') {
      setFeedbackMessage('Error: Only active listings can be reverted to draft.');
      return;
    }

    // In production: sessionService.updateProperty(prop.id, { status: 'draft' })
    setProperties((prev) =>
      prev.map((p) =>
        p.id === prop.id
          ? { ...p, status: 'draft', updated_at: new Date().toISOString() }
          : p
      )
    );
    if (selectedProperty && selectedProperty.id === prop.id) {
      setSelectedProperty({ ...selectedProperty, status: 'draft' });
    }
    setFeedbackMessage(`📝 "${prop.title}" reverted to draft.`);
  };

  // ============ DETAIL / EDIT VIEW ============
  if (selectedProperty) {
    const st = statusConfig[selectedProperty.status] || statusConfig.draft;
    const isLocked = ['under_offer', 'sold', 'rented'].includes(selectedProperty.status);

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={handleBackToList} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back to list</Text>
          </Pressable>

          <Text style={styles.brand}>HOLMIA</Text>
          <Text style={styles.heading}>Moderate Listing</Text>

          <View style={[styles.statusBadgeLg, { backgroundColor: st.bg }]}>
            <Text style={styles.statusIconLg}>{st.icon}</Text>
            <Text style={[styles.statusTextLg, { color: st.color }]}>{st.label}</Text>
          </View>

          {isLocked && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                🔒 This property is marked « {st.label} ». Price, property type, and transaction mode are locked.
              </Text>
            </View>
          )}

          {/* Edit Form */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={editForm.title}
              onChangeText={(t) => setEditForm({ ...editForm, title: t })}
              editable={!isLocked}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={editForm.description}
              onChangeText={(t) => setEditForm({ ...editForm, description: t })}
              multiline
              numberOfLines={4}
              editable={!isLocked}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Price ({selectedProperty.listing_type === 'rent' ? '£/month' : '£'})
              {isLocked ? ' 🔒' : ''}
            </Text>
            <TextInput
              style={[styles.input, isLocked && styles.inputLocked]}
              value={editForm.price}
              onChangeText={(t) => setEditForm({ ...editForm, price: t })}
              keyboardType="numeric"
              editable={!isLocked}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={editForm.location}
              onChangeText={(t) => setEditForm({ ...editForm, location: t })}
              editable={!isLocked}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Property Type{isLocked ? ' 🔒' : ''}
            </Text>
            <TextInput
              style={[styles.input, isLocked && styles.inputLocked]}
              value={editForm.property_type}
              onChangeText={(t) => setEditForm({ ...editForm, property_type: t })}
              editable={!isLocked}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Transaction Mode</Text>
            <Text style={styles.readOnlyValue}>
              {listingTypeLabel[selectedProperty.listing_type]}{isLocked ? ' 🔒' : ''}
            </Text>
          </View>

          {feedbackMessage ? (
            <Text
              style={[
                styles.feedbackText,
                feedbackMessage.startsWith('Error') ? styles.errorText : styles.successText,
              ]}
            >
              {feedbackMessage}
            </Text>
          ) : null}

          {!isLocked && (
            <View style={styles.actionRow}>
              <Pressable style={styles.saveButton} onPress={handleSaveChanges}>
                <Text style={styles.saveButtonText}>💾 Save Changes</Text>
              </Pressable>

              {selectedProperty.status === 'draft' && (
                <Pressable
                  style={styles.activateButton}
                  onPress={() => handleActivateDraft(selectedProperty)}
                >
                  <Text style={styles.activateButtonText}>✅ Activate</Text>
                </Pressable>
              )}

              {selectedProperty.status === 'active' && (
                <Pressable
                  style={styles.deactivateButton}
                  onPress={() => handleDeactivate(selectedProperty)}
                >
                  <Text style={styles.deactivateButtonText}>📝 Revert to Draft</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============ LIST VIEW ============
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>HOLMIA</Text>
        <Text style={styles.heading}>Agent Moderation</Text>
        <Text style={styles.subheading}>
          Edit and activate assigned listings · {currentSession?.username || 'demo_agent'}
        </Text>

        {properties.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No assigned listings</Text>
          </View>
        ) : (
          properties.map((prop) => {
            const st = statusConfig[prop.status] || statusConfig.draft;
            const isDraft = prop.status === 'draft';
            return (
              <Pressable
                key={prop.id}
                style={styles.propertyCard}
                onPress={() => handleSelectProperty(prop)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={styles.statusIcon}>{st.icon}</Text>
                    <Text style={[styles.statusText, { color: st.color }]}>
                      {st.label}
                    </Text>
                  </View>
                  <Text style={styles.listingTypeBadge}>
                    {listingTypeLabel[prop.listing_type]}
                  </Text>
                </View>

                <Text style={styles.propertyTitle}>{prop.title}</Text>
                <Text style={styles.propertyMeta}>
                  📍 {prop.location} · 🏠 {prop.property_type}
                </Text>
                <Text style={styles.priceText}>
                  {prop.listing_type === 'rent'
                    ? `£${prop.price.toLocaleString('en-GB')}/month`
                    : `£${prop.price.toLocaleString('en-GB')}`}
                </Text>

                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.editBtn}
                    onPress={() => handleSelectProperty(prop)}
                  >
                    <Text style={styles.editBtnText}>✏️ Edit</Text>
                  </Pressable>

                  {isDraft && (
                    <Pressable
                      style={styles.activateBtnSmall}
                      onPress={() => handleActivateDraft(prop)}
                    >
                      <Text style={styles.activateBtnSmallText}>✅ Activate</Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          })
        )}

        {feedbackMessage && !selectedProperty ? (
          <Text
            style={[
              styles.feedbackText,
              feedbackMessage.startsWith('Error') ? styles.errorText : styles.successText,
            ]}
          >
            {feedbackMessage}
          </Text>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>📋 Features — Week 3</Text>
          <Text style={styles.infoCardItem}>
            • Agent can edit details of assigned listings
          </Text>
          <Text style={styles.infoCardItem}>
            • Draft activation via{' '}
            <Text style={styles.bold}>sessionService.activateProperty()</Text>
          </Text>
          <Text style={styles.infoCardItem}>
            • Automatic price/type locking once under offer
          </Text>
          <Text style={styles.infoCardItem}>
            • Field validations enforced before saving
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 60,
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 3,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 6,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    color: colors.secondary,
    marginBottom: 20,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  statusBadgeLg: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
    marginBottom: 16,
  },
  statusIconLg: {
    fontSize: 18,
  },
  statusTextLg: {
    fontSize: 15,
    fontWeight: '700',
  },
  warningBanner: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FFB74D',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 13,
    color: '#E65100',
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCD6D1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputLocked: {
    backgroundColor: '#F0F0F0',
    color: '#999',
  },
  readOnlyValue: {
    fontSize: 16,
    color: colors.secondary,
    backgroundColor: '#F0F4F2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 12,
    textAlign: 'center',
  },
  successText: {
    color: '#2E7D32',
  },
  errorText: {
    color: '#C62828',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  activateButton: {
    flex: 1,
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  deactivateButton: {
    flex: 1,
    backgroundColor: '#757575',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deactivateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // List View styles
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E7E3',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    color: colors.secondary,
    fontWeight: '600',
  },
  propertyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7E3',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusIcon: {
    fontSize: 14,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listingTypeBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
    backgroundColor: '#F0F4F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  propertyMeta: {
    fontSize: 13,
    color: colors.secondary,
    marginBottom: 6,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 10,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    backgroundColor: '#FBEFEA',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  editBtnText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  activateBtnSmall: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  activateBtnSmallText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7E3',
    marginTop: 10,
    marginBottom: 40,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  infoCardItem: {
    fontSize: 13,
    color: colors.secondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
  },
});

