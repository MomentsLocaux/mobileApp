import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart3, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Card, Button } from '@/components/ui';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks';

export default function CreatorIndexScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const isGuest = !session;

  if (isGuest) {
    return (
      <View style={styles.container}>
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Espace créateur</Text>
      <Text style={styles.subtitle}>
        Accédez à vos performances et à votre communauté depuis un seul endroit.
      </Text>

      <Card padding="md" style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <BarChart3 size={18} color={colors.primary[700]} />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>Statistiques</Text>
            <Text style={styles.cardBody}>Vues, likes, commentaires, check-ins et score d'engagement.</Text>
          </View>
        </View>
        <Button title="Ouvrir le dashboard" onPress={() => router.push('/creator/dashboard' as any)} />
      </Card>

      <Card padding="md" style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <Users size={18} color={colors.primary[700]} />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>Communauté</Text>
            <Text style={styles.cardBody}>Consultez vos fans les plus actifs et leurs interactions.</Text>
          </View>
        </View>
        <Button title="Voir la communauté" variant="outline" onPress={() => router.push('/creator/fans' as any)} />
      </Card>

      <Button title="Mes évènements" variant="ghost" onPress={() => router.push('/profile/my-events' as any)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[600],
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    ...typography.h6,
    color: colors.neutral[900],
  },
  cardBody: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
});
