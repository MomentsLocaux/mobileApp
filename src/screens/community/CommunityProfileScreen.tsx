import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Flag } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { CommunityService } from '../../services/community.service';
import { ReportService } from '@/services/report.service';
import ReportReasonModal from '@/components/moderation/ReportReasonModal';
import type { CommunityMember } from '../../types/community';
import type { EventWithCreator } from '@/types/database';
import { EventCard } from '@/components/events';
import { useAuth } from '@/hooks';

export default function CommunityProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [member, setMember] = useState<CommunityMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'prive'>('all');
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

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

  useEffect(() => {
    const loadEvents = async () => {
      if (!id) return;
      setLoadingEvents(true);
      try {
        const data = await CommunityService.listCreatorEvents({
          creatorId: id,
          dateFilter,
          visibility: visibilityFilter,
        });
        setEvents(data);
      } catch (e) {
        console.warn('load events', e);
      } finally {
        setLoadingEvents(false);
      }
    };
    loadEvents();
  }, [id, dateFilter, visibilityFilter]);

  useEffect(() => {
    const checkFollowing = async () => {
      if (!id || !profile) return;
      try {
        const following = await CommunityService.isFollowing(id);
        setIsFollowing(following);
      } catch (e) {
        console.warn('check following', e);
      }
    };
    checkFollowing();
  }, [id, profile]);

  const filteredLabel = useMemo(() => {
    const parts = [];
    if (dateFilter === 'upcoming') parts.push('À venir');
    if (dateFilter === 'past') parts.push('Passés');
    if (visibilityFilter === 'public') parts.push('Publics');
    if (visibilityFilter === 'prive') parts.push('Privés');
    return parts.length ? parts.join(' • ') : 'Tous les événements';
  }, [dateFilter, visibilityFilter]);

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
        <TouchableOpacity style={[styles.backButton, { paddingTop: insets.top + spacing.xs }]} onPress={() => router.back()}>
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
          {profile?.id !== member.user_id && (
            <View style={styles.profileActions}>
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followButtonActive]}
                onPress={async () => {
                  if (!id || followLoading) return;
                  setFollowLoading(true);
                  try {
                    if (isFollowing) {
                      await CommunityService.unfollow(id);
                      setIsFollowing(false);
                    } else {
                      await CommunityService.follow(id);
                      setIsFollowing(true);
                    }
                  } catch (e) {
                    console.warn('follow toggle', e);
                  } finally {
                    setFollowLoading(false);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
                  {isFollowing ? 'Suivi' : 'Suivre'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportButton} onPress={() => setReportVisible(true)}>
                <Flag size={14} color={colors.neutral[700]} />
                <Text style={styles.reportText}>Signaler</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Événements" value={member.events_created_count} />
        <Stat label="Followers" value={member.followers_count} />
        <Stat label="Suivis" value={member.following_count || 0} />
        <Stat label="Lumo" value={member.lumo_total} />
      </View>

      <View style={styles.eventsSection}>
        <View style={styles.eventsHeader}>
          <Text style={styles.sectionTitle}>Événements</Text>
          <Text style={styles.sectionSubtitle}>{filteredLabel}</Text>
        </View>
        <View style={styles.filterRow}>
          <FilterChip
            label="Tous"
            active={dateFilter === 'all'}
            onPress={() => setDateFilter('all')}
          />
          <FilterChip
            label="À venir"
            active={dateFilter === 'upcoming'}
            onPress={() => setDateFilter(dateFilter === 'upcoming' ? 'all' : 'upcoming')}
          />
          <FilterChip
            label="Passés"
            active={dateFilter === 'past'}
            onPress={() => setDateFilter(dateFilter === 'past' ? 'all' : 'past')}
          />
        </View>
        <View style={styles.filterRow}>
          <FilterChip
            label="Public"
            active={visibilityFilter === 'public'}
            onPress={() => setVisibilityFilter(visibilityFilter === 'public' ? 'all' : 'public')}
          />
          <FilterChip
            label="Privé"
            active={visibilityFilter === 'prive'}
            onPress={() => setVisibilityFilter(visibilityFilter === 'prive' ? 'all' : 'prive')}
          />
          <FilterChip
            label="Tous"
            active={visibilityFilter === 'all'}
            onPress={() => setVisibilityFilter('all')}
          />
        </View>

        {loadingEvents ? (
          <View style={styles.loadingEvents}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Chargement des événements…</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aucun événement trouvé</Text>
          </View>
        ) : (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onPress={() => router.push(`/events/${event.id}`)}
            />
          ))
        )}
      </View>

      <ReportReasonModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onSelect={async (reason) => {
          try {
            if (member?.user_id) {
              await ReportService.profile(member.user_id, { reason });
            }
          } catch (e) {
            console.warn('report profile', e);
          } finally {
            setReportVisible(false);
          }
        }}
      />
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

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
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
  eventsSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  eventsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.neutral[900],
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.neutral[0],
  },
  chipActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  chipText: {
    ...typography.caption,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary[700],
  },
  profileActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  followButtonActive: {
    backgroundColor: colors.neutral[200],
  },
  followText: {
    ...typography.body,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  followTextActive: {
    color: colors.neutral[800],
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
  },
  reportText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  loadingEvents: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
  },
  empty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.neutral[500],
  },
});
