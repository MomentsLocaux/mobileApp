import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Flag, Lock, MapPin, MessageCircle, Users } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { AppBackground } from '@/components/ui';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { CommunityService } from '../../services/community.service';
import { LocalStatusService } from '@/services/local-status.service';
import { ReportService } from '@/services/report.service';
import ReportReasonModal from '@/components/moderation/ReportReasonModal';
import type { CommunityMember } from '../../types/community';
import type { EventWithCreator } from '@/types/database';
import { MapDiscoveryEventCard } from '@/components/search/MapDiscoveryEventCard';
import { sharePublishedEvent } from '@/utils/event-share';
import { SocialService } from '@/services/social.service';
import { useAuth } from '@/hooks';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { features } from '@/config/features';
import { MessagingService } from '@/services/messaging.service';
import { canMessageProfile, messagingBlockedCopy, normalizeProfileVisibility } from '@/utils/messaging-access';
import Toast from 'react-native-toast-message';

function memberFirstName(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) return 'ce membre';
  return trimmed.split(/\s+/)[0] ?? 'ce membre';
}

export default function CommunityProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user, session } = useAuth();
  const [member, setMember] = useState<CommunityMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [heartedIds, setHeartedIds] = useState<ReadonlySet<string>>(new Set());
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'prive'>('all');
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [theyFollowMe, setTheyFollowMe] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [isAmbassadeur, setIsAmbassadeur] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const currentUserId = user?.id || session?.user?.id || profile?.id;
  const showCreatorEvents = features.eventCreate;

  const refreshFollowingState = React.useCallback(async () => {
    if (!id || !currentUserId) return;
    try {
      const link = await CommunityService.getSocialLink(id);
      setIsFollowing(link.isFollowing);
      setTheyFollowMe(link.theyFollowMe);
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
    if (!showCreatorEvents) {
      setEvents([]);
      setLoadingEvents(false);
      return;
    }
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
  }, [id, dateFilter, visibilityFilter, showCreatorEvents]);

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
    const cover = member?.cover_url;
    const eventCovers = showCreatorEvents ? events.map((evt) => evt.cover_url) : [];
    const urls = [cover, ...eventCovers].filter(
      (url): url is string => typeof url === 'string' && url.trim().length > 0,
    );
    return Array.from(new Set(urls)).slice(0, 6);
  }, [member?.cover_url, events, showCreatorEvents]);

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

  const isOwnProfile = currentUserId === member.user_id;
  const firstName = memberFirstName(member.display_name);
  const cityLabel = member.city?.trim() || null;
  const visibility = normalizeProfileVisibility(member.profile_visibility);
  const isPrivate = visibility === 'private';
  const messageAccess = canMessageProfile({
    viewerId: currentUserId,
    targetId: member.user_id,
    visibility,
    viewerFollowsTarget: isFollowing,
    targetFollowsViewer: theyFollowMe,
  });
  const isFriend = messageAccess.isFriend;
  const presenceCopy = isOwnProfile
    ? isPrivate
      ? 'C’est votre profil privé. Les autres membres doivent être amis (suivi mutuel) pour vous écrire.'
      : 'C’est votre profil public. Les autres membres voient votre nom, votre ville et peuvent vous écrire.'
    : isFriend
      ? `Vous et ${firstName} êtes amis. Vous pouvez vous écrire.`
      : isFollowing
        ? `Vous suivez ${firstName}. Ses coups de cœur apparaîtront près des événements que vous découvrez.`
        : `Suivez ${firstName} pour voir ses coups de cœur dans votre fil.`;

  const openConversation = async () => {
    if (!id || messageBusy) return;
    if (!messageAccess.allowed) {
      Toast.show({
        type: 'info',
        text1: 'Profil privé',
        text2: messagingBlockedCopy({ firstName, viewerFollowsTarget: isFollowing }),
      });
      return;
    }
    setMessageBusy(true);
    try {
      const conversationId = await MessagingService.openConversation(id);
      router.push(
        `/messages/${conversationId}?name=${encodeURIComponent(member.display_name || firstName)}` as any,
      );
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Message impossible',
        text2: error instanceof Error ? error.message : 'Réessaie dans un instant.',
      });
    } finally {
      setMessageBusy(false);
    }
  };

  const toggleFollow = async () => {
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
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
        ) : galleryUrls.length === 1 ? (
          <Image source={{ uri: galleryUrls[0] }} style={styles.cover} />
        ) : (
          <View style={styles.coverFallback} />
        )}
        <View style={styles.headerOverlay}>
          <UserAvatar
            uri={member.avatar_url}
            name={member.display_name}
            size={100}
            style={styles.avatar}
          />
          <Text style={styles.name}>{member.display_name}</Text>
          <Text style={styles.meta}>{cityLabel || 'Membre de la communauté'}</Text>
          {isPrivate ? (
            <View style={styles.privateBadge}>
              <Lock size={12} color={colors.brand.ink} />
              <Text style={styles.privateBadgeText}>Profil privé</Text>
            </View>
          ) : null}
          {isAmbassadeur ? (
            <View style={styles.ambassadorBadge}>
              <Text style={styles.ambassadorBadgeText}>Ambassadeur</Text>
            </View>
          ) : null}
          {member.bio ? <Text style={styles.bio}>{member.bio}</Text> : null}
          {!isOwnProfile ? (
            <View style={styles.profileActions}>
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followButtonActive]}
                onPress={toggleFollow}
                activeOpacity={0.8}
                disabled={followLoading}
                accessibilityRole="button"
                accessibilityLabel={isFollowing ? 'Ne plus suivre' : 'Suivre'}
              >
                <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
                  {isFollowing ? (theyFollowMe ? 'Ami' : 'Suivi') : theyFollowMe ? 'Suivre aussi' : 'Suivre'}
                </Text>
              </TouchableOpacity>
              {features.socialPeers ? (
                <TouchableOpacity
                  style={[styles.messageButton, !messageAccess.allowed && styles.messageButtonDisabled]}
                  onPress={() => void openConversation()}
                  activeOpacity={0.8}
                  disabled={messageBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Envoyer un message"
                >
                  <MessageCircle size={14} color={colors.brand.text} />
                  <Text style={styles.messageText}>Message</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.reportButton} onPress={() => setReportVisible(true)}>
                <Flag size={14} color={colors.brand.textSecondary} />
                <Text style={styles.reportText}>Signaler</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => router.push('/settings/privacy/profile' as any)}
              accessibilityRole="button"
              accessibilityLabel="Visibilité du profil"
            >
              <Lock size={14} color={colors.brand.text} />
              <Text style={styles.messageText}>{isPrivate ? 'Profil privé' : 'Profil public'}</Text>
            </TouchableOpacity>
          )}
          {!isOwnProfile && isPrivate && !messageAccess.allowed ? (
            <Text style={styles.privateHint}>
              {messagingBlockedCopy({ firstName, viewerFollowsTarget: isFollowing })}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.statsRow}>
        {showCreatorEvents ? <Stat label="Événements" value={member.events_created_count} /> : null}
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

      {!showCreatorEvents ? (
        <View style={styles.presenceCard}>
          <View style={styles.presenceHeader}>
            <View style={styles.presenceIcon}>
              <Users size={18} color={colors.brand.secondary} />
            </View>
            <Text style={styles.presenceTitle}>Dans la communauté</Text>
          </View>
          {cityLabel ? (
            <View style={styles.presenceCityRow}>
              <MapPin size={14} color={colors.brand.secondary} />
              <Text style={styles.presenceCity}>{cityLabel}</Text>
            </View>
          ) : null}
          <Text style={styles.presenceCopy}>{presenceCopy}</Text>
          {features.socialPeers ? (
            <TouchableOpacity
              style={styles.presenceCta}
              onPress={() => router.push('/community' as any)}
              accessibilityRole="button"
              accessibilityLabel="Découvrir d'autres membres"
              activeOpacity={0.8}
            >
              <Text style={styles.presenceCtaText}>Découvrir d'autres membres</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
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
              <MapDiscoveryEventCard
                key={event.id}
                event={event}
                variant="feed"
                liked={heartedIds.has(event.id)}
                onOpen={() => router.push(`/events/${event.id}`)}
                onToggleHeart={(item) => {
                  const liked = heartedIds.has(item.id);
                  setHeartedIds((current) => {
                    const next = new Set(current);
                    if (liked) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  });
                  if (!profile?.id) return;
                  void (liked ? SocialService.unlike(profile.id, item.id) : SocialService.like(profile.id, item.id));
                }}
                onShare={(item) => { void sharePublishedEvent(item); }}
              />
            ))
          )}
        </View>
      )}

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
  content: {
    paddingBottom: spacing.xl,
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
  coverFallback: {
    width: '100%',
    height: 120,
    backgroundColor: colors.brand.surfaceMuted,
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
    backgroundColor: 'rgba(255,255,255,0.55)',
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
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    borderWidth: 3,
    borderColor: colors.brand.surface,
    marginBottom: spacing.sm,
    backgroundColor: colors.brand.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typography.h3,
    color: colors.brand.text,
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
    color: colors.brand.ink,
    fontWeight: '700',
  },
  privateBadge: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  privateBadgeText: {
    ...typography.caption,
    color: colors.brand.ink,
    fontWeight: '700',
  },
  privateHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    lineHeight: 18,
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
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.line,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statValue: {
    ...typography.h4,
    color: colors.brand.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  presenceCard: {
    marginHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.line,
  },
  presenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  presenceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceTitle: {
    ...typography.h4,
    color: colors.brand.text,
  },
  presenceCityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  presenceCity: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
  },
  presenceCopy: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  presenceCta: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surfaceMuted,
  },
  presenceCtaText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
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
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.brand.surface,
  },
  chipActive: {
    borderColor: colors.brand.secondary,
    backgroundColor: colors.brand.surfaceMuted,
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
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
  },
  followButtonActive: {
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  followText: {
    ...typography.body,
    color: colors.brand.onAccent,
    fontWeight: '700',
  },
  followTextActive: {
    color: colors.brand.textSecondary,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  messageButtonDisabled: {
    opacity: 0.7,
  },
  messageText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surfaceMuted,
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
