import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { useAuthStore } from '../src/state/auth';
import { AuthService } from '../src/services/auth.service';

export default function RootLayout() {
  useFrameworkReady();

  const { setUser, setSession, setProfile, setLoading, initialized, setInitialized } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    if (initialized) return;

    const initializeAuth = async () => {
      if (!mounted) return;
      setLoading(true);

      try {
        const currentSession = await AuthService.getCurrentSession();
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

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="events" />
        <Stack.Screen name="bug-report" />
        <Stack.Screen name="moderation" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
      <Toast />
    </>
  );
}
