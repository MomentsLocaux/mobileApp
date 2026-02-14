import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Send } from 'lucide-react-native';
import { AppBackground, Button, Card, TopBar, colors, radius, spacing, typography } from '@/components/ui/v2';

const DEFAULT_SHARE_URL = 'https://momentslocaux.app';

export default function InviteFriendsScreen() {
  const router = useRouter();
  const shareUrl = useMemo(
    () => process.env.EXPO_PUBLIC_APP_SHARE_URL || DEFAULT_SHARE_URL,
    [],
  );

  const handleInvite = async () => {
    try {
      await Share.share({
        message: `Viens découvrir Moments Locaux avec moi: ${shareUrl}`,
        url: shareUrl,
        title: 'Inviter des amis',
      });
    } catch (error) {
      console.warn('invite share error', error);
      Alert.alert('Erreur', "Impossible d'ouvrir le partage pour le moment.");
    }
  };

  return (
    <View style={styles.container}>
      <AppBackground opacity={0.2} />
      <View style={styles.topBarWrap}>
        <TopBar title="Inviter des amis" onBack={() => router.back()} />
      </View>

      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          <Send size={20} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>Partagez l’application</Text>
        <Text style={styles.cardBody}>
          Invitez votre entourage à rejoindre Moments Locaux pour découvrir et publier des événements.
        </Text>
        <Button title="Partager maintenant" onPress={handleInvite} fullWidth />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  topBarWrap: {
    paddingTop: spacing.xs,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 191, 227, 0.16)',
  },
  cardTitle: {
    ...typography.subsection,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  cardBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
