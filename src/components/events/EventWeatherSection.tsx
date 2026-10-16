import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudSnow,
  Droplet,
  Sun,
} from 'lucide-react-native';
import { EventDetailSection } from '@/components/events/EventDetailSection';
import { brandFonts } from '@/constants/fonts';
import { colors, spacing } from '@/constants/theme';
import { fetchEventWeather } from '@/services/weather.service';
import type { EventWeatherDay, EventWeatherView, WeatherKind } from '@/utils/weather-forecast';

type Props = {
  latitude: number | null;
  longitude: number | null;
  startsAt: string;
  endsAt?: string | null;
  placeName?: string | null;
};

export function EventWeatherSection({
  latitude,
  longitude,
  startsAt,
  endsAt,
  placeName,
}: Props) {
  const [view, setView] = useState<EventWeatherView | 'loading'>('loading');
  const place = placeName?.trim() ?? '';

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    let cancelled = false;
    setView('loading');
    void fetchEventWeather({ latitude, longitude, startsAt, endsAt }).then((next) => {
      if (!cancelled) setView(next);
    });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, startsAt, endsAt]);

  if (latitude == null || longitude == null) return null;

  const ready = view !== 'loading' && view.status === 'ready' ? view : null;
  const message = view !== 'loading' && view.status !== 'ready' ? view.message : null;

  return (
    <EventDetailSection style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        Quel temps fera-t-il ?
      </Text>
      {place ? <Text style={styles.place}>(à {place})</Text> : null}

      {view === 'loading' ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand.text} />
        </View>
      ) : message ? (
        <Text style={styles.message}>{message}</Text>
      ) : ready ? (
        <View style={styles.days}>
          {ready.days.map((day) => (
            <DayColumn key={day.date} day={day} />
          ))}
        </View>
      ) : null}
      {ready ? <Text style={styles.attribution}>{ready.attribution}</Text> : null}
    </EventDetailSection>
  );
}

function DayColumn({ day }: { day: EventWeatherDay }) {
  const rainy = isWet(day);
  const min = formatTemp(day.tempMin);
  const max = formatTemp(day.tempMax);
  return (
    <View
      style={styles.day}
      accessibilityLabel={`${day.label}, ${day.summary}, minimum ${min}, maximum ${max}`}
    >
      <Text style={styles.weekday}>{day.weekday}</Text>
      <Text style={styles.dayNumber}>{day.dayNumber}</Text>
      <View style={styles.glyphSlot}>
        <WeatherGlyph kind={day.kind} rainy={rainy} />
      </View>
      <Text style={styles.temps}>
        {min ? <Text style={styles.tempMin}>{min}</Text> : null}
        {min && max ? <Text style={styles.tempSep}> | </Text> : null}
        {max ? <Text style={styles.tempMax}>{max}</Text> : null}
      </Text>
    </View>
  );
}

function isWet(day: EventWeatherDay): boolean {
  if (day.kind === 'rain' || day.kind === 'drizzle' || day.kind === 'thunder') return true;
  return (day.precipitationProbability ?? 0) >= 40;
}

function WeatherGlyph({ kind, rainy }: { kind: WeatherKind; rainy: boolean }) {
  const color = colors.brand.text;
  const stroke = 1.6;
  if (kind === 'clear' && !rainy) return <Sun size={40} color={color} strokeWidth={stroke} />;
  if (kind === 'fog') return <CloudFog size={40} color={color} strokeWidth={stroke} />;
  if (kind === 'snow') return <CloudSnow size={40} color={color} strokeWidth={stroke} />;
  if (kind === 'thunder') return <CloudLightning size={40} color={color} strokeWidth={stroke} />;
  if (rainy) {
    return (
      <View style={styles.glyph}>
        <Cloud size={38} color={color} strokeWidth={stroke} />
        <Droplet size={14} color={color} strokeWidth={stroke} style={styles.drop} />
      </View>
    );
  }
  return <Cloud size={40} color={color} strokeWidth={stroke} />;
}

function formatTemp(value: number | null): string {
  if (value == null) return '';
  return `${Math.round(value)}°`;
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand.line,
  },
  title: {
    fontFamily: brandFonts.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: colors.brand.text,
    textTransform: 'uppercase',
  },
  place: {
    fontFamily: brandFonts.bold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.brand.text,
    marginTop: 2,
  },
  loading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontFamily: brandFonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.brand.textSecondary,
    marginTop: spacing.sm,
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.lg,
  },
  day: {
    flex: 1,
    alignItems: 'center',
  },
  weekday: {
    fontFamily: brandFonts.bold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.4,
    color: colors.brand.text,
  },
  dayNumber: {
    fontFamily: brandFonts.bold,
    fontSize: 28,
    lineHeight: 32,
    color: colors.brand.text,
    marginTop: 2,
  },
  glyphSlot: {
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  glyph: {
    alignItems: 'center',
  },
  drop: {
    marginTop: -2,
  },
  temps: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  tempMin: {
    fontFamily: brandFonts.bold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.neutral[400],
  },
  tempSep: {
    fontFamily: brandFonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.neutral[400],
  },
  tempMax: {
    fontFamily: brandFonts.bold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.brand.text,
  },
  attribution: {
    fontFamily: brandFonts.regular,
    fontSize: 11,
    lineHeight: 14,
    color: colors.neutral[400],
    marginTop: spacing.md,
  },
});
