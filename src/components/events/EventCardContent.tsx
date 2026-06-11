import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { Eye, MapPin } from 'lucide-react-native';
import type { EventWithCreator } from '@/types/database';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import type { EventCardContentDensity, EventCardContentTone } from '@/constants/event-card-layout';
import { EVENT_CARD_SCHEDULE_COLUMN_MAX_WIDTH } from '@/constants/event-card-layout';
import { getEventCardCity } from '@/utils/event-card-meta';
import { EventCardMetaRows } from './EventCardMetaRows';

type EventMetaSource = Pick<
  EventWithCreator,
  'starts_at' | 'ends_at' | 'city' | 'venue_name' | 'address' | 'postal_code' | 'title'
>;

export interface EventCardContentProps {
  event: EventMetaSource;
  tone: EventCardContentTone;
  density?: EventCardContentDensity;
  isLive?: boolean;
  liveUntilLabel?: string | null;
  viewsCount?: number;
  distanceLabel?: string | null;
  friendsGoingCount?: number;
  showSocial?: boolean;
  showStats?: boolean;
  onNavigate?: () => void;
  titleAccessory?: React.ReactNode;
  style?: ViewStyle;
}

export const EventCardContent: React.FC<EventCardContentProps> = ({
  event,
  tone,
  density = 'comfortable',
  isLive = false,
  liveUntilLabel = null,
  viewsCount = 0,
  distanceLabel = null,
  friendsGoingCount = 0,
  showSocial = true,
  showStats = true,
  onNavigate,
  titleAccessory,
  style,
}) => {
  const cityLabel = getEventCardCity(event);
  const isCompact = density === 'compact';
  const titleStyle = TITLE_STYLES[tone][density];
  const cityStyle = CITY_STYLES[tone];
  const attendeesCount = Number.isFinite(friendsGoingCount) ? Number(friendsGoingCount) : 0;
  const viewCount = Number.isFinite(viewsCount) ? Number(viewsCount) : 0;
  const useLightStats = tone === 'overlay';

  return (
    <View style={[styles.wrap, isCompact && styles.wrapCompact, style]}>
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={[styles.title, titleStyle]} numberOfLines={2}>
            {event.title}
          </Text>
          {titleAccessory}
        </View>
        <View style={styles.scheduleCol}>
          <EventCardMetaRows
            event={event}
            tone={tone}
            isLive={isLive}
            liveUntilLabel={liveUntilLabel}
            showCity={false}
            align="right"
            compactSpacing={isCompact}
          />
        </View>
      </View>

      <View style={styles.cityRow}>
        <MapPin size={12} color={cityStyle.iconColor} />
        <Text style={[styles.cityText, cityStyle.text]} numberOfLines={1}>
          {cityLabel}
        </Text>
      </View>

      {showSocial ? (
        <View style={styles.socialRow}>
          <View style={styles.avatarPile}>
            {Array.from({ length: Math.max(1, Math.min(attendeesCount, 3)) }).map((_, i) => (
              <View key={i} style={[styles.attendeeAvatar, { transform: [{ translateX: -i * 10 }] }]}>
                <View style={[styles.attendeeDot, !useLightStats && styles.attendeeDotDark]} />
              </View>
            ))}
            {attendeesCount > 3 ? (
              <View style={[styles.attendeeAvatar, styles.attendeeMore, { transform: [{ translateX: -30 }] }]}>
                <Text style={styles.moreText}>+</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.socialText, SOCIAL_STYLES[tone]]}>
            {attendeesCount} ami{attendeesCount > 1 ? 's' : ''} y vont
          </Text>
        </View>
      ) : null}

      {showStats ? (
        <View style={styles.statsRow}>
          <View style={[styles.statsChip, useLightStats ? styles.statsChipOverlay : styles.statsChipSurface]}>
            <Eye size={14} color={useLightStats ? 'rgba(255,255,255,0.6)' : colors.brand.textSecondary} />
            <Text style={[styles.statsText, useLightStats ? styles.statsTextOverlay : styles.statsTextSurface]}>
              {viewCount} vues
            </Text>
          </View>
          {distanceLabel ? (
            <TouchableOpacity
              style={[styles.statsChip, useLightStats ? styles.statsChipOverlay : styles.statsChipSurface]}
              onPress={(e) => {
                e.stopPropagation();
                onNavigate?.();
              }}
              activeOpacity={0.8}
              disabled={!onNavigate}
            >
              <MapPin size={12} color={colors.brand.textSecondary} />
              <Text style={[styles.statsText, useLightStats ? styles.statsTextOverlay : styles.statsTextSurface]}>
                {distanceLabel}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const TITLE_STYLES: Record<EventCardContentTone, Record<EventCardContentDensity, object>> = {
  overlay: {
    comfortable: {
      fontSize: 28,
      lineHeight: 32,
      fontWeight: '800',
      color: '#ffffff',
      letterSpacing: -0.5,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    compact: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '800',
      color: colors.brand.text,
    },
  },
  surface: {
    comfortable: {
      ...typography.h4,
      color: colors.brand.text,
      fontWeight: '800',
    },
    compact: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '800',
      color: colors.brand.text,
    },
  },
  muted: {
    comfortable: {
      ...typography.h4,
      color: colors.brand.text,
      fontWeight: '700',
      marginBottom: 0,
    },
    compact: {
      ...typography.bodySmall,
      color: colors.brand.text,
      fontWeight: '700',
    },
  },
};

const CITY_STYLES: Record<EventCardContentTone, { text: object; iconColor: string }> = {
  overlay: {
    text: {
      ...typography.bodySmall,
      color: colors.brand.text,
      fontWeight: '600',
    },
    iconColor: colors.brand.textSecondary,
  },
  surface: {
    text: {
      ...typography.caption,
      color: colors.brand.text,
      fontWeight: '600',
    },
    iconColor: colors.brand.textSecondary,
  },
  muted: {
    text: {
      ...typography.bodySmall,
      color: colors.brand.textSecondary,
      fontWeight: '600',
    },
    iconColor: colors.brand.textSecondary,
  },
};

const SOCIAL_STYLES: Record<EventCardContentTone, object> = {
  overlay: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  surface: {
    fontSize: 12,
    color: colors.brand.textSecondary,
    fontWeight: '500',
  },
  muted: {
    fontSize: 12,
    color: colors.brand.textSecondary,
    fontWeight: '500',
  },
};

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  wrapCompact: {
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    flexShrink: 1,
  },
  scheduleCol: {
    maxWidth: EVENT_CARD_SCHEDULE_COLUMN_MAX_WIDTH,
    alignItems: 'flex-end',
    paddingTop: 2,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cityText: {
    flex: 1,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPile: {
    flexDirection: 'row',
    marginRight: 8,
  },
  attendeeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0f1719',
    overflow: 'hidden',
    backgroundColor: '#333',
  },
  attendeeDot: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  attendeeDotDark: {
    backgroundColor: colors.brand.textSecondary,
  },
  attendeeMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.secondary,
  },
  moreText: {
    fontSize: 8,
    color: '#000',
    fontWeight: 'bold',
  },
  socialText: {
    marginLeft: -20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  statsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  statsChipOverlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  statsChipSurface: {
    backgroundColor: colors.brand.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsTextOverlay: {
    color: 'rgba(255,255,255,0.8)',
  },
  statsTextSurface: {
    color: colors.brand.textSecondary,
  },
});
