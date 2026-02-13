import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart3, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBackground, Card, Button } from '@/components/ui';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';

export default function CreatorIndexScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const isGuest = !session;
  const handleExitCreator = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/map' as any);
  };

  if (isGuest) {
    return (
      <View style={styles.container}>
        <AppBackground opacity={0.9} />
        <GuestGateModal
          visible
          title="Espace créateur"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackground />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.topActions}>
          <Button
            title="Quitter"
            variant="secondary"
            size="sm"
            onPress={handleExitCreator}
            accessibilityRole="button"
            accessibilityLabel="Quitter l'espace créateur"
          />
        </View>

        <LinearGradient colors={[colors.primary[700], colors.primary[600]]} style={styles.hero}>
          <Text style={styles.heroTitle}>Espace créateur</Text>
          <Text style={styles.heroSubtitle}>
            Pilotez vos performances et votre communauté depuis un seul espace.
          </Text>
          <Text style={styles.heroFoot}>{profile?.display_name || 'Créateur'}</Text>
        </LinearGradient>

        <Card padding="md" style={styles.card} onPress={() => router.push('/creator/dashboard' as any)}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <BarChart3 size={18} color={colors.primary[700]} />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>Statistiques</Text>
              <Text style={styles.cardBody}>KPIs, courbe d’engagement et top événements.</Text>
            </View>
          </View>
          <Button
            title="Ouvrir le dashboard"
            onPress={() => router.push('/creator/dashboard' as any)}
            accessibilityRole="button"
          />
        </Card>

        <Card padding="md" style={styles.card} onPress={() => router.push('/creator/fans' as any)}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <Users size={18} color={colors.primary[700]} />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>Communauté</Text>
              <Text style={styles.cardBody}>Segmentez vos fans et lancez des actions de reward rapidement.</Text>
            </View>
          </View>
          <Button
            title="Voir la communauté"
            variant="secondary"
            onPress={() => router.push('/creator/fans' as any)}
            accessibilityRole="button"
          />
        </Card>

        <Button
          title="Mes événements"
          variant="ghost"
          onPress={() => router.push('/profile/my-events' as any)}
          accessibilityRole="button"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background[500],
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  hero: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  heroTitle: {
    ...typography.h3,
    color: colors.secondaryAccent[500],
  },
  heroSubtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.92)',
  },
  heroFoot: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.86)',
    marginTop: spacing.xs,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.secondaryAccent[500],
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background[500],
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    ...typography.h6,
    color: colors.textPrimary[500],
  },
  cardBody: {
    ...typography.bodySmall,
    color: colors.textSecondary[500],
  },
});
