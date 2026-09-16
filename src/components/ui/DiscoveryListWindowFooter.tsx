import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';

type Props = {
  loading: boolean;
};

/** Compact inline spinner while the next sorted page of discovery cards mounts. */
export function DiscoveryListWindowFooter({ loading }: Props) {
  if (!loading) return null;
  return (
    <View
      style={styles.footer}
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement des événements suivants"
    >
      <ActivityIndicator color={colors.brand.secondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
