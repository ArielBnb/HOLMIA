import { Platform, StyleSheet, Text, View } from 'react-native';
import { authColors } from '../styles/authTheme';
// Native vector geometry traced from 01 - Login.jpg, including the two circular forms.
export default function HolmiaLogo() {
  return <View accessible accessibilityLabel="HOLMIA" style={s.logo}>
    <View style={s.mark}>
      <View style={s.outer} /><View style={s.inner} /><View style={s.left} /><View style={s.right} />
    </View>
    <Text style={s.word}>HOLMIA</Text>
  </View>;
}
const stroke = { borderWidth: 4.5, borderColor: authColors.red, backgroundColor: authColors.background };
const s = StyleSheet.create({
  logo: { width: 140, height: 140, alignSelf: 'center', alignItems: 'center' },
  mark: { width: 100, height: 100 },
  outer: { ...stroke, position: 'absolute', left: 16, top: 0, width: 74, height: 100, borderTopLeftRadius: 42, borderTopRightRadius: 42 },
  inner: { ...stroke, position: 'absolute', left: 31, top: 15, width: 44, height: 70, borderTopLeftRadius: 27, borderTopRightRadius: 27 },
  left: { ...stroke, position: 'absolute', left: 3, top: 15, width: 44, height: 44, borderRadius: 22 },
  right: { ...stroke, position: 'absolute', left: 48, top: 43, width: 44, height: 44, borderRadius: 22 },
  word: { color: authColors.red, fontSize: 36, lineHeight: 44, fontWeight: '500', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }), letterSpacing: -1.2 },
});
