import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, SafeAreaView } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import DatabaseTestScreen from './src/screens/DatabaseTestScreen';
import RoleAccessScreen from './src/screens/RoleAccessScreen';
import { colors } from './src/styles/theme';

export default function App() {
  const [activeTab, setActiveTab] = useState('login');
  const [currentSession, setCurrentSession] = useState({
    username: 'demo_buyer',
    role: 'buyer',
    loginTime: '15:00'
  });

  const handleLogin = (sessionData) => {
    setCurrentSession(sessionData);
  };

  const handleLogout = () => {
    setCurrentSession(null);
  };

  const handleSwitchRole = (newRole) => {
    setCurrentSession(prev => ({
      username: prev?.username || `demo_${newRole}`,
      role: newRole,
      loginTime: prev?.loginTime || new Date().toLocaleTimeString('fr-FR')
    }));
  };

  const renderCurrentScreen = () => {
    switch (activeTab) {
      case 'login':
        return (
          <LoginScreen
            currentSession={currentSession}
            onLoginSuccess={handleLogin}
            onLogout={handleLogout}
          />
        );
      case 'welcome':
        return <WelcomeScreen />;
      case 'catalog':
        return <DatabaseTestScreen />;
      case 'roles':
        return (
          <RoleAccessScreen
            currentSession={currentSession}
            onSwitchRole={handleSwitchRole}
          />
        );
      default:
        return <LoginScreen />;
    }
  };

  const tabs = [
    { id: 'login', label: 'Login', icon: '🔐' },
    { id: 'welcome', label: 'Accueil', icon: '🏠' },
    { id: 'catalog', label: 'Catalogue', icon: '📋' },
    { id: 'roles', label: 'Session/Rôles', icon: '👤' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenContainer}>
        {renderCurrentScreen()}
      </View>

      {/* Barre de navigation basse pour Expo Go */}
      <View style={styles.navBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={styles.navIcon}>{tab.icon}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#DBE1DC',
    paddingVertical: 8,
    paddingBottom: 16,
    justifyContent: 'space-around',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  navItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#E7EFEA',
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '600',
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
