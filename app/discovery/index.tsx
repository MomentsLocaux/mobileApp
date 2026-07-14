import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Compass, Settings } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { DiscoveryInsightsCard } from '@/components/discovery/DiscoveryInsightsCard';
import { WhyThisSheet } from '@/components/discovery/WhyThisSheet';
import { AppBackground, Button, ScreenHeader } from '@/components/ui';
import { ForYouList } from '@/components/discovery/ForYouList';
import { MyRadiusTeaser } from '@/components/discovery/MyRadiusTeaser';
import { RightNowCard } from '@/components/discovery/RightNowCard';
import { colors, spacing, typography } from '@/constants/theme';
import { useDiscoveryConsent } from '@/hooks/useDiscoveryConsent';
import { useDiscoveryRecommendations } from '@/hooks/useDiscoveryRecommendations';
import { useLocation } from '@/hooks/useLocation';
import { DiscoveryRecommendationsService } from '@/services/discovery/discovery-recommendations.service';
import { PremiumPaywallSheet } from '@/components/discovery/PremiumPaywallSheet';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';
import { useDiscoveryInsights } from '@/hooks/useDiscoveryInsights';
import { PremiumCard } from '@/components/premium/PremiumCard';
import { PremiumMemberBadge } from '@/components/premium/PremiumMemberBadge';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { useAuthStore } from '@/state/auth';

