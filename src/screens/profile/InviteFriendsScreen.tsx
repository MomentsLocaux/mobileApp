import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Send } from 'lucide-react-native';
import { AppBackground, Card, Button, ScreenHeader } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

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
      <AppBackground />
      <ScreenHeader title="Inviter des amis" onBack={() => router.back()} />

      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          <Send size={20} color={colors.primary[600]} />
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
    gap: spacing.md,
  },
  card: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
  },
  cardTitle: {
    ...typography.h5,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  cardBody: {
    ...typography.body,
    color: colors.neutral[600],
  },
});
