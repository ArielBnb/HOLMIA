import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { startOrFindConversation } from '../services/chatService';
import { acceptOffer, getOffersReceived, rejectOffer } from '../services/offerService';
import { decideRentalApplication, getRentalApplicationsReceived } from '../services/rentalService';
import { formatMoveIn } from '../services/rentalRules';
import { changePropertyStatus, getManagedProperties, getPropertyHistory } from '../services/transitionService';
import {
  availableActions,
  historyLine,
  historyWhen,
  historyWho,
  isFinalStatus,
  statusGuidance,
  statusName,
  transitionError,
} from '../services/transitionRules';

// Wireframe 15: current status, role/status-aware actions wired to the
// status-change service (public.change_property_status), and the status
// history recorded by the database (public.property_history).
export default function PropertyLifecycleScreen({
  currentSession,
  initialProperty,
  onEditProperty,
  onBack,
  onOpenChat,
}) {
  const role = currentSession?.role;
  const [viewMode, setViewMode] = useState('manage'); // 'manage' | 'offers'
  const [properties, setProperties] = useState(null);
  const [selectedPropId, setSelectedPropId] = useState(initialProperty?.id || null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { kind: 'success' | 'error', text }
  const [history, setHistory] = useState(null);

  const loadProperties = useCallback(async () => {
    try {
      const rows = await getManagedProperties(currentSession);
      setProperties(rows);
      setSelectedPropId((current) => (current && rows.some((p) => p.id === current) ? current : rows[0]?.id || null));
    } catch (failure) {
      setProperties((current) => current ?? []);
      setMessage({ kind: 'error', text: failure.message });
    }
  }, [currentSession]);

  const loadHistory = useCallback(async (propertyId) => {
    if (!propertyId) return;
    try {
      setHistory(await getPropertyHistory(propertyId));
    } catch (failure) {
      setHistory([]);
      setMessage({ kind: 'error', text: failure.message });
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(loadProperties, 0);
    return () => clearTimeout(first);
  }, [loadProperties]);

  useEffect(() => {
    const first = setTimeout(() => loadHistory(selectedPropId), 0);
    return () => clearTimeout(first);
  }, [selectedPropId, loadHistory]);

  const selectedProp = properties?.find((p) => p.id === selectedPropId) || null;
  const actions = availableActions(selectedProp, role);
  const effectiveTarget = actions.some((a) => a.to === targetStatus) ? targetStatus : actions[0]?.to || '';
  const chosen = actions.find((a) => a.to === effectiveTarget);
  const isTerminal = !!selectedProp && isFinalStatus(selectedProp.status);

  const selectProperty = (id) => {
    setSelectedPropId(id);
    setTargetStatus('');
    setNote('');
    setConfirming(false);
    setMessage(null);
    setHistory(null);
  };

  const handleTransition = async () => {
    if (!selectedProp || !effectiveTarget) return;
    // Defensive check; the database applies the same rules and has the last word.
    const problem = transitionError(selectedProp.status, effectiveTarget, selectedProp.listing_type);
    if (problem) {
      setMessage({ kind: 'error', text: problem });
      return;
    }
    if (isFinalStatus(effectiveTarget) && !confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await changePropertyStatus(selectedProp.id, effectiveTarget, note);
      const released = result?.released_deals ? ' The accepted deal was released.' : '';
      setMessage({ kind: 'success', text: `Status changed: ${statusName(selectedProp.status)} → ${statusName(effectiveTarget)}.${released}` });
      setNote('');
      setTargetStatus('');
    } catch (failure) {
      setMessage({ kind: 'error', text: `Transition refused: ${failure.message}` });
    } finally {
      setConfirming(false);
      setBusy(false);
      // Always show what the database now holds.
      await loadProperties();
      await loadHistory(selectedProp.id);
    }
  };

  // "See offers": the real offers (sale) or rental applications (rent) of the
  // selected listing, decided through the same transactional services as the
  // Received tab. The list and the listing status are reloaded after each decision.
  const [deals, setDeals] = useState(null);
  const [dealBusy, setDealBusy] = useState(null);
  const isRent = selectedProp?.listing_type === 'rent';

  const loadDeals = useCallback(async () => {
    if (!selectedPropId) return;
    try {
      const rows = isRent ? await getRentalApplicationsReceived() : await getOffersReceived();
      setDeals(rows.filter((r) => r.property_id === selectedPropId));
    } catch (failure) {
      setDeals([]);
      setMessage({ kind: 'error', text: failure.message });
    }
  }, [selectedPropId, isRent]);

  const openDeals = () => {
    setDeals(null);
    setMessage(null);
    setViewMode('offers');
    setTimeout(loadDeals, 0);
  };

  const decideDeal = async (deal, accept) => {
    setDealBusy(deal.id);
    setMessage(null);
    try {
      if (isRent) await decideRentalApplication(deal.id, accept);
      else if (accept) await acceptOffer(deal.id);
      else await rejectOffer(deal.id);
      setMessage({
        kind: 'success',
        text: accept
          ? `${deal.buyer_name} accepted: other pending ${isRent ? 'applications' : 'offers'} rejected, listing now Under Offer.`
          : `${deal.buyer_name} rejected.`,
      });
    } catch (failure) {
      setMessage({ kind: 'error', text: `Decision refused: ${failure.message}` });
    } finally {
      setDealBusy(null);
      await loadDeals();
      await loadProperties();
      if (selectedProp) await loadHistory(selectedProp.id);
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Figma 15 Header: ← Property */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (viewMode === 'offers') setViewMode('manage');
            else if (onBack) onBack();
          }}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            ← {viewMode === 'offers' ? 'Back to property' : selectedProp?.title || 'Property status'}
          </Text>
        </Pressable>

        {message ? (
          <View style={[styles.feedbackBanner, message.kind === 'error' && styles.feedbackError]} accessibilityRole="alert">
            <Text style={[styles.feedbackText, message.kind === 'error' && styles.feedbackErrorText]}>{message.text}</Text>
          </View>
        ) : null}

        {viewMode === 'manage' ? (
          <>
            {properties === null && <ActivityIndicator color="#B6331E" accessibilityLabel="Loading listings" />}
            {properties?.length === 0 && (
              <Text style={styles.noteText}>
                {role === 'agent' ? 'No listing is assigned to you yet.' : 'You have no listings yet.'}
              </Text>
            )}

            {/* Listing picker (when opened from the tab bar) */}
            {!initialProperty && properties?.length > 1 && (
              <View style={styles.picker}>
                {properties.map((p) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: p.id === selectedPropId }}
                    style={[styles.pickerChip, p.id === selectedPropId && styles.pickerChipActive]}
                    onPress={() => selectProperty(p.id)}
                  >
                    <Text style={[styles.pickerText, p.id === selectedPropId && styles.pickerTextActive]} numberOfLines={1}>
                      {p.title} · {statusName(p.status)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {selectedProp && (
              <>
                {selectedProp.image_url ? (
                  <Image
                    source={{ uri: selectedProp.image_url }}
                    style={{
                      width: '100%',
                      height: 150,
                      borderRadius: 8,
                      backgroundColor: 'rgba(182, 51, 30, 0.1)',
                    }}
                    resizeMode="cover"
                  />
                ) : null}
                {/* Current status row matching Figma 15 */}
                <View style={styles.statusRow}>
                  <Text style={styles.rowText}>Current status</Text>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{statusName(selectedProp.status)}</Text>
                  </View>
                </View>

                {/* Change status to (only the actions allowed for this role and status) */}
                <Text style={styles.sectionLabel}>Change status to</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={actions.length === 0 || busy}
                  style={[styles.dropdownBox, actions.length === 0 && styles.disabledBox]}
                  onPress={() => setDropdownOpen((open) => !open)}
                >
                  <Text style={styles.dropdownText}>
                    {isTerminal
                      ? `${statusName(selectedProp.status)} (final status)`
                      : chosen ? `${chosen.label}  ▾` : 'No manual change available'}
                  </Text>
                </Pressable>

                {dropdownOpen && actions.length > 0 && (
                  <View style={styles.dropdownMenu}>
                    {actions.map((action) => (
                      <Pressable
                        key={action.to}
                        style={[styles.dropdownItem, action.to === effectiveTarget && styles.dropdownItemActive]}
                        onPress={() => { setTargetStatus(action.to); setDropdownOpen(false); setConfirming(false); }}
                      >
                        <Text style={[styles.dropdownItemText, action.to === effectiveTarget && styles.dropdownItemTextActive]}>
                          {action.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {chosen?.hint ? <Text style={styles.noteText}>{chosen.hint}</Text> : null}

                {chosen && (
                  <TextInput
                    style={styles.noteInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Note for the history (optional)"
                    maxLength={500}
                    accessibilityLabel="Note for the status history"
                  />
                )}

                {confirming && (
                  <Text style={styles.confirmText}>
                    {statusName(effectiveTarget)} is final: the listing will no longer be able to change status. Tap again to confirm.
                  </Text>
                )}

                {/* Primary CTA: Update status (#B6331E, h-52) */}
                <Pressable
                  accessibilityRole="button"
                  disabled={!chosen || busy}
                  style={[styles.primaryBtn, (!chosen || busy) && styles.primaryBtnDisabled]}
                  onPress={handleTransition}
                >
                  {busy
                    ? <ActivityIndicator color="#F6F5F0" />
                    : <Text style={styles.primaryBtnText}>{confirming ? `Confirm: ${statusName(effectiveTarget)}` : 'Update status'}</Text>}
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
                  <Pressable accessibilityRole="button" style={styles.secondaryBtn} onPress={openDeals}>
                    <Text style={styles.secondaryBtnText}>See offers</Text>
                  </Pressable>
                </View>

                <Text style={styles.noteText}>{statusGuidance(selectedProp, role) || 'note: only valid status changes (no Sold → Active)'}</Text>

                {/* Status history recorded by the database */}
                <View style={styles.statusRow}>
                  <Text style={styles.sectionLabel}>Status history</Text>
                  <Pressable accessibilityRole="button" onPress={() => loadHistory(selectedProp.id)}>
                    <Text style={styles.chatLinkText}>↻ Refresh</Text>
                  </Pressable>
                </View>
                <View style={styles.historyBox}>
                  {history === null && <ActivityIndicator color="#B6331E" accessibilityLabel="Loading history" />}
                  {history?.length === 0 && <Text style={styles.historyDate}>No status change recorded yet.</Text>}
                  {history?.map((entry) => (
                    <View key={entry.id} style={styles.historyItem}>
                      <View style={styles.historyRow}>
                        <Text style={styles.historyLabel} numberOfLines={1}>{historyLine(entry)}</Text>
                        <Text style={styles.historyDate}>{historyWhen(entry.changed_at)}</Text>
                      </View>
                      <Text style={styles.historyMeta}>
                        by {historyWho(entry)}{entry.note ? ` · ${entry.note}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        ) : (
          /* Offers sub-view when tapping "See offers": real data for the selected listing */
          <>
            <Text style={styles.sectionLabel}>
              {isRent ? 'Rental applications' : 'Offers'} · {selectedProp?.title}
            </Text>
            {deals === null && <ActivityIndicator color="#B6331E" accessibilityLabel="Loading offers" />}
            {deals?.length === 0 && (
              <Text style={styles.noteText}>No {isRent ? 'rental applications' : 'offers'} on this listing yet.</Text>
            )}
            {deals?.map((deal) => (
              <View key={deal.id} style={styles.offerCard}>
                <View style={styles.statusRow}>
                  <Text style={styles.offerBuyer}>{deal.buyer_name}</Text>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>
                      {(deal.status || 'pending').charAt(0).toUpperCase() + (deal.status || 'pending').slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.offerMeta}>
                  {isRent
                    ? `Move-in ${formatMoveIn(deal.move_in_date)}${deal.notes ? ` · “${deal.notes}”` : ''}`
                    : `£${Number(deal.amount).toLocaleString('en-GB')} · ${new Date(deal.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </Text>

                {deal.status === 'pending' && selectedProp?.status === 'active' && (
                  <View style={styles.secondaryRow}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!!dealBusy}
                      style={[styles.primaryBtn, { flex: 1, height: 44 }]}
                      onPress={() => decideDeal(deal, true)}
                    >
                      {dealBusy === deal.id ? <ActivityIndicator color="#F6F5F0" /> : <Text style={styles.primaryBtnText}>Accept</Text>}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!!dealBusy}
                      style={[styles.secondaryBtn, { height: 44 }]}
                      onPress={() => decideDeal(deal, false)}
                    >
                      <Text style={styles.secondaryBtnText}>Reject</Text>
                    </Pressable>
                  </View>
                )}

                {onOpenChat && (
                  <Pressable
                    style={styles.chatLink}
                    onPress={async () => {
                      try {
                        const conv = await startOrFindConversation({
                          property: selectedProp,
                          userRole: role,
                          userName: currentSession?.full_name || currentSession?.username,
                        });
                        if (conv?.id) onOpenChat(conv.id);
                      } catch {
                        // Ignore chat open error
                      }
                    }}
                  >
                    <Text style={styles.chatLinkText}>Message about this listing →</Text>
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
  feedbackError: { borderColor: '#B6331E', backgroundColor: 'rgba(182, 51, 30, 0.1)' },
  feedbackErrorText: { color: '#B6331E', fontWeight: '700' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerChip: { borderWidth: 1, borderColor: '#292424', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F6F5F0', maxWidth: '100%' },
  pickerChipActive: { backgroundColor: '#292424' },
  pickerText: { color: '#292424', fontSize: 12 },
  pickerTextActive: { color: '#F6F5F0', fontWeight: '700' },
  noteInput: { borderWidth: 1, borderColor: '#292424', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#292424', backgroundColor: '#F6F5F0' },
  confirmText: { color: '#B6331E', fontWeight: '700', fontSize: 13 },
  historyItem: { gap: 2, paddingVertical: 4 },
  historyMeta: { color: '#292424', fontSize: 12, opacity: 0.75 },
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
