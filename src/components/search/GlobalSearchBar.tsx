import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Search } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

interface Props {
  placeholder?: string;
  onPress: () => void;
  summary?: string;
}

export const GlobalSearchBar: React.FC<Props> = ({ placeholder = 'Rechercher un moment', onPress, summary }) => {
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <Search size={18} color={colors.neutral[500]} />
      <Text style={styles.text} numberOfLines={1}>
        {summary || placeholder}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  text: {
    marginLeft: spacing.sm,
    color: colors.neutral[600],
    ...typography.body,
    flex: 1,
  },
});
