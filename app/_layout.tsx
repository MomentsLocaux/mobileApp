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
import { useProximityAlerts } from '../src/hooks/useProximityAlerts';
import { ensureProximityLocationTaskRegistered } from '@/tasks/proximity-location';
import { useProposalsStore } from '@/store/proposalsStore';
import { hydrateDiscoveryCaches } from '@/store/hydrateDiscoveryCache';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

ensureProximityLocationTaskRegistered();
void hydrateDiscoveryCaches().finally(() => {
  void useTaxonomyStore.getState().load();
});

export default function RootLayout() {
  useFrameworkReady();
  const [fontsLoaded] = useFonts(brandFontAssets);

  const { setUser, setSession, setProfile, setLoading, initialized, setInitialized } = useAuthStore();
  const userId = useAuthStore((state) => state.user?.id);

  usePushNotifications(userId);
  useProximityAlerts(userId);

  useEffect(() => {
    useProposalsStore.getState().bindToUser(userId ?? null);
  }, [userId]);

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
          const currentUser = currentSession.user;
          const currentProfile = await AuthService.getProfileForUser(currentUser);
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
      const previousUserId = useAuthStore.getState().user?.id;
      setSession(session);
      if (session) {
        if (previousUserId !== session.user.id) {
          setProfile(null);
        }
        setUser(session.user);
        if (profile) {
          setProfile(profile);
        }
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
        <Stack.Screen
          name="map-event/[id]"
          options={{
            presentation: 'transparentModal',
            animation: 'none',
            gestureEnabled: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="bug-report" />
        <Stack.Screen name="contact" />
        <Stack.Screen
          name="agenda"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="messages" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="dark" />
      <Toast config={toastConfig} />
    </GestureHandlerRootView>
  );
}
