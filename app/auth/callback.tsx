import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { colors } from '@/constants/theme';
import { AuthService } from '@/services/auth.service';
import { completeOAuthFromUrl } from '@/services/oauth.service';
import { useAuthStore } from '@/state/auth';

/** Fallback handler when the app is opened via the OAuth redirect deep link. */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { setSession, setUser, setProfile } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const url = await Linking.getInitialURL();
        if (!url) {
          router.replace('/auth/login');
          return;
        }

        const session = await completeOAuthFromUrl(url);
        const response = await AuthService.finalizeOAuthSession(session);
        if (!response.success || !response.user) {
          throw new Error(response.error || 'Connexion impossible');
        }

        if (!mounted) return;
        setSession(response.session ?? null);
        setUser(response.user);
        setProfile(response.profile ?? null);
        router.replace('/(tabs)/map');
      } catch {
        if (mounted) router.replace('/auth/login');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router, setProfile, setSession, setUser]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.brand.secondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
  },
});
