import { Redirect } from 'expo-router';
import { useAuth } from '../src/hooks';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../src/constants/theme';

export default function Index() {
  const { isLoading, isAuthenticated, profile, initialized } = useAuth();

  // initialized starts false. Redirecting before the Keychain restore finishes
  // sends every cold start to the login screen and drops notification routes.
  if (!initialized || isLoading || (isAuthenticated && !profile)) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.secondary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  if (profile && !profile.onboarding_completed) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: colors.neutral[50], // Removed for global background
  },
});
