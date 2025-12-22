import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldAlert, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { ModerationService, type ModerationBug } from '@/services/moderation.service';
import { Card, Button } from '@/components/ui';

const STATUS_FILTERS: Array<{ key: 'all' | 'resolved' | 'unresolved'; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'resolved', label: 'Résolus' },
  { key: 'unresolved', label: 'Non résolus' },
];

const SEVERITIES: Array<{ key: 'all' | 'low' | 'medium' | 'high' | 'critical'; label: string }> = [
  { key: 'all', label: 'Toutes' },
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
  { key: 'critical', label: 'Critical' },
];

const LIMITS = [30, 60, 120] as const;

const badgeStyles = {
  category: {
    bug: { bg: colors.error[50], text: colors.error[700] },
    ux: { bg: colors.primary[50], text: colors.primary[700] },
    suggestion: { bg: colors.secondary[50], text: colors.secondary[700] },
    default: { bg: colors.neutral[100], text: colors.neutral[700] },
  },
  severity: {
    low: { bg: colors.primary[50], text: colors.primary[700] },
    medium: { bg: colors.warning[50], text: colors.warning[700] },
    high: { bg: colors.error[50], text: colors.error[700] },
    critical: { bg: colors.error[100], text: colors.error[800] },
    default: { bg: colors.neutral[100], text: colors.neutral[700] },
  },
  status: {
    done: { bg: colors.neutral[100], text: colors.neutral[700] },
    open: { bg: colors.primary[50], text: colors.primary[700] },
    triage: { bg: colors.secondary[50], text: colors.secondary[700] },
    in_progress: { bg: colors.warning[50], text: colors.warning[700] },
    ignored: { bg: colors.neutral[100], text: colors.neutral[700] },
    default: { bg: colors.neutral[100], text: colors.neutral[700] },
  },
};

export default function ModerationDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'all' | 'resolved' | 'unresolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [limit, setLimit] = useState<(typeof LIMITS)[number]>(30);
  const [bugs, setBugs] = useState<ModerationBug[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const canModerate = profile?.role === 'moderateur' || profile?.role === 'admin';

  const fetchBugs = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await ModerationService.listBugs({
        status: statusFilter,
        severity: severityFilter,
        limit,
      });
      setBugs(data);
    } catch (err: any) {
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canModerate) return;
    fetchBugs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, severityFilter, limit, canModerate]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await ModerationService.listBugs({
        status: statusFilter,
        severity: severityFilter,
        limit,
      });
      setBugs(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setRefreshing(false);
    }
  };

  const markResolved = async (id: string) => {
    setUpdatingId(id);
    setBugs((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'done' } : b)));
    try {
      const updated = await ModerationService.updateBugStatus(id, 'done');
      if (updated) {
        setBugs((prev) => prev.map((b) => (b.id === id ? updated : b)));
      } else {
        await onRefresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Impossible de mettre à jour');
      setBugs((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'open' } : b)));
    } finally {
      setUpdatingId(null);
    }
  };

  const renderBadge = (label: string, type: 'category' | 'severity' | 'status') => {
    const map = badgeStyles[type] as any;
    const style = map[label] || map.default;
    return (
      <View style={[styles.badge, { backgroundColor: style.bg }]}>
        <Text style={[styles.badgeText, { color: style.text }]}>{label}</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: ModerationBug }) => (
    <Card padding="md" style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          {renderBadge(item.category || 'bug', 'category')}
          {renderBadge(item.severity || 'low', 'severity')}
          {renderBadge(item.status || 'open', 'status')}
        </View>
        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>
      <Text style={styles.pageText}>{item.page || 'Page inconnue'}</Text>
      <Text style={styles.description}>{item.description}</Text>
      <Button
        title="Marquer comme résolu"
        onPress={() => markResolved(item.id)}
        disabled={item.status === 'done' || updatingId === item.id}
        loading={updatingId === item.id}
        variant={item.status === 'done' ? 'outline' : 'primary'}
        style={styles.resolveButton}
        fullWidth
      />
    </Card>
  );

  const listContent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.metaText}>Chargement des bugs...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centered}>
          <AlertTriangle size={32} color={colors.error[600]} />
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Réessayer" onPress={fetchBugs} />
        </View>
      );
    }
    if (!bugs.length) {
      return (
        <View style={styles.centered}>
          <Text style={styles.metaText}>Aucun bug correspondant à votre filtre.</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={bugs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
      />
    );
  }, [bugs, error, loading, refreshing]);

  if (!canModerate) {
    return (
      <View style={styles.blocked}>
        <ShieldAlert size={40} color={colors.error[600]} />
        <Text style={styles.blockedText}>Accès réservé aux modérateurs.</Text>
        <Button title="Retour" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                statusFilter === f.key && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(f.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === f.key && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.filterRow}>
          {SEVERITIES.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                severityFilter === f.key && styles.filterChipActive,
              ]}
              onPress={() => setSeverityFilter(f.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  severityFilter === f.key && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.filterRow}>
          {LIMITS.map((l) => (
            <TouchableOpacity
              key={l}
              style={[styles.filterChip, limit === l && styles.filterChipActive]}
              onPress={() => setLimit(l)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  limit === l && styles.filterChipTextActive,
                ]}
              >
                {l}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchBugs}>
            <RefreshCw size={16} color={colors.neutral[700]} />
            <Text style={styles.refreshText}>Rafraîchir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {listContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
  },
  filters: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  filterChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  filterChipText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.primary[700],
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  refreshText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  card: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateText: {
    ...typography.caption,
    color: colors.neutral[600],
  },
  pageText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '700',
  },
  description: {
    ...typography.body,
    color: colors.neutral[800],
  },
  resolveButton: {
    marginTop: spacing.xs,
  },
  blocked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.neutral[50],
  },
  blockedText: {
    ...typography.body,
    color: colors.neutral[800],
  },
  errorText: {
    ...typography.body,
    color: colors.error[600],
    textAlign: 'center',
  },
  metaText: {
    ...typography.body,
    color: colors.neutral[600],
    textAlign: 'center',
  },
});
