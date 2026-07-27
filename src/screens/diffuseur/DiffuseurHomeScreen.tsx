import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CalendarClock,
  Plug,
  Users,
} from 'lucide-react-native';
import { AppBackground, Button, Card } from '@/components/ui';
import { IdentityAppBackground } from '@/components/identity/IdentityAppBackground';
import { useAuth } from '@/hooks';
import { useDiffuseur } from '@/hooks/useDiffuseur';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import {
  DiffuseurHomeService,
  type DiffuseurHomeSnapshot,
} from '@/services/diffuseur-home.service';
import { DIFFUSEUR_PLANS } from '@/constants/diffuseur';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { PRO_SUBTYPE_LABELS } from '@/constants/accountIdentity';
import type { ProSubtype } from '@/constants/accountIdentity';

const EMPTY_SNAP: DiffuseurHomeSnapshot = {
  statusCounts: { draft: 0, pending: 0, published: 0, refused: 0, archived: 0 },
  kpis: {
    views7d: 0,
    interests7d: 0,
    checkins7d: 0,
    presenceRate: null,
    upcoming14d: 0,
  },
  actionEvents: [],
};

function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Brouillon';
    case 'pending':
      return 'En revue';
    case 'published':
      return 'Publié';
    case 'refused':
      return 'Refusé';
    case 'archived':
      return 'Archivé';
    default:
      return status;
  }
}

function connectorLabel(status: string | null | undefined): string {
  switch (status) {
    case 'sit_pending':
      return 'SIT en attente de connexion';
    case 'sit_connected':
      return 'SIT connecté';
    case 'custom_requested':
      return 'Demande de connecteur envoyée';
    case 'custom_active':
      return 'Connecteur actif';
    default:
      return 'Aucun connecteur configuré';
  }
}

/**
 * Accueil Professionnel — tableau de bord Diffuseur Free (KPI 7j).
 * Ticket DIFF-HOME.
 */
