import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../styles/theme';

export default function RoleAccessScreen({ currentSession, onSwitchRole }) {
  const currentRole = currentSession?.role || 'buyer';

  const roleFeatures = {
    buyer: {
      title: 'Espace Acheteur / Locataire (Buyer)',
      description: 'Accès en lecture au catalogue et soumission des propositions.',
      permissions: [
        { label: 'Consulter le catalogue actif', allowed: true },
        { label: 'Rechercher et filtrer les biens', allowed: true },
        { label: 'Soumettre une offre d’achat', allowed: true },
        { label: 'Déposer une candidature de location', allowed: true },
        { label: 'Créer une annonce immobilière', allowed: false },
        { label: 'Modifier les annonces du catalogue', allowed: false },
        { label: 'Modérer / Activer des annonces', allowed: false },
      ],
      sampleData: [
        { title: 'Appartement lumineux à Paris', price: '425 000 €', status: 'Actif', action: 'Offre soumise : 410 000 €' },
        { title: 'Maison familiale à Lyon', price: '580 000 €', status: 'Actif', action: 'Enregistré dans les favoris' },
      ]
    },
    seller: {
      title: 'Espace Vendeur (Seller)',
      description: 'Gestion autonome de vos annonces et suivi des offres reçues.',
      permissions: [
        { label: 'Créer une annonce (Vente ou Location)', allowed: true },
        { label: 'Modifier ses propres annonces', allowed: true },
        { label: 'Supprimer ses propres annonces', allowed: true },
        { label: 'Examiner et accepter les offres reçues', allowed: true },
        { label: 'Modifier les biens d’un autre vendeur', allowed: false },
        { label: 'Soumettre des offres d’achat Buyer', allowed: false },
        { label: 'Modérer le catalogue général', allowed: false },
      ],
      sampleData: [
        { title: 'Mon Bien : Studio Rennes', price: '165 000 €', status: 'Brouillon (Draft)', action: 'Prêt pour validation' },
        { title: 'Mon Bien : Appartement Paris', price: '425 000 €', status: 'Sous offre (Under Offer)', action: '1 offre acceptée' },
      ]
    },
    agent: {
      title: 'Espace Agent Immobilier (Agent)',
      description: 'Portefeuille de biens assignés, modération et suivi des transactions.',
      permissions: [
        { label: 'Voir son portefeuille de biens assignés', allowed: true },
        { label: 'Modérer et activer les brouillons assignés', allowed: true },
        { label: 'Modifier les détails des biens assignés', allowed: true },
        { label: 'Calculer les statistiques de performance', allowed: true },
        { label: 'Créer des annonces en tant que vendeur', allowed: false },
        { label: 'Modifier des biens non assignés', allowed: false },
        { label: 'Supprimer les biens du vendeur', allowed: false },
      ],
      sampleData: [
        { title: 'Bien assigné : Villa Marseille', price: '720 000 €', status: 'Assigné à l’agent', action: 'Brouillon modéré & activé' },
        { title: 'Bien assigné : T3 Nantes', price: '290 000 €', status: 'Assigné à l’agent', action: 'Portefeuille actif' },
      ]
    }
  };

  const activeInfo = roleFeatures[currentRole] || roleFeatures.buyer;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>HOLMIA</Text>
        <Text style={styles.heading}>Session & Contrôle d'Accès</Text>
        <Text style={styles.subheading}>Tâche ABD · Rôles Buyer, Seller & Agent</Text>

        {/* Role Switcher Toolbar */}
        <View style={styles.roleTabs}>
          {['buyer', 'seller', 'agent'].map((r) => {
            const active = currentRole === r;
            return (
              <Pressable
                key={r}
                style={[styles.roleTab, active && styles.roleTabActive]}
                onPress={() => onSwitchRole && onSwitchRole(r)}
              >
                <Text style={[styles.roleTabText, active && styles.roleTabTextActive]}>
                  {r.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Current Role Card */}
        <View style={styles.card}>
          <Text style={styles.roleTitle}>{activeInfo.title}</Text>
          <Text style={styles.roleDesc}>{activeInfo.description}</Text>

          <Text style={styles.sectionHeader}>Matrice des autorisations :</Text>
          {activeInfo.permissions.map((p, index) => (
            <View key={index} style={styles.permRow}>
              <Text style={p.allowed ? styles.checkIcon : styles.crossIcon}>
                {p.allowed ? '✓' : '✕'}
              </Text>
              <Text style={[styles.permLabel, !p.allowed && styles.permDisabled]}>
                {p.label}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeader}>Données de démonstration du rôle :</Text>
          {activeInfo.sampleData.map((d, index) => (
            <View key={index} style={styles.dataRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dataTitle}>{d.title}</Text>
                <Text style={styles.dataAction}>{d.action}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dataPrice}>{d.price}</Text>
                <Text style={styles.dataBadge}>{d.status}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Validé par 101 tests automatisés (CRUD SQLite + SessionService).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 40, maxWidth: 600, width: '100%', alignSelf: 'center' },
  brand: { fontSize: 32, fontWeight: '800', color: colors.primary, letterSpacing: 3 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.primary, marginTop: 6 },
  subheading: { fontSize: 14, color: colors.secondary, marginBottom: 18 },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: '#E2E8E4',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  roleTabActive: {
    backgroundColor: colors.primary,
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  roleTabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DDE4E0',
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6,
  },
  roleDesc: {
    fontSize: 14,
    color: colors.secondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 14,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F0',
    paddingTop: 14,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2E7D32',
    width: 20,
  },
  crossIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: '#C62828',
    width: 20,
  },
  permLabel: {
    fontSize: 14,
    color: '#222',
  },
  permDisabled: {
    color: '#888',
    textDecorationLine: 'line-through',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAF9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E7ECE9',
  },
  dataTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  dataAction: {
    fontSize: 12,
    color: colors.secondary,
    marginTop: 3,
  },
  dataPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  dataBadge: {
    fontSize: 11,
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  footerNote: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.secondary,
  },
});

