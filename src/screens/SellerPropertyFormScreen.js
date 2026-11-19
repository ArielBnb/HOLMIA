import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { isSupabaseConfigured, supabase, watchAuthRefresh } from '../config/supabase';
import { signInWithEmail, signOut } from '../services/authService';
import { getMyProfile } from '../services/profileService';
import { createProperty, deleteOwnProperty, getSellerProperties, updateOwnProperty } from '../services/propertyService';
import {
  EMPTY_FORM,
  LIMITS,
  LISTING_TYPES,
  PROPERTY_TYPES,
  REPRESENTATIONS,
  SIMULATED_IMAGES,
  buildPropertyPayload,
  validatePropertyForm,
} from '../services/propertyFormValidation';
import {
  areTermsLocked,
  buildPropertyChanges,
  canDeleteProperty,
  deleteBlockedReason,
  formValuesFromProperty,
  statusLabel,
} from '../services/propertyEditRules';
import { listAgents } from '../services/messageService';
import PropertyMessages, { useConversations } from '../components/PropertyMessages';
import { colors } from '../styles/theme';

const border = '#DBE1DC';
const danger = '#B3261E';

function describeError(failure) {
  const message = failure?.message || '';
  if (/locked|cannot be deleted|not your|not its owner/i.test(message)) return message;
  if (failure?.code === '42501') return 'Permission denied: you can only manage your own listings.';
  if (failure?.code === '23514') return 'The database rejected one of the values. Check the form and try again.';
  return message || 'Something went wrong. Please try again.';
}

function formatPrice(item) {
  const amount = Number(item.price).toLocaleString('en-GB', { maximumFractionDigits: 2 });
  return `€${amount}${item.listing_type === 'rent' ? ' / month' : ''}`;
}

