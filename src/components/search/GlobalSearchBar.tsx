import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Search } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/components/ui/v2/theme';

interface Props {
  placeholder?: string;
  onPress: () => void;
  summary?: string;
}

export const GlobalSearchBar: React.FC<Props> = ({
  placeholder = 'Rechercher un évènement',
  onPress,
  summary,
}) => {
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <Search size={18} color={colors.scale.neutral[500]} />
      <Text style={styles.text} numberOfLines={1}>
        {summary || placeholder}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.scale.neutral[0],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.scale.neutral[100],
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  text: {
    marginLeft: spacing.sm,
    color: colors.scale.neutral[600],
    ...typography.body,
    flex: 1,
  },
});
