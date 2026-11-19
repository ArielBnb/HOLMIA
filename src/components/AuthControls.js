import { ActivityIndicator, Pressable, Text, TextInput } from 'react-native';
import { authColors, authStyles as s } from '../styles/authTheme';
export function AuthInput({ label, password = false, ...props }) {
  return <TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor={authColors.text}
    autoCapitalize="none" autoCorrect={false} secureTextEntry={password} style={s.input} {...props} />;
}
export function AuthButton({ title, busy, onPress }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: busy, busy }}
    disabled={busy} onPress={onPress} style={[s.button, busy && s.disabled]}>
    {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.buttonText}>{title}</Text>}
  </Pressable>;
}
export function AuthError({ message }) {
  return message ? <Text accessibilityRole="alert" style={s.error}>{message}</Text> : null;
}
