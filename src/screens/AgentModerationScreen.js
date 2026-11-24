import React, { useEffect, useState } from 'react';
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
import { getSupabase } from '../config/supabase';

const MODERATION_PROPERTY_TYPES = [
  { value: 'flat', label: 'Flat' },
  { value: 'house', label: 'House' },
  { value: 'studio', label: 'Studio' },
  { value: 'loft', label: 'Loft' },
];

export default function AgentModerationScreen({
  property: initialProperty,
  currentSession,
  onBack,
  onSaved,
  onOpenChat,
}) {
  const userRole = currentSession?.role || 'agent';

  const defaultProperty = {
    id: null,
    title: '',
    description: '',
    price: '',
    location: '',
    listing_type: 'sale',
    property_type: 'flat',
    status: 'draft',
    agent_id: null, // default direct
  };

  const prop = initialProperty || defaultProperty;

  const [title, setTitle] = useState(prop.title || '');
  const [description, setDescription] = useState(prop.description || '');
  const [price, setPrice] = useState(String(prop.price || ''));
  const [location, setLocation] = useState(prop.location || '');
  const [listingType, setListingType] = useState(prop.listing_type || 'sale');
  const [propertyType, setPropertyType] = useState(
    String(prop.property_type || 'flat').toLowerCase()
  );
  const [status, setStatus] = useState(prop.status || 'draft');
  const [agentModel, setAgentModel] = useState(prop.agent_id ? 'agent' : 'none'); // 'none' (direct) | 'agent'
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState([]);

  // Real Agent accounts (public.list_agents). Never a hard-coded ID: Supabase
  // rejects an agent_id that is not an Agent profile.
  useEffect(() => {
    let cancelled = false;
    const first = setTimeout(async () => {
      try {
        const { data, error } = await getSupabase().rpc('list_agents');
        if (!cancelled && !error) setAgents(data ?? []);
      } catch {
        // Without agents, "Assign an Agent" reports a clear error on save.
      }
    }, 0);
    return () => { cancelled = true; clearTimeout(first); };
  }, []);

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
              In HOLMIA, property listings are submitted by Sellers as drafts. As an Estate Agent, your role is to review and moderate drafts in the &quot;Review&quot; tab, or manage your assigned listings in the &quot;Properties&quot; tab.
            </Text>
            <Pressable style={styles.publishBtn} onPress={onBack}>
              <Text style={styles.publishBtnText}>Return to Managed Properties</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isTerminal = ['sold', 'rented'].includes(status);
  const isCommercialLocked = ['under_offer', 'sold', 'rented'].includes(status);
  // Former name still used by the representation toggle and the action bar.
  const isLocked = isCommercialLocked;

  const getAgentIdValue = () => {
    if (agentModel === 'none') return null;
    return prop.agent_id || agents[0]?.id || null;
  };

  // One save path for "Save", "Save draft" and "Publish": creates the listing
  // when it does not exist yet, otherwise updates it. Supabase has the last word
  // (RLS, transitions, locks); its error is shown and nothing is reported as saved.
  const persist = async (targetStatus, pending, success) => {
    if (busy || isTerminal) return;
    const amount = Number(String(price).replace(/[\s,]/g, ''));
    if (!title.trim() || !location.trim() || !(amount > 0)) {
      setFeedback('❌ Please fill in a title, a location and a price greater than 0.');
      return;
    }
    const agentId = getAgentIdValue();
    if (agentModel === 'agent' && !agentId) {
      setFeedback('❌ No agent account is available. Choose "Direct (No Agent)" or try again later.');
      return;
    }
    setBusy(true);
    setFeedback(pending);
    const changes = {
      title: title.trim(),
      description: description.trim(),
      price: amount,
      location: location.trim(),
      listing_type: listingType,
      property_type: String(propertyType || 'flat').toLowerCase(),
      agent_id: agentId,
    };
    if (targetStatus !== prop.status) changes.status = targetStatus;
    try {
      const saved = prop.id
        ? await updateProperty(prop.id, changes)
        : await createProperty({ ...changes, seller_id: currentSession?.id, status: targetStatus });
      setStatus(saved.status);
      setFeedback(success);
      if (onSaved) setTimeout(() => onSaved(saved), 600);
    } catch (err) {
      setFeedback(`❌ Not saved: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => persist(prop.status || status, 'Saving modifications...', '✅ Modifications saved.');
  const handleSaveDraft = () => persist('draft', 'Saving draft...', '✅ Draft saved.');
  const handlePublish = () => persist('active', 'Publishing listing...', '✅ Listing published. Visible to all Buyers.');

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
              editable={!isTerminal}
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
              editable={!isTerminal}
            />
          </View>

          {/* Row: Price £ | Location */}
          <View style={styles.twoColRow}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.input, isCommercialLocked && styles.inputLocked]}
                placeholder="Price £"
                placeholderTextColor="#888"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                editable={!isCommercialLocked}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                placeholder="Location (e.g. London, UK)"
                placeholderTextColor="#888"
                value={location}
                onChangeText={setLocation}
                editable={!isTerminal}
              />
            </View>
          </View>

          {/* Row: Sale | Rent Pills */}
          <View style={styles.twoColRow}>
            <Pressable
              style={[styles.togglePill, listingType === 'sale' && styles.togglePillActive]}
              onPress={() => !isCommercialLocked && setListingType('sale')}
              disabled={isCommercialLocked}
            >
              <Text style={[styles.togglePillText, listingType === 'sale' && styles.togglePillTextActive]}>
                Sale
              </Text>
            </Pressable>
            <Pressable
              style={[styles.togglePill, listingType === 'rent' && styles.togglePillActive]}
              onPress={() => !isCommercialLocked && setListingType('rent')}
              disabled={isCommercialLocked}
            >
              <Text style={[styles.togglePillText, listingType === 'rent' && styles.togglePillTextActive]}>
                Rent
              </Text>
            </Pressable>
          </View>

          {/* Property Type Dropdown / Picker */}
          <View style={styles.typeSelectorRow}>
            {MODERATION_PROPERTY_TYPES.map((t) => (
              <Pressable
                key={t.value}
                style={[styles.typePill, propertyType === t.value && styles.typePillActive]}
                onPress={() => !isCommercialLocked && setPropertyType(t.value)}
                disabled={isCommercialLocked}
              >
                <Text style={[styles.typePillText, propertyType === t.value && styles.typePillTextActive]}>
                  {t.label}
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
                  try {
                    const conv = await contactAgentForTerms({
                      property: { id: prop.id, title: title || 'New Property', seller_id: prop.seller_id },
                      sellerName: currentSession?.full_name || currentSession?.username || 'Seller',
                    });
                    if (onOpenChat && conv?.id) onOpenChat(conv.id);
                  } catch (err) {
                    setFeedback(`❌ Could not open chat: ${err?.message || 'Try again.'}`);
                  }
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
                feedback.startsWith('✅') ? styles.successText : styles.infoText,
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
                style={[styles.publishBtn, isTerminal && styles.btnDisabled]}
                onPress={handleSave}
                disabled={isTerminal}
              >
                <Text style={styles.publishBtnText}>Save modifications</Text>
              </Pressable>
              {status === 'draft' && (
                <Pressable
                  accessibilityRole="button"
                  style={styles.saveDraftBtn}
                  onPress={handlePublish}
                >
                  <Text style={styles.saveDraftBtnText}>Approve & Publish</Text>
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
    backgroundColor: '#F6F5F0',
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 40,
    backgroundColor: '#F6F5F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    marginRight: 10,
    padding: 4,
  },
  backArrow: {
    fontSize: 20,
    color: '#292424',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#292424',
  },
  headerSub: {
    fontSize: 12,
    color: '#66605A',
    textTransform: 'capitalize',
  },
  formGroup: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#292424',
    backgroundColor: '#F6F5F0',
  },
  inputLocked: {
    backgroundColor: 'rgba(41, 36, 36, 0.06)',
    color: '#66605A',
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  togglePill: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F6F5F0',
  },
  togglePillActive: {
    backgroundColor: '#292424',
  },
  togglePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#292424',
  },
  togglePillTextActive: {
    color: '#F6F5F0',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typePill: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F6F5F0',
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
