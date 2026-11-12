import { StyleSheet } from 'react-native';
export const authColors = { background: '#F6F5F0', red: '#B6311E', text: '#2A2424' };
export const authStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: authColors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 32, width: '100%', maxWidth: 466, alignSelf: 'center' },
  input: { height: 48, borderWidth: 1, borderColor: authColors.text, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 0, fontSize: 14, color: authColors.text, backgroundColor: authColors.background },
  button: { height: 52, borderRadius: 8, backgroundColor: authColors.red, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  link: { fontSize: 14, lineHeight: 20, textAlign: 'center', color: authColors.text },
  error: { fontSize: 13, lineHeight: 18, color: authColors.red },
  title: { color: authColors.text, fontSize: 20, lineHeight: 24, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});
