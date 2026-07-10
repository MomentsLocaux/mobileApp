import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { DISCOVERY_ENABLED } from '@/config/discovery.flags';
import { AppBackground, ScreenHeader } from '@/components/ui';
import { ForYouList } from '@/components/discovery/ForYouList';
import { PremiumPaywallSheet } from '@/components/discovery/PremiumPaywallSheet';
import { colors, spacing, typography } from '@/constants/theme';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';
import { useLocation } from '@/hooks/useLocation';
import { DiscoveryRecommendationsService } from '@/services/discovery/discovery-recommendations.service';
import type { RecommendationWithEvent } from '@/services/discovery/discovery-recommendations.service';

function BreakTheLoopContent() {
  const router = useRouter();
  const { isPremium, loading: premiumLoading } = usePremiumEntitlement();
  const { currentLocation } = useLocation();
  const [items, setItems] = useState<RecommendationWithEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const load = useCallback(async () => {
    if (!isPremium) return;
    setLoading(true);
    try {
      const coords = currentLocation?.coords;
      await DiscoveryRecommendationsService.triggerScoring({
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        types: ['break_the_loop'],
      });
      const rows = await DiscoveryRecommendationsService.getWithEvents('break_the_loop', 3);
      setItems(rows);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Impossible de charger Break the Loop',
        text2: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [currentLocation, isPremium]);

  useEffect(() => {
    if (!premiumLoading && isPremium) {
      load();
    }
  }, [premiumLoading, isPremium, load]);

  if (premiumLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brand.secondary} />
      </View>
    );
  }

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppBackground />
        <ScreenHeader title="Break the Loop" onBack={() => router.back()} />
        <View style={styles.locked}>
          <Text style={styles.lockedTitle}>Fonction Premium</Text>
          <Text style={styles.lockedBody}>
            Trois suggestions pour sortir de vos habitudes, quand vos insights le suggèrent.
          </Text>
          <Text style={styles.link} onPress={() => setPaywallVisible(true)}>
            Découvrir Moments Locaux+
          </Text>
        </View>
        <PremiumPaywallSheet
          visible={paywallVisible}
          source="discovery_home"
          onClose={() => setPaywallVisible(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppBackground />
      <ScreenHeader title="Break the Loop" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Des idées différentes de vos sorties habituelles — sans jugement, juste pour varier.
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.brand.secondary} />
        ) : (
          <ForYouList
            items={items}
            onPress={(item) => router.push(`/events/${item.event_id}` as any)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function BreakTheLoopScreen() {
  if (!DISCOVERY_ENABLED) {
    return <Redirect href="/(tabs)/map" />;
  }
  return <BreakTheLoopContent />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg },
  intro: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.md,
  },
  locked: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  lockedTitle: { ...typography.h2, color: colors.brand.text, textAlign: 'center' },
  lockedBody: { ...typography.body, color: colors.brand.textSecondary, textAlign: 'center' },
  link: { ...typography.body, color: colors.brand.secondary, textAlign: 'center', fontWeight: '600' },
});
