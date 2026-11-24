import { useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView,
  ScrollView, Text, TextInput, View } from 'react-native';
import MoveInDate from '../components/MoveInDate';
import { formatPrice } from '../services/buyerFilters';
import { submissionValues } from '../services/submissionRules';
import { submitPropertyRequest } from '../services/submissionService';
import { buyerStyles as s } from '../styles/buyerTheme';

export default function PropertySubmissionScreen({ property, onBack, onSubmitted }) {
  const sale = property.listing_type === 'sale';
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(null);
  const sending = useRef(false);

  async function submit() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const values = submissionValues(property, value, notes);
      const signature = JSON.stringify(values);
      if (request.current?.signature !== signature) request.current = { id: randomUUID(), signature };
      await submitPropertyRequest(property, request.current.id, values);
      onSubmitted(sale ? 'offer' : 'rental');
    } catch (failure) {
      setError(failure.message || 'Unable to confirm submission. Please retry.');
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={() => { if (!sending.current) onBack(); }}>
      <SafeAreaView style={s.page}>
        <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={s.page} contentContainerStyle={[s.content, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
            <Pressable accessibilityRole="button" accessibilityLabel="Back to property details" disabled={busy} onPress={onBack}>
              <Text style={s.heading}>{sale ? '← Make an offer' : '← Apply to rent'}</Text>
            </Pressable>
            <View style={s.summary}>
              <Text style={[s.text, { fontWeight: '700' }]}>{property.title}</Text>
              <Text style={s.label}>{sale ? 'Asking price' : 'Rent'} · {formatPrice(property)}</Text>
            </View>
            <Text style={s.label}>{sale ? 'Your offer (£)' : 'Move-in date'}</Text>
            {sale ? <TextInput accessibilityLabel="Your offer (£)" style={s.input} value={value}
              placeholder="Amount" onChangeText={setValue} editable={!busy} keyboardType="decimal-pad" /> :
              <MoveInDate value={value} onChange={setValue} disabled={busy} />}
            <Text style={s.label}>{sale ? 'Message (optional)' : 'Notes (optional)'}</Text>
            <TextInput accessibilityLabel={sale ? 'Message (optional)' : 'Notes (optional)'}
              placeholder={sale ? 'Add a note for the seller' : 'Tell the landlord about you'}
              style={[s.input, { height: sale ? 100 : 110, paddingVertical: 12, textAlignVertical: 'top' }]}
              value={notes} onChangeText={setNotes} multiline maxLength={2000} editable={!busy} />
            {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
            <View style={{ flexGrow: 1 }} />
            <Pressable accessibilityRole="button" style={[s.button, s.primary]} disabled={busy}
              accessibilityState={{ busy, disabled: busy }} onPress={submit}>
              {busy ? <ActivityIndicator color="#fff" /> :
                <Text style={s.primaryText}>{sale ? 'Submit offer' : 'Submit application'}</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
