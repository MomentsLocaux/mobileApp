import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {
  Menu,
  AlertTriangle,
  Flag,
  ShieldAlert,
  User,
  X,
  CalendarCheck2,
  MessageSquare,
  Users,
  CheckCircle2,
  Ban,
} from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks';
import { useRouter } from 'expo-router';
import { ModerationService } from '@/services/moderation.service';

type ReportSeverity = 'minor' | 'harmful' | 'abusive' | 'illegal';
type ReportStatus = 'new' | 'in_review' | 'closed';
type ReportTargetType = 'event' | 'comment' | 'user';

type Report = {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string | null;
  severity: ReportSeverity;
  status: ReportStatus;
  created_at: string;
  reporter: Profile | null;
};

type Warning = {
  id: string;
  user_id: string;
  level: number;
  reason: string | null;
  created_at: string;
  user: Profile | null;
};

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: 'moderateur' | 'admin' | 'createur' | 'particulier';
};

type EventRecord = {
  id: string;
  title: string;
  city: string | null;
  starts_at: string | null;
  status: string;
  reports_count: number;
};

type DashboardStats = {
  pendingEvents: number;
  newReports: number;
  flaggedUsers: number;
  rejectedEvents: number;
  resolvedActions: number;
  bannedUsers: number;
};

const formatDate = (value: string | null) => {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date);
};

const formatRelative = (value: string) => {
  const delta = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.floor(delta / 36e5));
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${Math.floor(hours / 24)}j`;
};

const severityColor = (severity: ReportSeverity) => {
  if (severity === 'minor') return colors.info[100];
  if (severity === 'harmful') return colors.warning[100];
  if (severity === 'abusive') return colors.error[100];
  return colors.error[200];
};

const severityTextColor = (severity: ReportSeverity) => {
  if (severity === 'minor') return colors.info[700];
  if (severity === 'harmful') return colors.warning[700];
  return colors.error[700];
};

const targetIcon = (target: ReportTargetType) => {
  if (target === 'event') return <CalendarCheck2 size={16} color={colors.info[700]} />;
  if (target === 'comment') return <MessageSquare size={16} color={colors.warning[700]} />;
  return <Users size={16} color={colors.error[700]} />;
};

const KpiCard = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.kpiCard}>
    <Text style={styles.kpiValue}>{value}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </View>
);

const EventModerationRow = ({
  event,
  onReview,
  onReject,
}: {
  event: EventRecord;
  onReview: () => void;
  onReject: () => void;
}) => (
  <View style={styles.eventCard}>
    <View style={styles.eventInfo}>
      <Text style={styles.eventTitle}>{event.title}</Text>
      <Text style={styles.eventMeta}>
        {event.city || 'Ville inconnue'} · {formatDate(event.starts_at)}
      </Text>
      <View style={styles.eventReport}>
        <Flag size={14} color={colors.warning[600]} />
        <Text style={styles.eventReportText}>{event.reports_count} signalements</Text>
      </View>
    </View>
    <View style={styles.eventActions}>
      <TouchableOpacity style={styles.eventButtonPrimary} onPress={onReview}>
        <Text style={styles.eventButtonPrimaryText}>Examiner</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.eventButtonGhost} onPress={onReject}>
        <Text style={styles.eventButtonGhostText}>Rejeter</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const ReportItem = ({ report }: { report: Report }) => (
  <View style={styles.reportItem}>
    <View style={styles.reportAvatarWrap}>
      {report.reporter?.avatar_url ? (
        <Image source={{ uri: report.reporter.avatar_url }} style={styles.reportAvatar} />
      ) : (
        <View style={styles.reportAvatarPlaceholder}>
          <User size={16} color={colors.neutral[500]} />
        </View>
      )}
    </View>
    <View style={styles.reportContent}>
      <Text style={styles.reportReason}>{report.reason || 'Signalement sans motif'}</Text>
      <View style={styles.reportMeta}>
        <View style={[styles.reportBadge, { backgroundColor: severityColor(report.severity) }]}>
          <Text style={[styles.reportBadgeText, { color: severityTextColor(report.severity) }]}>
            {report.severity}
          </Text>
        </View>
        <Text style={styles.reportTime}>{formatRelative(report.created_at)}</Text>
      </View>
    </View>
    <View style={styles.reportTarget}>{targetIcon(report.target_type)}</View>
  </View>
);

const UserRiskRow = ({ profile, warning }: { profile: Profile; warning: Warning }) => (
  <View style={styles.userRow}>
    <View style={styles.userInfo}>
      {profile.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={styles.userAvatar} />
      ) : (
        <View style={styles.userAvatarPlaceholder}>
          <User size={16} color={colors.neutral[500]} />
        </View>
      )}
      <View>
        <Text style={styles.userName}>{profile.display_name}</Text>
        <View style={styles.userBadges}>
          <View style={styles.userWarningBadge}>
            <AlertTriangle size={12} color={colors.warning[700]} />
            <Text style={styles.userWarningText}>Niveau {warning.level}</Text>
          </View>
          <View style={styles.userStatusBadge}>
            <Text style={styles.userStatusText}>Récidiviste</Text>
          </View>
        </View>
      </View>
    </View>
    <View style={styles.userActions}>
      <TouchableOpacity style={styles.userActionOutline}>
        <Text style={styles.userActionOutlineText}>Voir profil</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.userActionDanger}>
        <Text style={styles.userActionDangerText}>Bloquer</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const DonutChart = ({ data }: { data: Array<{ label: string; value: number; color: string }> }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <View style={styles.donutCard}>
      <View style={styles.donutRing}>
        <View style={styles.donutCenter}>
          <Text style={styles.donutTotal}>{total}</Text>
          <Text style={styles.donutSubtitle}>Signalements</Text>
        </View>
      </View>
      <View style={styles.donutLegend}>
        {data.map((item) => (
          <View key={item.label} style={styles.donutLegendRow}>
            <View style={[styles.donutDot, { backgroundColor: item.color }]} />
            <Text style={styles.donutLegendLabel}>{item.label}</Text>
            <Text style={styles.donutLegendValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const BarChart = ({ data }: { data: Array<{ label: string; value: number; color: string }> }) => (
  <View style={styles.barCard}>
    {data.map((item) => (
      <View key={item.label} style={styles.barRow}>
        <Text style={styles.barLabel}>{item.label}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.min(100, item.value)}%`, backgroundColor: item.color }]} />
        </View>
        <Text style={styles.barValue}>{item.value}</Text>
      </View>
    ))}
  </View>
);

