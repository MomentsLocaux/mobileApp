import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../src/constants/theme';

export default function FavoritesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Mes Favoris</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
  },
  text: {
    ...typography.h3,
    color: colors.neutral[600],
  },
});
