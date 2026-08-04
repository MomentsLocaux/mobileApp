import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Clock3, History, Play, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import type { ProposalSession } from './proposal.types';

type Props = {
  sessions: ProposalSession[];
  activeSessionId: string | null;
  onResume: (sessionId: string) => void;
  onStartNew: () => void;
  onHistory: () => void;
};

export function ProposalSessionEntry({
  sessions,
  activeSessionId,
  onResume,
  onStartNew,
  onHistory,
}: Props) {
  const insets = useSafeAreaInsets();
  const activeSession = activeSessionId
    ? sessions.find((session) => session.id === activeSessionId && session.status === 'in_progress')
    : sessions.find((session) => session.status === 'in_progress');

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.iconHalo}>
        <Sparkles size={34} color={colors.brand.primary} />
      </View>
      <Text style={styles.eyebrow}>TES PROPOSITIONS</Text>
      <Text style={styles.title}>On reprend où tu veux</Text>
      <Text style={styles.subtitle}>
        Ta progression est sauvegardée automatiquement après chaque choix.
      </Text>

      {activeSession ? (
        <View style={styles.resumeCard}>
          <View style={styles.resumeHeader}>
            <View style={styles.resumeIcon}>
              <Clock3 size={20} color={colors.brand.secondary} />
            </View>
            <View style={styles.resumeCopy}>
              <Text style={styles.resumeEyebrow}>SESSION EN COURS</Text>
              <Text style={styles.resumeTitle}>{activeSession.preferences.anchor?.label || 'Ta sélection locale'}</Text>
            </View>
          </View>
          <Text style={styles.resumeMeta}>
            {activeSession.currentIndex} choix sur {activeSession.pool.length} · rayon {activeSession.preferences.radiusKm} km
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressValue,
                { width: `${Math.min(100, (activeSession.currentIndex / Math.max(1, activeSession.pool.length)) * 100)}%` },
              ]}
            />
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => onResume(activeSession.id)}
            accessibilityRole="button"
            accessibilityLabel={`Reprendre à la proposition ${activeSession.currentIndex + 1}`}
          >
            <Play size={19} color={colors.brand.primary} fill={colors.brand.primary} />
            <Text style={styles.primaryButtonText}>Reprendre</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        style={activeSession ? styles.secondaryButton : styles.primaryButtonStandalone}
        onPress={onStartNew}
        accessibilityRole="button"
      >
        <Sparkles size={19} color={activeSession ? colors.brand.text : colors.brand.primary} />
        <Text style={activeSession ? styles.secondaryButtonText : styles.primaryButtonText}>
          Nouvelle sélection
        </Text>
      </TouchableOpacity>

      {sessions.length > 0 ? (
        <TouchableOpacity
          style={styles.historyButton}
          onPress={onHistory}
          accessibilityRole="button"
          accessibilityLabel={`Voir l’historique de ${sessions.length} session${sessions.length > 1 ? 's' : ''}`}
        >
          <History size={20} color={colors.brand.secondary} />
          <Text style={styles.historyButtonText}>Voir mon historique</Text>
          <View style={styles.historyCount}>
            <Text style={styles.historyCountText}>{sessions.length}</Text>
          </View>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 120 },
  iconHalo: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.secondary, marginBottom: spacing.lg },
  eyebrow: { ...typography.label, fontSize: 11, letterSpacing: 1.3, color: colors.brand.secondary },
  title: { ...typography.h2, color: colors.brand.text, textAlign: 'center', marginTop: spacing.sm },
  subtitle: { ...typography.body, color: colors.brand.textSecondary, textAlign: 'center', marginTop: spacing.sm, maxWidth: 460 },
  resumeCard: { width: '100%', maxWidth: 520, marginTop: spacing.xl, padding: spacing.lg, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: '#365867', backgroundColor: colors.brand.surface },
  resumeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  resumeIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(43, 191, 227, 0.1)' },
  resumeCopy: { flex: 1 },
  resumeEyebrow: { ...typography.label, fontSize: 10, letterSpacing: 1, color: colors.brand.secondary },
  resumeTitle: { ...typography.h5, color: colors.brand.text, marginTop: 2 },
  resumeMeta: { ...typography.bodySmall, color: colors.brand.textSecondary, marginTop: spacing.md },
  progressTrack: { height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: '#334155', marginTop: spacing.sm },
  progressValue: { height: '100%', borderRadius: 3, backgroundColor: colors.brand.secondary },
  primaryButton: { minHeight: 52, marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.brand.secondary },
  primaryButtonStandalone: { minHeight: 54, width: '100%', maxWidth: 520, marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.brand.secondary },
  primaryButtonText: { ...typography.bodyBold, color: colors.brand.primary },
  secondaryButton: { minHeight: 52, width: '100%', maxWidth: 520, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: '#475569' },
  secondaryButtonText: { ...typography.label, color: colors.brand.text },
  historyButton: { minHeight: 58, width: '100%', maxWidth: 520, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderRadius: borderRadius.lg, backgroundColor: 'rgba(43, 191, 227, 0.08)' },
  historyButtonText: { ...typography.label, flex: 1, color: colors.brand.secondary },
  historyCount: { minWidth: 28, height: 28, paddingHorizontal: 6, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.secondary },
  historyCountText: { ...typography.label, color: colors.brand.primary },
});
