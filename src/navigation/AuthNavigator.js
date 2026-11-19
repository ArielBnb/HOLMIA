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
import AgentReviewScreen from '../screens/AgentReviewScreen';
import AgentStatsScreen from '../screens/AgentStatsScreen';
import SellerPropertyFormScreen from '../screens/SellerPropertyFormScreen';
import OffersReceivedScreen from '../screens/OffersReceivedScreen';
import { authStyles as s } from '../styles/authTheme';

function MainHome({ profile }) {
  const { signOut } = useAuth();
  const userRole = profile?.role || 'agent';

  // Role-specific initial tab & navigation
  const [activeTab, setActiveTab] = useState(userRole === 'agent' ? 'properties' : 'listings');
  const [editingProperty, setEditingProperty] = useState(null);
  const [viewingDetailsProperty, setViewingDetailsProperty] = useState(null);
  const [chatConvId, setChatConvId] = useState(null);

  const handleEditProperty = (prop) => {
    setEditingProperty(prop);
  };

  const handleViewDetails = (prop) => {
    setViewingDetailsProperty(prop);
  };

  const handleAddProperty = () => {
    // Only available for seller
    setEditingProperty(null);
    setActiveTab('add');
  };

  const handleOpenChat = (conversationId) => {
    setChatConvId(conversationId);
    setActiveTab(userRole === 'agent' ? 'enquiries' : 'messages');
  };

  // Wireframe Tabs strictly mapped by Role:
  // - Agent: Wireframes 13-17: Stats | Properties | Review | Enquiries | Profile
  // - Seller: Wireframes 10-12: My listings | Add | Offers | Messages | Profile
  const agentTabs = [
    { id: 'stats', label: 'Stats' },
    { id: 'properties', label: 'Properties' },
    { id: 'review', label: 'Review' },
    { id: 'enquiries', label: 'Enquiries' },
    // Received offers on assigned listings: accept / reject (transactional, Supabase).
    { id: 'offers', label: 'Offers' },
    { id: 'profile', label: 'Profile' },
  ];

  const sellerTabs = [
    { id: 'listings', label: 'My listings' },
    { id: 'add', label: 'Add' },
    { id: 'lifecycle', label: 'Offers' },
    // Create / edit / delete own listings with ownership and Under Offer locks.
    { id: 'sell', label: 'Sell' },
    // Received offers on own listings: accept / reject (transactional, Supabase).
    { id: 'received', label: 'Decide' },
    { id: 'messages', label: 'Messages' },
    { id: 'profile', label: 'Profile' },
  ];

  const buyerTabs = [
    { id: 'listings', label: 'Catalogue' },
    { id: 'messages', label: 'Messages' },
    { id: 'profile', label: 'Profile' },
  ];

  const tabs = userRole === 'agent' ? agentTabs : userRole === 'seller' ? sellerTabs : buyerTabs;

  return (
    <SafeAreaView style={styles.container}>
      {/* Screen Content */}
      <View style={styles.content}>
        {/* Detail/Moderation overlay for Agent/Seller */}
        {editingProperty ? (
          <AgentModerationScreen
            property={editingProperty}
            currentSession={profile}
            onBack={() => setEditingProperty(null)}
            onSaved={() => setEditingProperty(null)}
            onOpenChat={handleOpenChat}
          />
        ) : viewingDetailsProperty ? (
          /* Wireframe 15: Managed property details */
          <PropertyLifecycleScreen
            currentSession={profile}
            initialProperty={viewingDetailsProperty}
            onEditProperty={(prop) => {
              setViewingDetailsProperty(null);
              setEditingProperty(prop);
            }}
            onBack={() => setViewingDetailsProperty(null)}
            onOpenChat={handleOpenChat}
          />
        ) : (
          <>
            {/* === AGENT WORKSPACE (Screens 13-17) === */}
            {userRole === 'agent' && (
              <>
                {/* Wireframe 13: Dashboard KPI Stats */}
                {activeTab === 'stats' && (
                  <AgentStatsScreen currentSession={profile} />
                )}

                {/* Wireframe 14: Managed properties */}
                {activeTab === 'properties' && (
                  <AgentPortfolioScreen
                    currentSession={profile}
                    onEditProperty={handleEditProperty}
                    onViewDetails={handleViewDetails}
                    onOpenChat={handleOpenChat}
                  />
                )}

                {/* Wireframe 16: Listings to review (Approve / Reject) */}
                {activeTab === 'review' && (
                  <AgentReviewScreen
                    currentSession={profile}
                    onEditProperty={handleEditProperty}
                    onOpenChat={handleOpenChat}
                  />
                )}

                {activeTab === 'offers' && <OffersReceivedScreen currentSession={profile} />}

                {/* Wireframe 17: Enquiries & Supabase Realtime Communication */}
                {activeTab === 'enquiries' && (
                  <MessagesScreen
                    currentSession={profile}
                    initialConversationId={chatConvId}
                    onBackToNav={() => setActiveTab('properties')}
                  />
                )}
              </>
            )}

            {/* === SELLER / BUYER WORKSPACE === */}
            {userRole !== 'agent' && (
              <>
                {/* Wireframe 10: My listings / Catalogue */}
                {activeTab === 'listings' && (
                  <AgentPortfolioScreen
                    currentSession={profile}
                    onEditProperty={handleEditProperty}
                    onAddProperty={handleAddProperty}
                    onOpenChat={handleOpenChat}
                  />
                )}

                {/* Wireframe 11: Add / Edit Property (Seller only) */}
                {activeTab === 'add' && (
                  <AgentModerationScreen
                    property={editingProperty}
                    currentSession={profile}
                    onBack={() => setActiveTab('listings')}
                    onSaved={() => setActiveTab('listings')}
                    onOpenChat={handleOpenChat}
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

                {activeTab === 'sell' && userRole === 'seller' && <SellerPropertyFormScreen />}

                {activeTab === 'received' && userRole === 'seller' && <OffersReceivedScreen currentSession={profile} />}

                {/* Messages Screen */}
                {activeTab === 'messages' && (
                  <MessagesScreen
                    currentSession={profile}
                    initialConversationId={chatConvId}
                    onBackToNav={() => setActiveTab('listings')}
                  />
                )}
              </>
            )}

            {/* Profile Tab (Universal) */}
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
          </>
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
                setEditingProperty(null);
                setViewingDetailsProperty(null);
                if (tab.id !== 'messages' && tab.id !== 'enquiries') {
                  setChatConvId(null);
                }
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
