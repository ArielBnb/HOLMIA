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
import MessagesScreen from '../screens/MessagesScreen';
import SellerPropertyFormScreen from '../screens/SellerPropertyFormScreen';
import { authStyles as s } from '../styles/authTheme';

function MainHome({ profile }) {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('listings');
  const [editingProperty, setEditingProperty] = useState(null);
  const [chatConvId, setChatConvId] = useState(null);

  const handleEditProperty = (prop) => {
    setEditingProperty(prop);
    setActiveTab('add');
  };

  const handleAddProperty = () => {
    setEditingProperty(null);
    setActiveTab('add');
  };

  const handleOpenChat = (conversationId) => {
    setChatConvId(conversationId);
    setActiveTab('messages');
  };

  // Wireframe Navigation + Messages
  const tabs = [
    { id: 'listings', label: 'My listings' },
    { id: 'add', label: 'Add' },
    { id: 'lifecycle', label: 'Lifecycle' },
    // Seller-only: create, edit and delete own listings (ownership + Under Offer locks).
    ...(profile.role === 'seller' ? [{ id: 'sell', label: 'Sell' }] : []),
    { id: 'messages', label: 'Messages' },
    { id: 'profile', label: 'Profile' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Screen Content */}
      <View style={styles.content}>
        {/* Wireframe 10: My listings */}
        {activeTab === 'listings' && (
          <AgentPortfolioScreen
            currentSession={profile}
            onEditProperty={handleEditProperty}
            onAddProperty={handleAddProperty}
            onOpenChat={handleOpenChat}
          />
        )}

        {/* Wireframe 11: Add / Edit Property */}
        {activeTab === 'add' && (
          <AgentModerationScreen
            property={editingProperty}
            currentSession={profile}
            onBack={() => setActiveTab('listings')}
            onSaved={() => setActiveTab('listings')}
          />
        )}

        {/* Wireframe 12: Offers & Property Lifecycle */}
        {activeTab === 'lifecycle' && (
          <PropertyLifecycleScreen
            currentSession={profile}
            onBack={() => setActiveTab('listings')}
            onOpenChat={handleOpenChat}
          />
        )}

        {activeTab === 'sell' && profile.role === 'seller' && <SellerPropertyFormScreen />}

        {/* Communication System: Agent-Seller, Seller-Buyer (direct), Agent-Buyer */}
        {activeTab === 'messages' && (
          <MessagesScreen
            currentSession={profile}
            initialConversationId={chatConvId}
            onBackToNav={() => setActiveTab('listings')}
          />
        )}

        {/* Profile */}
        {activeTab === 'profile' && (
          <View style={styles.profileContainer}>
            <Text style={styles.profileTitle}>Profile</Text>

            <View style={styles.profileCard}>
              <Text style={styles.profileName}>
                {profile.full_name || profile.username || 'User'}
              </Text>
              <Text style={styles.profileMeta}>
                Role:{' '}
                <Text style={{ fontWeight: '700', textTransform: 'capitalize', color: '#B6311E' }}>
                  {profile.role || 'agent'}
                </Text>
              </Text>
              {profile.email ? (
                <Text style={styles.profileMeta}>Email: {profile.email}</Text>
              ) : null}
              {profile.username ? (
                <Text style={styles.profileMeta}>Username: {profile.username}</Text>
              ) : null}
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

      {/* Figma Bottom Navigation Bar (pure white #FFFFFF) */}
      <View style={styles.bottomNav}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={styles.navItem}
              onPress={() => {
                if (tab.id === 'add') setEditingProperty(null);
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

  if (profile) return <MainHome key={profile.id} profile={profile} />;

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
    paddingHorizontal: 6,
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
    marginBottom: 24,
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
