import { useRef, useState } from 'react';
import { randomUUID } from '../utils/uuid';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  SafeAreaView, ScrollView, Text, TextInput,
} from 'react-native';
import { sendEnquiry } from '../services/enquiryService';
import { ENQUIRY_MAX } from '../services/enquiryRules';
import { buyerStyles as s } from '../styles/buyerTheme';

export default function SendEnquiryScreen({ property, onBack }) {
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inFlight = useRef(false);
  const request = useRef(null);

  async function submit() {
    const message = question.trim();
    if (inFlight.current || sent || !message) return;
    inFlight.current = true;
    setSending(true);
    setError('');
    try {
      if (request.current?.message !== message) {
        request.current = { id: randomUUID(), message };
      }
      await sendEnquiry(property.id, message, request.current.id);
      setSent(true);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  }

  function close() {
    if (!inFlight.current) onBack();
  }

  return (
    <Modal animationType="slide" onRequestClose={close}>
      <SafeAreaView style={s.page}>
        <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Pressable accessibilityRole="button" accessibilityLabel="Back to property details" onPress={close} disabled={sending}>
              <Text style={s.heading}>← Send enquiry</Text>
            </Pressable>
            <Text style={s.text}>{property.title}</Text>
            {sent ? (
              <>
                <Text accessibilityRole="alert" style={s.text}>Enquiry sent.</Text>
                <Text style={s.text}>The seller or their agent will reply in Profile › My enquiries, where you can follow its status (Pending / Handled).</Text>
                <Pressable accessibilityRole="button" style={[s.button, s.primary]} onPress={close}>
                  <Text style={s.primaryText}>Back to property</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.label}>Your question</Text>
                <TextInput
                  accessibilityLabel="Your question"
                  style={[s.input, { height: 128, paddingVertical: 12, textAlignVertical: 'top' }]}
                  value={question}
                  onChangeText={setQuestion}
                  maxLength={ENQUIRY_MAX}
                  editable={!sending}
                  multiline
                />
                {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: sending, disabled: sending || !question.trim() }}
                  disabled={sending || !question.trim()}
                  style={[s.button, s.primary, !question.trim() && { opacity: 0.5 }]}
                  onPress={submit}
                >
                  {sending ? <ActivityIndicator color="#fff" accessibilityLabel="Sending enquiry" /> :
                    <Text style={s.primaryText}>Send enquiry</Text>}
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
