import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import type { CommentWithAuthor } from '@/types/database';
import { formatAuthorHomeLocation, formatTimeAgo } from '@/utils/relative-time';
import { UserAvatar } from '@/components/ui/UserAvatar';

const STAR_COLOR = '#FBBF24';

type Props = {
  comment: CommentWithAuthor;
  compact?: boolean;
  size?: 'default' | 'reply';
};

function StarRow({ rating }: { rating?: number | null }) {
  if (typeof rating !== 'number' || rating <= 0) return null;
  const filled = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <View style={styles.stars} accessibilityLabel={`${filled} sur 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={12}
          color={STAR_COLOR}
          fill={value <= filled ? STAR_COLOR : 'transparent'}
        />
      ))}
    </View>
  );
}

export function EchoCommentCard({ comment, compact = false, size = 'default' }: Props) {
  const name = comment.author?.display_name?.trim() || 'Utilisateur';
  const location = formatAuthorHomeLocation(comment.author?.city, comment.author?.region);
  const ago = formatTimeAgo(comment.created_at);
  const hasRating = typeof comment.rating === 'number' && comment.rating > 0;
  const avatarSize = size === 'reply' ? 36 : 48;
  const showMore = compact && comment.message.trim().length > 160;

  return (
    <View>
      <View style={styles.header}>
        <UserAvatar
          uri={comment.author?.avatar_url}
          name={name}
          size={avatarSize}
        />
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {location ? (
            <Text style={styles.location} numberOfLines={1}>
              {location}
            </Text>
          ) : null}
        </View>
      </View>

      {(hasRating || ago) ? (
        <View style={styles.metaRow}>
          <StarRow rating={comment.rating} />
          {ago ? (
            <Text style={styles.ago} numberOfLines={1}>
              {hasRating ? ` · ${ago}` : ago}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.message} numberOfLines={compact ? 5 : undefined}>
        {comment.message}
      </Text>
      {showMore ? <Text style={styles.more}>Afficher plus</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  location: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  ago: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    flexShrink: 1,
  },
  message: {
    ...typography.body,
    color: colors.brand.text,
    lineHeight: 22,
  },
  more: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginTop: spacing.xs,
  },
});
