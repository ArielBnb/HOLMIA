import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import EmailConfirmationScreen from '../screens/EmailConfirmationScreen';
import AgentPortfolioScreen from '../screens/AgentPortfolioScreen';
import AgentModerationScreen from '../screens/AgentModerationScreen';
import PropertyLifecycleScreen from '../screens/PropertyLifecycleScreen';
import BuyerExploreScreen from '../screens/BuyerExploreScreen';
import MessagesScreen from '../screens/MessagesScreen';
import { authStyles as s } from '../styles/authTheme';

function RoleHome({ profile: initialProfile }) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState(initialProfile);
  const currentRole = profile?.role || 'buyer';

  // Role-specific default tab
  const getDefaultTab = (role) => {
    if (role === 'buyer') return 'explore';
    return 'listings';
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab(currentRole));
  const [editingProperty, setEditingProperty] = useState(null);
  const [chatConvId, setChatConvId] = useState(null);

  const handleEditProperty = (prop) => {
    setEditingProperty(prop);
    setActiveTab(currentRole === 'agent' ? 'moderate' : 'add');
  };

  const handleAddProperty = () => {
    setEditingProperty(null);
    setActiveTab(currentRole === 'agent' ? 'moderate' : 'add');
  };

  const handleOpenChat = (conversationId) => {
    setChatConvId(conversationId);
    setActiveTab('messages');
  };

  // Define tabs strictly per role
  const getTabsForRole = (role) => {
    if (role === 'buyer') {
      return [
        { id: 'explore', label: 'Explore' },
        { id: 'messages', label: 'Messages' },
        { id: 'profile', label: 'Profile' },
      ];
    }
    if (role === 'seller') {
      return [
        { id: 'listings', label: 'My listings' },
        { id: 'add', label: 'Add' },
        { id: 'offers', label: 'Offers' },
        { id: 'messages', label: 'Messages' },
        { id: 'profile', label: 'Profile' },
      ];
    }
    // Agent
    return [
      { id: 'listings', label: 'Assigned' },
      { id: 'moderate', label: 'Moderate' },
      { id: 'lifecycle', label: 'Lifecycle' },
      { id: 'messages', label: 'Messages' },
      { id: 'profile', label: 'Profile' },
    ];
  };

  const tabs = getTabsForRole(currentRole);

  const handleSwitchRolePreview = (newRole) => {
    const updated = { ...profile, role: newRole };
    setProfile(updated);
    setActiveTab(getDefaultTab(newRole));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Screen Content */}
      <View style={styles.content}>
        {/* BUYER SCREENS */}
        {currentRole === 'buyer' && activeTab === 'explore' && (
          <BuyerExploreScreen
            currentSession={profile}
            onOpenChat={handleOpenChat}
          />
        )}

        {/* SELLER / AGENT LISTINGS SCREEN (Wireframe 10) */}
        {activeTab === 'listings' && (
          <AgentPortfolioScreen
            currentSession={profile}
            onEditProperty={handleEditProperty}
            onAddProperty={handleAddProperty}
            onOpenChat={handleOpenChat}
          />
        )}

        {/* SELLER / AGENT ADD OR EDIT PROPERTY (Wireframe 11) */}
        {(activeTab === 'add' || activeTab === 'moderate') && (
          <AgentModerationScreen
            property={editingProperty}
            currentSession={profile}
            onBack={() => setActiveTab('listings')}
            onSaved={() => setActiveTab('listings')}
          />
        )}

        {/* OFFERS / LIFECYCLE (Wireframe 12) */}
        {(activeTab === 'offers' || activeTab === 'lifecycle') && (
          <PropertyLifecycleScreen
            currentSession={profile}
            onBack={() => setActiveTab('listings')}
          />
        )}

        {/* MESSAGING & CHAT SCREEN (All Roles) */}
        {activeTab === 'messages' && (
          <MessagesScreen
            currentSession={profile}
            initialConversationId={chatConvId}
            onBackToNav={() => setActiveTab(getDefaultTab(currentRole))}
          />
        )}

        {/* PROFILE SCREEN */}
        {activeTab === 'profile' && (
          <View style={styles.profileContainer}>
            <Text style={styles.profileTitle}>Profile</Text>

            <View style={styles.profileCard}>
              <Text style={styles.profileName}>
                {profile.full_name || profile.username || 'User'}
              </Text>
              <Text style={styles.profileMeta}>
                Active Role:{' '}
                <Text style={{ fontWeight: '700', textTransform: 'capitalize', color: '#B6311E' }}>
                  {currentRole}
                </Text>
              </Text>
              {profile.email ? (
                <Text style={styles.profileMeta}>Email: {profile.email}</Text>
              ) : null}
              {profile.username ? (
                <Text style={styles.profileMeta}>Username: {profile.username}</Text>
              ) : null}
            </View>

            {/* Quick Role Switcher for Testing */}
            <View style={styles.roleSwitcherBox}>
              <Text style={styles.roleSwitcherTitle}>Switch Role (Demo & Testing):</Text>
              <View style={styles.roleButtonRow}>
                {['buyer', 'seller', 'agent'].map((r) => {
                  const isActive = currentRole === r;
                  return (
                    <Pressable
                      key={r}
                      style={[styles.roleBtn, isActive && styles.roleBtnActive]}
                      onPress={() => handleSwitchRolePreview(r)}
                    >
                      <Text style={[styles.roleBtnText, isActive && styles.roleBtnTextActive]}>
                        {r.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.roleSwitcherNote}>
                Instantly previews the tailored UI and communication rules for this role.
              </Text>
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

      {/* Figma Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={styles.navItem}
              onPress={() => {
                if (tab.id === 'add' || tab.id === 'moderate') setEditingProperty(null);
                if (tab.id !== 'messages') setChatConvId(null);
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
        <Text accessibilityRole="alert" style={s.error}>
          {error || 'Unable to load profile'}
        </Text>
        <Pressable accessibilityRole="button" onPress={retry}>
          <Text style={s.link}>Retry</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => signOut().catch(() => {})}>
          <Text style={s.link}>Logout</Text>
        </Pressable>
      </View>
    );
  }

  if (profile) return <RoleHome key={profile.id} profile={profile} />;

  if (screen === 'register') {
    return (
      <RegisterScreen
        onLogin={login}
        onContinue={(val) => {
          setRegistration(val);
          setScreen('email');
        }}
      />
    );
  }

  if (screen === 'email') {
    return (
      <EmailConfirmationScreen
        registration={registration}
        onBack={() => {
          setRegistration(null);
          setScreen('register');
        }}
        onComplete={login}
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
    backgroundColor: '#FFFFFF',
  },
  bottomNav: {
    flexDirection: 'row',
    height: 60,
    borderTopWidth: 1,
    borderTopColor: '#2A2424',
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#888888',
  },
  navLabelActive: {
    fontWeight: '700',
    color: '#2A2424',
  },
  profileContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  profileTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 20,
  },
  profileCard: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 10,
    padding: 18,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
    gap: 8,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 4,
  },
  profileMeta: {
    fontSize: 14,
    color: '#444444',
  },
  roleSwitcherBox: {
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 10,
    padding: 16,
    backgroundColor: '#FAFAFA',
    marginBottom: 24,
  },
  roleSwitcherTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2A2424',
    marginBottom: 10,
  },
  roleButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  roleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2A2424',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  roleBtnActive: {
    backgroundColor: '#2A2424',
  },
  roleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2A2424',
  },
  roleBtnTextActive: {
    color: '#FFFFFF',
  },
  roleSwitcherNote: {
    fontSize: 11,
    color: '#777',
    fontStyle: 'italic',
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: '#B6311E',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B6311E',
  },
});
