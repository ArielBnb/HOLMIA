import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../styles/theme';

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.accent} />
        <Text style={styles.brand}>HOLMIA</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Welcome to HOLMIA
        </Text>
        <Text style={styles.subtitle}>Your next chapter starts here.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 64,
  },
  content: { width: '100%', maxWidth: 480 },
  accent: {
    width: 48, height: 5, borderRadius: 3,
    backgroundColor: colors.primary, marginBottom: 28,
  },
  brand: {
    color: colors.primary, fontSize: 14, fontWeight: '700',
    letterSpacing: 4, marginBottom: 18,
  },
  title: {
    color: colors.primary, fontSize: 38, fontWeight: '700',
    letterSpacing: -1, marginBottom: 16,
  },
  subtitle: { color: colors.secondary, fontSize: 17, lineHeight: 26 },
});
