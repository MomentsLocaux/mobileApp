import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { ArrowLeft, X, Flag } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { ModerationService } from '@/services/moderation.service';
import { getReportReasonMeta } from '@/constants/report-reasons';
import type { ModerationReportTargetPreview, ReportRecordWithTarget, ReportStatus } from '@/types/moderation';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/hooks';
import { supabase } from '@/lib/supabase/client';

export default function ModerationReportsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportRecordWithTarget[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jwtRole, setJwtRole] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'to_review' | ReportStatus | 'all'>('to_review');
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const role = (sessionData.session?.user?.app_metadata as any)?.role;
      setJwtRole(typeof role === 'string' ? role : null);
      const data = await ModerationService.listReportsWithTargets({
        limit: 80,
        ...(statusFilter === 'to_review' ? { excludeClosed: true } : {}),
        ...(statusFilter !== 'to_review' && statusFilter !== 'all' ? { status: statusFilter } : {}),
      });
      setReports(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const updateStatus = async (reportId: string, status: 'new' | 'in_review' | 'closed' | 'escalated') => {
    if (!profile?.id) {
      Alert.alert('Erreur', 'Session modérateur introuvable.');
      return;
    }
    setUpdatingReportId(reportId);
    try {
      await ModerationService.updateReportStatus({
        reportId,
        status,
        moderatorId: profile.id,
      });
      await loadReports();
      Alert.alert('Mise à jour effectuée', `Le signalement est passé au statut "${status}".`);
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de mettre à jour le signalement.');
    } finally {
      setUpdatingReportId(null);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('fr-FR');
  };
  const formatDateTime = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canOpenTarget = (target?: ModerationReportTargetPreview | null) => {
    if (!target) return false;
    if (target.type === 'event') return true;
    if (target.type === 'comment') return !!target.event_id;
    if (target.type === 'media') return !!target.event_id;
    if (target.type === 'user') return true;
    if (target.type === 'contest_entry' || target.type === 'challenge') return true;
    return false;
  };

  const openTarget = (target?: ModerationReportTargetPreview | null) => {
    if (!target) return;
    if (target.type === 'event') {
      router.push(`/events/${target.id}` as any);
      return;
    }
    if (target.type === 'comment' && target.event_id) {
      router.push(`/events/${target.event_id}` as any);
      return;
    }
    if (target.type === 'media' && target.event_id) {
      router.push(`/events/${target.event_id}` as any);
      return;
    }
    if (target.type === 'user') {
      router.push('/moderation/users' as any);
      return;
    }
    if (target.type === 'contest_entry' || target.type === 'challenge') {
      router.push('/moderation/contests' as any);
    }
  };

  const renderTargetPreview = (target?: ModerationReportTargetPreview | null) => {
    if (!target || target.type === 'unknown') {
      return (
        <View style={styles.targetCard}>
          <Text style={styles.targetTitle}>Détail indisponible</Text>
          <Text style={styles.targetMeta}>Aucune donnée liée trouvée pour cette cible.</Text>
        </View>
      );
    }

    if (target.type === 'event') {
      return (
        <View style={styles.targetCard}>
          <Text style={styles.targetTitle}>{target.title || 'Événement sans titre'}</Text>
          <Text style={styles.targetMeta}>
            {target.city || 'Ville inconnue'}
            {target.status ? ` · ${target.status}` : ''}
          </Text>
          {target.creator_name ? <Text style={styles.targetMeta}>Créateur: {target.creator_name}</Text> : null}
        </View>
      );
    }

    if (target.type === 'comment') {
      return (
        <View style={styles.targetCard}>
          <Text style={styles.targetTitle}>Commentaire signalé</Text>
          <Text style={styles.targetBody}>{target.message || 'Commentaire vide'}</Text>
          <Text style={styles.targetMeta}>
            {target.author_name ? `Par ${target.author_name}` : 'Auteur inconnu'}
            {target.event_title ? ` · ${target.event_title}` : ''}
          </Text>
        </View>
      );
    }

    if (target.type === 'user') {
      return (
        <View style={styles.targetCard}>
          <Text style={styles.targetTitle}>{target.display_name || 'Utilisateur inconnu'}</Text>
          <Text style={styles.targetMeta}>
            {target.role || 'rôle inconnu'}
            {target.status ? ` · ${target.status}` : ''}
          </Text>
          {target.ban_until ? <Text style={styles.targetMeta}>Banni jusqu’au {formatDate(target.ban_until)}</Text> : null}
        </View>
      );
    }

    if (target.type === 'media') {
      return (
        <View style={styles.targetCard}>
          <Text style={styles.targetTitle}>Média communautaire</Text>
          <Text style={styles.targetMeta}>
            {target.event_title ? `Événement: ${target.event_title}` : 'Événement inconnu'}
            {target.status ? ` · ${target.status}` : ''}
          </Text>
          {target.author_name ? <Text style={styles.targetMeta}>Auteur: {target.author_name}</Text> : null}
          {target.url ? <Text style={styles.targetBody} numberOfLines={1}>{target.url}</Text> : null}
        </View>
      );
    }

    return (
      <View style={styles.targetCard}>
        <Text style={styles.targetTitle}>
          {target.type === 'challenge' ? 'Participation challenge' : 'Participation concours'}
        </Text>
        {target.contest_title ? <Text style={styles.targetMeta}>Concours: {target.contest_title}</Text> : null}
        {target.author_name ? <Text style={styles.targetMeta}>Auteur: {target.author_name}</Text> : null}
        {target.status ? <Text style={styles.targetMeta}>Statut: {target.status}</Text> : null}
        {target.content ? <Text style={styles.targetBody}>{target.content}</Text> : null}
      </View>
    );
  };

  const statusFilterOptions: Array<{ key: 'to_review' | ReportStatus | 'all'; label: string }> = [
    { key: 'to_review', label: 'À traiter' },
    { key: 'new', label: 'Nouveaux' },
    { key: 'in_review', label: 'En revue' },
    { key: 'escalated', label: 'Escaladés' },
    { key: 'closed', label: 'Clôturés' },
    { key: 'all', label: 'Tous' },
  ];

  const visibleReports = useMemo(() => {
    if (statusFilter === 'to_review') return reports.filter((report) => report.status !== 'closed');
    if (statusFilter === 'all') return reports;
    return reports.filter((report) => report.status === statusFilter);
  }, [reports, statusFilter]);

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {statusFilterOptions.map((option) => {
            const selected = option.key === statusFilter;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.filterChip, selected && styles.filterChipActive]}
                onPress={() => setStatusFilter(option.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {loading && <Text style={styles.metaText}>Chargement…</Text>}
        {!loading && visibleReports.length === 0 && (
          <Text style={styles.metaText}>
            {statusFilter === 'closed'
              ? 'Aucun signalement clôturé.'
              : "Aucun signalement correspondant au filtre."}
          </Text>
        )}
        {visibleReports.map((report) => (
          <Card key={report.id} padding="md" style={styles.card}>
            <View style={styles.cardHeader}>
              <Flag size={16} color={colors.warning[700]} />
              <Text style={styles.cardTitle}>{report.target_type}</Text>
            </View>
            <Text style={styles.cardMeta}>
              Signalé par: {report.reporter?.display_name || report.reporter_id}
            </Text>
            <Text style={styles.cardMeta}>Sévérité: {getReportReasonMeta(report.reason).severity}</Text>
            <Text style={styles.cardMeta}>Statut: {report.status}</Text>
            {report.reviewed_at ? (
              <Text style={styles.cardMeta}>
                Revu par {report.reviewer?.display_name || report.reviewed_by || 'modérateur'} le {formatDateTime(report.reviewed_at)}
              </Text>
            ) : null}
            <Text style={styles.cardBody}>{getReportReasonMeta(report.reason).label}</Text>
            {renderTargetPreview(report.target_preview)}
            {canOpenTarget(report.target_preview) ? (
              <TouchableOpacity
                style={styles.openTargetButton}
                onPress={() => openTarget(report.target_preview)}
              >
                <Text style={styles.openTargetButtonText}>Ouvrir l'élément</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.actionRow}>
              <Button
                title="En revue"
                onPress={() => updateStatus(report.id, 'in_review')}
                disabled={updatingReportId === report.id}
                fullWidth
              />
              <Button
                title="Clôturer"
                variant="outline"
                onPress={() => updateStatus(report.id, 'closed')}
                disabled={updatingReportId === report.id}
                fullWidth
              />
              <Button
                title="Escalader"
                variant="ghost"
                onPress={() => updateStatus(report.id, 'escalated')}
                disabled={updatingReportId === report.id}
                fullWidth
              />
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
  filterRow: {
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
  },
  filterChipActive: {
    backgroundColor: colors.info[50],
    borderColor: colors.info[300],
  },
  filterChipText: {
    ...typography.caption,
    color: colors.neutral[600],
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.info[700],
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
  targetCard: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  targetTitle: {
    ...typography.bodySmall,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  targetMeta: {
    ...typography.caption,
    color: colors.neutral[600],
  },
  targetBody: {
    ...typography.bodySmall,
    color: colors.neutral[800],
  },
  openTargetButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.info[300],
    backgroundColor: colors.info[50],
  },
  openTargetButtonText: {
    ...typography.bodySmall,
    color: colors.info[700],
    fontWeight: '600',
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