export default function DiscoveryHomeScreen() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const { isEnabled, loading: consentLoading } = useDiscoveryConsent();
  const { currentLocation, permissionGranted, refreshLocation } = useLocation();
  const {
    rightNow,
    forYou,
    placesCount,
    loading,
    error,
    locationRequired,
    load,
    react,
  } = useDiscoveryRecommendations();
  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallSource, setPaywallSource] = useState<'my_radius' | 'right_now' | 'discovery_home'>(
    'discovery_home',
  );
  const { isPremium, loading: premiumLoading } = usePremiumEntitlement();
  const { insights, markSeen } = useDiscoveryInsights();
  const [whyVisible, setWhyVisible] = useState(false);

  const openPaywall = (source: 'my_radius' | 'right_now' | 'discovery_home') => {
    setPaywallSource(source);
    setPaywallVisible(true);
  };

  const loadWithLocation = useCallback(async () => {
    const coords = currentLocation?.coords;
    await load({
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      refreshScores: true,
    });
  }, [currentLocation, load]);

  useEffect(() => {
    if (!session || consentLoading || !isEnabled) return;
    loadWithLocation();
  }, [session, consentLoading, isEnabled, loadWithLocation]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (!permissionGranted) {
        await refreshLocation();
      }
      await loadWithLocation();
    } finally {
      setRefreshing(false);
    }
  };

  if (!session) {
    return (
      <View style={styles.container}>
        <AppBackground />
        <GuestGateModal
          visible
          title="Découvrir autour de vous"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </View>
    );
  }

  if (consentLoading) {
    return (
      <View style={styles.centered}>
        <AppBackground />
        <ActivityIndicator size="large" color={colors.brand.secondary} />
      </View>
    );
  }

  if (!isEnabled) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppBackground />
        <ScreenHeader title="Discovery" onBack={() => router.back()} />
        <View style={styles.consentPrompt}>
          <Compass size={40} color={colors.brand.secondary} />
          <Text style={styles.promptTitle}>Activez Discovery</Text>
          <Text style={styles.promptBody}>
            Recevez des suggestions personnalisées basées sur vos goûts et votre localisation actuelle.
            Vous gardez le contrôle et pouvez désactiver à tout moment.
          </Text>
          <Button title="Configurer Discovery" onPress={() => router.push('/discovery/onboarding' as any)} />
        </View>
      </SafeAreaView>
    );
  }

  const topRightNow = rightNow[0] ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <AppBackground />
      <ScreenHeader
        title="Discovery"
        onBack={() => router.back()}
        right={
          <TouchableOpacity onPress={() => router.push('/settings/discovery' as any)}>
            <Settings size={20} color={colors.brand.text} />
          </TouchableOpacity>
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {isPremium && (
          <View style={styles.premiumHeader}>
            <PremiumMemberBadge />
          </View>
        )}

        {loading && !refreshing && (
          <ActivityIndicator size="small" color={colors.brand.secondary} style={styles.loader} />
        )}

        {locationRequired && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Activez la localisation ou définissez un domicile dans les notifications pour des suggestions
              plus précises.
            </Text>
            <Button title="Actualiser la position" variant="outline" onPress={handleRefresh} />
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <PremiumCard isPremium={isPremium}>
          <View style={styles.quickLinks}>
            <Button title="Mon territoire" variant="outline" onPress={() => router.push('/discovery/my-radius' as any)} />
            <Button title="Break the Loop" variant="outline" onPress={() => router.push('/discovery/break-the-loop' as any)} />
          </View>
        </PremiumCard>

        <DiscoveryInsightsCard
          insights={insights}
          onDismiss={markSeen}
          onBreakLoopPress={() => router.push('/discovery/break-the-loop' as any)}
        />

        <MyRadiusTeaser
          placesCount={placesCount}
          isPremium={isPremium}
          onUnlockPress={!isPremium ? () => openPaywall('my_radius') : undefined}
        />

        {!premiumLoading && !isPremium && (
          <TouchableOpacity
            style={styles.premiumBanner}
            onPress={() => openPaywall('right_now')}
            activeOpacity={0.85}
          >
            <Text style={styles.premiumBannerTitle}>Right Now · version gratuite</Text>
            <Text style={styles.premiumBannerBody}>
              1 suggestion par jour. Passez à Moments Locaux+ pour un flux complet.
            </Text>
          </TouchableOpacity>
        )}

        {topRightNow ? (
          <RightNowCard
            recommendation={topRightNow}
            onOpen={async () => {
              await react(topRightNow.id, 'opened');
              router.push(`/events/${topRightNow.event_id}` as any);
            }}
            onDismiss={async () => {
              await react(topRightNow.id, 'dismissed');
              Toast.show({ type: 'info', text1: 'Suggestion masquée' });
              await loadWithLocation();
            }}
            onInterested={async () => {
              await react(topRightNow.id, 'interested');
              Toast.show({ type: 'success', text1: 'Noté, merci !' });
            }}
            onRoute={async () => {
              const event = topRightNow.event;
              if (!event) return;
              await react(topRightNow.id, 'route_requested');
              await DiscoveryRecommendationsService.openRoute(event.latitude, event.longitude);
            }}
            showWhyThis={isPremium}
            onWhyThis={() => setWhyVisible(true)}
          />
        ) : (
          <View style={styles.emptyRightNow}>
            <Text style={styles.emptyTitle}>Rien pour l'instant</Text>
            <Text style={styles.emptyBody}>
              Revenez plus tard ou explorez la carte pour nourrir vos recommandations.
            </Text>
            {!isPremium && (
              <Button
                title="Débloquer plus de suggestions"
                variant="outline"
                onPress={() => openPaywall('right_now')}
                style={styles.emptyCta}
              />
            )}
          </View>
        )}

        <ForYouList
          items={forYou}
          onPress={async (item) => {
            await react(item.id, 'opened');
            router.push(`/events/${item.event_id}` as any);
          }}
        />
      </ScrollView>

      <PremiumPaywallSheet
        visible={paywallVisible}
        source={paywallSource}
        onClose={() => setPaywallVisible(false)}
      />
      <WhyThisSheet
        visible={whyVisible}
        reasonCodes={topRightNow?.reason_codes ?? []}
        onClose={() => setWhyVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  loader: {
    marginBottom: spacing.md,
  },
  consentPrompt: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  promptTitle: {
    ...typography.h2,
    color: colors.brand.text,
    textAlign: 'center',
  },
  promptBody: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  banner: {
    backgroundColor: 'rgba(43, 191, 227, 0.12)',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  bannerText: {
    ...typography.bodySmall,
    color: colors.brand.text,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.brand.error,
    marginBottom: spacing.md,
  },
  premiumHeader: {
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  emptyRightNow: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.brand.text,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  premiumBanner: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(43, 191, 227, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(43, 191, 227, 0.25)',
  },
  premiumBannerTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  premiumBannerBody: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  emptyCta: {
    marginTop: spacing.md,
  },
  quickLinks: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
});
