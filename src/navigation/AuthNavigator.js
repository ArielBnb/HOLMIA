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
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await signOut();
    } catch (f) {
      setError(f.message || 'Logout failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.page} testID={`home-${profile.role}`}>
      <View style={{ paddingHorizontal: 24, paddingTop: 52, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{destination[profile.role] || 'Welcome'}</Text>
          <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
            {profile.full_name || profile.username || 'User'} ({profile.role})
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={handleLogout}
          disabled={busy}
          style={{ backgroundColor: '#B6311E', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minWidth: 80, alignItems: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
            {busy ? '...' : 'Logout'}
          </Text>
        </Pressable>
      </View>
      {profile.requested_role && profile.requested_role !== profile.role && (
        <Text style={[s.link, { paddingHorizontal: 24, color: '#E65100', marginBottom: 8, textAlign: 'left' }]}>
          {profile.requested_role} access requested — awaiting approval.
        </Text>
      )}
      {error ? <Text accessibilityRole="alert" style={[s.error, { paddingHorizontal: 24, marginBottom: 8 }]}>{error}</Text> : null}
      <DatabaseTestScreen />
    </View>
  );
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
