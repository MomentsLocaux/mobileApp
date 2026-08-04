import { useCallback } from 'react';
import { useAuthStore } from '@/state/auth';
import { AuthService } from '@/services/auth.service';
import type { SocialProvider } from '@/services/oauth.service';
import { UserService } from '@/services/user.service';

export function useAuth() {
  const {
    user,
    session,
    profile,
    isLoading,
    error,
    setUser,
    setSession,
    setProfile,
    setLoading,
    setError,
    reset,
  } = useAuthStore();

  const fetchProfile = useCallback(
    async (userId: string, userEmail?: string | null) => {
      const profile =
        (await UserService.getProfile(userId)) || (await AuthService.ensureProfile(userId, userEmail || ''));
      const enriched = profile ? { ...profile, email: profile.email ?? userEmail ?? null } : null;
      setProfile(enriched);
      return enriched;
    },
    [setProfile],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      const response = await AuthService.signIn(email, password);

      if (!response.success) {
        setLoading(false);
        setError(response.error || 'Erreur connexion');
        return response;
      }

      setSession(response.session || null);
      setUser(response.user || null);
      setProfile(response.profile || null);
      setLoading(false);

      if (response.user && !response.profile) {
        void AuthService.getProfileForUser(response.user)
          .then(setProfile)
          .catch((profileError) => {
            console.error('Post-login profile hydration failed:', profileError);
          });
      }

      return response;
    },
    [setError, setLoading, setSession, setUser, setProfile],
  );

  const signInWithProvider = useCallback(
    async (provider: SocialProvider) => {
      setLoading(true);
      setError(null);
      const response = await AuthService.signInWithProvider(provider);

      if (!response.success) {
        setLoading(false);
        setError(response.error || 'Connexion impossible');
        return response;
      }

      setSession(response.session || null);
      setUser(response.user || null);
      setProfile(response.profile || null);
      setLoading(false);

      if (response.user && !response.profile) {
        void AuthService.getProfileForUser(response.user)
          .then(setProfile)
          .catch((profileError) => {
            console.error('Post-login profile hydration failed:', profileError);
          });
      }

      return response;
    },
    [setError, setLoading, setSession, setUser, setProfile],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      const response = await AuthService.signUp(email, password);
      setLoading(false);

      if (!response.success) {
        setError(response.error || 'Erreur inscription');
        return response;
      }

      setSession(response.session || null);
      setUser(response.user || null);

      if (response.user && response.session) {
        const profile = response.profile || (await fetchProfile(response.user.id, response.user.email));
        setProfile(profile);
      } else {
        setProfile(null);
      }

      return response;
    },
    [fetchProfile, setError, setLoading, setSession, setUser, setProfile],
  );

  const signOut = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await AuthService.signOut();
      if (!response.success) {
        throw new Error(response.error || 'Erreur déconnexion');
      }
    } catch (signOutError: any) {
      setLoading(false);
      setError(signOutError?.message || 'Erreur déconnexion');
      return false;
    }
    setLoading(false);
    reset();
    return true;
  }, [reset, setError, setLoading]);

  const fullSignOut = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await AuthService.fullSignOut();
      if (!response.success) {
        throw new Error(response.error || 'Erreur déconnexion complète');
      }
    } catch (signOutError: any) {
      setLoading(false);
      setError(signOutError?.message || 'Erreur déconnexion complète');
      return false;
    }
    setLoading(false);
    reset();
    return true;
  }, [reset, setError, setLoading]);

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    return fetchProfile(user.id, user.email);
  }, [fetchProfile, user]);

  return {
    user,
    session,
    profile,
    isLoading,
    error,
    isAuthenticated: !!session,
    signIn,
    signInWithProvider,
    signUp,
    signOut,
    fullSignOut,
    refreshProfile,
  };
}
