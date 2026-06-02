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
import { Settings, User as UserIcon, Calendar, Award } from 'lucide-react-native';
import { AppBackground, Button, Card } from '../../src/components/ui';
import { useAuth } from '../../src/hooks';
import { colors, spacing, typography, borderRadius } from '../../src/constants/theme';
import { getRoleLabel, getRoleBadgeColor } from '../../src/utils/roleHelpers';
import { GuestGateModal } from '../../src/components/auth/GuestGateModal';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, signOut, session } = useAuth();
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

  const handleViewMyEvents = () => {
    router.push('/profile/my-events' as any);
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
        <View style={styles.header}>
          {profile.cover_url ? (
            <Image source={{ uri: profile.cover_url }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, { backgroundColor: colors.neutral[200] }]} />
          )}
          <View style={styles.headerOverlay}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <UserIcon size={40} color={colors.brand.text} />
              </View>
            )}
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
          <Card padding="md">
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
          </Card>

          <Card padding="md" style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <TouchableOpacity style={styles.linkButton} onPress={handleViewMyEvents}>
              <Calendar size={18} color={colors.brand.secondary} />
              <Text style={styles.linkText}>Mes événements</Text>
            </TouchableOpacity>
          </Card>

          {(profile.role === 'moderateur' || profile.role === 'admin') && (
            <Card padding="md" style={styles.actionCard}>
              <Text style={styles.sectionTitle}>Modération</Text>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => router.push('/moderation' as any)}
              >
                <Award size={18} color={colors.secondary[600]} />
                <Text style={styles.linkText}>Accès modération</Text>
              </TouchableOpacity>
            </Card>
          )}

          <Button
            title="Se déconnecter"
            onPress={handleSignOut}
            variant="outline"
            fullWidth
            style={styles.signOutButton}
          />
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
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  signOutButton: {
    marginTop: spacing.lg,
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
