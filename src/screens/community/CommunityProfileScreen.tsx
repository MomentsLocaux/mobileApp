import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Flag } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { AppBackground } from '@/components/ui';
import { CommunityService } from '../../services/community.service';
import { LocalStatusService } from '@/services/local-status.service';
import { ReportService } from '@/services/report.service';
import ReportReasonModal from '@/components/moderation/ReportReasonModal';
import type { CommunityMember } from '../../types/community';
import type { EventWithCreator } from '@/types/database';
import { EventCard } from '@/components/events';
import { useAuth } from '@/hooks';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';

export default function CommunityProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user, session } = useAuth();
  const [member, setMember] = useState<CommunityMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'prive'>('all');
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [isAmbassadeur, setIsAmbassadeur] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const currentUserId = user?.id || session?.user?.id || profile?.id;

  const refreshFollowingState = React.useCallback(async () => {
    if (!id || !currentUserId) return;
    try {
      const following = await CommunityService.isFollowing(id);
      setIsFollowing(following);
    } catch (e) {
      console.warn('check following', e);
    }
  }, [id, currentUserId]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const data = await CommunityService.getMember(id);
        setMember(data);
        const fromStats = data?.is_ambassadeur === true;
        if (!GAMIFICATION_ENABLED) {
          setIsAmbassadeur(false);
        } else {
          const status = await LocalStatusService.getForUser(id);
          setIsAmbassadeur(status.isAmbassadeur || fromStats);
        }
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
    refreshFollowingState();
  }, [refreshFollowingState]);

  useFocusEffect(
    React.useCallback(() => {
      refreshFollowingState();
    }, [refreshFollowingState]),
  );

  const filteredLabel = useMemo(() => {
    const parts = [];
    if (dateFilter === 'upcoming') parts.push('À venir');
    if (dateFilter === 'past') parts.push('Passés');
    if (visibilityFilter === 'public') parts.push('Publics');
    if (visibilityFilter === 'prive') parts.push('Privés');
    return parts.length ? parts.join(' • ') : 'Tous les événements';
  }, [dateFilter, visibilityFilter]);

  const galleryUrls = useMemo(() => {
    const urls = [member?.cover_url, ...events.map((evt) => evt.cover_url)].filter(
      (url): url is string => typeof url === 'string' && url.trim().length > 0,
    );
    return Array.from(new Set(urls)).slice(0, 6);
  }, [member?.cover_url, events]);

  const coverWidth = Dimensions.get('window').width;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <AppBackground />
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  if (!member) {
    return (
      <View style={styles.loadingContainer}>
        <AppBackground />
        <Text style={styles.error}>Profil introuvable</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <AppBackground />
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { paddingTop: insets.top + spacing.xs }]} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.brand.text} />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
        {galleryUrls.length > 1 ? (
          <View style={styles.galleryWrap}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const next = Math.round(e.nativeEvent.contentOffset.x / coverWidth);
                setGalleryIndex(next);
              }}
            >
              {galleryUrls.map((url) => (
                <Image key={url} source={{ uri: url }} style={[styles.cover, { width: coverWidth }]} />
              ))}
            </ScrollView>
            <View style={styles.galleryDots}>
              {galleryUrls.map((url, index) => (
                <View
                  key={url}
                  style={[styles.galleryDot, index === galleryIndex && styles.galleryDotActive]}
                />
              ))}
            </View>
          </View>
        ) : member.cover_url ? (
          <Image source={{ uri: member.cover_url }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
        )}
        <View style={styles.headerOverlay}>
          {member.avatar_url ? (
            <Image source={{ uri: member.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          )}
          <Text style={styles.name}>{member.display_name}</Text>
          <Text style={styles.meta}>{member.city || 'Sans ville'}</Text>
          {isAmbassadeur ? (
            <View style={styles.ambassadorBadge}>
              <Text style={styles.ambassadorBadgeText}>Ambassadeur</Text>
            </View>
          ) : null}
          {member.bio ? <Text style={styles.bio}>{member.bio}</Text> : null}
          {currentUserId !== member.user_id && (
            <View style={styles.profileActions}>
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followButtonActive]}
                onPress={async () => {
                  if (!id || followLoading) return;
                  setFollowLoading(true);
                  try {
                    if (isFollowing) {
                      await CommunityService.unfollow(id);
                    } else {
                      await CommunityService.follow(id);
                    }
                    await refreshFollowingState();
                  } catch (e) {
                    console.warn('follow toggle error', e);
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
                <Flag size={14} color={colors.brand.textSecondary} />
                <Text style={styles.reportText}>Signaler</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Événements" value={member.events_created_count} />
        <Stat
          label="Followers"
          value={member.followers_count}
          onPress={() => router.push(`/community/follows?userId=${member.user_id}&tab=followers` as any)}
        />
        <Stat
          label="Suivis"
          value={member.following_count || 0}
          onPress={() => router.push(`/community/follows?userId=${member.user_id}&tab=following` as any)}
        />
        {GAMIFICATION_ENABLED ? <Stat label="Engagement" value={member.lumo_total ?? 0} /> : null}
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
            <ActivityIndicator size="small" color={colors.brand.primary} />
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
              variant="discovery"
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

function Stat({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );
  if (!onPress) {
    return <View style={styles.statBox}>{content}</View>;
  }
  return (
    <TouchableOpacity
      style={styles.statBox}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value}`}
      activeOpacity={0.8}
    >
      {content}
    </TouchableOpacity>
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
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  error: {
    ...typography.body,
    color: colors.error[500],
  },
  header: {
    backgroundColor: 'transparent',
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
    color: colors.brand.text,
    fontWeight: '600',
  },
  cover: {
    width: '100%',
    height: 180,
  },
  galleryWrap: {
    position: 'relative',
  },
  galleryDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  galleryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  galleryDotActive: {
    backgroundColor: colors.brand.secondary,
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
    borderColor: colors.brand.surface,
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.h3,
    color: colors.brand.text,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.xs,
  },
  ambassadorBadge: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.page,
  },
  ambassadorBadgeText: {
    ...typography.caption,
    color: colors.brand.surface,
    fontWeight: '700',
  },
  bio: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    backgroundColor: 'transparent',
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h4,
    color: colors.brand.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
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
    color: colors.brand.text,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.page,
  },
  chipText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.brand.text,
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
    backgroundColor: colors.brand.page,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  followButtonActive: {
    backgroundColor: colors.brand.surface,
  },
  followText: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  followTextActive: {
    color: colors.brand.textSecondary,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  reportText: {
    ...typography.bodySmall,
    color: colors.brand.text,
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
    color: colors.brand.textSecondary,
  },
  empty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
});
