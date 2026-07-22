import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Settings, User as UserIcon, Calendar, Award, Compass, Crown, Trophy, Coins, Target, ShoppingBag } from 'lucide-react-native';
import { DISCOVERY_ENABLED } from '@/config/discovery.flags';
import { CONTESTS_ENABLED } from '@/config/contests.flags';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { PremiumAvatarFrame } from '@/components/premium/PremiumAvatarFrame';
import { PremiumCard } from '@/components/premium/PremiumCard';
import { PremiumMemberBadge } from '@/components/premium/PremiumMemberBadge';
import { usePremiumEntitlement } from '@/hooks/usePremiumEntitlement';
import { AppBackground, Button, ScreenHeader } from '../../src/components/ui';
import { useAuth } from '../../src/hooks';
import { colors, spacing, typography, borderRadius } from '../../src/constants/theme';
import { getRoleLabel, getRoleBadgeColor } from '../../src/utils/roleHelpers';
import { GuestGateModal } from '../../src/components/auth/GuestGateModal';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, signOut, fullSignOut, session } = useAuth();
  const { isPremium } = usePremiumEntitlement();
  const isGuest = !session;

  const handleSignOut = async () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const handleForgetDevice = async () => {
    Alert.alert(
      'Oublier cet appareil',
      'La session sauvegardée sera supprimée et la connexion biométrique ne sera plus proposée sur cet appareil.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oublier',
          style: 'destructive',
          onPress: async () => {
            await fullSignOut();
            router.replace('/auth/login');
          },
        },
      ],
    );
  };

  const handleViewMyEvents = () => {
    router.push('/profile/my-events' as any);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/map' as any);
  };

  if (isGuest) {
    return (
      <View style={styles.container}>
        <AppBackground />
        <GuestGateModal
          visible
          title="Accéder à votre profil"
          onClose={() => router.replace('/(tabs)/map')}
          onSignUp={() => router.replace('/auth/register' as any)}
          onSignIn={() => router.replace('/auth/login' as any)}
        />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <AppBackground />
        <View style={styles.fallback}>
          <ActivityIndicator size="large" color={colors.brand.secondary} />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackground />
      <ScrollView style={styles.scroll}>
        <ScreenHeader title="Mon profil" onBack={handleBack} />
        <View style={styles.header}>
          {profile.cover_url ? (
            <Image source={{ uri: profile.cover_url }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, { backgroundColor: colors.neutral[200] }]} />
          )}
          <View style={styles.headerOverlay}>
            <PremiumAvatarFrame isPremium={isPremium} size={100}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <UserIcon size={40} color={colors.brand.text} />
                </View>
              )}
            </PremiumAvatarFrame>
            {isPremium && <PremiumMemberBadge />}
            <Text style={styles.displayName}>{profile.display_name}</Text>
            <Text style={styles.email}>{profile.email}</Text>
            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: getRoleBadgeColor(profile.role).bg },
              ]}
            >
              <Award size={14} color={getRoleBadgeColor(profile.role).text} />
              <Text
                style={[
                  styles.roleText,
                  { color: getRoleBadgeColor(profile.role).text },
                ]}
              >
                {getRoleLabel(profile.role)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/profile/edit' as any)}
            >
              <Settings size={20} color={colors.brand.secondary} />
              <Text style={styles.editButtonText}>Modifier le profil</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <PremiumCard isPremium={isPremium}>
            <Text style={styles.sectionTitle}>Informations</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Rôle</Text>
              <Text style={styles.infoValue}>{getRoleLabel(profile.role)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Onboarding</Text>
              <Text style={styles.infoValue}>
                {profile.onboarding_completed ? '✓ Terminé' : '○ En cours'}
              </Text>
            </View>
          </PremiumCard>

          <PremiumCard isPremium={isPremium} style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Actions</Text>
            {DISCOVERY_ENABLED && (
              <TouchableOpacity
                style={[styles.linkButton, isPremium && styles.linkButtonPremium]}
                onPress={() => router.push('/discovery' as any)}
              >
                <Compass size={18} color={isPremium ? colors.brand.premiumLight : colors.brand.secondary} />
                <Text style={[styles.linkText, isPremium && styles.linkTextPremium]}>Discovery</Text>
              </TouchableOpacity>
            )}
            {DISCOVERY_ENABLED && (
              <TouchableOpacity
                style={[styles.linkButton, isPremium && styles.linkButtonPremium]}
                onPress={() => router.push('/profile/subscription' as any)}
              >
                <Crown size={18} color={isPremium ? colors.brand.premiumLight : colors.brand.secondary} />
                <Text style={[styles.linkText, isPremium && styles.linkTextPremium]}>
                  {isPremium ? 'Moments Locaux+ actif' : 'Moments Locaux+'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.linkButton} onPress={handleViewMyEvents}>
              <Calendar size={18} color={colors.brand.secondary} />
              <Text style={styles.linkText}>Mes événements</Text>
            </TouchableOpacity>
            {GAMIFICATION_ENABLED && (
              <>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => router.push('/profile/wallet' as any)}
                >
                  <Coins size={18} color={colors.brand.secondary} />
                  <Text style={styles.linkText}>Portefeuille Lumo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => router.push('/(tabs)/missions' as any)}
                >
                  <Target size={18} color={colors.brand.secondary} />
                  <Text style={styles.linkText}>Missions</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => router.push('/(tabs)/shop' as any)}
                >
                  <ShoppingBag size={18} color={colors.brand.secondary} />
                  <Text style={styles.linkText}>Boutique</Text>
                </TouchableOpacity>
              </>
            )}
            {CONTESTS_ENABLED && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => router.push('/contests' as any)}
              >
                <Trophy size={18} color={colors.brand.secondary} />
                <Text style={styles.linkText}>Concours</Text>
              </TouchableOpacity>
            )}
          </PremiumCard>

          <Button
            title="Se déconnecter"
            onPress={handleSignOut}
            variant="outline"
            fullWidth
            style={styles.signOutButton}
          />
          <TouchableOpacity style={styles.forgetDeviceButton} onPress={handleForgetDevice}>
            <Text style={styles.forgetDeviceText}>Oublier cet appareil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    backgroundColor: 'transparent',
  },
  cover: {
    width: '100%',
    height: 180,
  },
  headerOverlay: {
    alignItems: 'center',
    marginTop: -60,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    ...typography.h2,
    color: colors.brand.text,
    marginBottom: spacing.xs,
  },
  email: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.xs,
  },
  bio: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  roleText: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  editButtonText: {
    ...typography.body,
    color: colors.brand.secondary,
    fontWeight: '600',
  },
  content: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.brand.text,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
  },
  actionCard: {
    marginTop: spacing.md,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  linkText: {
    ...typography.body,
    color: colors.brand.secondary,
    fontWeight: '600',
  },
  linkButtonPremium: {
    backgroundColor: colors.brand.premiumMuted,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.brand.premiumBorder,
    paddingHorizontal: spacing.sm,
  },
  linkTextPremium: {
    color: colors.brand.premiumLight,
    fontWeight: '700',
  },
  signOutButton: {
    marginTop: spacing.lg,
  },
  forgetDeviceButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  forgetDeviceText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.neutral[600],
    marginTop: spacing.md,
  },
});
