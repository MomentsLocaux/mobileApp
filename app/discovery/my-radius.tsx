import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { DISCOVERY_ENABLED } from '@/config/discovery.flags';
import { AppBackground, Button, Card, ScreenHeader } from '@/components/ui';
import { RadiusMap } from '@/components/discovery/RadiusMap';
import { PremiumPaywallSheet } from '@/components/discovery/PremiumPaywallSheet';
import { colors, spacing, typography } from '@/constants/theme';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';
import { useLocation } from '@/hooks/useLocation';
import { DiscoveryPlacesService } from '@/services/discovery/discovery-places.service';
import type { DiscoveryDailySummary, DiscoveryPlace } from '@/types/discovery.types';

function MyRadiusContent() {
  const router = useRouter();
  const { isPremium } = usePremiumEntitlement();
  const { currentLocation } = useLocation();
  const [places, setPlaces] = useState<DiscoveryPlace[]>([]);
  const [summaries, setSummaries] = useState<DiscoveryDailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [placeRows, summaryRows] = await Promise.all([
        DiscoveryPlacesService.listPlaces(),
        DiscoveryPlacesService.getRecentSummaries(30),
      ]);
      setPlaces(placeRows);
      setSummaries(summaryRows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const newPlaces = places.filter((place) => place.is_new).length;
  const totalVisits = summaries.reduce((sum, row) => sum + row.places_count, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <AppBackground />
      <ScreenHeader title="Mon territoire" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.brand.secondary} />
        ) : (
          <>
            <Card padding="md" style={styles.statsCard}>
              <Text style={styles.statsTitle}>30 derniers jours</Text>
              <Text style={styles.statLine}>{places.length} lieux repérés</Text>
              <Text style={styles.statLine}>{newPlaces} nouveaux lieux</Text>
              <Text style={styles.statLine}>{totalVisits} visites enregistrées</Text>
            </Card>

            {isPremium ? (
              <>
                <RadiusMap
                  places={places}
                  center={
                    currentLocation
                      ? {
                          latitude: currentLocation.coords.latitude,
                          longitude: currentLocation.coords.longitude,
                        }
                      : null
                  }
                />
                {places.map((place) => (
                  <Card key={place.id} padding="md" style={styles.placeCard}>
                    <Text style={styles.placeTitle}>{place.label ?? 'Lieu habituel'}</Text>
                    <Text style={styles.placeMeta}>
                      {place.visit_count} visite{place.visit_count > 1 ? 's' : ''} · dernière fois le{' '}
                      {new Date(place.last_seen_at).toLocaleDateString('fr-FR')}
                    </Text>
                  </Card>
                ))}
              </>
            ) : (
              <>
                <Text style={styles.teaser}>
                  Aperçu : {places.length} lieu{places.length > 1 ? 'x' : ''} dans votre territoire récent.
                  Le détail carte et l’historique complet sont réservés à Moments Locaux+.
                </Text>
                <Button title="Débloquer Mon territoire" onPress={() => setPaywallVisible(true)} />
              </>
            )}
          </>
        )}
      </ScrollView>
      <PremiumPaywallSheet
        visible={paywallVisible}
        source="my_radius"
        onClose={() => setPaywallVisible(false)}
      />
    </SafeAreaView>
  );
}

export default function MyRadiusScreen() {
  if (!DISCOVERY_ENABLED) {
    return <Redirect href="/(tabs)/map" />;
  }
  return <MyRadiusContent />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  statsCard: { marginBottom: spacing.md },
  statsTitle: { ...typography.h3, color: colors.brand.text, marginBottom: spacing.sm },
  statLine: { ...typography.bodySmall, color: colors.brand.textSecondary, marginBottom: spacing.xs },
  placeCard: { marginBottom: spacing.sm },
  placeTitle: { ...typography.body, color: colors.brand.text, fontWeight: '600' },
  placeMeta: { ...typography.caption, color: colors.brand.textSecondary, marginTop: spacing.xs },
  teaser: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.md,
  },
});
