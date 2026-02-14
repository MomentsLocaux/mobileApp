import { Redirect } from 'expo-router';
import { useAuth } from '../src/hooks';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../src/constants/theme';

export default function Index() {
  const { isLoading, isAuthenticated, profile } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  if (profile && !profile.onboarding_completed) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/map" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
  },
});
