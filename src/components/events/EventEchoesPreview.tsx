import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import type { CommentWithAuthor } from '@/types/database';
import { formatEchoesCountLabel } from '@/utils/relative-time';
import { EchoCommentCard } from './EchoCommentCard';

type Props = {
  comments: CommentWithAuthor[];
  onOpenAll: () => void;
};

const PEEK = 28;
const CARD_GAP = spacing.sm;

export function EventEchoesPreview({ comments, onOpenAll }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const rootComments = useMemo(
    () => comments.filter((comment) => !comment.parent_comment_id),
    [comments],
  );
  const cardWidth = Math.max(240, windowWidth - spacing.lg * 2 - PEEK);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Echos de la communauté</Text>

      {rootComments.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucun avis pour le moment</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={cardWidth + CARD_GAP}
          snapToAlignment="start"
          disableIntervalMomentum
          contentContainerStyle={styles.carousel}
        >
          {rootComments.map((comment) => (
            <Pressable
              key={comment.id}
              onPress={onOpenAll}
              style={[styles.card, { width: cardWidth }]}
              accessibilityRole="button"
              accessibilityLabel={`Avis de ${comment.author?.display_name || 'Utilisateur'}`}
            >
              <EchoCommentCard comment={comment} compact />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Pressable
        onPress={onOpenAll}
        style={styles.allButton}
        accessibilityRole="button"
        accessibilityLabel={formatEchoesCountLabel(rootComments.length)}
      >
        <Text style={styles.allButtonText}>{formatEchoesCountLabel(rootComments.length)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
  },
  carousel: {
    gap: CARD_GAP,
    paddingRight: spacing.sm,
  },
  card: {
    paddingVertical: spacing.md,
    minHeight: 196,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand.line,
  },
  emptyCard: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand.line,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  allButton: {
    minHeight: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  allButtonText: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '800',
  },
});
