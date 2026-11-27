import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import NotificationBanner from '../components/NotificationBanner';
import {
  emitNotification,
  subscribeToAppNotifications,
  subscribeToLocalNotifications,
} from '../services/notificationService';
import { getTabBadges, markTabSeen } from '../services/badgeService';
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
import BuyerEnquiriesScreen from '../screens/BuyerEnquiriesScreen';
import BuyerNavigator from './BuyerNavigator';
import AssistantChat from '../components/AssistantChat';
import { authStyles as s } from '../styles/authTheme';

function MainHome({ profile }) {
  const { session, signOut } = useAuth();
  const userRole = profile?.role || 'buyer';

  // Role-specific initial tab & navigation (Figma 13: Dashboard is Agent home)
  const [activeTab, setActiveTab] = useState(userRole === 'agent' ? 'stats' : 'listings');
  const [buyerTab, setBuyerTab] = useState('Browse');
  const [editingProperty, setEditingProperty] = useState(null);
  const [viewingDetailsProperty, setViewingDetailsProperty] = useState(null);
  const [chatConvId, setChatConvId] = useState(null);
  const [directThread, setDirectThread] = useState(null);
  const [activeNotification, setActiveNotification] = useState(null);
  const [tabBadges, setTabBadges] = useState({});

  const refreshBadges = useCallback(async () => {
    try {
      const next = await getTabBadges(profile);
      setTabBadges(next || {});
    } catch {
      // keep current badges
    }
  }, [profile]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (alive) await refreshBadges();
    };
    const first = setTimeout(run, 0);
    const interval = setInterval(run, 8000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [refreshBadges]);

  useEffect(() => {
    const unsubRemote = subscribeToAppNotifications(profile, (notif) => {
      setActiveNotification(notif);
      refreshBadges();
    });
    const unsubLocal = subscribeToLocalNotifications((notif) => {
      setActiveNotification(notif);
      refreshBadges();
    });
    return () => {
      unsubRemote?.();
      unsubLocal?.();
    };
  }, [profile, refreshBadges]);

  const dismissNotification = useCallback(() => {
    setActiveNotification(null);
  }, []);

  const handleNotificationPress = useCallback(
    (notif) => {
      setActiveNotification(null);
      if (!notif) return;
      setEditingProperty(null);
      setViewingDetailsProperty(null);
      if (notif.conversationId) {
        setChatConvId(notif.conversationId);
      }
      if (notif.targetTab === 'buyer_offers' && userRole === 'buyer') {
        setBuyerTab('Offers');
        setActiveTab('listings');
      } else if (notif.targetTab === 'buyer_favourites' && userRole === 'buyer') {
        setBuyerTab('Favourites');
        setActiveTab('listings');
      } else if (notif.targetTab) {
        setActiveTab(notif.targetTab);
      }
    },
    [userRole]
  );

  // A listing card tapped in the AI assistant: Buyer -> property details,
  // Seller / Agent -> the listing's status and history screen.
  const [buyerOpenRequest, setBuyerOpenRequest] = useState(null);
  const handleAssistantListing = (listing) => {
    if (!listing?.id) return;
    if (userRole === 'buyer') {
      setBuyerTab('Browse');
      setActiveTab('listings');
      setBuyerOpenRequest({ id: listing.id, at: Date.now() });
    } else {
      setEditingProperty(null);
      setViewingDetailsProperty(listing);
    }
  };

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

  const handleMessageCounterpart = (prop) => {
    if (!prop?.id) return;
    const otherId = userRole === 'agent' ? prop.seller_id : prop.agent_id;
    if (!otherId) return;
    setEditingProperty(null);
    setViewingDetailsProperty(null);
    setDirectThread({
      propertyId: prop.id,
      propertyTitle: prop.title || 'Property',
      otherId,
      otherName: userRole === 'agent' ? prop.seller_name || 'Seller' : 'Agent',
      otherRole: userRole === 'agent' ? 'seller' : 'agent',
    });
    setActiveTab(userRole === 'agent' ? 'offers' : 'received');
  };

  // Wireframe Tabs strictly mapped by Role:
  // - Agent: Wireframes 13-17: Stats | Properties | Review | Enquiries | Profile
  // - Seller: Wireframes 10-12: My listings | Add | Offers | Messages | Profile
  const agentTabs = [
    { id: 'stats', label: 'Stats' },
    { id: 'properties', label: 'Properties' },
    { id: 'review', label: 'Review' },
    { id: 'enquiries', label: 'Enquiries' },
    // Received offers (accept / reject) and enquiries (reply) on assigned listings.
    { id: 'offers', label: 'Received' },
    { id: 'profile', label: 'Profile' },
  ];

  const sellerTabs = [
    { id: 'listings', label: 'My listings' },
    { id: 'add', label: 'Add' },
    { id: 'received', label: 'Received' },
    { id: 'messages', label: 'Messages' },
    { id: 'profile', label: 'Profile' },
  ];

  const buyerTabs = ['Browse', 'Favourites', 'Offers', 'Profile'].map((label) => ({ id: label, label }));
  function selectBuyerTab(label) {
    setBuyerTab(label);
    setActiveTab(label === 'Profile' ? 'profile' : 'listings');
    if (profile?.id && (label === 'Offers' || label === 'Profile')) {
      markTabSeen(profile.id, label);
      setTabBadges((prev) => ({ ...prev, [label]: 0 }));
    }
  }

  const tabs = userRole === 'agent' ? agentTabs : userRole === 'seller' ? sellerTabs : buyerTabs;

  return (
    <SafeAreaView style={styles.container}>
      {/* Live In-App Pop-up Notification Banner */}
      <NotificationBanner
        notification={activeNotification}
        onPress={handleNotificationPress}
        onDismiss={dismissNotification}
      />
      {/* AI assistant for every role (Supabase Edge Function holmia-assistant) */}
      <AssistantChat profile={profile} onOpenListing={handleAssistantListing} />
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
            onMessageCounterpart={handleMessageCounterpart}
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
                    onMessageSeller={handleMessageCounterpart}
                  />
                )}

                {activeTab === 'offers' && (
                  <OffersReceivedScreen
                    key={directThread ? `thread-${directThread.propertyId}` : 'offers-default'}
                    currentSession={profile}
                    initialThread={directThread}
                    onClearInitialThread={() => setDirectThread(null)}
                  />
                )}

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
                {/* Wireframe 10: Seller listings / Buyer catalogue */}
                {activeTab === 'listings' && userRole === 'buyer' && (
                  <BuyerNavigator
                    tab={buyerTab} onTab={selectBuyerTab} tabBadges={tabBadges}
                    openRequest={buyerOpenRequest}
                  />
                )}
                {activeTab === 'listings' && userRole === 'seller' && (
                  <AgentPortfolioScreen
                    currentSession={profile}
                    onEditProperty={handleEditProperty}
                    onViewDetails={handleViewDetails}
                    onAddProperty={handleAddProperty}
                    onOpenChat={handleOpenChat}
                  />
                )}

                {/* Add Property (Seller only) */}
                {activeTab === 'add' && userRole === 'seller' && (
                  <SellerPropertyFormScreen />
                )}

                {activeTab === 'received' && userRole === 'seller' && (
                  <OffersReceivedScreen
                    key={directThread ? `thread-${directThread.propertyId}` : 'received-default'}
                    currentSession={profile}
                    initialThread={directThread}
                    onClearInitialThread={() => setDirectThread(null)}
                  />
                )}

                {activeTab === 'enquiries' && userRole === 'buyer' && <BuyerEnquiriesScreen />}

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
                      {profile.role || 'buyer'}
                    </Text>
                  </Text>
                  {(profile.email || session?.user?.email) ? (
                    <Text style={styles.profileMeta}>Email: {profile.email || session?.user?.email}</Text>
                  ) : null}
                  {profile.username ? (
                    <Text style={styles.profileMeta}>Username: {profile.username}</Text>
                  ) : null}
                </View>

                {userRole === 'buyer' && ['Enquiries', 'Messages'].map((label) => (
                  <Pressable
                    key={label}
                    accessibilityRole="button"
                    onPress={() => {
                      const target = label.toLowerCase();
                      if (profile?.id && target === 'enquiries') {
                        markTabSeen(profile.id, 'enquiries');
                        setTabBadges((prev) => ({ ...prev, Profile: 0 }));
                      }
                      setActiveTab(target);
                    }}
                  >
                    <Text style={s.link}>{label === 'Enquiries' ? 'My enquiries' : label}</Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  style={styles.testNotifBtn}
                  onPress={() =>
                    emitNotification({
                      badge: userRole === 'buyer' ? 'OFFER' : 'ALERT',
                      title:
                        userRole === 'agent'
                          ? 'New offer on Central London Flat'
                          : userRole === 'seller'
                          ? 'New buyer enquiry received'
                          : 'Your offer status was updated',
                      body:
                        userRole === 'agent'
                          ? 'A buyer just submitted £425,000. Tap to review.'
                          : userRole === 'seller'
                          ? 'A prospective buyer asked about viewing times.'
                          : 'Tap to check your latest offer and application status.',
                      targetTab:
                        userRole === 'agent'
                          ? 'offers'
                          : userRole === 'seller'
                          ? 'received'
                          : 'buyer_offers',
                    })
                  }
                >
                  <Text style={styles.testNotifBtnText}>Test pop-up notification</Text>
                </Pressable>

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
      {!(userRole === 'buyer' && activeTab === 'listings') && <View style={styles.bottomNav}>
        {tabs.map((tab) => {
          const isActive = userRole === 'buyer' ? tab.id === 'Profile' && activeTab === 'profile' : activeTab === tab.id;
          const badgeCount = Number(tabBadges[tab.id] || 0);
          return (
            <Pressable
              key={tab.id}
              style={styles.navItem}
              onPress={() => {
                if (userRole === 'buyer') { selectBuyerTab(tab.id); return; }
                setEditingProperty(null);
                setViewingDetailsProperty(null);
                if (tab.id !== 'messages' && tab.id !== 'enquiries') {
                  setChatConvId(null);
                }
                if (profile?.id) {
                  markTabSeen(profile.id, tab.id);
                  setTabBadges((prev) => ({ ...prev, [tab.id]: 0 }));
                }
                setActiveTab(tab.id);
              }}
            >
              <View style={styles.navLabelRow}>
                <Text numberOfLines={1} style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {tab.label}
                </Text>
                {badgeCount > 0 && (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>}
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
    backgroundColor: '#F6F5F0',
  },
  content: {
    flex: 1,
    backgroundColor: '#F6F5F0',
  },
  bottomNav: {
    flexDirection: 'row',
    height: 56,
    borderTopWidth: 1,
    borderTopColor: '#DDDDDD',
    backgroundColor: '#F6F5F0',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    height: '100%',
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#292424',
  },
  navLabelActive: {
    fontWeight: '700',
    color: '#292424',
  },
  navLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#B6331E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  profileContainer: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
    justifyContent: 'flex-start',
    backgroundColor: '#F6F5F0',
  },
  profileTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#292424',
    marginBottom: 16,
  },
  profileCard: {
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#F6F5F0',
    marginBottom: 16,
    gap: 8,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#292424',
    marginBottom: 4,
  },
  profileMeta: {
    fontSize: 14,
    color: '#292424',
  },
  testNotifBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: '#292424',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F5F0',
    marginBottom: 12,
  },
  testNotifBtnText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#292424',
  },
  logoutBtn: {
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B6331E',
  },
  logoutBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F6F5F0',
  },
});
