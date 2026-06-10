import React, { useMemo } from 'react';
import { View, Text, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import type { EventWithCreator } from '@/types/database';
import {
  formatEventCardEndLine,
  formatEventCardStartLine,
  getEventCardSchedule,
  type EventCardDateStyle,
} from '@/utils/event-card-meta';

export type EventCardMetaTone = 'overlay' | 'surface' | 'muted';

type EventMetaSource = Pick<
  EventWithCreator,
  'starts_at' | 'ends_at' | 'city' | 'venue_name' | 'address' | 'postal_code'
>;

interface Props {
  event: EventMetaSource;
  tone?: EventCardMetaTone;
  dateStyle?: EventCardDateStyle;
  isLive?: boolean;
  liveUntilLabel?: string | null;
  showCityIcon?: boolean;
  showCity?: boolean;
  align?: 'left' | 'right';
  compactSpacing?: boolean;
  style?: ViewStyle;
}

export const EventCardMetaRows: React.FC<Props> = ({
  event,
  tone = 'muted',
  dateStyle = 'compact',
  isLive = false,
  liveUntilLabel = null,
  showCityIcon = false,
  showCity = true,
  align = 'left',
  compactSpacing = false,
  style,
}) => {
  const schedule = useMemo(() => getEventCardSchedule(event, dateStyle), [dateStyle, event]);
  const palette = TONE_STYLES[tone];
  const alignRight = align === 'right';

  return (
    <View
      style={[
        styles.container,
        compactSpacing && styles.containerCompact,
        alignRight && styles.containerRight,
        style,
      ]}
    >
      {isLive && liveUntilLabel ? (
        <Text style={[styles.line, palette.live, alignRight && styles.lineRight]} numberOfLines={2}>
          En direct jusqu&apos;à {liveUntilLabel}
        </Text>
      ) : null}
      <Text style={[styles.line, palette.line, alignRight && styles.lineRight]} numberOfLines={2}>
        {formatEventCardStartLine(schedule)}
      </Text>
      <Text style={[styles.line, palette.line, alignRight && styles.lineRight]} numberOfLines={2}>
        {formatEventCardEndLine(schedule)}
      </Text>
      {showCity ? (
        <View style={[styles.cityRow, alignRight && styles.cityRowRight]}>
          {showCityIcon ? <MapPin size={12} color={palette.cityIcon} /> : null}
          <Text style={[styles.city, palette.city, alignRight && styles.lineRight]} numberOfLines={1}>
            {schedule.city}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const TONE_STYLES: Record<
  EventCardMetaTone,
  { line: TextStyle; city: TextStyle; live: TextStyle; cityIcon: string }
> = {
  overlay: {
    line: {
      ...typography.bodySmall,
      color: colors.brand.secondary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    city: {
      ...typography.bodySmall,
      color: colors.brand.text,
      fontWeight: '600',
    },
    live: {
      ...typography.bodySmall,
      color: '#F87171',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    cityIcon: colors.brand.textSecondary,
  },
  surface: {
    line: {
      ...typography.caption,
      color: colors.brand.textSecondary,
      fontWeight: '600',
    },
    city: {
      ...typography.caption,
      color: colors.brand.text,
      fontWeight: '600',
    },
    live: {
      ...typography.caption,
      color: colors.brand.error,
      fontWeight: '700',
    },
    cityIcon: colors.brand.textSecondary,
  },
  muted: {
    line: {
      ...typography.bodySmall,
      color: colors.brand.textSecondary,
    },
    city: {
      ...typography.bodySmall,
      color: colors.brand.textSecondary,
      flex: 1,
    },
    live: {
      ...typography.bodySmall,
      color: colors.brand.error,
      fontWeight: '600',
    },
    cityIcon: colors.brand.textSecondary,
  },
};

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  containerCompact: {
    gap: 1,
  },
  containerRight: {
    alignItems: 'flex-end',
  },
  line: {
    fontSize: 11,
  },
  lineRight: {
    textAlign: 'right',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  cityRowRight: {
    justifyContent: 'flex-end',
  },
  city: {
    flex: 1,
  },
});
