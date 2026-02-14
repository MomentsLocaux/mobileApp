import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  AppBackground,
  Avatar,
  Badge,
  Button,
  Card,
  Icon,
  Input,
  ProgressBar,
  ScaleOnPress,
  ScreenLayout,
  Typography,
  animation,
  colors,
  radius,
  shadows,
  spacing,
} from '@/components/ui/v2';
import {
  Calendar,
  ChevronLeft,
  Heart,
  MapPin,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
  Ticket,
} from 'lucide-react-native';

export type EventAttendee = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

export type OrganizerInfo = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  followersLabel: string;
};

export type CommunityBuzzItem = {
  id: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  content: string;
  likesCount: number;
  commentsCount: number;
  timeLabel?: string;
};

export type EventDetailViewData = {
  title: string;
  category: string;
  statusLabel?: string;
  heroImageUrl?: string | null;
  dateTimeLabel: string;
  dateTimeSubLabel?: string;
  locationLabel: string;
  locationSubLabel?: string;
  mapLinkLabel: string;
  priceLabel: string;
  xpCurrent: number;
  xpTarget: number;
  description: string;
  tags: string[];
  attendees: EventAttendee[];
  extraAttendeesCount?: number;
  attendingLabel?: string;
  organizer: OrganizerInfo;
  communityBuzz: CommunityBuzzItem[];
  isFavorite?: boolean;
  isFollowingOrganizer?: boolean;
};

export type EventDetailScreenProps = {
  data?: EventDetailViewData;
  commentValue?: string;
  onCommentChange?: (value: string) => void;
  onBack?: () => void;
  onShare?: () => void;
  onToggleFavorite?: () => void;
  onCheckInNow?: () => void;
  onOpenMap?: () => void;
  onSubmitComment?: (value: string) => void;
  onPressAttendee?: (attendee: EventAttendee) => void;
  onFollowOrganizer?: () => void;
  onPressCommunitySeeAll?: () => void;
  onPressLikeBuzz?: (buzzId: string) => void;
  onPressCommentBuzz?: (buzzId: string) => void;
};

const mockData: EventDetailViewData = {
  title: 'Moments Locaux: Summer Underground Sessions',
  category: 'MUSIC',
  statusLabel: 'LIVE NOW',
  heroImageUrl:
    'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=1400&q=80',
  dateTimeLabel: 'Friday, Oct 27 • 19:00',
  dateTimeSubLabel: 'Ends at 23:30 (4.5 hours)',
  locationLabel: 'The Echo Lounge',
  locationSubLabel: '2.4 km from your location',
  mapLinkLabel: 'Open map',
  priceLabel: '$25.00',
  xpCurrent: 320,
  xpTarget: 450,
  description:
    'Join us for an exclusive underground electronic night with local art showcases. This edition features Brooklyn headliners and modular live performances.',
  tags: ['Techno', 'LiveMusic', 'Underground', 'NYC'],
  attendees: [
    { id: '1', name: 'Lena', avatarUrl: 'https://i.pravatar.cc/100?img=32' },
    { id: '2', name: 'Alex', avatarUrl: 'https://i.pravatar.cc/100?img=13' },
    { id: '3', name: 'Mina', avatarUrl: 'https://i.pravatar.cc/100?img=51' },
  ],
  extraAttendeesCount: 72,
  attendingLabel: 'Join 3 friends & others attending',
  organizer: {
    id: 'org-1',
    name: 'Urban Beats Collective',
    avatarUrl: 'https://i.pravatar.cc/100?img=68',
    followersLabel: 'Organizer • 4.2k followers',
  },
  communityBuzz: [
    {
      id: 'buzz-1',
      authorName: 'Alex Rivera',
      authorAvatarUrl: 'https://i.pravatar.cc/100?img=12',
      content: "I can't wait for this line-up. Who else is coming?",
      likesCount: 21,
      commentsCount: 5,
      timeLabel: '2h ago',
    },
    {
      id: 'buzz-2',
      authorName: 'Sam Lee',
      authorAvatarUrl: 'https://i.pravatar.cc/100?img=47',
      content: 'Last edition was insane. Sound system was perfect.',
      likesCount: 14,
      commentsCount: 3,
      timeLabel: '5h ago',
    },
  ],
};

