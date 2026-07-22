import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { Ticket, MapPin } from 'lucide-react-native';
import { AppBackground, ScreenHeader } from '@/components/ui';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { PassService, type PassStatus } from '@/services/pass.service';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { GuestGateModal } from '@/components/auth/GuestGateModal';

export default function PassScreen() {
  if (!GAMIFICATION_ENABLED) {
    return <Redirect href="/(tabs)/map" />;
  }
  return <PassScreenInner />;
}

function PassScreenInner() {
  const router = useRouter();
  const { session } = useAuth();
  const [status, setStatus] = useState<PassStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guestGate, setGuestGate] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setStatus(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setStatus(await PassService.getMine());
    } catch (e) {
      console.warn('pass load', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setGuestGate(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      void load();
    }, [session, load]),
  );

  const stamps = status?.stampsRequired || 3;
  const done = Math.min(status?.checkinsCount || 0, stamps);
  const pct = stamps > 0 ? done / stamps : 0;

  return (
    <View style={styles.wrapper}>
      <AppBackground />
      <ScreenHeader title="Pass quartier" onBack={() => router.back()} />
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
        <View style={styles.hero}>
          <View style={styles.iconBadge}>
            <Ticket size={22} color={colors.brand.secondary} />
          </View>
          <Text style={styles.title}>Pass Habitué</Text>
          <Text style={styles.subtitle}>
            3 sorties check-in ce mois = un Pass week-end pour des avantages IRL.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brand.secondary} style={{ marginTop: spacing.lg }} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Streak du mois</Text>
              <Text style={styles.meta}>
                {done}/{stamps} check-ins distincts
                {status?.periodKey ? ` · ${status.periodKey}` : ''}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
              <Text style={styles.message}>{status?.message}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.row}>
                <MapPin size={16} color={colors.brand.secondary} />
                <Text style={styles.cardTitle}>Partenaires</Text>
              </View>
              <Text style={styles.message}>
                {status?.redemptionLive
                  ? 'La redemption est active chez les partenaires pilotes.'
                  : 'Bientôt disponible : cafés, bars et commerces locaux. Aucune promesse IRL active tant que le pilote n’est pas ouvert.'}
              </Text>
              {status?.streakUnlocked ? (
                <Text style={styles.unlocked}>
                  Streak débloqué
                  {status.pass?.status ? ` · statut ${status.pass.status}` : ''}
                </Text>
              ) : (
                <Text style={styles.meta}>Continue à faire des check-ins pour débloquer ton Pass.</Text>
              )}
            </View>
          </>
        )}
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
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.h3, color: colors.brand.text },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...typography.bodyLarge, color: colors.brand.text, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.brand.textSecondary },
  message: { ...typography.body, color: colors.brand.textSecondary },
  unlocked: { ...typography.body, color: colors.brand.secondary, fontWeight: '700' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.brand.secondary },
});
