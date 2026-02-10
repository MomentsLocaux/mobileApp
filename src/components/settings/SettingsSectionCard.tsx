import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

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
      <Icon size={22} color={colors.neutral[800]} />
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
        <Icon size={20} color={danger ? colors.error[600] : colors.neutral[700]} />
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger, disabled && styles.rowLabelDisabled]}>
          {label}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {right}
        {onPress && showChevron ? <ChevronRight size={18} color={colors.neutral[400]} /> : null}
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
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardAccent: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
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
    ...typography.h4,
    color: colors.neutral[900],
  },
  cardDescription: {
    ...typography.caption,
    color: colors.neutral[500],
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
    borderTopColor: colors.neutral[200],
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
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  rowLabelDanger: {
    color: colors.error[600],
  },
  rowLabelDisabled: {
    color: colors.neutral[400],
  },
  rowDisabled: {
    opacity: 0.6,
  },
});
