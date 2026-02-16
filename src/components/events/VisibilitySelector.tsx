import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image, ScrollView } from 'react-native';
import { Users, Search } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { CommunityService } from '@/services/community.service';

type Props = {
  value: 'public' | 'unlisted';
  privateAudienceIds: string[];
  onChange: (v: 'public' | 'unlisted') => void;
  onChangeAudience: (ids: string[]) => void;
};

type Follower = { id: string; display_name: string; avatar_url: string | null };

export const VisibilitySelector = ({ value, privateAudienceIds, onChange, onChangeAudience }: Props) => {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value !== 'unlisted') return;
    let mounted = true;
    setLoading(true);
    CommunityService.listMyFollowers()
      .then((rows) => {
        if (mounted) setFollowers(rows);
      })
      .catch((err) => {
        console.warn('list followers', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [value]);

  const filtered = useMemo(() => {
    if (!query.trim()) return followers;
    const q = query.trim().toLowerCase();
    return followers.filter((f) => f.display_name.toLowerCase().includes(q));
  }, [followers, query]);

  const toggleAudience = (id: string) => {
    if (privateAudienceIds.includes(id)) {
      onChangeAudience(privateAudienceIds.filter((item) => item !== id));
      return;
    }
    onChangeAudience([...privateAudienceIds, id]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Visibilité</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.segment, value === 'public' && styles.segmentActive]}
          onPress={() => onChange('public')}
        >
          <Text style={[styles.segmentText, value === 'public' && styles.segmentTextActive]}>Public</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, value === 'unlisted' && styles.segmentActive]}
          onPress={() => onChange('unlisted')}
        >
          <Text style={[styles.segmentText, value === 'unlisted' && styles.segmentTextActive]}>Privé</Text>
        </TouchableOpacity>
      </View>

      {value === 'unlisted' ? (
        <View style={styles.privateBox}>
          <View style={styles.privateHeader}>
            <Users size={16} color={colors.brand.secondary} />
            <Text style={styles.privateTitle}>Audience privée</Text>
            <Text style={styles.privateCount}>{privateAudienceIds.length} sélectionné(s)</Text>
          </View>

          <View style={styles.searchRow}>
            <Search size={15} color={colors.brand.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher parmi vos followers"
              placeholderTextColor={colors.brand.textSecondary}
              style={styles.searchInput}
            />
          </View>

          <ScrollView style={styles.followersList} contentContainerStyle={styles.followersContent}>
            {loading ? (
              <Text style={styles.emptyText}>Chargement...</Text>
            ) : filtered.length === 0 ? (
              <Text style={styles.emptyText}>Aucun follower trouvé.</Text>
            ) : (
              filtered.map((follower) => {
                const active = privateAudienceIds.includes(follower.id);
                return (
                  <TouchableOpacity
                    key={follower.id}
                    style={[styles.followerRow, active && styles.followerRowActive]}
                    onPress={() => toggleAudience(follower.id)}
                  >
                    {follower.avatar_url ? (
                      <Image source={{ uri: follower.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]} />
                    )}
                    <Text style={[styles.followerName, active && styles.followerNameActive]} numberOfLines={1}>
                      {follower.display_name}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <Text style={styles.privateHint}>
            Ces personnes recevront une notification d'invitation privée à la publication.
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.full,
    padding: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.brand.surface,
  },
  segmentText: {
    ...typography.body,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.brand.text,
  },
  privateBox: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: colors.brand.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  privateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  privateTitle: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  privateCount: {
    ...typography.caption,
    color: colors.brand.secondary,
    marginLeft: 'auto',
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.brand.text,
  },
  followersList: {
    maxHeight: 180,
  },
  followersContent: {
    gap: spacing.xs,
  },
  followerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  followerRowActive: {
    borderColor: colors.brand.secondary,
    backgroundColor: 'rgba(43,191,227,0.12)',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  followerName: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
    flex: 1,
  },
  followerNameActive: {
    color: colors.brand.secondary,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  privateHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
});
