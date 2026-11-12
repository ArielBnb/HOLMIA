import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthButton, AuthError, AuthInput } from '../components/AuthControls';
import { validateRegistration } from '../services/authValidation';
import { authColors, authStyles as s } from '../styles/authTheme';
export default function RegisterScreen({ onLogin, onContinue }) {
  const [form, setForm] = useState({ fullName: '', username: '', password: '', confirmPassword: '', role: null });
  const [error, setError] = useState('');
  const change = (key) => (value) => setForm(previous => ({ ...previous, [key]: value }));
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onLogin(); return true; });
    return () => sub.remove();
  }, [onLogin]);
  function submit() {
    const message = validateRegistration(form); setError(message);
    if (!message) onContinue({ ...form, confirmPassword: undefined });
  }
  return <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.scroll, styles.content]}>
      <View style={styles.header}>
        <Pressable onPress={onLogin} accessibilityLabel="Back to login" accessibilityRole="button" hitSlop={12}><Text style={styles.back}>←</Text></Pressable>
        <Text style={s.title}>Create account</Text>
      </View>
      <View style={styles.fields}>
        <AuthInput label="Full name" value={form.fullName} onChangeText={change('fullName')} autoCapitalize="words" autoComplete="name" textContentType="name" maxLength={120} />
        <AuthInput label="Username" value={form.username} onChangeText={change('username')} autoComplete="username-new" textContentType="username" maxLength={40} />
        <AuthInput label="Password" password value={form.password} onChangeText={change('password')} autoComplete="new-password" textContentType="newPassword" maxLength={128} />
        <AuthInput label="Confirm password" password value={form.confirmPassword} onChangeText={change('confirmPassword')} autoComplete="new-password" textContentType="newPassword" maxLength={128} />
      </View>
      <Text style={styles.label}>I am a:</Text>
      <View style={styles.roles} accessibilityRole="radiogroup">
        {['Buyer', 'Seller', 'Agent'].map(label => {
          const selected = form.role === label.toLowerCase();
          return <Pressable key={label} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected }}
            onPress={() => change('role')(label.toLowerCase())} style={[styles.role, selected && styles.selected]}>
            <Text style={[styles.roleText, selected && styles.selectedText]}>{label}</Text>
          </Pressable>;
        })}
      </View>
      {error ? <View style={styles.error}><AuthError message={error} /></View> : null}
      <AuthButton title="Sign up" onPress={submit} />
      <Pressable style={styles.footer} accessibilityRole="link" onPress={onLogin}><Text style={s.link}>Already have an account? Login</Text></Pressable>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  content: { paddingTop: 56, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 24, marginBottom: 12 },
  back: { color: authColors.text, fontSize: 24, lineHeight: 26, fontWeight: '700' },
  fields: { gap: 12 }, label: { color: authColors.text, fontSize: 14, lineHeight: 20, marginTop: 12, marginBottom: 8 },
  roles: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  role: { flex: 1, borderWidth: 1, borderColor: authColors.text, borderRadius: 8, height: 48, alignItems: 'center', justifyContent: 'center' },
  roleText: { color: authColors.text, fontSize: 14 }, selected: { backgroundColor: authColors.red, borderColor: authColors.red }, selectedText: { color: '#FFFFFF' },
  footer: { marginTop: 12 }, error: { marginBottom: 12 },
});
