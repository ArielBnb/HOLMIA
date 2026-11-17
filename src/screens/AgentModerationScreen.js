import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { authColors as colors } from '../styles/authTheme';

export default function AgentModerationScreen({ property: initialProperty, onBack, onSaved }) {
  const defaultProperty = {
    id: 'prop-1',
    title: 'Central London Flat',
    description: 'Charming two-bedroom apartment with private balcony, close to tube station.',
    price: '425000',
    location: 'London (SW1)',
    listing_type: 'sale',
    property_type: 'Flat',
    status: 'draft',
  };

  const prop = initialProperty || defaultProperty;

  const [title, setTitle] = useState(prop.title || '');
  const [description, setDescription] = useState(prop.description || '');
  const [price, setPrice] = useState(String(prop.price || ''));
  const [location, setLocation] = useState(prop.location || '');
  const [listingType, setListingType] = useState(prop.listing_type || 'sale');
  const [propertyType, setPropertyType] = useState(prop.property_type || 'Flat');
  const [status, setStatus] = useState(prop.status || 'draft');
  const [feedback, setFeedback] = useState('');

  const isLocked = ['under_offer', 'sold', 'rented'].includes(status);

  const handleSaveDraft = () => {
    setStatus('draft');
    setFeedback('Draft saved successfully.');
    if (onSaved) onSaved({ ...prop, title, description, price, location, listing_type: listingType, property_type: propertyType, status: 'draft' });
  };

  const handlePublish = () => {
    if (!title.trim() || !price.trim() || !location.trim()) {
      setFeedback('Please fill in title, price, and location.');
      return;
    }
    setStatus('active');
    setFeedback('Listing published and active!');
    if (onSaved) onSaved({ ...prop, title, description, price, location, listing_type: listingType, property_type: propertyType, status: 'active' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Figma Wireframe 11 Header */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => onBack && onBack()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </Pressable>
            <Text style={styles.headerTitle}>
              {initialProperty ? 'Edit property' : 'New property'}
            </Text>
          </View>

          {/* Form Fields matching Wireframe 11 */}
          <View style={styles.formGroup}>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor="#888"
              value={title}
              onChangeText={setTitle}
              editable={!isLocked}
            />
          </View>

          <View style={styles.formGroup}>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Description"
              placeholderTextColor="#888"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              editable={!isLocked}
            />
          </View>

          {/* Row: Price £ | Location */}
          <View style={styles.twoColRow}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.input, isLocked && styles.inputLocked]}
                placeholder="Price £"
                placeholderTextColor="#888"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                editable={!isLocked}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                placeholder="Location"
                placeholderTextColor="#888"
                value={location}
                onChangeText={setLocation}
                editable={!isLocked}
              />
            </View>
          </View>

          {/* Row: Sale | Rent Pills */}
          <View style={styles.twoColRow}>
            <Pressable
              style={[styles.togglePill, listingType === 'sale' && styles.togglePillActive]}
              onPress={() => !isLocked && setListingType('sale')}
              disabled={isLocked}
            >
              <Text style={[styles.togglePillText, listingType === 'sale' && styles.togglePillTextActive]}>
                Sale
              </Text>
            </Pressable>
            <Pressable
              style={[styles.togglePill, listingType === 'rent' && styles.togglePillActive]}
              onPress={() => !isLocked && setListingType('rent')}
              disabled={isLocked}
            >
              <Text style={[styles.togglePillText, listingType === 'rent' && styles.togglePillTextActive]}>
                Rent
              </Text>
            </Pressable>
          </View>

          {/* Property Type Dropdown / Picker */}
          <View style={styles.typeSelectorRow}>
            {['Flat', 'House', 'Studio', 'Loft'].map((t) => (
              <Pressable
                key={t}
                style={[styles.typePill, propertyType === t && styles.typePillActive]}
                onPress={() => !isLocked && setPropertyType(t)}
                disabled={isLocked}
              >
                <Text style={[styles.typePillText, propertyType === t && styles.typePillTextActive]}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Photo Boxes matching Wireframe 11 (+ Add | img | img in light pink/beige) */}
          <View style={styles.photoRow}>
            <View style={[styles.photoBox, styles.addPhotoBox]}>
              <Text style={styles.addPhotoText}>+ Add</Text>
            </View>
            <View style={styles.photoBox}>
              <Text style={styles.photoText}>img</Text>
            </View>
            <View style={styles.photoBox}>
              <Text style={styles.photoText}>img</Text>
            </View>
          </View>

          {/* Figma wireframe note */}
          <Text style={styles.noteText}>note: some fields locked when Under Offer</Text>

          {feedback ? (
            <Text style={[styles.feedbackText, feedback.includes('!') ? styles.successText : styles.infoText]}>
              {feedback}
            </Text>
          ) : null}

          {/* Bottom Action Bar: Save draft | Publish matching Wireframe 11 */}
          <View style={styles.bottomActionBar}>
            <Pressable
              accessibilityRole="button"
              style={styles.saveDraftBtn}
              onPress={handleSaveDraft}
              disabled={isLocked}
            >
              <Text style={styles.saveDraftBtnText}>Save draft</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.publishBtn, isLocked && styles.btnDisabled]}
              onPress={handlePublish}
              disabled={isLocked}
            >
              <Text style={styles.publishBtnText}>Publish</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  formGroup: {
    marginBottom: 14,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#2A2424',
    backgroundColor: '#F6F5F0',
  },
  textarea: {
    height: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  inputLocked: {
    opacity: 0.6,
    backgroundColor: '#EBE8DF',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  togglePill: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F5F0',
  },
  togglePillActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  togglePillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2A2424',
  },
  togglePillTextActive: {
    fontWeight: '700',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typePill: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F5F0',
  },
  typePillActive: {
    backgroundColor: '#2A2424',
  },
  typePillText: {
    fontSize: 12,
    color: '#2A2424',
    fontWeight: '600',
  },
  typePillTextActive: {
    color: '#FFFFFF',
  },
  photoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  photoBox: {
    width: 76,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#EEDCD7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBox: {
    backgroundColor: '#EEDCD7',
  },
  addPhotoText: {
    fontSize: 13,
    color: '#2A2424',
    fontWeight: '600',
  },
  photoText: {
    fontSize: 12,
    color: '#666666',
  },
  noteText: {
    fontSize: 12,
    color: '#555555',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  feedbackText: {
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  successText: {
    color: '#2E7D32',
  },
  infoText: {
    color: '#B6311E',
  },
  bottomActionBar: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  saveDraftBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveDraftBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2A2424',
  },
  publishBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#B6311E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
