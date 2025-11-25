import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings, User as UserIcon, MapPin, Calendar, Award, LogOut } from 'lucide-react-native';
import { Button, Card } from '../../src/components/ui';
import { useAuth } from '../../src/hooks';
import { colors, spacing, typography, borderRadius } from '../../src/constants/theme';
import { getRoleLabel, getRoleBadgeColor } from '../../src/utils/roleHelpers';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();

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
    if (profile?.id) {
      router.push(`/creator/${profile.id}` as any);
    }
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.fallback}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <UserIcon size={40} color={colors.neutral[0]} />
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
          <Settings size={20} color={colors.primary[600]} />
          <Text style={styles.editButtonText}>Modifier le profil</Text>
        </TouchableOpacity>
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

        {profile.role === 'createur' && (
          <Card padding="md" style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Actions créateur</Text>
            <TouchableOpacity style={styles.linkButton} onPress={handleViewMyEvents}>
              <Calendar size={18} color={colors.primary[600]} />
              <Text style={styles.linkText}>Voir mes événements</Text>
            </TouchableOpacity>
          </Card>
        )}

        {(profile.role === 'moderateur' || profile.role === 'admin') && (
          <Card padding="md" style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Modération</Text>
            <TouchableOpacity style={styles.linkButton}>
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
          icon={<LogOut size={18} color={colors.error[600]} />}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  header: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.neutral[50],
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
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  displayName: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  email: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    marginBottom: spacing.xs,
  },
  bio: {
    ...typography.body,
    color: colors.neutral[700],
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
    color: colors.primary[600],
    fontWeight: '600',
  },
  content: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    fontWeight: '500',
  },
  infoValue: {
    ...typography.body,
    color: colors.neutral[900],
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
    color: colors.primary[600],
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
