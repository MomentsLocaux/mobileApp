import React, { useCallback, useEffect, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { Settings, User as UserIcon, Calendar, Award, Send, Sparkles, Lightbulb } from 'lucide-react-native';
import { features } from '@/config/features';
import { PremiumAvatarFrame } from '@/components/premium/PremiumAvatarFrame';
import { PremiumCard } from '@/components/premium/PremiumCard';
import { Button, ScreenHeader } from '../../src/components/ui';
import { IdentityAppBackground } from '@/components/identity/IdentityAppBackground';
import { useAuth } from '../../src/hooks';
import { colors, spacing, typography, borderRadius } from '../../src/constants/theme';
import { getProfileIdentityLabel } from '../../src/utils/roleHelpers';
import { GuestGateModal } from '../../src/components/auth/GuestGateModal';
import { ModeSwitch } from '@/components/identity/ModeSwitch';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import { useEventPublishSurfaces } from '@/hooks/useEventPublishSurfaces';
import { prefetchMySuggestionHistory } from '@/services/suggestion-history.service';
import { CommunityService } from '@/services/community.service';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, signOut, fullSignOut, session } = useAuth();
  const {
    showModeSwitch,
    activeMode,
    savingMode,
    setActiveMode,
    accent,
    accountKind,
  } = useAccountIdentity();
  const { showPosterSuggestDrawer, showMyEvents, showMySuggestions, routes } = useEventPublishSurfaces();
  const isProfessionnelAccount = accountKind === 'professionnel';
  const isGuest = !session;
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    if (!profile?.id || isGuest) return;
    prefetchMySuggestionHistory(profile.id);
  }, [isGuest, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.id || isGuest || !features.socialPeers) return;
      let cancelled = false;
      void CommunityService.getMember(profile.id)
        .then((member) => {
          if (cancelled || !member) return;
          setFollowCounts({
            followers: member.followers_count || 0,
            following: member.following_count || 0,
          });
        })
        .catch((error) => {
          console.warn('load my follow counts', error);
        });
      return () => {
        cancelled = true;
      };
    }, [isGuest, profile?.id]),
  );

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

  const handleViewMySuggestions = () => {
    router.push('/profile/my-suggestions' as any);
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
        <IdentityAppBackground />
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
        <IdentityAppBackground />
        <View style={styles.fallback}>
          <ActivityIndicator size="large" color={accent.accent} />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <IdentityAppBackground />
      <ScrollView style={styles.scroll}>
        <ScreenHeader title="Mon profil" onBack={handleBack} />
        <View style={styles.header}>
          {profile.cover_url ? (
            <Image source={{ uri: profile.cover_url }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, { backgroundColor: colors.neutral[200] }]} />
          )}
          <View style={styles.headerOverlay}>
            <PremiumAvatarFrame isPremium={false} size={100}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <UserIcon size={40} color={colors.brand.text} />
                </View>
              )}
            </PremiumAvatarFrame>
            <Text style={styles.displayName}>{profile.display_name}</Text>
            <Text style={styles.email}>{profile.email}</Text>
            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor: accent.accentMuted,
                  borderColor: accent.accentBorder,
                },
              ]}
            >
              <Award size={14} color={accent.accent} />
              <Text style={[styles.roleText, { color: accent.accent }]}>
                {getProfileIdentityLabel(profile)}
              </Text>
            </View>

            {showModeSwitch ? (
              <ModeSwitch
                mode={activeMode}
                loading={savingMode}
                onChange={(mode) => {
                  void setActiveMode(mode);
                }}
              />
            ) : null}

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/profile/edit' as any)}
            >
              <Settings size={20} color={accent.accent} />
              <Text style={[styles.editButtonText, { color: accent.accent }]}>
                Modifier le profil
              </Text>
            </TouchableOpacity>
            {features.socialPeers ? (
              <View style={styles.followStats}>
                <TouchableOpacity
                  style={styles.followStat}
                  onPress={() =>
                    router.push(`/community/follows?userId=${profile.id}&tab=followers` as any)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Abonnés : ${followCounts.followers}`}
                >
                  <Text style={styles.followStatValue}>{followCounts.followers}</Text>
                  <Text style={styles.followStatLabel}>Abonnés</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.followStat}
                  onPress={() =>
                    router.push(`/community/follows?userId=${profile.id}&tab=following` as any)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Abonnements : ${followCounts.following}`}
                >
                  <Text style={styles.followStatValue}>{followCounts.following}</Text>
                  <Text style={styles.followStatLabel}>Abonnements</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.content}>
          <PremiumCard isPremium={false}>
            <Text style={styles.sectionTitle}>Informations</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Profil</Text>
              <Text style={styles.infoValue}>{getProfileIdentityLabel(profile)}</Text>
            </View>
            {profile.city ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Ville</Text>
                <Text style={styles.infoValue}>{profile.city}</Text>
              </View>
            ) : null}
          </PremiumCard>

          <PremiumCard isPremium={false} style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Actions</Text>
            {features.socialPeers ? (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => router.push('/profile/invite' as any)}
              >
                <Send size={18} color={accent.accent} />
                <Text style={[styles.linkText, { color: accent.accent }]}>Inviter des amis</Text>
              </TouchableOpacity>
            ) : null}
            {showPosterSuggestDrawer && !isProfessionnelAccount ? (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() =>
                  router.push(`${routes.posterSuggest}?source=community_suggest` as any)
                }
              >
                <Sparkles size={18} color={accent.accent} />
                <Text style={[styles.linkText, { color: accent.accent }]}>
                  Proposer depuis une affiche
                </Text>
              </TouchableOpacity>
            ) : null}
            {showMySuggestions ? (
              <TouchableOpacity style={styles.linkButton} onPress={handleViewMySuggestions}>
                <Lightbulb size={18} color={accent.accent} />
                <Text style={[styles.linkText, { color: accent.accent }]}>Mes suggestions</Text>
              </TouchableOpacity>
            ) : null}
            {showMyEvents ? (
              <TouchableOpacity style={styles.linkButton} onPress={handleViewMyEvents}>
                <Calendar size={18} color={accent.accent} />
                <Text style={[styles.linkText, { color: accent.accent }]}>Mes événements</Text>
              </TouchableOpacity>
            ) : null}
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
    borderWidth: 1,
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
  followStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  followStat: {
    alignItems: 'center',
    minWidth: 88,
  },
  followStatValue: {
    ...typography.h4,
    color: colors.brand.text,
    fontWeight: '800',
  },
  followStatLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
    marginTop: 2,
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
  diffuseurHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 18,
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
