import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing, radius, shadows } from '@/components/ui/v2';

type CardProps = {
  title: string;
  description?: string;
  icon: LucideIcon;
  accent?: boolean;
  children: React.ReactNode;
};

type RowProps = {
  label: string;
  icon: LucideIcon;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  showChevron?: boolean;
  noBorder?: boolean;
};

export const SettingsSectionCard: React.FC<CardProps> = ({ title, description, icon: Icon, accent, children }) => (
  <View style={[styles.card, accent && styles.cardAccent]}>
    <View style={styles.cardHeader}>
      <Icon size={22} color={colors.primary} />
      <View style={styles.cardHeaderText}>
        <Text style={styles.cardTitle}>{title}</Text>
        {description ? <Text style={styles.cardDescription}>{description}</Text> : null}
      </View>
    </View>
    <View style={styles.cardBody}>{children}</View>
  </View>
);

export const SettingsRow: React.FC<RowProps> = ({
  label,
  icon: Icon,
  onPress,
  right,
  danger,
  disabled,
  showChevron = true,
  noBorder,
}) => {
  const content = (
    <>
      <View style={styles.rowLeft}>
        <Icon size={20} color={danger ? colors.danger : colors.textSecondary} />
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger, disabled && styles.rowLabelDisabled]}>
          {label}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {right}
        {onPress && showChevron ? <ChevronRight size={18} color={colors.textMuted} /> : null}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, noBorder && styles.rowNoBorder]}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={[styles.row, noBorder && styles.rowNoBorder, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceLevel1,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.surfaceSoft,
  },
  cardAccent: {
    borderWidth: 1,
    borderColor: 'rgba(43, 191, 227, 0.45)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardBody: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowNoBorder: {
    borderTopWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowLabel: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  rowLabelDanger: {
    color: colors.danger,
  },
  rowLabelDisabled: {
    color: colors.textMuted,
  },
  rowDisabled: {
    opacity: 0.6,
  },
});
