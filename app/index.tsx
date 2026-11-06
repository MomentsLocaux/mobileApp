import { Redirect } from 'expo-router';
import { useAuth } from '../src/hooks';
import { BrandStartupScreen } from '@/components/ui/BrandStartupScreen';

export default function Index() {
  const { isLoading, isAuthenticated, profile, initialized } = useAuth();

  // initialized starts false. Redirecting before the Keychain restore finishes
  // sends every cold start to the login screen and drops notification routes.
  if (!initialized || isLoading || (isAuthenticated && !profile)) {
    return <BrandStartupScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  if (profile && !profile.onboarding_completed) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
