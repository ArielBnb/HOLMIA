import React, { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import EmailConfirmationScreen from '../screens/EmailConfirmationScreen';
import AgentPortfolioScreen from '../screens/AgentPortfolioScreen';
import AgentModerationScreen from '../screens/AgentModerationScreen';
import PropertyLifecycleScreen from '../screens/PropertyLifecycleScreen';
import DatabaseTestScreen from '../screens/DatabaseTestScreen';
import { authStyles as s } from '../styles/authTheme';

function RoleHome({ profile }) {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('listings');
  const [editingProperty, setEditingProperty] = useState(null);

  const handleEditProperty = (prop) => {
    setEditingProperty(prop);
    setActiveTab('add');
  };

  const handleAddProperty = () => {
    setEditingProperty(null);
    setActiveTab('add');
  };

  const tabs = [
    { id: 'listings', label: 'My listings' },
    { id: 'add', label: 'Add' },
    { id: 'lifecycle', label: 'Lifecycle' },
    { id: 'profile', label: 'Profile' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Screen Content */}
      <View style={styles.content}>
        {activeTab === 'listings' && (
          <AgentPortfolioScreen
            currentSession={profile}
            onEditProperty={handleEditProperty}
            onAddProperty={handleAddProperty}
          />
        )}
        {activeTab === 'add' && (
          <AgentModerationScreen
            property={editingProperty}
            onBack={() => setActiveTab('listings')}
            onSaved={() => setActiveTab('listings')}
          />
        )}
        {activeTab === 'lifecycle' && (
          <PropertyLifecycleScreen
            currentSession={profile}
            onBack={() => setActiveTab('listings')}
          />
        )}
        {activeTab === 'profile' && (
          <View style={styles.profileContainer}>
            <Text style={styles.profileTitle}>Profile</Text>
            <View style={styles.profileCard}>
              <Text style={styles.profileName}>{profile.full_name || profile.username || 'User'}</Text>
              <Text style={styles.profileMeta}>Role: <Text style={{ fontWeight: '700', textTransform: 'capitalize' }}>{profile.role}</Text></Text>
              {profile.email ? <Text style={styles.profileMeta}>Email: {profile.email}</Text> : null}
              {profile.username ? <Text style={styles.profileMeta}>Username: {profile.username}</Text> : null}
            </View>

            <Pressable
              accessibilityRole="button"
              style={styles.logoutBtn}
              onPress={() => signOut().catch(() => {})}
            >
              <Text style={styles.logoutBtnText}>Logout</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Figma Bottom Navigation Bar (Screens 10, 11, 12) */}
      <View style={styles.bottomNav}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={styles.navItem}
              onPress={() => {
                if (tab.id === 'add') setEditingProperty(null);
                setActiveTab(tab.id);
              }}
            >
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function AuthNavigator() {
  const { session, profile, loading, error, retry, signOut } = useAuth();
  const [screen, setScreen] = useState('login');
  const [registration, setRegistration] = useState(null);

  function login() {
    setRegistration(null);
    setScreen('login');
  }

  if (loading) {
    return (
      <View style={[s.page, { justifyContent: 'center' }]}>
        <ActivityIndicator color="#B6311E" accessibilityLabel="Loading session" />
      </View>
    );
  }

  if (session && !profile) {
    return (
      <View style={[s.page, { padding: 32, justifyContent: 'center', gap: 16 }]}>
        <Text accessibilityRole="alert" style={s.error}>{error || 'Unable to load profile'}</Text>
        <Pressable accessibilityRole="button" onPress={retry}><Text style={s.link}>Retry</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => signOut().catch(() => {})}><Text style={s.link}>Logout</Text></Pressable>
      </View>
    );
  }

  if (profile) return <RoleHome key={profile.id + profile.role} profile={profile} />;
  if (screen === 'register') {
    return <RegisterScreen onLogin={login} onContinue={(val) => { setRegistration(val); setScreen('email'); }} />;
  }
  if (screen === 'email') {
    return (
      <EmailConfirmationScreen
        registration={registration}
        onBack={() => { setRegistration(null); setScreen('register'); }}
        onLogin={login}
        onRegistered={() => setRegistration(null)}
      />
    );
  }

  return <LoginScreen onRegister={() => setScreen('register')} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  profileContainer: {
    flex: 1,
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  profileTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 16,
  },
  profileCard: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 6,
  },
  profileMeta: {
    fontSize: 14,
    color: '#555555',
    marginBottom: 4,
  },
  logoutBtn: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#B6311E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  // Figma Wireframe Bottom Bar
  bottomNav: {
    flexDirection: 'row',
    height: 54,
    borderTopWidth: 1,
    borderTopColor: '#2A2424',
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  navLabel: {
    fontSize: 13,
    color: '#777777',
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#2A2424',
    fontWeight: '700',
  },
});
