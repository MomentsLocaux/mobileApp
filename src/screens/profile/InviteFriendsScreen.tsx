import React from 'react';
import { View, Text, StyleSheet, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Send } from 'lucide-react-native';
import { AppBackground, Card, Button, ScreenHeader } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { getAppShareMessage, getPublicShareOrigin } from '@/utils/event-share';

export default function InviteFriendsScreen() {
  const router = useRouter();

  const handleInvite = async () => {
    try {
      await Share.share({
        message: getAppShareMessage(getPublicShareOrigin()),
        title: 'Moments Locaux',
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
          <Send size={20} color={colors.brand.secondary} />
        </View>
        <Text style={styles.cardTitle}>Partagez l’application</Text>
        <Text style={styles.cardBody}>
          Invitez vos proches à découvrir les moments près de chez vous. Aucun accès au carnet
          d’adresses : partagez un lien, c’est tout.
        </Text>
        <Button title="Partager le lien" onPress={handleInvite} fullWidth />
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
    backgroundColor: 'rgba(124, 181, 24,0.12)',
  },
  cardTitle: {
    ...typography.h5,
    color: colors.brand.text,
    fontWeight: '700',
  },
  cardBody: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
});
