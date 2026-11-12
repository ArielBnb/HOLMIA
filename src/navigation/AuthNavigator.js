import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import EmailConfirmationScreen from '../screens/EmailConfirmationScreen';
import DatabaseTestScreen from '../screens/DatabaseTestScreen';
import { authStyles as s } from '../styles/authTheme';
// No Buyer/Seller/Agent screens exist on main yet. Preserve the catalogue as their
// shared temporary content; the keyed destinations are ready for the team's screens.
const destination = { buyer: 'Browse', seller: 'My listings', agent: 'Dashboard & stats' };
function RoleHome({ profile }) {
  const { signOut } = useAuth(); const [error, setError] = useState('');
  return <View style={s.page} testID={`home-${profile.role}`}>
    <View style={{ paddingHorizontal: 32, paddingTop: 48, gap: 10 }}>
      <Text style={s.title}>{destination[profile.role]}</Text>
      {profile.requested_role !== profile.role && <Text style={s.link}>{profile.requested_role} access requested — awaiting approval.</Text>}
      <Pressable accessibilityRole="button" onPress={() => signOut().catch(f => setError(f.message))}><Text style={s.link}>Logout</Text></Pressable>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    </View>
    <DatabaseTestScreen />
  </View>;
}
export default function AuthNavigator() {
  const { session, profile, loading, error, retry, signOut } = useAuth();
  const [screen, setScreen] = useState('login'); const [registration, setRegistration] = useState(null);
  function login() { setRegistration(null); setScreen('login'); }
  if (loading) return <View style={[s.page, { justifyContent: 'center' }]}><ActivityIndicator color="#B6311E" accessibilityLabel="Loading session" /></View>;
  if (session && !profile) return <View style={[s.page, { padding: 32, justifyContent: 'center', gap: 16 }]}>
    <Text accessibilityRole="alert" style={s.error}>{error}</Text>
    <Pressable accessibilityRole="button" onPress={retry}><Text style={s.link}>Retry</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => signOut().catch(() => {})}><Text style={s.link}>Logout</Text></Pressable>
  </View>;
  if (profile) return <RoleHome key={profile.id + profile.role} profile={profile} />;
  if (screen === 'register') return <RegisterScreen onLogin={login} onContinue={value => { setRegistration(value); setScreen('email'); }} />;
  if (screen === 'email') return <EmailConfirmationScreen registration={registration} onBack={() => { setRegistration(null); setScreen('register'); }} onLogin={login} onRegistered={() => setRegistration(null)} />;
  return <LoginScreen onRegister={() => setScreen('register')} />;
}
