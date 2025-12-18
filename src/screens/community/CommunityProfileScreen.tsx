import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { CommunityService } from '../../services/community.service';
import type { CommunityMember } from '../../types/community';

export default function CommunityProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<CommunityMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const data = await CommunityService.getMember(id);
        setMember(data);
      } catch (e) {
        console.warn('load member', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!member) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.error}>Profil introuvable</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.neutral[800]} />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
        {member.cover_url ? (
          <Image source={{ uri: member.cover_url }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, { backgroundColor: colors.neutral[200] }]} />
        )}
        <View style={styles.headerOverlay}>
          {member.avatar_url ? (
            <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.neutral[300] }]} />
          )}
          <Text style={styles.name}>{member.display_name}</Text>
          <Text style={styles.meta}>{member.city || 'Sans ville'}</Text>
          {member.bio ? <Text style={styles.bio}>{member.bio}</Text> : null}
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Événements" value={member.events_created_count} />
        <Stat label="Followers" value={member.followers_count} />
        <Stat label="Suivis" value={member.following_count || 0} />
        <Stat label="Lumo" value={member.lumo_total} />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    ...typography.body,
    color: colors.error[600],
  },
  header: {
    backgroundColor: colors.neutral[50],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backText: {
    ...typography.bodySmall,
    color: colors.neutral[800],
    fontWeight: '600',
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
    borderWidth: 3,
    borderColor: colors.neutral[0],
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  meta: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    marginBottom: spacing.xs,
  },
  bio: {
    ...typography.body,
    color: colors.neutral[700],
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    backgroundColor: colors.neutral[0],
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h4,
    color: colors.neutral[900],
  },
  statLabel: {
    ...typography.caption,
    color: colors.neutral[600],
  },
});
