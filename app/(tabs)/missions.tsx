import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { Target, Trophy, CheckCircle2 } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { AppBackground, ScreenHeader } from '@/components/ui';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { MissionsService, type MissionProgressItem } from '@/services/missions.service';
import { useAuth } from '@/hooks';
import { GuestGateModal } from '@/components/auth/GuestGateModal';

export default function MissionsScreen() {
  if (!GAMIFICATION_ENABLED) {
    return <Redirect href="/(tabs)/map" />;
  }
  return <MissionsScreenInner />;
}

function MissionsScreenInner() {
  const router = useRouter();
  const { session } = useAuth();
  const isGuest = !session;
  const [missions, setMissions] = useState<MissionProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guestGate, setGuestGate] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setMissions([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await MissionsService.listMine();
      setMissions(res.missions);
    } catch (e) {
      console.warn('missions load', e);
      setMissions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      if (isGuest) {
        setGuestGate(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      void load();
    }, [isGuest, load]),
  );

  return (
    <View style={styles.wrapper}>
      <AppBackground />
      <ScreenHeader
        title="Missions"
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/map');
        }}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.brand.secondary}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Target size={20} color={colors.brand.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Habitué du quartier</Text>
            <Text style={styles.subtitle}>Valide tes missions pour gagner du Lumo</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.walletLink} onPress={() => router.push('/profile/wallet' as any)}>
          <Trophy size={16} color={colors.brand.secondary} />
          <Text style={styles.walletLinkText}>Voir mon portefeuille</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={colors.brand.secondary} style={{ marginTop: spacing.xl }} />
        ) : missions.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Aucune mission</Text>
            <Text style={styles.cardText}>
              Les missions daily/weekly apparaîtront ici dès que le serveur les expose.
            </Text>
          </View>
        ) : (
          missions.map((m) => {
            const pct = m.target > 0 ? Math.min(1, m.progress / m.target) : 0;
            return (
              <View key={m.mission_id} style={styles.card}>
                <View style={styles.cardHeader}>
                  {m.completed ? (
                    <CheckCircle2 size={18} color={colors.brand.secondary} />
                  ) : (
                    <Trophy size={18} color={colors.brand.secondary} />
                  )}
                  <Text style={styles.cardTitle}>{m.title}</Text>
                </View>
                {m.description ? <Text style={styles.cardText}>{m.description}</Text> : null}
                <Text style={styles.meta}>
                  {m.kind === 'daily' ? 'Quotidienne' : m.kind === 'weekly' ? 'Hebdo' : m.kind}
                  {' · '}
                  +{m.reward_lumo} Lumo
                  {m.completed ? ' · Terminée' : ''}
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {m.progress}/{m.target}
                  {m.steps_done?.length ? ` · ${m.steps_done.join(', ')}` : ''}
                </Text>
              </View>
            );
          })
        )}

        <TouchableOpacity style={styles.ctaSecondary} onPress={() => router.push('/(tabs)/shop' as any)}>
          <Text style={styles.ctaSecondaryText}>Aller à la boutique</Text>
        </TouchableOpacity>
      </ScrollView>

      <GuestGateModal
        visible={guestGate}
        title="Connexion requise"
        onClose={() => {
          setGuestGate(false);
          router.replace('/(tabs)/map');
        }}
        onSignUp={() => router.replace('/auth/register' as any)}
        onSignIn={() => router.replace('/auth/login' as any)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: 'transparent',
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  walletLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  walletLinkText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.brand.text,
    flex: 1,
  },
  cardText: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  meta: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brand.secondary,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  ctaSecondary: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  ctaSecondaryText: {
    ...typography.body,
    color: colors.brand.primary,
    fontWeight: '700',
  },
});
