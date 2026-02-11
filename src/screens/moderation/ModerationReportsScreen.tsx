import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { ArrowLeft, X, Flag } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { ModerationService } from '@/services/moderation.service';
import { getReportReasonMeta } from '@/constants/report-reasons';
import type { ReportRecord } from '@/types/moderation';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/hooks';
import { supabase } from '@/lib/supabase/client';

export default function ModerationReportsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jwtRole, setJwtRole] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const role = (sessionData.session?.user?.app_metadata as any)?.role;
      setJwtRole(typeof role === 'string' ? role : null);
      const data = await ModerationService.listReports({ limit: 50 });
      setReports(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const updateStatus = async (reportId: string, status: 'new' | 'in_review' | 'closed' | 'escalated') => {
    if (!profile?.id) {
      Alert.alert('Erreur', 'Session modérateur introuvable.');
      return;
    }
    await ModerationService.updateReportStatus({
      reportId,
      status,
      moderatorId: profile.id,
    });
    await loadReports();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/moderation')}>
          <ArrowLeft size={18} color={colors.neutral[700]} />
          <Text style={styles.headerButtonText}>Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Signalements</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
          <X size={18} color={colors.neutral[700]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadReports} />}
      >
        <View style={styles.debugCard}>
          <Text style={styles.debugText}>Role profil: {profile?.role || 'n/a'}</Text>
          <Text style={styles.debugText}>Role JWT: {jwtRole || 'n/a'}</Text>
          {loadError ? <Text style={styles.debugError}>Erreur: {loadError}</Text> : null}
          {!!profile?.role && !!jwtRole && profile.role !== (jwtRole as any) ? (
            <Text style={styles.debugWarn}>Incohérence: le rôle JWT diffère du rôle profil (RLS peut bloquer).</Text>
          ) : null}
        </View>
        {loading && <Text style={styles.metaText}>Chargement…</Text>}
        {!loading && reports.length === 0 && <Text style={styles.metaText}>Aucun signalement.</Text>}
        {reports.map((report) => (
          <Card key={report.id} padding="md" style={styles.card}>
            <View style={styles.cardHeader}>
              <Flag size={16} color={colors.warning[700]} />
              <Text style={styles.cardTitle}>{report.target_type}</Text>
            </View>
            <Text style={styles.cardMeta}>Sévérité: {getReportReasonMeta(report.reason).severity}</Text>
            <Text style={styles.cardMeta}>Statut: {report.status}</Text>
            <Text style={styles.cardBody}>{getReportReasonMeta(report.reason).label}</Text>
            <View style={styles.actionRow}>
              <Button title="En revue" onPress={() => updateStatus(report.id, 'in_review')} fullWidth />
              <Button title="Clôturer" variant="outline" onPress={() => updateStatus(report.id, 'closed')} fullWidth />
              <Button title="Escalader" variant="ghost" onPress={() => updateStatus(report.id, 'escalated')} fullWidth />
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerButtonText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  cardMeta: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  cardBody: {
    ...typography.bodySmall,
    color: colors.neutral[800],
  },
  actionRow: {
    gap: spacing.sm,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  debugCard: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
    gap: spacing.xs,
  },
  debugText: {
    ...typography.caption,
    color: colors.neutral[700],
  },
  debugError: {
    ...typography.caption,
    color: colors.error[700],
  },
  debugWarn: {
    ...typography.caption,
    color: colors.warning[700],
    fontWeight: '600',
  },
});
