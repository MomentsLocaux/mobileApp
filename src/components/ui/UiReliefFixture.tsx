import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BRAND_ICON_STUDY_NAMES } from '@/constants/brand-icon-artwork';
import { colors, spacing, typography } from '@/constants/theme';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { PushButton } from '@/components/ui/PushButton';
import { EventHeartButton } from '@/components/events/EventHeartButton';
import { EventDetailSection } from '@/components/events/EventDetailSection';

/** Visual fixture for UI-RELIEF-001 — real components, no user data. */
export function UiReliefFixture() {
  const [hearted, setHearted] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);

  return (
    <View style={styles.page}>
      <Text style={styles.kicker}>Duo végétal · fixture</Text>
      <View style={styles.board}>
        {BRAND_ICON_STUDY_NAMES.map((name) => (
          <View key={name} style={styles.specimen} accessibilityLabel={name}>
            <BrandIcon name={name} active={name === 'heart' ? hearted : false} />
            <Text style={styles.caption}>{name}</Text>
          </View>
        ))}
      </View>
      <EventDetailSection>
        <View style={styles.row}>
          <PushButton
            icon="calendar"
            toggled={hoursOpen}
            onPress={() => setHoursOpen((open) => !open)}
            accessibilityLabel={hoursOpen ? 'Masquer le détail des horaires' : 'Afficher le détail des horaires'}
          />
          <Text style={styles.grow}>Samedi 26 septembre</Text>
          <EventHeartButton active={hearted} onPress={() => setHearted((value) => !value)} />
        </View>
        <PushButton
          icon="calendar"
          tone="secondary"
          label="Je note la date"
          onPress={() => undefined}
          accessibilityLabel="Je note la date"
          style={styles.wide}
        />
        <PushButton
          icon="navigation"
          label="J’y vais"
          onPress={() => undefined}
          accessibilityLabel="J’y vais"
          style={styles.wide}
        />
      </EventDetailSection>
      <Pressable onPress={() => setHoursOpen(false)} accessibilityRole="button" accessibilityLabel="Réinitialiser">
        <Text style={styles.reset}>Réinitialiser la fixture</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.brand.page,
  },
  kicker: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.brand.textSecondary,
  },
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 22,
    backgroundColor: colors.brand.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  specimen: {
    width: 56,
    alignItems: 'center',
    gap: 8,
  },
  caption: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grow: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.brand.text,
    flex: 1,
  },
  wide: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  reset: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textDecorationLine: 'underline',
  },
});
