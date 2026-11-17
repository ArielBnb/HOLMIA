import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { colors } from '../styles/theme';

const statusConfig = {
  none:        { label: 'Création',    color: '#607D8B', bg: '#ECEFF1', icon: '🆕' },
  draft:       { label: 'Brouillon',   color: '#757575', bg: '#EEEEEE', icon: '📝' },
  active:      { label: 'Actif',       color: '#2E7D32', bg: '#E8F5E9', icon: '✅' },
  under_offer: { label: 'Sous offre',  color: '#E65100', bg: '#FFF3E0', icon: '🤝' },
  sold:        { label: 'Vendu',       color: '#1565C0', bg: '#E3F2FD', icon: '🏷️' },
  rented:      { label: 'Loué',        color: '#6A1B9A', bg: '#F3E5F5', icon: '🔑' },
};

// Valid transitions diagram
const transitionRules = [
  { from: 'draft',       to: 'active',      desc: 'Activation par vendeur ou agent' },
  { from: 'active',      to: 'draft',       desc: 'Retour en brouillon' },
  { from: 'active',      to: 'under_offer', desc: 'Offre acceptée' },
  { from: 'under_offer', to: 'active',      desc: 'Annulation de l\'offre' },
  { from: 'under_offer', to: 'sold',        desc: 'Vente finalisée (vente uniquement)' },
  { from: 'under_offer', to: 'rented',      desc: 'Location finalisée (location uniquement)' },
];

