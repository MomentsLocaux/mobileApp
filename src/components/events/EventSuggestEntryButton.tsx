import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { useEventPublishSurfaces } from '@/hooks/useEventPublishSurfaces';

type Props = {
  /** When false, hide even if flags allow (e.g. already in poster flow). */
  visible?: boolean;
};

/**
 * Secondary entry: scan a poster while in organizer create form.
 * Keeps submission_source = organizer_create.
 */
export function EventSuggestEntryButton({ visible = true }: Props) {
  const router = useRouter();
  const { showPosterSuggestOnCreateHub, routes } = useEventPublishSurfaces();
  const setSubmissionSource = useCreateEventStore((s) => s.setSubmissionSource);

  if (!visible || !showPosterSuggestOnCreateHub) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Scanner une affiche avec l'IA"
      onPress={() => {
        setSubmissionSource('organizer_create');
        router.push(`${routes.posterSuggest}?source=organizer_create` as any);
      }}
    >
      <View style={styles.iconWrap}>
        <Sparkles size={20} color={colors.brand.secondary} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Scanner une affiche</Text>
        <Text style={styles.subtitle}>Préremplir avec l'IA à partir d'une photo</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.brand.secondary,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.h6,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
});
