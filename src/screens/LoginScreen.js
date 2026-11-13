import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../styles/theme';

export default function LoginScreen({ onLoginSuccess, currentSession, onLogout }) {
  const [username, setUsername] = useState('demo_buyer');
  const [password, setPassword] = useState('••••••••');
  const [selectedRole, setSelectedRole] = useState('buyer');
  const [statusMessage, setStatusMessage] = useState('');

  const demoAccounts = [
    { role: 'buyer', label: 'Buyer (Acheteur)', user: 'demo_buyer', email: 'buyer@holmia.example' },
    { role: 'seller', label: 'Seller (Vendeur)', user: 'demo_seller', email: 'seller@holmia.example' },
    { role: 'agent', label: 'Agent (Immobilier)', user: 'demo_agent', email: 'agent@holmia.example' }
  ];

  const handleSelectDemo = (acc) => {
    setSelectedRole(acc.role);
    setUsername(acc.user);
    setPassword('Password123!');
    setStatusMessage('');
  };

  const handleLogin = () => {
    if (!username.trim()) {
      setStatusMessage('Erreur : Veuillez saisir un identifiant ou email.');
      return;
    }
    if (!password.trim()) {
      setStatusMessage('Erreur : Veuillez saisir un mot de passe.');
      return;
    }

    const sessionData = {
      username: username.trim(),
      role: selectedRole,
      loginTime: new Date().toLocaleTimeString('fr-FR')
    };

    setStatusMessage(`Connecté avec succès en tant que [${selectedRole.toUpperCase()}] !`);
    if (onLoginSuccess) {
      onLoginSuccess(sessionData);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.brand}>HOLMIA</Text>
          <Text style={styles.heading}>Connexion & Authentification</Text>
          <Text style={styles.subheading}>Livrable Week 2 · Première saisie utilisateur</Text>

          {/* Current Session status banner */}
          {currentSession ? (
            <View style={styles.sessionBanner}>
              <Text style={styles.sessionTitle}>Session Active :</Text>
              <Text style={styles.sessionText}>
                Utilisateur : <Text style={styles.bold}>{currentSession.username}</Text>
              </Text>
              <Text style={styles.sessionText}>
                Rôle : <Text style={styles.bold}>{currentSession.role.toUpperCase()}</Text>
              </Text>
              <Text style={styles.sessionText}>Heure : {currentSession.loginTime}</Text>
              <Pressable style={styles.logoutButton} onPress={onLogout}>
                <Text style={styles.logoutButtonText}>Se déconnecter</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Quick Demo Role Picker */}
          <Text style={styles.sectionLabel}>Sélection rapide des comptes de test :</Text>
          <View style={styles.rolePickerRow}>
            {demoAccounts.map((acc) => {
              const active = selectedRole === acc.role;
              return (
                <Pressable
                  key={acc.role}
                  style={[styles.roleBadge, active && styles.roleBadgeActive]}
                  onPress={() => handleSelectDemo(acc)}
                >
                  <Text style={[styles.roleBadgeText, active && styles.roleBadgeTextActive]}>
                    {acc.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Form Fields */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Identifiant ou Email</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: demo_buyer"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {statusMessage ? (
            <Text
              style={[
                styles.feedbackText,
                statusMessage.startsWith('Erreur') ? styles.errorText : styles.successText
              ]}
            >
              {statusMessage}
            </Text>
          ) : null}

          <Pressable style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Se connecter à HOLMIA</Text>
          </Pressable>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Règles de session par rôle (Tâche ABD) :</Text>
            <Text style={styles.infoCardItem}>• <Text style={styles.bold}>Buyer :</Text> Accès au catalogue, favoris, offres de prix.</Text>
            <Text style={styles.infoCardItem}>• <Text style={styles.bold}>Seller :</Text> Création d'annonces, gestion de ses propres biens.</Text>
            <Text style={styles.infoCardItem}>• <Text style={styles.bold}>Agent :</Text> Modération et suivi du portefeuille assigné.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 40,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 3,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 6,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    color: colors.secondary,
    marginBottom: 20,
  },
  sessionBanner: {
    backgroundColor: '#E7EFEA',
    borderColor: '#BDD2C6',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  sessionTitle: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 6,
  },
  sessionText: {
    color: colors.primary,
    fontSize: 14,
    marginBottom: 2,
  },
  bold: {
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 10,
    backgroundColor: '#D9534F',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 8,
  },
  rolePickerRow: {
    gap: 8,
    marginBottom: 18,
  },
  roleBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCD6D1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  roleBadgeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleBadgeText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  roleBadgeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCD6D1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 10,
    textAlign: 'center',
  },
  successText: {
    color: '#2E7D32',
  },
  errorText: {
    color: '#C62828',
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 12,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7E3',
    marginTop: 10,
    marginBottom: 40,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  infoCardItem: {
    fontSize: 13,
    color: colors.secondary,
    lineHeight: 20,
    marginBottom: 4,
  },
});