export default function ModerationScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    pendingEvents: 0,
    newReports: 0,
    flaggedUsers: 0,
    rejectedEvents: 0,
    resolvedActions: 0,
    bannedUsers: 0,
  });

  const loadDashboard = async () => {
      setLoading(true);
      try {
        const [
          eventsRes,
          reportsRes,
          warningsRes,
          reportCountsRes,
          userReportsRes,
          reportsCountRes,
          actionsRejectedRes,
          actionsResolvedRes,
          actionsBanRes,
        ] = await Promise.all([
          supabase
            .from('events')
            .select('id, title, city, starts_at, status')
            .neq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('reports')
            .select('id, target_type, target_id, reason, severity, status, created_at, reporter:profiles!reports_reporter_id_fkey(id, display_name, avatar_url, role)')
            .eq('status', 'new')
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('warnings')
            .select('id, user_id, level, reason, created_at, user:profiles!warnings_user_id_fkey(id, display_name, avatar_url, role)')
            .order('created_at', { ascending: false })
            .limit(6),
          supabase
            .from('reports')
            .select('target_id, target_type')
            .eq('target_type', 'event')
            .eq('status', 'new'),
          supabase
            .from('reports')
            .select('target_id')
            .eq('target_type', 'user')
            .eq('status', 'new'),
          supabase
            .from('reports')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'new'),
          supabase
            .from('moderation_actions')
            .select('id', { count: 'exact', head: true })
            .eq('target_type', 'event')
            .eq('action_type', 'refuse'),
          supabase
            .from('moderation_actions')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('moderation_actions')
            .select('id', { count: 'exact', head: true })
            .eq('action_type', 'ban'),
        ]);

        if (eventsRes.error) throw eventsRes.error;
        if (reportsRes.error) throw reportsRes.error;
        if (warningsRes.error) throw warningsRes.error;
        if (reportCountsRes.error) throw reportCountsRes.error;
        if (userReportsRes.error) throw userReportsRes.error;
        if (reportsCountRes.error) throw reportsCountRes.error;
        if (actionsRejectedRes.error) throw actionsRejectedRes.error;
        if (actionsResolvedRes.error) throw actionsResolvedRes.error;
        if (actionsBanRes.error) throw actionsBanRes.error;

        const reportCountByEvent = new Map<string, number>();
        (reportCountsRes.data || []).forEach((row) => {
          if (!row.target_id) return;
          reportCountByEvent.set(row.target_id, (reportCountByEvent.get(row.target_id) || 0) + 1);
        });

        const mappedEvents = (eventsRes.data || []).map((event) => ({
          ...event,
          reports_count: reportCountByEvent.get(event.id) || 0,
        })) as EventRecord[];

        const reportList = (reportsRes.data || []) as Report[];
        const warningList = (warningsRes.data || []) as Warning[];

        const flaggedUsers = new Set((userReportsRes.data || []).map((row) => row.target_id)).size;

        setEvents(mappedEvents);
        setReports(reportList);
        setWarnings(warningList);
        setStats({
          pendingEvents: mappedEvents.length,
          newReports: reportsCountRes.count || 0,
          flaggedUsers,
          rejectedEvents: actionsRejectedRes.count || 0,
          resolvedActions: actionsResolvedRes.count || 0,
          bannedUsers: actionsBanRes.count || 0,
        });
      } catch (error) {
        console.error('[Moderation] load dashboard failed', error);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleRejectEvent = async (eventId: string) => {
    if (!profile?.id) return;
    try {
      await ModerationService.updateEventStatus({
        eventId,
        status: 'refused',
        moderatorId: profile.id,
        actionType: 'refuse',
      });
      await loadDashboard();
    } catch (error) {
      console.error('[Moderation] reject event failed', error);
    }
  };

  const menuItems: Array<{ label: string; route: string }> = [
    { label: 'Dashboard', route: '/moderation' },
    { label: 'Événements', route: '/moderation/events' },
    { label: 'Commentaires', route: '/moderation/comments' },
    { label: 'Utilisateurs', route: '/moderation/users' },
    { label: 'Signalements', route: '/moderation/reports' },
    { label: 'Photos', route: '/moderation/media' },
  ];

  const severityStats = useMemo(() => {
    const counts = reports.reduce(
      (acc, report) => {
        acc[report.severity] += 1;
        return acc;
      },
      { minor: 0, harmful: 0, abusive: 0, illegal: 0 }
    );
    return [
      { label: 'Minor', value: counts.minor, color: colors.info[400] },
      { label: 'Harmful', value: counts.harmful, color: colors.warning[400] },
      { label: 'Abusive', value: counts.abusive, color: colors.error[400] },
      { label: 'Illegal', value: counts.illegal, color: colors.error[600] },
    ];
  }, [reports]);

  const moderationStats = useMemo(
    () => [
      { label: 'Événements rejetés', value: stats.rejectedEvents, color: colors.error[500] },
      { label: 'Actions résolues', value: stats.resolvedActions, color: colors.success[500] },
      { label: 'Utilisateurs bannis', value: stats.bannedUsers, color: colors.warning[500] },
    ],
    [stats]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Modération – Moments Locaux</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)}>
            <Menu size={22} color={colors.neutral[800]} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={() => router.back()}>
            <X size={20} color={colors.neutral[700]} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.info[600]} />
            <Text style={styles.loadingText}>Chargement des données…</Text>
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiRow}>
          <KpiCard label="Événements en attente" value={stats.pendingEvents} />
          <KpiCard label="Signalements reçus" value={stats.newReports} />
          <KpiCard label="Utilisateurs signalés" value={stats.flaggedUsers} />
        </ScrollView>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Événements à vérifier</Text>
            <TouchableOpacity>
              <Text style={styles.sectionAction}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {events.map((event) => (
            <EventModerationRow
              key={event.id}
              event={event}
              onReview={() => router.push('/moderation/events')}
              onReject={() => handleRejectEvent(event.id)}
            />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signalements récents</Text>
          <View style={styles.card}>
            {reports.length === 0 ? (
              <Text style={styles.emptyText}>Aucun signalement récent.</Text>
            ) : (
              reports.map((report) => (
                <ReportItem key={report.id} report={report} />
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Utilisateurs à problèmes</Text>
          <View style={styles.card}>
            {warnings.length === 0 ? (
              <Text style={styles.emptyText}>Aucun utilisateur signalé.</Text>
            ) : (
              warnings.map((warning) => {
                const profile = warning.user || {
                  id: warning.user_id,
                  display_name: 'Utilisateur',
                  avatar_url: null,
                  role: 'particulier',
                };
                return <UserRiskRow key={warning.id} profile={profile} warning={warning} />;
              })
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catégories de problèmes</Text>
          <DonutChart data={severityStats} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiques de modération</Text>
          <BarChart data={moderationStats} />
          <View style={styles.statRow}>
            <View style={styles.statChip}>
              <CheckCircle2 size={16} color={colors.success[600]} />
              <Text style={styles.statChipText}>Résolues</Text>
            </View>
            <View style={styles.statChip}>
              <Ban size={16} color={colors.error[600]} />
              <Text style={styles.statChipText}>Bloquées</Text>
            </View>
            <View style={styles.statChip}>
              <ShieldAlert size={16} color={colors.info[600]} />
              <Text style={styles.statChipText}>Suivi</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Historique des modérations</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuBackdrop}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Navigation</Text>
              <TouchableOpacity onPress={() => setMenuOpen(false)}>
                <X size={18} color={colors.neutral[600]} />
              </TouchableOpacity>
            </View>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.route}
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push(item.route as any);
                }}
              >
                <Text style={styles.menuItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    ...typography.h4,
    color: colors.neutral[900],
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  kpiRow: {
    gap: spacing.md,
  },
  kpiCard: {
    width: 180,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  kpiValue: {
    ...typography.h3,
    color: colors.info[700],
    marginBottom: spacing.xs,
  },
  kpiLabel: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  sectionAction: {
    ...typography.bodySmall,
    color: colors.info[600],
    fontWeight: '600',
  },
  eventCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    gap: spacing.md,
  },
  eventInfo: {
    gap: spacing.xs,
  },
  eventTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  eventMeta: {
    ...typography.bodySmall,
    color: colors.neutral[500],
  },
  eventReport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eventReportText: {
    ...typography.bodySmall,
    color: colors.warning[700],
  },
  eventActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  eventButtonPrimary: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.info[600],
    alignItems: 'center',
  },
  eventButtonPrimaryText: {
    ...typography.bodySmall,
    color: colors.neutral[0],
    fontWeight: '600',
  },
  eventButtonGhost: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.error[200],
    alignItems: 'center',
  },
  eventButtonGhostText: {
    ...typography.bodySmall,
    color: colors.error[600],
    fontWeight: '600',
  },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    gap: spacing.md,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.neutral[500],
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  reportAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  reportAvatar: {
    width: '100%',
    height: '100%',
  },
  reportAvatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  reportContent: {
    flex: 1,
    gap: spacing.xs,
  },
  reportReason: {
    ...typography.bodySmall,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  reportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reportBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  reportBadgeText: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  reportTime: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  reportTarget: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  userRow: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
  },
  userAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  userBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  userWarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.warning[100],
  },
  userWarningText: {
    ...typography.caption,
    color: colors.warning[700],
    fontWeight: '600',
  },
  userStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error[100],
  },
  userStatusText: {
    ...typography.caption,
    color: colors.error[700],
    fontWeight: '600',
  },
  userActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  userActionOutline: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.info[200],
    alignItems: 'center',
  },
  userActionOutlineText: {
    ...typography.bodySmall,
    color: colors.info[700],
    fontWeight: '600',
  },
  userActionDanger: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error[600],
    alignItems: 'center',
  },
  userActionDangerText: {
    ...typography.bodySmall,
    color: colors.neutral[0],
    fontWeight: '600',
  },
  donutCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    gap: spacing.lg,
  },
  donutRing: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
  },
  donutCenter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 12,
    borderColor: colors.info[200],
  },
  donutTotal: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  donutSubtitle: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  donutLegend: {
    gap: spacing.sm,
  },
  donutLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  donutDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  donutLegendLabel: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    flex: 1,
  },
  donutLegendValue: {
    ...typography.bodySmall,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  barCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    gap: spacing.md,
  },
  barRow: {
    gap: spacing.xs,
  },
  barLabel: {
    ...typography.bodySmall,
    color: colors.neutral[700],
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  barValue: {
    ...typography.caption,
    color: colors.neutral[600],
    textAlign: 'right',
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
  },
  statChipText: {
    ...typography.caption,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  footer: {
    paddingBottom: spacing.xl,
  },
  primaryButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.info[600],
    alignItems: 'center',
    shadowColor: colors.info[600],
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    gap: spacing.sm,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  menuTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  menuItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
  },
  menuItemText: {
    ...typography.bodySmall,
    color: colors.neutral[800],
    fontWeight: '600',
  },
});
