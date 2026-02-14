import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, BarChart3, Sparkles, Users } from 'lucide-react-native';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import {
  Badge,
  Button,
  Card,
  ScreenLayout,
  Typography,
  colors,
  radius,
  spacing,
} from '@/components/ui/v2';
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
      <View style={styles.guestContainer}>
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
    <ScreenLayout
      header={
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Typography variant="sectionTitle" color={colors.textPrimary} weight="700">
              Espace créateur
            </Typography>
            <Typography variant="body" color={colors.textSecondary}>
              Pilotez vos performances et votre communauté.
            </Typography>
          </View>
          <Button
            title="Quitter"
            variant="secondary"
            size="sm"
            onPress={handleExitCreator}
            accessibilityRole="button"
            accessibilityLabel="Quitter l'espace créateur"
          />
        </View>
      }
      contentContainerStyle={styles.content}
    >
      <LinearGradient
        colors={[colors.accent, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Badge label="Creator module" style={styles.heroBadge} />
        <Typography variant="sectionTitle" color={colors.textPrimary} weight="700">
          Dashboard + Community
        </Typography>
        <Typography variant="body" color="rgba(255,255,255,0.9)">
          {profile?.display_name || 'Créateur'} · KPIs, top événements, fan segmentation et actions rapides.
        </Typography>
      </LinearGradient>

      <Card padding="lg" style={styles.featureCard} onPress={() => router.push('/creator/dashboard' as any)}>
        <View style={styles.featureTopRow}>
          <View style={styles.featureIconWrap}>
            <BarChart3 size={18} color={colors.primary} />
          </View>
          <View style={styles.featureTextWrap}>
            <Typography variant="subsection" color={colors.textPrimary} weight="700">
              Dashboard
            </Typography>
            <Typography variant="body" color={colors.textSecondary}>
              KPIs globaux, courbe d'engagement et top événements.
            </Typography>
          </View>
          <ArrowUpRight size={16} color={colors.primary} />
        </View>

        <Button
          title="Ouvrir le dashboard"
          onPress={() => router.push('/creator/dashboard' as any)}
          fullWidth
          accessibilityRole="button"
        />
      </Card>

      <Card padding="lg" style={styles.featureCard} onPress={() => router.push('/creator/fans' as any)}>
        <View style={styles.featureTopRow}>
          <View style={styles.featureIconWrap}>
            <Users size={18} color={colors.primary} />
          </View>
          <View style={styles.featureTextWrap}>
            <Typography variant="subsection" color={colors.textPrimary} weight="700">
              Community Hub
            </Typography>
            <Typography variant="body" color={colors.textSecondary}>
              Segmentation fans, classement XP, rewards et challenges.
            </Typography>
          </View>
          <ArrowUpRight size={16} color={colors.primary} />
        </View>

        <Button
          title="Voir la communauté"
          variant="secondary"
          onPress={() => router.push('/creator/fans' as any)}
          fullWidth
          accessibilityRole="button"
        />
      </Card>

      <Card padding="md" style={styles.secondaryCard}>
        <View style={styles.secondaryCardRow}>
          <Sparkles size={16} color={colors.primary} />
          <Typography variant="body" color={colors.textSecondary}>
            Accès rapide à vos événements publiés.
          </Typography>
        </View>
        <Button
          title="Mes événements"
          variant="ghost"
          onPress={() => router.push('/profile/my-events' as any)}
          accessibilityRole="button"
        />
      </Card>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  guestContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  content: {
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroBadge: {
    backgroundColor: 'rgba(15, 23, 25, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  featureCard: {
    gap: spacing.lg,
  },
  featureTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.element,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 191, 227, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(43, 191, 227, 0.35)',
  },
  featureTextWrap: {
    flex: 1,
    gap: 2,
  },
  secondaryCard: {
    gap: spacing.sm,
  },
  secondaryCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
