import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Page introuvable' }} />
      <View style={styles.container}>
        <Text style={styles.text}>Cette page n&apos;existe pas.</Text>
        <Link href="/(tabs)/map" style={styles.link}>
          <Text style={styles.linkText}>Retour à la carte</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.brand.primary,
  },
  text: {
    ...typography.h4,
    color: colors.brand.text,
    textAlign: 'center',
  },
  link: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  linkText: {
    ...typography.body,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
});