export default function DiffuseurHomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { accent } = useAccountIdentity();
  const { organization, plan, entitlements, memberCount, isPro, loading: orgLoading, refresh } =
    useDiffuseur();
  const [snap, setSnap] = useState<DiffuseurHomeSnapshot>(EMPTY_SNAP);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setSnap(EMPTY_SNAP);
      setLoading(false);
      return;
    }
    try {
      const data = await DiffuseurHomeService.getSnapshot(profile.id);
      setSnap(data);
    } catch (err) {
      console.warn('DiffuseurHome load', err);
      setSnap(EMPTY_SNAP);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), refresh()]);
    setRefreshing(false);
  }, [load, refresh]);

  const subtype =
    (organization?.pro_subtype || profile?.pro_subtype) as ProSubtype | null | undefined;
  const subtypeLabel = subtype ? PRO_SUBTYPE_LABELS[subtype] : 'Professionnel';
  const seatLimit = entitlements.seatLimit;
  const connectorStatus = organization?.connector_status || 'none';

  return (
    <View style={styles.root}>
      <IdentityAppBackground />
      <AppBackground opacity={0.85} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accent.accent}
          />
        }
      >
        <Text style={styles.eyebrow}>Moments Diffuseur</Text>
        <Text style={styles.title}>Tableau de bord</Text>
        <Text style={styles.subtitle}>
          {subtypeLabel} · présence réelle et publications — pas un second back-office de saisie.
        </Text>

        <Card style={styles.planCard}>
          <View style={styles.planRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planName}>
                {DIFFUSEUR_PLANS[plan].label}
                {isPro ? ' · Analytics 30/90j' : ''}
              </Text>
              <Text style={styles.planMeta}>
                Sièges {memberCount || 1} / {seatLimit}
                {organization?.verified_at ? ' · Vérifié' : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/profile/diffuseur' as any)}
              style={[styles.planCta, { borderColor: accent.accent }]}
            >
              <Text style={[styles.planCtaText, { color: accent.accent }]}>Offre</Text>
            </Pressable>
          </View>
          {!isPro ? (
            <Text style={styles.teaser}>
              Analytics 30/90j, crédits boost et priorisation connecteur — Diffuseur Pro.
            </Text>
          ) : null}
        </Card>

        {(loading || orgLoading) && snap.actionEvents.length === 0 ? (
          <ActivityIndicator color={accent.accent} style={{ marginVertical: spacing.xl }} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>7 derniers jours</Text>
            <View style={styles.kpiGrid}>
              <KpiTile label="Vues" value={String(snap.kpis.views7d)} />
              <KpiTile label="Intérêts" value={String(snap.kpis.interests7d)} />
              <KpiTile label="Check-ins" value={String(snap.kpis.checkins7d)} />
              <KpiTile
                label="Présence"
                value={
                  snap.kpis.presenceRate === null ? '—' : `${snap.kpis.presenceRate} %`
                }
              />
              <KpiTile
                label="À venir (14j)"
                value={String(snap.kpis.upcoming14d)}
                wide
              />
            </View>

            <Text style={styles.sectionTitle}>Publications</Text>
            <View style={styles.statusRow}>
              {(
                [
                  ['draft', snap.statusCounts.draft],
                  ['pending', snap.statusCounts.pending],
                  ['published', snap.statusCounts.published],
                  ['refused', snap.statusCounts.refused],
                ] as const
              ).map(([key, n]) => (
                <View key={key} style={styles.statusChip}>
                  <Text style={styles.statusCount}>{n}</Text>
                  <Text style={styles.statusLabel}>{statusLabel(key)}</Text>
                </View>
              ))}
            </View>

            {snap.actionEvents.length > 0 ? (
              <View style={styles.list}>
                {snap.actionEvents.map((ev) => (
                  <Pressable
                    key={ev.id}
                    style={styles.eventRow}
                    onPress={() => router.push(`/events/${ev.id}` as any)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {ev.title}
                      </Text>
                      <Text style={styles.eventMeta}>{statusLabel(ev.status)}</Text>
                    </View>
                    <CalendarClock size={16} color={colors.brand.textSecondary} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>Aucune publication pour l’instant.</Text>
            )}

            <Card style={styles.widget}>
              <View style={styles.widgetHeader}>
                <Plug size={18} color={accent.accent} />
                <Text style={styles.widgetTitle}>Connecteur</Text>
              </View>
              <Text style={styles.widgetBody}>{connectorLabel(connectorStatus)}</Text>
              <Text style={styles.widgetHint}>
                Une saisie en amont — Moments Locaux concentre check-ins et interactions temps
                réel.
              </Text>
              {connectorStatus === 'none' ? (
                <Button
                  title="Configurer un connecteur"
                  size="sm"
                  variant="outline"
                  onPress={() => router.push('/profile/diffuseur' as any)}
                  style={{ marginTop: spacing.sm }}
                />
              ) : null}
            </Card>

            <View style={styles.actions}>
              <Button
                title="Créer un moment"
                onPress={() => router.push('/events/create/step-1' as any)}
              />
              <Button
                title="Packs Diffuseur"
                variant="outline"
                onPress={() => router.push('/profile/diffuseur' as any)}
              />
              <Button
                title={isPro ? 'Analytics Pro' : 'Découvrir Analytics Pro'}
                variant="outline"
                onPress={() => router.push('/profile/diffuseur-analytics' as any)}
              />
            </View>

            <Pressable
              style={styles.b2cBanner}
              onPress={() => {
                /* dual account V1 — informational */
              }}
            >
              <Users size={16} color={colors.brand.textSecondary} />
              <Text style={styles.b2cBannerText}>
                Pour découvrir et check-in en participant : compte Particulier séparé.
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function KpiTile({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.kpiTile, wide && styles.kpiTileWide]}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brand.primary },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 8,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { ...typography.h1, color: colors.brand.text },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  planCard: { gap: spacing.sm },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  planName: { ...typography.h3, color: colors.brand.text },
  planMeta: { ...typography.caption, color: colors.brand.textSecondary, marginTop: 2 },
  planCta: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  planCtaText: { ...typography.caption, fontWeight: '700' },
  teaser: { ...typography.caption, color: colors.brand.textSecondary, lineHeight: 18 },
  sectionTitle: {
    ...typography.h3,
    color: colors.brand.text,
    marginTop: spacing.sm,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiTile: {
    width: '47%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  kpiTileWide: { width: '100%' },
  kpiValue: { ...typography.h2, color: colors.brand.text },
  kpiLabel: { ...typography.caption, color: colors.brand.textSecondary, marginTop: 2 },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusChip: {
    minWidth: 72,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statusCount: { ...typography.h3, color: colors.brand.text },
  statusLabel: { ...typography.caption, color: colors.brand.textSecondary },
  list: { gap: spacing.xs },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  eventTitle: { ...typography.body, color: colors.brand.text, fontWeight: '600' },
  eventMeta: { ...typography.caption, color: colors.brand.textSecondary },
  empty: { ...typography.body, color: colors.brand.textSecondary },
  widget: { gap: spacing.xs },
  widgetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  widgetTitle: { ...typography.h3, color: colors.brand.text },
  widgetBody: { ...typography.body, color: colors.brand.text },
  widgetHint: { ...typography.caption, color: colors.brand.textSecondary, lineHeight: 18 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  b2cBanner: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  b2cBannerText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
