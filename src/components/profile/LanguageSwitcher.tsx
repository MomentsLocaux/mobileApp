import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useI18nStore, type AppLocale } from '@/store/i18nStore';
import { t } from '@/i18n/translations';

export const LanguageSwitcher = () => {
  const { locale, setLocale } = useI18nStore();

  const options: { value: AppLocale; labelKey: string }[] = [
    { value: 'fr', labelKey: 'french' },
    { value: 'en', labelKey: 'english' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('profile', 'language', locale)}</Text>
      <View style={styles.row}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, locale === opt.value && styles.chipActive]}
            onPress={() => setLocale(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, locale === opt.value && styles.chipTextActive]}>
              {t('profile', opt.labelKey, locale)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  label: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[50],
  },
  chipActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary[700],
  },
});
