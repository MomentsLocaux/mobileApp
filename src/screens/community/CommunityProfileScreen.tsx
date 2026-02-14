import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Flag } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground, Card, TopBar, colors, radius, spacing, typography } from '@/components/ui/v2';
import { EventCard } from '@/components/events';
import ReportReasonModal from '@/components/moderation/ReportReasonModal';
import { useAuth } from '@/hooks';
import { CommunityService } from '@/services/community.service';
import { ReportService } from '@/services/report.service';
import type { EventWithCreator } from '@/types/database';
import type { CommunityMember } from '@/types/community';

export default function CommunityProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [member, setMember] = useState<CommunityMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'prive'>('all');
  const [isFollowing, setIsFollowing] = useState(false);
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
      <SafeAreaView style={styles.safe}>
        <AppBackground opacity={0.18} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!member) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppBackground opacity={0.18} />
        <View style={styles.centerState}>
          <Text style={styles.error}>Profil introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppBackground opacity={0.18} />
      <View style={styles.topBarWrap}>
        <TopBar title="Profil" onBack={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card padding="none" style={styles.heroCard}>
          {member.cover_url ? (
            <Image source={{ uri: member.cover_url }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]} />
          )}

          <View style={styles.heroOverlay}>
            {member.avatar_url ? (
              <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]} />
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
                  accessibilityRole="button"
                  activeOpacity={0.85}
                >
                  <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
                    {isFollowing ? 'Suivi' : 'Suivre'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.reportButton}
                  onPress={() => setReportVisible(true)}
                  accessibilityRole="button"
                  activeOpacity={0.85}
                >
                  <Flag size={14} color={colors.textPrimary} />
                  <Text style={styles.reportText}>Signaler</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Card>

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
            <FilterChip label="Tous" active={dateFilter === 'all'} onPress={() => setDateFilter('all')} />
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
            <FilterChip label="Tous" active={visibilityFilter === 'all'} onPress={() => setVisibilityFilter('all')} />
          </View>

          {loadingEvents ? (
            <View style={styles.loadingEvents}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Chargement des événements…</Text>
            </View>
          ) : events.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Aucun événement trouvé</Text>
            </View>
          ) : (
            events.map((event) => (
              <EventCard key={event.id} event={event} onPress={() => router.push(`/events/${event.id}`)} />
            ))
          )}
        </View>
      </ScrollView>

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
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card padding="sm" style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      activeOpacity={0.85}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBarWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  error: {
    ...typography.bodyStrong,
    color: colors.danger,
  },
  heroCard: {
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: 160,
  },
  coverPlaceholder: {
    backgroundColor: colors.surfaceLevel2,
  },
  heroOverlay: {
    alignItems: 'center',
    marginTop: -44,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: colors.background,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceLevel2,
  },
  name: {
    ...typography.subsection,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  bio: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 82,
  },
  statValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  eventsSection: {
    gap: spacing.sm,
  },
  eventsHeader: {
    gap: spacing.xxs,
  },
  sectionTitle: {
    ...typography.subsection,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sectionSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceLevel1,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(43, 191, 227, 0.16)',
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  followButton: {
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonActive: {
    backgroundColor: colors.surfaceLevel2,
  },
  followText: {
    ...typography.bodyStrong,
    color: colors.background,
  },
  followTextActive: {
    color: colors.textPrimary,
  },
  reportButton: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceLevel1,
  },
  reportText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  loadingEvents: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  empty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
