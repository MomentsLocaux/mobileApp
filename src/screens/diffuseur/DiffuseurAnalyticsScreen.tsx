import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { AppBackground, Button, Card } from '@/components/ui';
import { IdentityAppBackground } from '@/components/identity/IdentityAppBackground';
import { useAuth } from '@/hooks';
import { useDiffuseur } from '@/hooks/useDiffuseur';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import {
  DiffuseurAnalyticsService,
  type DiffuseurAnalyticsSnapshot,
  type DiffuseurAnalyticsWindow,
  type HeatmapCell,
} from '@/services/diffuseur-analytics.service';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';

const DOW_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const SLOT_LABELS: Record<HeatmapCell['slot'], string> = {
  morning: 'Matin',
  afternoon: 'A-midi',
  evening: 'Soir',
  night: 'Nuit',
};

function formatDelta(value: number | null, unit = '%'): string {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${unit}`;
}

/**
 * Analytics Diffuseur Pro — données réelles 30/90j + delta + heatmap + CSV.
 * Free → teaser.
 */
export default function DiffuseurAnalyticsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { accent } = useAccountIdentity();
  const { isProfessionnel, isPro, loading: orgLoading } = useDiffuseur();
  const [window, setWindow] = useState<DiffuseurAnalyticsWindow>('30d');
  const [snap, setSnap] = useState<DiffuseurAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id || !isPro) {
      setSnap(null);
      setLoading(false);
      return;
    }
    try {
      const data = await DiffuseurAnalyticsService.getSnapshot(profile.id, window);
      setSnap(data);
    } catch (err) {
      console.warn('analytics load', err);
      setSnap(null);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, isPro, window]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const exportCsv = useCallback(async () => {
    if (!snap || exporting) return;
    setExporting(true);
    try {
      const csv = DiffuseurAnalyticsService.toCsv(snap);
      const uri = `${FileSystemLegacy.cacheDirectory}diffuseur-analytics-${snap.window}.csv`;
      await FileSystemLegacy.writeAsStringAsync(uri, csv, {
        encoding: FileSystemLegacy.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Exporter analytics',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Export', 'Partage fichier indisponible sur cet appareil.');
      }
    } catch (e: any) {
      Alert.alert('Export', e?.message || 'Impossible d’exporter');
    } finally {
      setExporting(false);
    }
  }, [snap, exporting]);

  if (!orgLoading && !isProfessionnel) {
    return <Redirect href="/(tabs)" />;
  }

  if (!orgLoading && isProfessionnel && !isPro) {
    return (
      <View style={styles.root}>
        <IdentityAppBackground />
        <AppBackground opacity={0.9} />
        <View style={styles.gate}>
          <Text style={styles.title}>Analytics Pro</Text>
          <Text style={styles.subtitle}>
            Funnel 30/90j, deltas, heatmap et export CSV — inclus dans Diffuseur Pro.
          </Text>
          <Button title="Voir l’offre" onPress={() => router.push('/profile/diffuseur' as any)} />
          <Button
            title="Retour au tableau de bord"
            variant="outline"
            onPress={() => router.replace('/(tabs)' as any)}
          />
        </View>
      </View>
    );
  }

  const heatMax = snap?.heatmap.reduce((m, c) => Math.max(m, c.count), 0) || 0;

  return (
    <View style={styles.root}>
      <IdentityAppBackground />
      <AppBackground opacity={0.85} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={accent.accent}
          />
        }
      >
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.back, { color: accent.accent }]}>← Tableau de bord</Text>
        </Pressable>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>
          Données réelles · comparaison vs période précédente · export CSV.
        </Text>

        <View style={styles.windowRow}>
          {(['30d', '90d'] as const).map((w) => (
            <Pressable
              key={w}
              onPress={() => setWindow(w)}
              style={[
                styles.windowChip,
                window === w && { borderColor: accent.accent, backgroundColor: accent.accentMuted },
              ]}
            >
              <Text
                style={[styles.windowChipText, window === w && { color: accent.accent }]}
              >
                {w === '30d' ? '30 jours' : '90 jours'}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading || !snap ? (
          <ActivityIndicator color={accent.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <View style={styles.kpiGrid}>
              <Kpi
                label="Vues"
                value={String(snap.views)}
                delta={formatDelta(snap.delta.views)}
              />
              <Kpi
                label="Intérêts"
                value={String(snap.interests)}
                delta={formatDelta(snap.delta.interests)}
              />
              <Kpi
                label="Check-ins"
                value={String(snap.checkins)}
                delta={formatDelta(snap.delta.checkins)}
              />
              <Kpi
                label="Présence"
                value={snap.presenceRate == null ? '—' : `${snap.presenceRate} %`}
                delta={formatDelta(snap.delta.presenceRate, ' pts')}
              />
            </View>

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Funnel</Text>
              <Text style={styles.cardLine}>
                Vues → intérêts :{' '}
                {snap.funnel.viewsToInterests == null
                  ? '—'
                  : `${snap.funnel.viewsToInterests} %`}
              </Text>
              <Text style={styles.cardLine}>
                Intérêts → check-ins :{' '}
                {snap.funnel.interestsToCheckins == null
                  ? '—'
                  : `${snap.funnel.interestsToCheckins} %`}
              </Text>
              <Text style={styles.cardHint}>
                Période N-1 : {snap.previous.views} vues · {snap.previous.interests} intérêts ·{' '}
                {snap.previous.checkins} check-ins
              </Text>
            </Card>

            <Text style={styles.section}>Heatmap présence (jour × créneau)</Text>
            {snap.heatmap.length === 0 ? (
              <Text style={styles.empty}>Pas encore de check-ins sur la période.</Text>
            ) : (
              <View style={styles.heatGrid}>
                {snap.heatmap.slice(0, 12).map((cell) => {
                  const intensity = heatMax > 0 ? cell.count / heatMax : 0;
                  return (
                    <View
                      key={`${cell.dow}-${cell.slot}`}
                      style={[
                        styles.heatCell,
                        {
                          backgroundColor: `rgba(56, 189, 248, ${0.12 + intensity * 0.55})`,
                          borderColor: accent.accentBorder || 'rgba(255,255,255,0.12)',
                        },
                      ]}
                    >
                      <Text style={styles.heatLabel}>
                        {DOW_LABELS[cell.dow]} · {SLOT_LABELS[cell.slot]}
                      </Text>
                      <Text style={styles.heatValue}>{cell.count}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.section}>Top événements (check-ins)</Text>
            {snap.topByCheckins.every((e) => e.checkins === 0) ? (
              <Text style={styles.empty}>Pas encore assez de présence sur la période.</Text>
            ) : (
              snap.topByCheckins.map((ev) => (
                <Pressable
                  key={ev.id}
                  style={styles.topRow}
                  onPress={() => router.push(`/events/${ev.id}` as any)}
                >
                  <Text style={styles.topTitle} numberOfLines={1}>
                    {ev.title}
                  </Text>
                  <Text style={styles.topMeta}>
                    {ev.checkins} check-ins · {ev.views} vues
                  </Text>
                </Pressable>
              ))
            )}

            <Button
              title={exporting ? 'Export…' : 'Exporter CSV'}
              variant="outline"
              onPress={() => void exportCsv()}
              disabled={exporting}
              style={{ marginTop: spacing.md }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Kpi({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {delta ? <Text style={styles.kpiDelta}>{delta} vs N-1</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brand.page },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl + 8,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  gate: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  back: { ...typography.body, fontWeight: '600' },
  title: { ...typography.h1, color: colors.brand.text },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
  windowRow: { flexDirection: 'row', gap: spacing.sm },
  windowChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  windowChipText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: {
    width: '47%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  kpiValue: { ...typography.h2, color: colors.brand.text },
  kpiLabel: { ...typography.caption, color: colors.brand.textSecondary },
  kpiDelta: {
    ...typography.caption,
    color: colors.brand.secondary,
    marginTop: 4,
    fontWeight: '600',
  },
  card: { gap: spacing.xs },
  cardTitle: { ...typography.h3, color: colors.brand.text },
  cardLine: { ...typography.body, color: colors.brand.textSecondary },
  cardHint: { ...typography.caption, color: colors.brand.textSecondary, marginTop: 4 },
  section: { ...typography.h3, color: colors.brand.text, marginTop: spacing.sm },
  empty: { ...typography.body, color: colors.brand.textSecondary },
  heatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  heatCell: {
    width: '47%',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  heatLabel: { ...typography.caption, color: colors.brand.textSecondary },
  heatValue: { ...typography.h3, color: colors.brand.text },
  topRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  topTitle: { ...typography.body, color: colors.brand.text, fontWeight: '600' },
  topMeta: { ...typography.caption, color: colors.brand.textSecondary },
});