export default function EventDetailScreen({
  data = mockData,
  commentValue,
  onCommentChange,
  onBack,
  onShare,
  onToggleFavorite,
  onCheckInNow,
  onOpenMap,
  onSubmitComment,
  onPressAttendee,
  onFollowOrganizer,
  onPressCommunitySeeAll,
  onPressLikeBuzz,
  onPressCommentBuzz,
}: EventDetailScreenProps) {
  const [localComment, setLocalComment] = useState('');

  const commentText = commentValue ?? localComment;

  const attendeesLabel = useMemo(() => {
    if (data.attendingLabel) return data.attendingLabel;
    const baseCount = data.attendees.length;
    return `Join ${baseCount} friends & others attending`;
  }, [data.attendees.length, data.attendingLabel]);

  const handleCommentChange = (value: string) => {
    if (onCommentChange) {
      onCommentChange(value);
      return;
    }
    setLocalComment(value);
  };

  const handleSubmitComment = () => {
    const nextValue = commentText.trim();
    if (!nextValue) return;
    onSubmitComment?.(nextValue);
    if (!onCommentChange) {
      setLocalComment('');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.screen}>
        <AppBackground opacity={0.16} />
        <ScreenLayout
          edges={['top', 'left', 'right']}
          scroll
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.heroSection}>
            {data.heroImageUrl ? (
              <Image source={{ uri: data.heroImageUrl }} style={styles.heroImage} />
            ) : (
              <View style={styles.heroFallback}>
                <Typography variant="subsection" color={colors.textSecondary}>
                  Event Visual
                </Typography>
              </View>
            )}

            <LinearGradient
              colors={['rgba(15, 23, 25, 0.1)', 'rgba(15, 23, 25, 0.92)']}
              locations={[0.45, 1]}
              style={styles.heroGradient}
            />

            <View style={styles.heroTopActions}>
              <ScaleOnPress
                onPress={onBack}
                accessibilityLabel="Go back"
                containerStyle={styles.heroIconButton}
              >
                <Icon icon={ChevronLeft} />
              </ScaleOnPress>

              <View style={styles.heroTopRight}>
                <ScaleOnPress
                  onPress={onShare}
                  accessibilityLabel="Share event"
                  containerStyle={styles.heroIconButton}
                >
                  <Icon icon={Share2} />
                </ScaleOnPress>

                <ScaleOnPress
                  onPress={onToggleFavorite}
                  accessibilityLabel="Toggle favorite"
                  containerStyle={styles.heroIconButton}
                >
                  <Icon
                    icon={Heart}
                    color={data.isFavorite ? colors.primary : colors.textPrimary}
                  />
                </ScaleOnPress>
              </View>
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.heroLabelsRow}>
              <Badge label={data.category} tone="primary" />
              {data.statusLabel ? <Badge label={data.statusLabel} tone="success" /> : null}
            </View>

            <Typography variant="displayLarge" color={colors.textPrimary} style={styles.title}>
              {data.title}
            </Typography>

            <Animated.View entering={FadeIn.duration(animation.fadeDuration)}>
              <Card padding="md" style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <View style={styles.metaIconWrap}>
                    <Icon icon={Calendar} color={colors.primary} />
                  </View>
                  <View style={styles.metaMain}>
                    <Typography variant="caption" color={colors.textSecondary}>
                      DATE & TIME
                    </Typography>
                    <Typography variant="subsection" color={colors.textPrimary}>
                      {data.dateTimeLabel}
                    </Typography>
                    {data.dateTimeSubLabel ? (
                      <Typography variant="bodySmall" color={colors.textSecondary}>
                        {data.dateTimeSubLabel}
                      </Typography>
                    ) : null}
                  </View>
                  <View style={styles.priceWrap}>
                    <Typography variant="h4" color={colors.primary}>
                      {data.priceLabel}
                    </Typography>
                    <Typography variant="caption" color={colors.textSecondary}>
                      PER TICKET
                    </Typography>
                  </View>
                </View>
              </Card>
            </Animated.View>

            <Animated.View entering={FadeIn.duration(animation.fadeDuration).delay(60)}>
              <Card padding="md" style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <View style={styles.metaIconWrap}>
                    <Icon icon={MapPin} color={colors.primary} />
                  </View>
                  <View style={styles.metaMain}>
                    <Typography variant="caption" color={colors.textSecondary}>
                      LOCATION
                    </Typography>
                    <Typography variant="subsection" color={colors.textPrimary}>
                      {data.locationLabel}
                    </Typography>
                    {data.locationSubLabel ? (
                      <Typography variant="bodySmall" color={colors.textSecondary}>
                        {data.locationSubLabel}
                      </Typography>
                    ) : null}
                  </View>
                  <ScaleOnPress
                    onPress={onOpenMap}
                    accessibilityLabel="Open map"
                    containerStyle={styles.mapLinkButton}
                  >
                    <Typography variant="bodyStrong" color={colors.primary}>
                      {data.mapLinkLabel}
                    </Typography>
                  </ScaleOnPress>
                </View>
              </Card>
            </Animated.View>

            <Animated.View entering={FadeIn.duration(animation.fadeDuration).delay(100)}>
              <Button
                title="CHECK-IN NOW"
                onPress={onCheckInNow}
                leftSlot={<Icon icon={Ticket} size={18} color={colors.background} />}
              />
            </Animated.View>

            <Animated.View entering={FadeIn.duration(animation.fadeDuration).delay(140)}>
              <Card padding="none" style={styles.rewardCard}>
                <LinearGradient
                  colors={['#2bbfe3', '#2a4fe3']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.rewardInner}
                >
                  <View style={styles.rewardTopRow}>
                    <View style={styles.rewardTextWrap}>
                      <Typography variant="h4" color={colors.textPrimary}>
                        Earn +450 XP
                      </Typography>
                      <Typography variant="body" color={colors.textPrimary}>
                        Participate and unlock your reward
                      </Typography>
                    </View>
                    <View style={styles.rewardIcon}>
                      <Icon icon={Sparkles} color={colors.textPrimary} />
                    </View>
                  </View>

                  <ProgressBar
                    value={data.xpCurrent}
                    max={data.xpTarget}
                    fillColor={colors.textPrimary}
                    trackColor="rgba(255,255,255,0.28)"
                    accessibilityLabel="XP reward progression"
                  />
                  <Typography variant="caption" color={colors.textPrimary}>
                    {data.xpCurrent}/{data.xpTarget} XP
                  </Typography>
                </LinearGradient>
              </Card>
            </Animated.View>

            <Animated.View entering={FadeIn.duration(animation.fadeDuration).delay(180)}>
              <View style={styles.attendeesRow}>
                <View style={styles.attendeesStack}>
                  {data.attendees.map((attendee, index) => (
                    <ScaleOnPress
                      key={attendee.id}
                      onPress={() => onPressAttendee?.(attendee)}
                      accessibilityLabel={`View ${attendee.name}`}
                      containerStyle={[
                        styles.attendeePressable,
                        { marginLeft: index === 0 ? 0 : -12, zIndex: data.attendees.length - index },
                      ]}
                    >
                      <Avatar uri={attendee.avatarUrl} name={attendee.name} size={36} />
                    </ScaleOnPress>
                  ))}
                  {data.extraAttendeesCount ? (
                    <View style={styles.extraAttendeesBubble}>
                      <Typography variant="caption" color={colors.textPrimary} weight="700">
                        +{data.extraAttendeesCount}
                      </Typography>
                    </View>
                  ) : null}
                </View>
                <Typography variant="body" color={colors.textSecondary}>
                  {attendeesLabel}
                </Typography>
              </View>
            </Animated.View>

            <View style={styles.sectionBlock}>
              <Typography variant="sectionTitle" color={colors.textPrimary}>
                About the Event
              </Typography>
              <Typography variant="body" color={colors.textSecondary} style={styles.description}>
                {data.description}
              </Typography>
            </View>

            <View style={styles.tagsWrap}>
              {data.tags.map((tag) => (
                <Badge key={tag} label={tag.startsWith('#') ? tag : `#${tag}`} tone="neutral" />
              ))}
            </View>

            <Animated.View entering={FadeIn.duration(animation.fadeDuration).delay(220)}>
              <View style={styles.commentComposer}>
                <Input
                  value={commentText}
                  onChangeText={handleCommentChange}
                  placeholder="Leave a comment..."
                  accessibilityLabel="Leave a comment"
                  containerStyle={styles.commentInputWrap}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmitComment}
                />
                <ScaleOnPress
                  onPress={handleSubmitComment}
                  accessibilityLabel="Send comment"
                  disabled={!commentText.trim()}
                  containerStyle={[
                    styles.sendButton,
                    !commentText.trim() && styles.sendButtonDisabled,
                  ]}
                >
                  <Icon icon={Send} color={colors.background} />
                </ScaleOnPress>
              </View>
            </Animated.View>

            <Animated.View entering={FadeIn.duration(animation.fadeDuration).delay(260)}>
              <Card padding="md" style={styles.organizerCard}>
                <View style={styles.organizerRow}>
                  <Avatar
                    uri={data.organizer.avatarUrl}
                    name={data.organizer.name}
                    size={54}
                  />
                  <View style={styles.organizerInfo}>
                    <Typography variant="subsection" color={colors.textPrimary}>
                      {data.organizer.name}
                    </Typography>
                    <Typography variant="bodySmall" color={colors.textSecondary}>
                      {data.organizer.followersLabel}
                    </Typography>
                  </View>
                  <Button
                    title={data.isFollowingOrganizer ? 'Following' : 'Follow'}
                    variant="secondary"
                    size="sm"
                    onPress={onFollowOrganizer}
                  />
                </View>
              </Card>
            </Animated.View>

            <View style={styles.communityHeader}>
              <Typography variant="sectionTitle" color={colors.textPrimary}>
                Community Buzz
              </Typography>
              <ScaleOnPress
                onPress={onPressCommunitySeeAll}
                accessibilityLabel="See all community comments"
              >
                <Typography variant="bodyStrong" color={colors.primary}>
                  See all
                </Typography>
              </ScaleOnPress>
            </View>

            <View style={styles.buzzList}>
              {data.communityBuzz.map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={FadeIn.duration(animation.fadeDuration).delay(300 + index * 40)}
                >
                  <Card padding="md" style={styles.buzzCard}>
                    <View style={styles.buzzTopRow}>
                      <Avatar
                        uri={item.authorAvatarUrl}
                        name={item.authorName}
                        size={38}
                      />
                      <View style={styles.buzzIdentity}>
                        <Typography variant="bodyStrong" color={colors.textPrimary}>
                          {item.authorName}
                        </Typography>
                        {item.timeLabel ? (
                          <Typography variant="caption" color={colors.textSecondary}>
                            {item.timeLabel}
                          </Typography>
                        ) : null}
                      </View>
                    </View>

                    <Typography variant="body" color={colors.textSecondary} style={styles.buzzContent}>
                      {item.content}
                    </Typography>

                    <View style={styles.buzzActions}>
                      <ScaleOnPress
                        onPress={() => onPressLikeBuzz?.(item.id)}
                        accessibilityLabel={`Like comment by ${item.authorName}`}
                        containerStyle={styles.buzzActionButton}
                      >
                        <Icon icon={Heart} size={16} color={colors.textSecondary} />
                        <Typography variant="caption" color={colors.textSecondary}>
                          {item.likesCount}
                        </Typography>
                      </ScaleOnPress>

                      <ScaleOnPress
                        onPress={() => onPressCommentBuzz?.(item.id)}
                        accessibilityLabel={`Open replies for ${item.authorName}`}
                        containerStyle={styles.buzzActionButton}
                      >
                        <Icon icon={MessageCircle} size={16} color={colors.textSecondary} />
                        <Typography variant="caption" color={colors.textSecondary}>
                          {item.commentsCount}
                        </Typography>
                      </ScaleOnPress>
                    </View>
                  </Card>
                </Animated.View>
              ))}
            </View>
          </View>
        </ScreenLayout>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    paddingBottom: spacing.xxl,
  },
  heroSection: {
    width: '100%',
    height: 300,
    position: 'relative',
    backgroundColor: colors.surfaceLevel2,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTopActions: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTopRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroIconButton: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 36, 38, 0.74)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  body: {
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.sm,
    gap: spacing.lg,
  },
  heroLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    lineHeight: 46,
  },
  metaCard: {
    ...shadows.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: 'rgba(43, 191, 227, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaMain: {
    flex: 1,
    gap: spacing.xxs,
  },
  priceWrap: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  mapLinkButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  rewardCard: {
    overflow: 'hidden',
    borderColor: 'rgba(43, 191, 227, 0.4)',
  },
  rewardInner: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  rewardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rewardTextWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  rewardIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  attendeesStack: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  attendeePressable: {
    borderRadius: radius.full,
  },
  extraAttendeesBubble: {
    marginLeft: -10,
    minWidth: 40,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLevel2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.xs,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  description: {
    lineHeight: 30,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  commentInputWrap: {
    flex: 1,
  },
  sendButton: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...shadows.primaryGlow,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  organizerCard: {
    borderColor: 'rgba(43, 191, 227, 0.32)',
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  organizerInfo: {
    flex: 1,
    gap: spacing.xxs,
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buzzList: {
    gap: spacing.sm,
  },
  buzzCard: {
    gap: spacing.sm,
  },
  buzzTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  buzzIdentity: {
    flex: 1,
    gap: 2,
  },
  buzzContent: {
    lineHeight: 24,
  },
  buzzActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  buzzActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
  },
});
