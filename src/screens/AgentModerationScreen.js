import React, { useState } from 'react';
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
import { updateProperty, createProperty } from '../services/propertyService';
import { contactAgentForTerms } from '../services/chatService';
import { authColors as colors } from '../styles/authTheme';

export default function AgentModerationScreen({
  property: initialProperty,
  currentSession,
  onBack,
  onSaved,
  onOpenChat,
}) {
  const userRole = currentSession?.role || 'agent';

  // Agent cannot create properties (Seller feature only)
  if (userRole === 'agent' && !initialProperty) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            {onBack && (
              <Pressable onPress={onBack} style={styles.backBtn}>
                <Text style={styles.backArrow}>←</Text>
              </Pressable>
            )}
            <Text style={styles.headerTitle}>Access Restricted</Text>
          </View>
          <View style={styles.restrictedCard}>
            <Text style={styles.restrictedTitle}>Agents Cannot Create Properties</Text>
            <Text style={styles.restrictedText}>
              In HOLMIA, property listings are submitted by Sellers as drafts. As an Estate Agent, your role is to review and moderate drafts in the "Review" tab, or manage your assigned listings in the "Properties" tab.
            </Text>
            <Pressable style={styles.publishBtn} onPress={onBack}>
              <Text style={styles.publishBtnText}>Return to Managed Properties</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const defaultProperty = {
    id: null,
    title: '',
    description: '',
    price: '',
    location: '',
    listing_type: 'sale',
    property_type: 'Flat',
    status: 'draft',
    agent_id: null, // default direct
  };

  const prop = initialProperty || defaultProperty;

  const [title, setTitle] = useState(prop.title || '');
  const [description, setDescription] = useState(prop.description || '');
  const [price, setPrice] = useState(String(prop.price || ''));
  const [location, setLocation] = useState(prop.location || '');
  const [listingType, setListingType] = useState(prop.listing_type || 'sale');
  const [propertyType, setPropertyType] = useState(prop.property_type || 'Flat');
  const [status, setStatus] = useState(prop.status || 'draft');
  const [agentModel, setAgentModel] = useState(prop.agent_id ? 'agent' : 'none'); // 'none' (direct) | 'agent'
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const isLocked = ['under_offer', 'sold', 'rented'].includes(status);

  const getAgentIdValue = () => {
    if (agentModel === 'none') return null;
    return prop.agent_id || 'a0000000-0000-4000-8000-000000000002'; // Demo agent ID
  };

  const handleSaveDraft = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback('Saving draft...');
    const changes = {
      title: title.trim(),
      description: description.trim(),
      price: parseFloat(price) || 0,
      location: location.trim(),
      listing_type: listingType,
      property_type: propertyType,
      agent_id: getAgentIdValue(),
      status: 'draft',
    };
    try {
      if (prop.id && prop.id.includes('-')) {
        await updateProperty(prop.id, changes);
      }
      setStatus('draft');
      setFeedback('✅ Draft saved (Live in Supabase)!');
      if (onSaved) onSaved({ ...prop, ...changes });
    } catch (err) {
      setStatus('draft');
      setFeedback(`Draft saved locally (${err.message})`);
      if (onSaved) onSaved({ ...prop, ...changes });
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    if (busy) return;
    if (!title.trim() || !price.trim() || !location.trim()) {
      setFeedback('Please fill in title, price, and location.');
      return;
    }
    setBusy(true);
    setFeedback('Publishing listing...');
    const changes = {
      title: title.trim(),
      description: description.trim(),
      price: parseFloat(price) || 0,
      location: location.trim(),
      listing_type: listingType,
      property_type: propertyType,
      agent_id: getAgentIdValue(),
      status: 'active',
    };
    try {
      if (prop.id && prop.id.includes('-')) {
        await updateProperty(prop.id, changes);
      }
      setStatus('active');
      setFeedback('✅ Listing published live! Visible to all Buyers.');
      if (onSaved) onSaved({ ...prop, ...changes });
    } catch (err) {
      setStatus('active');
      setFeedback(`Published locally (${err.message})`);
      if (onSaved) onSaved({ ...prop, ...changes });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header matching Wireframe 11 */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => onBack && onBack()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>
                {userRole === 'agent'
                  ? 'Moderate property'
                  : initialProperty
                  ? 'Edit property'
                  : 'New property'}
              </Text>
              <Text style={styles.headerSub}>
                {userRole === 'seller' ? 'Seller listing' : 'Agent moderation review'}
              </Text>
            </View>
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
                placeholder="Location (e.g. London, UK)"
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

          {/* Representation Model (Relevant for Seller creating/editing listing) */}
          {userRole === 'seller' && (
            <View style={styles.representationBox}>
              <Text style={styles.representationTitle}>Representation Model</Text>
              <View style={styles.twoColRow}>
                <Pressable
                  style={[styles.togglePill, agentModel === 'none' && styles.togglePillActive]}
                  onPress={() => !isLocked && setAgentModel('none')}
                  disabled={isLocked}
                >
                  <Text
                    style={[
                      styles.togglePillText,
                      agentModel === 'none' && styles.togglePillTextActive,
                    ]}
                  >
                    Direct (No Agent)
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.togglePill, agentModel === 'agent' && styles.togglePillActive]}
                  onPress={() => !isLocked && setAgentModel('agent')}
                  disabled={isLocked}
                >
                  <Text
                    style={[
                      styles.togglePillText,
                      agentModel === 'agent' && styles.togglePillTextActive,
                    ]}
                  >
                    Assign an Agent
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.representationNote}>
                {agentModel === 'none'
                  ? '✓ Direct Seller listing: You manage offers and communicate directly with buyers.'
                  : '✓ Agent listing: An agent represents the property, moderates changes, and handles inquiries.'}
              </Text>

              {/* Seller Pre-Listing Consultation Button */}
              <Pressable
                style={styles.consultAgentBtn}
                onPress={async () => {
                  const conv = await contactAgentForTerms({
                    property: { id: prop.id, title: title || 'New Property', seller_id: prop.seller_id },
                    sellerName: currentSession?.full_name || currentSession?.username || 'Seller',
                  });
                  if (onOpenChat) onOpenChat(conv.id);
                }}
              >
                <Text style={styles.consultAgentBtnText}>
                  💬 Contact Agent to Agree on Terms (Pre-Listing)
                </Text>
              </Pressable>
            </View>
          )}

          {/* Photo Boxes matching Wireframe 11 */}
          <View style={styles.photoRow}>
            {userRole === 'seller' && (
              <View style={[styles.photoBox, styles.addPhotoBox]}>
                <Text style={styles.addPhotoText}>+ Add</Text>
              </View>
            )}
            <View style={styles.photoBox}>
              <Text style={styles.photoText}>img</Text>
            </View>
            <View style={styles.photoBox}>
              <Text style={styles.photoText}>img</Text>
            </View>
          </View>

          <Text style={styles.noteText}>note: some fields locked when Under Offer</Text>

          {feedback ? (
            <Text
              style={[
                styles.feedbackText,
                feedback.includes('!') ? styles.successText : styles.infoText,
              ]}
            >
              {feedback}
            </Text>
          ) : null}

          {/* Bottom Action Bar */}
          {userRole === 'agent' ? (
            <View style={styles.bottomActionBar}>
              <Pressable
                accessibilityRole="button"
                style={styles.saveDraftBtn}
                onPress={handleSaveDraft}
                disabled={isLocked}
              >
                <Text style={styles.saveDraftBtnText}>Save changes</Text>
              </Pressable>
              {status === 'draft' && (
                <Pressable
                  accessibilityRole="button"
                  style={styles.publishBtn}
                  onPress={handlePublish}
                >
                  <Text style={styles.publishBtnText}>Approve & Publish</Text>
                </Pressable>
              )}
            </View>
          ) : (
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
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  backArrow: {
    fontSize: 22,
    color: '#2A2424',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2A2424',
  },
  headerSub: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  formGroup: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#2A2424',
    backgroundColor: '#FFFFFF',
  },
  inputLocked: {
    backgroundColor: '#F5F5F5',
    color: '#888',
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  togglePill: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  togglePillActive: {
    backgroundColor: '#2A2424',
  },
  togglePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2A2424',
  },
  togglePillTextActive: {
    color: '#FFFFFF',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typePill: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  typePillActive: {
    backgroundColor: '#2A2424',
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2A2424',
  },
  typePillTextActive: {
    color: '#FFFFFF',
  },
  representationBox: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    backgroundColor: '#FAFAFA',
  },
  representationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 8,
  },
  representationNote: {
    fontSize: 11,
    lineHeight: 16,
    color: '#555',
    marginTop: 2,
  },
  consultAgentBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#B6311E',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#FFF5F4',
  },
  consultAgentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B6311E',
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoBox: {
    flex: 1,
    height: 70,
    backgroundColor: '#EED9D5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#B6311E',
  },
  addPhotoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B6311E',
  },
  photoText: {
    fontSize: 12,
    color: '#8A5D57',
  },
  noteText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 14,
    textAlign: 'center',
  },
  successText: {
    color: '#008000',
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
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  saveDraftBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2A2424',
  },
  publishBtn: {
    flex: 1,
    backgroundColor: '#B6311E',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  publishBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  restrictedCard: {
    backgroundColor: '#FAEDE9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2424',
    padding: 20,
    marginTop: 20,
  },
  restrictedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 8,
  },
  restrictedText: {
    fontSize: 13,
    color: '#555555',
    lineHeight: 18,
    marginBottom: 20,
  },
});
