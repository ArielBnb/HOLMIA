import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthButton, AuthError, AuthInput } from '../components/AuthControls';
import HolmiaLogo from '../components/HolmiaLogo';
import { loginWithUsername } from '../services/authService';
import { authColors, authStyles as s } from '../styles/authTheme';
export default function LoginScreen({ onRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
    setBusy(true); setError('');
    try { await loginWithUsername(username, password); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.scroll, styles.content]}>
      <HolmiaLogo />
      <Text style={styles.title}>City Estate</Text>
      <Text style={styles.subtitle}>buyers &amp; sellers</Text>
      <View style={styles.form}>
        <AuthInput label="Username" value={username} onChangeText={setUsername} autoComplete="username" textContentType="username" editable={!busy} maxLength={40} />
        <AuthInput label="Password" password value={password} onChangeText={setPassword} autoComplete="current-password" textContentType="password" editable={!busy} maxLength={128} returnKeyType="go" onSubmitEditing={submit} />
        <AuthError message={error} />
        <AuthButton title="Login" busy={busy} onPress={submit} />
        <Pressable accessibilityRole="link" onPress={onRegister} disabled={busy}><Text style={s.link}>No account? Create one</Text></Pressable>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  content: { justifyContent: 'center', paddingTop: 34, paddingBottom: 0, minHeight: 590 },
  title: { textAlign: 'center', color: authColors.text, fontSize: 30, lineHeight: 36, fontWeight: '700', marginTop: 16 },
  subtitle: { textAlign: 'center', color: authColors.text, fontSize: 14, lineHeight: 20, marginTop: 8 },
  form: { marginTop: 46, gap: 12 },
});
