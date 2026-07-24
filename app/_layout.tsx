import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { AppBackground } from '../src/components/ui/AppBackground';
import { toastConfig } from '../src/components/ui/AppToast';
import { brandFontAssets } from '../src/constants/fonts';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { useAuthStore } from '../src/state/auth';
import { AuthService } from '../src/services/auth.service';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { DISCOVERY_CAPTURE_ENABLED } from '@/config/discovery.flags';
import { useDiscoveryCapture } from '../src/hooks/useDiscoveryCapture';
import { ensureDiscoveryLocationTaskRegistered } from '@/tasks/discovery-location';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

if (DISCOVERY_CAPTURE_ENABLED) {
  ensureDiscoveryLocationTaskRegistered();
}

export default function RootLayout() {
  useFrameworkReady();
  const [fontsLoaded] = useFonts(brandFontAssets);

  const { setUser, setSession, setProfile, setLoading, initialized, setInitialized } = useAuthStore();
  const userId = useAuthStore((state) => state.user?.id);

  usePushNotifications(userId);
  useDiscoveryCapture(userId);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  useEffect(() => {
    let mounted = true;

    if (initialized) return;

    const initializeAuth = async () => {
      if (!mounted) return;
      setLoading(true);

      try {
        const blocked = await AuthService.isAutoRestoreBlocked();
        const currentSession = blocked ? null : await AuthService.getCurrentSession();
        if (!mounted) return;

        if (currentSession) {
          const currentUser = await AuthService.getCurrentUser();
          const currentProfile = await AuthService.getCurrentProfile();
          if (!mounted) return;

          setSession(currentSession);
          setUser(currentUser);
          setProfile(currentProfile);
        } else {
          if (!mounted) return;
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = AuthService.onAuthStateChange((session, profile) => {
      if (!mounted) return;
      setSession(session);
      if (session) {
        setUser(session.user);
        setProfile(profile);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <AppBackground />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="events" />
        <Stack.Screen name="notifications/index" />
        <Stack.Screen name="bug-report" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="discovery" />
        <Stack.Screen name="contests" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
      <Toast config={toastConfig} />
    </>
  );
}