export default function PropertyLifecycleScreen({ currentSession }) {
  const [selectedPropertyIndex, setSelectedPropertyIndex] = useState(0);
  const [viewMode, setViewMode] = useState('timeline'); // timeline | rules

  // Demo properties with their lifecycle history
  const demoProperties = [
    {
      id: 'prop-1',
      title: 'Appartement Haussmannien Paris 8e',
      listing_type: 'sale',
      status: 'under_offer',
      history: [
        {
          id: 'h1',
          old_status: 'none',
          new_status: 'draft',
          changed_by: 'Marie Dupont (Seller)',
          notes: 'Property created',
          changed_at: '2026-11-10T10:00:00',
        },
        {
          id: 'h2',
          old_status: 'draft',
          new_status: 'active',
          changed_by: 'Agent Immobilier (Agent)',
          notes: 'Annonce validée et activée par l\'agent',
          changed_at: '2026-11-11T14:30:00',
        },
        {
          id: 'h3',
          old_status: 'active',
          new_status: 'under_offer',
          changed_by: 'Système',
          notes: 'Offre de 820 000 € acceptée',
          changed_at: '2026-11-16T09:15:00',
        },
      ],
    },
    {
      id: 'prop-2',
      title: 'Studio meublé Lyon 3e',
      listing_type: 'rent',
      status: 'rented',
      history: [
        {
          id: 'h4',
          old_status: 'none',
          new_status: 'draft',
          changed_by: 'Jean Martin (Seller)',
          notes: 'Property created',
          changed_at: '2026-10-20T08:00:00',
        },
        {
          id: 'h5',
          old_status: 'draft',
          new_status: 'active',
          changed_by: 'Jean Martin (Seller)',
          notes: 'Activated via session service',
          changed_at: '2026-10-21T10:00:00',
        },
        {
          id: 'h6',
          old_status: 'active',
          new_status: 'under_offer',
          changed_by: 'Système',
          notes: 'Candidature de location acceptée',
          changed_at: '2026-11-05T16:00:00',
        },
        {
          id: 'h7',
          old_status: 'under_offer',
          new_status: 'rented',
          changed_by: 'Agent Immobilier (Agent)',
          notes: 'Contrat de location signé',
          changed_at: '2026-11-10T09:30:00',
        },
      ],
    },
    {
      id: 'prop-3',
      title: 'Maison familiale Bordeaux',
      listing_type: 'sale',
      status: 'sold',
      history: [
        {
          id: 'h8',
          old_status: 'none',
          new_status: 'draft',
          changed_by: 'Marie Dupont (Seller)',
          notes: 'Property created',
          changed_at: '2026-10-15T11:30:00',
        },
        {
          id: 'h9',
          old_status: 'draft',
          new_status: 'active',
          changed_by: 'Agent Immobilier (Agent)',
          notes: 'Annonce validée après vérification du dossier',
          changed_at: '2026-10-16T15:00:00',
        },
        {
          id: 'h10',
          old_status: 'active',
          new_status: 'under_offer',
          changed_by: 'Système',
          notes: 'Offre de 415 000 € acceptée par le vendeur',
          changed_at: '2026-11-01T10:00:00',
        },
        {
          id: 'h11',
          old_status: 'under_offer',
          new_status: 'sold',
          changed_by: 'Agent Immobilier (Agent)',
          notes: 'Acte de vente signé chez le notaire',
          changed_at: '2026-11-14T10:00:00',
        },
      ],
    },
  ];

  const selectedProperty = demoProperties[selectedPropertyIndex];

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>HOLMIA</Text>
        <Text style={styles.heading}>Cycle de vie des biens</Text>
        <Text style={styles.subheading}>
          Historique des statuts · {currentSession?.username || 'demo_agent'}
        </Text>

        {/* View Mode Toggle */}
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, viewMode === 'timeline' && styles.toggleBtnActive]}
            onPress={() => setViewMode('timeline')}
          >
            <Text
              style={[
                styles.toggleBtnText,
                viewMode === 'timeline' && styles.toggleBtnTextActive,
              ]}
            >
              📊 Timeline
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, viewMode === 'rules' && styles.toggleBtnActive]}
            onPress={() => setViewMode('rules')}
          >
            <Text
              style={[
                styles.toggleBtnText,
                viewMode === 'rules' && styles.toggleBtnTextActive,
              ]}
            >
              📐 Règles
            </Text>
          </Pressable>
        </View>

        {viewMode === 'rules' ? (
          <>
            {/* Status Transition Rules */}
            <View style={styles.rulesCard}>
              <Text style={styles.rulesTitle}>Transitions de statut autorisées</Text>
              {transitionRules.map((rule, idx) => {
                const fromSt = statusConfig[rule.from];
                const toSt = statusConfig[rule.to];
                return (
                  <View key={idx} style={styles.ruleRow}>
                    <View style={[styles.ruleBadge, { backgroundColor: fromSt.bg }]}>
                      <Text style={{ color: fromSt.color, fontWeight: '700', fontSize: 12 }}>
                        {fromSt.icon} {fromSt.label}
                      </Text>
                    </View>
                    <Text style={styles.ruleArrow}>→</Text>
                    <View style={[styles.ruleBadge, { backgroundColor: toSt.bg }]}>
                      <Text style={{ color: toSt.color, fontWeight: '700', fontSize: 12 }}>
                        {toSt.icon} {toSt.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.constraintCard}>
              <Text style={styles.constraintTitle}>⚠️ Contraintes métier</Text>
              <Text style={styles.constraintItem}>
                • <Text style={styles.bold}>Sold</Text> et{' '}
                <Text style={styles.bold}>Rented</Text> sont des statuts terminaux
                (irréversibles)
              </Text>
              <Text style={styles.constraintItem}>
                • Un bien en <Text style={styles.bold}>Vente</Text> ne peut pas passer à{' '}
                <Text style={styles.bold}>Loué</Text>
              </Text>
              <Text style={styles.constraintItem}>
                • Un bien en <Text style={styles.bold}>Location</Text> ne peut pas passer à{' '}
                <Text style={styles.bold}>Vendu</Text>
              </Text>
              <Text style={styles.constraintItem}>
                • Le prix et le type sont{' '}
                <Text style={styles.bold}>verrouillés après Under Offer</Text>
              </Text>
            </View>

            {/* Visual State Diagram */}
            <View style={styles.diagramCard}>
              <Text style={styles.diagramTitle}>📊 Diagramme d'états</Text>
              <View style={styles.diagram}>
                {/* Row 1: Draft -> Active */}
                <View style={styles.diagramRow}>
                  <View style={[styles.diagramNode, { backgroundColor: statusConfig.draft.bg }]}>
                    <Text style={{ color: statusConfig.draft.color, fontWeight: '700' }}>
                      {statusConfig.draft.icon} Brouillon
                    </Text>
                  </View>
                  <Text style={styles.diagramArrow}>⇄</Text>
                  <View style={[styles.diagramNode, { backgroundColor: statusConfig.active.bg }]}>
                    <Text style={{ color: statusConfig.active.color, fontWeight: '700' }}>
                      {statusConfig.active.icon} Actif
                    </Text>
                  </View>
                </View>

                <Text style={styles.diagramDown}>↓</Text>

                {/* Row 2: Under Offer */}
                <View style={styles.diagramRow}>
                  <View style={[styles.diagramNode, { backgroundColor: statusConfig.under_offer.bg }]}>
                    <Text style={{ color: statusConfig.under_offer.color, fontWeight: '700' }}>
                      {statusConfig.under_offer.icon} Sous offre
                    </Text>
                  </View>
                </View>

                <View style={styles.diagramSplit}>
                  <Text style={styles.diagramDown}>↙️</Text>
                  <Text style={styles.diagramDown}>↘️</Text>
                </View>

                {/* Row 3: Sold / Rented */}
                <View style={styles.diagramRow}>
                  <View style={[styles.diagramNode, { backgroundColor: statusConfig.sold.bg }]}>
                    <Text style={{ color: statusConfig.sold.color, fontWeight: '700' }}>
                      {statusConfig.sold.icon} Vendu
                    </Text>
                  </View>
                  <View style={[styles.diagramNode, { backgroundColor: statusConfig.rented.bg }]}>
                    <Text style={{ color: statusConfig.rented.color, fontWeight: '700' }}>
                      {statusConfig.rented.icon} Loué
                    </Text>
                  </View>
                </View>

                <View style={styles.diagramRow}>
                  <View style={styles.terminalBadge}>
                    <Text style={styles.terminalText}>🔒 Terminal</Text>
                  </View>
                  <View style={styles.terminalBadge}>
                    <Text style={styles.terminalText}>🔒 Terminal</Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Property Selector */}
            <Text style={styles.sectionLabel}>Sélectionner un bien :</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.propertyScroll}
              contentContainerStyle={styles.propertyScrollContent}
            >
              {demoProperties.map((prop, idx) => {
                const st = statusConfig[prop.status];
                const isSelected = idx === selectedPropertyIndex;
                return (
                  <Pressable
                    key={prop.id}
                    style={[styles.propertySelectorCard, isSelected && styles.propertySelectorActive]}
                    onPress={() => setSelectedPropertyIndex(idx)}
                  >
                    <Text style={styles.propertySelectorTitle} numberOfLines={1}>
                      {prop.title}
                    </Text>
                    <View style={[styles.miniStatusBadge, { backgroundColor: st.bg }]}>
                      <Text style={{ color: st.color, fontSize: 11, fontWeight: '700' }}>
                        {st.icon} {st.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Timeline */}
            <View style={styles.timelineCard}>
              <Text style={styles.timelineTitle}>{selectedProperty.title}</Text>
              <Text style={styles.timelineSubtitle}>
                {selectedProperty.listing_type === 'sale' ? 'Vente' : 'Location'} · Statut actuel :{' '}
                {statusConfig[selectedProperty.status].icon}{' '}
                {statusConfig[selectedProperty.status].label}
              </Text>

              <View style={styles.timeline}>
                {selectedProperty.history.map((entry, idx) => {
                  const isLast = idx === selectedProperty.history.length - 1;
                  const newSt = statusConfig[entry.new_status] || statusConfig.draft;

                  return (
                    <View key={entry.id} style={styles.timelineItem}>
                      {/* Connector Line */}
                      <View style={styles.timelineConnector}>
                        <View style={[styles.timelineDot, { backgroundColor: newSt.color }]} />
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>

                      {/* Entry Content */}
                      <View style={styles.timelineContent}>
                        <View style={styles.timelineHeader}>
                          <View style={[styles.timelineStatusBadge, { backgroundColor: newSt.bg }]}>
                            <Text style={{ color: newSt.color, fontWeight: '700', fontSize: 13 }}>
                              {newSt.icon} {newSt.label}
                            </Text>
                          </View>
                          <Text style={styles.timelineDate}>
                            {formatDate(entry.changed_at)}
                          </Text>
                        </View>

                        {entry.old_status !== 'none' && (
                          <Text style={styles.timelineTransition}>
                            {statusConfig[entry.old_status]?.icon}{' '}
                            {statusConfig[entry.old_status]?.label} →{' '}
                            {newSt.icon} {newSt.label}
                          </Text>
                        )}

                        <Text style={styles.timelineNotes}>{entry.notes}</Text>
                        <Text style={styles.timelineActor}>Par : {entry.changed_by}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>📋 Fonctionnalité — Semaine 3</Text>
          <Text style={styles.infoCardItem}>
            • Historique complet des transitions via{' '}
            <Text style={styles.bold}>propertyRepo.getStatusHistory()</Text>
          </Text>
          <Text style={styles.infoCardItem}>
            • Timeline visuelle avec dates, acteurs et notes
          </Text>
          <Text style={styles.infoCardItem}>
            • Diagramme d'états avec transitions autorisées
          </Text>
          <Text style={styles.infoCardItem}>
            • Contraintes métier : statuts terminaux, verrouillage de champs
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 60,
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
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCD6D1',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleBtnText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 10,
  },
  propertyScroll: {
    marginBottom: 16,
  },
  propertyScrollContent: {
    gap: 10,
    paddingRight: 8,
  },
  propertySelectorCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCD6D1',
    borderRadius: 12,
    padding: 12,
    width: 180,
  },
  propertySelectorActive: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: '#E7EFEA',
  },
  propertySelectorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6,
  },
  miniStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  // Rules View
  rulesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7E3',
    marginBottom: 16,
  },
  rulesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 12,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  ruleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  ruleArrow: {
    fontSize: 18,
    color: colors.secondary,
  },
  constraintCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE082',
    marginBottom: 16,
  },
  constraintTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 10,
  },
  constraintItem: {
    fontSize: 13,
    color: '#5D4037',
    lineHeight: 20,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
  },
  // State Diagram
  diagramCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7E3',
    marginBottom: 16,
  },
  diagramTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  diagram: {
    alignItems: 'center',
  },
  diagramRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 4,
  },
  diagramNode: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  diagramArrow: {
    fontSize: 20,
    color: colors.secondary,
    alignSelf: 'center',
  },
  diagramDown: {
    fontSize: 24,
    color: colors.secondary,
    textAlign: 'center',
    marginVertical: 2,
  },
  diagramSplit: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 80,
  },
  terminalBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  terminalText: {
    fontSize: 11,
    color: '#C62828',
    fontWeight: '700',
  },
  // Timeline
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7E3',
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  timelineSubtitle: {
    fontSize: 13,
    color: colors.secondary,
    marginBottom: 16,
  },
  timeline: {
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineConnector: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#CCD6D1',
    marginTop: 2,
    marginBottom: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 20,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  timelineDate: {
    fontSize: 11,
    color: '#999',
  },
  timelineTransition: {
    fontSize: 12,
    color: colors.secondary,
    marginBottom: 4,
  },
  timelineNotes: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 2,
  },
  timelineActor: {
    fontSize: 12,
    color: colors.secondary,
    fontStyle: 'italic',
  },
  // Info Card
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

