import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import EmailConfirmationScreen from '../screens/EmailConfirmationScreen';
import DatabaseTestScreen from '../screens/DatabaseTestScreen';
import AgentPortfolioScreen from '../screens/AgentPortfolioScreen';
import AgentModerationScreen from '../screens/AgentModerationScreen';
import PropertyLifecycleScreen from '../screens/PropertyLifecycleScreen';
import { authStyles as s } from '../styles/authTheme';

function RoleHome({ profile }) {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  
  // Default to portfolio for agent, catalogue for buyer/seller
  const [activeTab, setActiveTab] = useState(profile.role === 'agent' ? 'portfolio' : 'catalogue');

  const tabs = profile.role === 'agent' ? [
    { id: 'portfolio', label: 'Portfolio', icon: '💼' },
    { id: 'moderation', label: 'Moderation', icon: '✏️' },
    { id: 'lifecycle', label: 'Lifecycle', icon: '🔄' },
    { id: 'catalogue', label: 'Catalogue', icon: '🏠' },
  ] : [
    { id: 'catalogue', label: 'Catalogue', icon: '🏠' },
    { id: 'lifecycle', label: 'Lifecycle', icon: '🔄' },
  ];

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
      {/* Top Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 52, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#B6311E', letterSpacing: 1 }}>HOLMIA</Text>
          <Text style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
            👤 {profile.full_name || profile.username || 'User'} · <Text style={{ fontWeight: '700', textTransform: 'capitalize' }}>{profile.role}</Text>
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={handleLogout}
          disabled={busy}
          style={{ backgroundColor: '#B6311E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
            {busy ? '...' : 'Logout'}
          </Text>
        </Pressable>
      </View>

      {/* Navigation Tabs */}
      <View style={{ borderBottomWidth: 1, borderColor: '#E5E0D8', paddingBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 15,
                  borderRadius: 18,
                  backgroundColor: isActive ? '#B6311E' : '#EAE7DF',
                }}
              >
                <Text style={{
                  fontWeight: '700',
                  fontSize: 13,
                  color: isActive ? '#FFFFFF' : '#2A2424',
                }}>
                  {tab.icon} {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {profile.requested_role && profile.requested_role !== profile.role && (
        <Text style={[s.link, { paddingHorizontal: 20, color: '#E65100', marginVertical: 4, textAlign: 'left', fontSize: 12 }]}>
          {profile.requested_role} access requested — awaiting approval.
        </Text>
      )}
      {error ? <Text accessibilityRole="alert" style={[s.error, { paddingHorizontal: 20, marginVertical: 4 }]}>{error}</Text> : null}

      {/* Active Screen Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'portfolio' && <AgentPortfolioScreen currentSession={profile} />}
        {activeTab === 'moderation' && <AgentModerationScreen currentSession={profile} />}
        {activeTab === 'lifecycle' && <PropertyLifecycleScreen currentSession={profile} />}
        {activeTab === 'catalogue' && <DatabaseTestScreen />}
      </View>
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