function Field({ label, error, hint, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function ChoiceGroup({ options, value, onChange, invalid, disabled }) {
  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[
              styles.choice,
              selected && styles.choiceSelected,
              invalid && !value && styles.inputInvalid,
              disabled && !selected && styles.choiceDisabled,
            ]}
          >
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SignInPanel() {
  const [email, setEmail] = useState('seller@holmia.example');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) {
      setMessage('Enter your email and password.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      // onAuthStateChange in the parent screen loads the profile.
      await signInWithEmail(email, password);
    } catch (failure) {
      setMessage(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Seller sign-in</Text>
      <Text style={styles.hint}>A real Supabase session is required so listings are linked to their owner.</Text>
      <Field label="Email">
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
      </Field>
      <Field label="Password">
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          onSubmitEditing={submit}
        />
      </Field>
      {message ? <Text style={styles.error}>{message}</Text> : null}
      <Pressable accessibilityRole="button" style={[styles.button, busy && styles.buttonDisabled]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </View>
  );
}

function ListingCard({ item, agentName, isEditing, confirmingDelete, deleting, onEdit, onAskDelete, onCancelDelete, onConfirmDelete, onMessageAgent }) {
  const deletable = canDeleteProperty(item);
  return (
    <View style={[styles.listing, isEditing && styles.listingEditing]}>
      <View style={styles.listingRow}>
        {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.listingImage} /> : null}
        <View style={styles.listingBody}>
          <Text style={styles.listingMeta}>
            {statusLabel(item.status).toUpperCase()} · {item.listing_type === 'sale' ? 'SALE' : 'RENT'} · {item.property_type}
          </Text>
          <Text style={styles.listingTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.listingMeta}>{item.location} · {formatPrice(item)}</Text>
          <Text style={styles.listingMeta}>{item.agent_id ? `Agent: ${agentName || 'Assigned agent'}` : 'Direct sale · buyers contact you'}</Text>
        </View>
      </View>
      {item.agent_id && !confirmingDelete ? (
        <Pressable accessibilityRole="button" style={styles.messageButton} onPress={onMessageAgent}>
          <Text style={styles.secondaryButtonText}>💬 Message {agentName || 'agent'}</Text>
        </Pressable>
      ) : null}

      {confirmingDelete ? (
        <View style={styles.confirmBox} accessibilityRole="alert">
          <Text style={styles.confirmText}>Delete &quot;{item.title}&quot; permanently? This cannot be undone.</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={onCancelDelete} disabled={deleting}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.dangerButton} onPress={onConfirmDelete} disabled={deleting}>
              {deleting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.dangerButtonText}>Yes, delete</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={onEdit}>
            <Text style={styles.secondaryButtonText}>{isEditing ? 'Editing…' : 'Edit'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !deletable }}
            style={[styles.dangerOutline, !deletable && styles.buttonDisabled]}
            onPress={onAskDelete}
            disabled={!deletable}
          >
            <Text style={styles.dangerOutlineText}>Delete</Text>
          </Pressable>
        </View>
      )}
      {!deletable && <Text style={styles.hint}>🔒 {deleteBlockedReason(item)}</Text>}
    </View>
  );
}

export default function SellerPropertyFormScreen() {
  const scrollRef = useRef(null);
  const [phase, setPhase] = useState(isSupabaseConfigured ? 'loading' : 'unconfigured');
  const [profile, setProfile] = useState(null);
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState(null);
  const [listings, setListings] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [listError, setListError] = useState('');
  const [agents, setAgents] = useState([]);
  const [view, setView] = useState('listings');
  const [thread, setThread] = useState(null);
  const inbox = useConversations(phase === 'ready');

  const loadListings = useCallback(async (sellerId) => {
    try {
      setListings(await getSellerProperties(sellerId));
    } catch {
      setListings([]);
    }
  }, []);

  const applySession = useCallback(async (user) => {
    try {
      if (!user) {
        setProfile(null);
        setPhase('signedOut');
        return;
      }
      const me = await getMyProfile();
      setProfile(me);
      if (me?.role !== 'seller') {
        setPhase('notSeller');
        return;
      }
      setPhase('ready');
      await loadListings(me.id);
      listAgents().then(setAgents).catch(() => setAgents([]));
    } catch (failure) {
      setSaveError(describeError(failure));
      setPhase('signedOut');
    }
  }, [loadListings]);

  // Fires INITIAL_SESSION on subscribe, then on every sign-in, sign-out and refresh.
  useEffect(() => {
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      // Defer: Supabase calls made inside this callback can deadlock the auth lock.
      setTimeout(() => applySession(session?.user ?? null), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [applySession]);
  useEffect(() => watchAuthRefresh(), []);

  const termsLocked = !!editing && areTermsLocked(editing);

  const update = (key) => (value) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted) setErrors(validatePropertyForm(next));
  };

  const resetForm = () => {
    setValues(EMPTY_FORM);
    setEditing(null);
    setSubmitted(false);
    setErrors({});
    setSaveError('');
  };

  const startEdit = (item) => {
    setEditing(item);
    setValues(formValuesFromProperty(item));
    setSubmitted(false);
    setErrors({});
    setSaveError('');
    setNotice(null);
    setConfirmDeleteId(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    setSaveError('');
    setNotice(null);
    const nextErrors = validatePropertyForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      if (editing) {
        const changes = buildPropertyChanges(editing, values);
        if (Object.keys(changes).length === 0) {
          setSaveError('No changes to save.');
          return;
        }
        const row = await updateOwnProperty(editing.id, changes);
        setNotice({ title: 'Changes saved', text: `"${row.title}" was updated (${Object.keys(changes).length} field${Object.keys(changes).length > 1 ? 's' : ''}).` });
      } else {
        const row = await createProperty(buildPropertyPayload(values, profile.id));
        setNotice({ title: 'Draft saved', text: `"${row.title}" was stored in Supabase with status ${row.status.toUpperCase()}.`, id: row.id });
      }
      resetForm();
      await loadListings(profile.id);
    } catch (failure) {
      setSaveError(describeError(failure));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    setDeletingId(item.id);
    setListError('');
    try {
      await deleteOwnProperty(item.id);
      if (editing?.id === item.id) resetForm();
      setConfirmDeleteId(null);
      setNotice({ title: 'Listing deleted', text: `"${item.title}" was removed.` });
      await loadListings(profile.id);
    } catch (failure) {
      setListError(describeError(failure));
      // The listing may have changed status elsewhere (e.g. accepted offer): refresh.
      await loadListings(profile.id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      setProfile(null);
      setListings([]);
      setNotice(null);
      setThread(null);
      setView('listings');
      resetForm();
      setPhase('signedOut');
    }
  };

  const agentName = (id) => {
    const agent = agents.find((a) => a.id === id);
    return agent ? agent.full_name || agent.username || 'Agent' : '';
  };
  const openAgentThread = (item) => {
    setThread({ propertyId: item.id, propertyTitle: item.title, otherId: item.agent_id, otherName: agentName(item.agent_id) || 'Agent', otherRole: 'agent' });
    setView('messages');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const errorCount = Object.keys(errors).length;
  const isRent = values.listingType === 'rent';
  const lockHint = termsLocked ? `🔒 Locked while the listing is ${statusLabel(editing.status)}.` : undefined;

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>HOLMIA</Text>
          <Text style={styles.heading}>{editing ? 'Edit listing' : 'Create a listing'}</Text>
          <Text style={styles.meta}>
            {editing
              ? 'Update your listing. Price, transaction type, property type and agent are locked once an offer is accepted.'
              : 'New listings are saved as Draft. Only you can see them until they are published.'}
          </Text>

          {phase === 'unconfigured' && (
            <Text style={styles.error}>Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.</Text>
          )}
          {phase === 'loading' && <ActivityIndicator color={colors.primary} />}
          {phase === 'signedOut' && <SignInPanel />}

          {(phase === 'ready' || phase === 'notSeller') && profile && (
            <View style={styles.ownerBar}>
              <View style={styles.ownerInfo}>
                <Text style={styles.ownerLabel}>Owner</Text>
                <Text style={styles.ownerName}>{profile.full_name || profile.username || 'Unnamed user'} · {profile.role}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={handleSignOut} style={styles.linkButton}>
                <Text style={styles.linkText}>Sign out</Text>
              </Pressable>
            </View>
          )}

          {phase === 'notSeller' && (
            <Text style={styles.error}>This account has the &quot;{profile?.role}&quot; role. Only Seller accounts can manage listings.</Text>
          )}

          {phase === 'ready' && (
            <View style={styles.segment}>
              {[
                { id: 'listings', label: 'My listings' },
                { id: 'messages', label: inbox.unread > 0 ? `Messages (${inbox.unread})` : 'Messages' },
              ].map((tab) => (
                <Pressable
                  key={tab.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: view === tab.id }}
                  style={[styles.segmentItem, view === tab.id && styles.segmentItemActive]}
                  onPress={() => { setView(tab.id); if (tab.id === 'messages') inbox.refresh(); }}
                >
                  <Text style={[styles.segmentText, view === tab.id && styles.segmentTextActive]}>{tab.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {phase === 'ready' && view === 'messages' && (
            <PropertyMessages
              meId={profile.id}
              conversations={inbox.conversations}
              onRefresh={inbox.refresh}
              active={thread}
              onOpen={setThread}
              onClose={() => { setThread(null); inbox.refresh(); }}
            />
          )}

          {phase === 'ready' && view === 'listings' && (
            <>
              {notice && (
                <View style={styles.success} accessibilityRole="alert">
                  <Text style={styles.successTitle}>{notice.title}</Text>
                  <Text style={styles.successText}>{notice.text}</Text>
                  {notice.id ? <Text style={styles.successId}>ID: {notice.id}</Text> : null}
                </View>
              )}

              <View style={[styles.card, editing && styles.cardEditing]}>
                <Text style={styles.sectionTitle}>{editing ? 'Listing details (editing)' : 'Listing details'}</Text>

                <Field label="Title *" error={errors.title} hint={`${values.title.trim().length}/${LIMITS.titleMax}`}>
                  <TextInput
                    style={[styles.input, errors.title && styles.inputInvalid]}
                    value={values.title}
                    onChangeText={update('title')}
                    placeholder="e.g. Bright two-bedroom flat near the station"
                    maxLength={LIMITS.titleMax}
                  />
                </Field>

                <Field label="Description *" error={errors.description} hint={`At least ${LIMITS.descriptionMin} characters · ${values.description.trim().length}/${LIMITS.descriptionMax}`}>
                  <TextInput
                    style={[styles.input, styles.textArea, errors.description && styles.inputInvalid]}
                    value={values.description}
                    onChangeText={update('description')}
                    placeholder="Rooms, surface area, condition, nearby amenities..."
                    multiline
                    textAlignVertical="top"
                    maxLength={LIMITS.descriptionMax}
                  />
                </Field>

                <Field label="Transaction type *" error={errors.listingType} hint={lockHint}>
                  <ChoiceGroup options={LISTING_TYPES} value={values.listingType} onChange={update('listingType')} invalid={!!errors.listingType} disabled={termsLocked} />
                </Field>

                <Field label={isRent ? 'Monthly rent (€) *' : 'Price (€) *'} error={errors.price} hint={lockHint}>
                  <TextInput
                    style={[styles.input, errors.price && styles.inputInvalid, termsLocked && styles.inputLocked]}
                    value={values.price}
                    onChangeText={update('price')}
                    placeholder={isRent ? 'e.g. 1150' : 'e.g. 425000'}
                    keyboardType="decimal-pad"
                    editable={!termsLocked}
                  />
                </Field>

                <Field label="Property type *" error={errors.propertyType} hint={lockHint}>
                  <ChoiceGroup options={PROPERTY_TYPES} value={values.propertyType} onChange={update('propertyType')} invalid={!!errors.propertyType} disabled={termsLocked} />
                </Field>

                <Field
                  label="Representation *"
                  hint={lockHint || (values.representation === 'agent'
                    ? 'Your agent manages offers and buyers talk to the agent.'
                    : 'You sell directly: buyers message you.')}
                >
                  <ChoiceGroup options={REPRESENTATIONS} value={values.representation} onChange={update('representation')} disabled={termsLocked} />
                </Field>

                {values.representation === 'agent' && (
                  <Field label="Agent *" error={errors.agentId} hint={agents.length === 0 ? 'No agent available right now.' : undefined}>
                    <ChoiceGroup
                      options={agents.map((a) => ({ value: a.id, label: a.full_name || a.username || 'Agent' }))}
                      value={values.agentId}
                      onChange={update('agentId')}
                      invalid={!!errors.agentId}
                      disabled={termsLocked}
                    />
                  </Field>
                )}

                <Field label="Location *" error={errors.location}>
                  <TextInput
                    style={[styles.input, errors.location && styles.inputInvalid]}
                    value={values.location}
                    onChangeText={update('location')}
                    placeholder="e.g. Lyon, France"
                    maxLength={LIMITS.locationMax}
                  />
                </Field>

                <Field label="Cover photo (simulated)" error={errors.imageUrl} hint="Placeholder images for the demo. Photo upload comes later.">
                  <View style={styles.gallery}>
                    {SIMULATED_IMAGES.map((image) => {
                      const selected = image.url === values.imageUrl;
                      return (
                        <Pressable
                          key={image.id}
                          accessibilityRole="radio"
                          accessibilityLabel={image.label}
                          accessibilityState={{ selected }}
                          onPress={() => update('imageUrl')(image.url)}
                          style={[styles.thumb, selected && styles.thumbSelected]}
                        >
                          <Image source={{ uri: image.url }} style={styles.thumbImage} />
                          <Text style={[styles.thumbLabel, selected && styles.choiceTextSelected]}>{image.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>

                <View style={styles.statusRow}>
                  <Text style={styles.ownerLabel}>Status</Text>
                  <Text style={styles.statusBadge}>{(editing ? statusLabel(editing.status) : 'Draft').toUpperCase()}</Text>
                </View>

                {submitted && errorCount > 0 && (
                  <Text style={styles.error}>Fix {errorCount} field{errorCount > 1 ? 's' : ''} before saving.</Text>
                )}
                {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

                <Pressable accessibilityRole="button" style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSubmit} disabled={saving}>
                  {saving
                    ? <ActivityIndicator color={colors.background} />
                    : <Text style={styles.buttonText}>{editing ? 'Save changes' : 'Save as draft'}</Text>}
                </Pressable>
                {editing && (
                  <Pressable accessibilityRole="button" style={styles.cancelEdit} onPress={resetForm} disabled={saving}>
                    <Text style={styles.linkText}>Cancel editing</Text>
                  </Pressable>
                )}
              </View>

              <Text style={styles.sectionTitle}>My listings ({listings.length})</Text>
              {listError ? <Text style={styles.error}>{listError}</Text> : null}
              {listings.length === 0 && <Text style={styles.meta}>No listings yet.</Text>}
              {listings.map((item) => (
                <ListingCard
                  key={item.id}
                  item={item}
                  agentName={agentName(item.agent_id)}
                  onMessageAgent={() => openAgentThread(item)}
                  isEditing={editing?.id === item.id}
                  confirmingDelete={confirmDeleteId === item.id}
                  deleting={deletingId === item.id}
                  onEdit={() => startEdit(item)}
                  onAskDelete={() => { setListError(''); setConfirmDeleteId(item.id); }}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onConfirmDelete={() => handleDelete(item)}
                />
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 48, paddingBottom: 40, gap: 14, maxWidth: 800, width: '100%', alignSelf: 'center' },
  brand: { fontSize: 30, fontWeight: '800', color: colors.primary, letterSpacing: 3 },
  heading: { fontSize: 23, fontWeight: '600', color: colors.primary },
  meta: { color: colors.secondary, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: '#FFFFFF', borderColor: border, borderWidth: 1, borderRadius: 18, padding: 18, gap: 4 },
  cardEditing: { borderColor: colors.primary, borderWidth: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  field: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: colors.primary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1B1B1B', backgroundColor: '#FBFBF8' },
  inputInvalid: { borderColor: danger },
  inputLocked: { backgroundColor: '#EEEEEE', color: '#777777' },
  textArea: { minHeight: 110 },
  hint: { color: colors.secondary, fontSize: 12, marginTop: 4 },
  error: { color: danger, fontSize: 13, marginTop: 4 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FBFBF8' },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceDisabled: { opacity: 0.4 },
  choiceText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  choiceTextSelected: { color: colors.background },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: { width: 100, borderWidth: 2, borderColor: 'transparent', borderRadius: 12, overflow: 'hidden', backgroundColor: '#FBFBF8' },
  thumbSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  thumbImage: { width: '100%', height: 70, backgroundColor: '#E7EFEA' },
  thumbLabel: { fontSize: 12, textAlign: 'center', paddingVertical: 4, color: colors.primary, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 },
  statusBadge: { backgroundColor: '#EEEEEE', color: '#555555', fontWeight: '700', fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  button: { backgroundColor: colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  cancelEdit: { alignItems: 'center', paddingVertical: 10 },
  ownerBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E7EFEA', borderRadius: 12, padding: 12 },
  ownerInfo: { flex: 1 },
  ownerLabel: { fontSize: 12, color: colors.secondary, fontWeight: '600', textTransform: 'uppercase' },
  ownerName: { fontSize: 15, color: colors.primary, fontWeight: '700' },
  linkButton: { paddingHorizontal: 10, paddingVertical: 6 },
  linkText: { color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
  success: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7', borderWidth: 1, borderRadius: 12, padding: 14 },
  successTitle: { color: '#1B5E20', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  successText: { color: '#1B5E20' },
  successId: { color: '#2E7D32', fontSize: 12, marginTop: 4 },
  listing: { backgroundColor: '#FFFFFF', borderColor: border, borderWidth: 1, borderRadius: 14, overflow: 'hidden', paddingBottom: 10 },
  listingEditing: { borderColor: colors.primary, borderWidth: 2 },
  listingRow: { flexDirection: 'row' },
  listingImage: { width: 90, minHeight: 80, backgroundColor: '#E7EFEA' },
  listingBody: { flex: 1, padding: 12, gap: 2 },
  listingTitle: { fontSize: 15, fontWeight: '600', color: colors.primary },
  listingMeta: { fontSize: 12, color: colors.secondary },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, marginTop: 4 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  secondaryButtonText: { color: colors.primary, fontWeight: '700' },
  dangerOutline: { flex: 1, borderWidth: 1, borderColor: danger, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  dangerOutlineText: { color: danger, fontWeight: '700' },
  dangerButton: { flex: 1, backgroundColor: danger, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  dangerButtonText: { color: '#FFFFFF', fontWeight: '700' },
  confirmBox: { backgroundColor: '#FDECEA', marginHorizontal: 12, marginTop: 4, borderRadius: 10, paddingVertical: 10, gap: 8 },
  confirmText: { color: danger, fontWeight: '600', paddingHorizontal: 12 },
  messageButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginHorizontal: 12, marginTop: 8 },
  segment: { flexDirection: 'row', backgroundColor: '#E7EFEA', borderRadius: 12, padding: 4, gap: 4 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  segmentItemActive: { backgroundColor: '#FFFFFF' },
  segmentText: { color: colors.secondary, fontWeight: '600' },
  segmentTextActive: { color: colors.primary, fontWeight: '700' },
});
