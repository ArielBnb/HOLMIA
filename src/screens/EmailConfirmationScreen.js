import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { AuthButton, AuthError, AuthInput } from '../components/AuthControls';
import { registerAccount } from '../services/authService';
import { authStyles as s } from '../styles/authTheme';
// Additional step approved for real email collection; original Register layout stays intact.
export default function EmailConfirmationScreen({ registration, onBack, onLogin, onRegistered }) {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false); const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setBusy(true); setError('');
    try { await registerAccount({ ...registration, email }); onRegistered(); setSent(true); }
    catch (failure) { setError(failure.message || 'Unable to create your account.'); }
    finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.scroll, { paddingTop: 56, paddingBottom: 32 }]}>
      <View style={{ gap: 16 }}>
        <Pressable accessibilityRole="button" onPress={sent ? onLogin : onBack} disabled={busy}><Text style={s.title}>← {sent ? 'Check your email' : 'Confirm your email'}</Text></Pressable>
        {sent ? <><Text style={s.link}>If this address can be registered, a confirmation email will arrive shortly. Confirm it, then log in with your username. Seller and Agent requests require approval.</Text><AuthButton title="Back to Login" onPress={onLogin} /></> : <>
          <Text style={s.link}>Use your real email address to confirm your account. You will log in with your username.</Text>
          <AuthInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" editable={!busy} maxLength={254} />
          <AuthError message={error} /><AuthButton title="Create account" busy={busy} onPress={submit} />
        </>}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
