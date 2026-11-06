import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IdentityAppBackground } from '@/components/identity/IdentityAppBackground';
import { BrandMark } from '@/components/ui/BrandMark';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';
import { EventsService } from '@/services/events.service';
import { getVisibleHomeLocation } from '@/services/home-location.service';
import { useProposalsStore } from '@/store/proposalsStore';
import type { EventWithCreator } from '@/types/database';
import { nearbyReviewEventIds } from '@/utils/notification-routing';

export default function NearbyReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ ids?: string | string[] }>();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const ids = useMemo(() => {
    const raw = Array.isArray(params.ids) ? params.ids.join(',') : params.ids;
    return nearbyReviewEventIds({ eventIds: raw ?? '' });
  }, [params.ids]);

  const goHome = () => {
    router.replace('/(tabs)');
  };

  const startReview = async () => {
    if (starting) return;
    setStarting(true);
    setError('');
    try {
      await waitForProposalsHydration();
      const loaded = await EventsService.getEventsByIds(ids);
      const byId = new Map(loaded.map((event) => [event.id.toLowerCase(), event]));
      const ordered = ids
        .map((id) => byId.get(id))
        .filter((event): event is EventWithCreator => Boolean(event));
      if (ordered.length === 0) {
        setError('Ces événements ne sont plus disponibles.');
        setStarting(false);
        return;
      }

      const store = useProposalsStore.getState();
      if (!store.preferences.anchor) {
        const home = user?.id ? await getVisibleHomeLocation(user.id) : null;
        const latitude = Number(home?.lat ?? ordered[0].latitude);
        const longitude = Number(home?.lon ?? ordered[0].longitude);
        if (Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0)) {
          store.setAnchor({
            latitude,
            longitude,
            label: 'Près de chez vous',
          });
        }
      }
      useProposalsStore.getState().setPool(ordered);
      router.replace('/(tabs)/proposals');
    } catch {
      setError('La revue n’a pas pu être préparée.');
      setStarting(false);
    }
  };

  const countLabel = ids.length > 1
    ? `${ids.length} nouveaux événements`
    : 'Nouveaux événements';

  return (
    <View style={styles.screen}>
      <IdentityAppBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerIcon}>
          <BrandMark size={32} />
        </View>
        <Text style={styles.kicker}>PRÈS DE CHEZ TOI</Text>
        <Text style={styles.headerTitle}>De nouveaux moments t’attendent</Text>
      </View>

      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>{countLabel}</Text>
          <Text style={styles.title}>Tu les passes en revue ?</Text>
          <Text style={styles.body}>
            Les événements récemment créés près de chez toi.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.primary, starting && styles.primaryBusy]}
            onPress={() => void startReview()}
            disabled={starting || ids.length === 0}
            accessibilityRole="button"
          >
            {starting ? (
              <ActivityIndicator color={colors.brand.onAccent} />
            ) : (
              <Text style={styles.primaryText}>Oui, je passe en revue</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondary}
            onPress={goHome}
            disabled={starting}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>Non, retour à l’accueil</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.kicker}>À TOI DE VOIR</Text>
        <Text style={styles.footerTitle}>Garde ce qui te fait envie.</Text>
        <Text style={styles.footerBody}>Le reste peut attendre. Rien n’est perdu si tu reviens plus tard.</Text>
      </View>
    </View>
  );
}

function waitForProposalsHydration(): Promise<void> {
  if (useProposalsStore.getState().hasHydrated) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useProposalsStore.subscribe((state) => {
      if (!state.hasHydrated) return;
      unsubscribe();
      resolve();
    });
  });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    marginBottom: spacing.md,
  },
  kicker: {
    ...typography.caption,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: colors.brand.secondary,
    textAlign: 'center',
  },
  headerTitle: {
    ...typography.h3,
    alignSelf: 'stretch',
    color: colors.brand.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  cardWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.brand.surface,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  footerTitle: {
    ...typography.bodyBold,
    color: colors.brand.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  footerBody: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  eyebrow: {
    ...typography.label,
    letterSpacing: 0.4,
    color: colors.brand.secondary,
    textAlign: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.brand.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  error: {
    ...typography.bodySmall,
    color: colors.brand.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  primary: {
    alignSelf: 'stretch',
    minHeight: 52,
    marginTop: spacing.xl,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.secondary,
  },
  primaryBusy: {
    opacity: 0.7,
  },
  primaryText: {
    ...typography.bodyBold,
    color: colors.brand.onAccent,
  },
  secondary: {
    alignSelf: 'stretch',
    minHeight: 48,
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    ...typography.bodyBold,
    color: colors.brand.textSecondary,
  },
});
