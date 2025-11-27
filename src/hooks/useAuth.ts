import { useEffect, useCallback, useState } from 'react';
import { useAuthStore } from '@/state/auth';
import { AuthService } from '@/services/auth.service';
import { UserService } from '@/services/user.service';

export function useAuth() {
  const {
    user,
    session,
    profile,
    isLoading,
    error,
    initialized,
    setUser,
    setSession,
    setProfile,
    setLoading,
    setError,
    setInitialized,
    reset,
  } = useAuthStore();

  const fetchProfile = useCallback(
    async (userId: string, userEmail?: string | null) => {
      const profile = await UserService.getProfile(userId);
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
      setLoading(false);

      if (!response.success) {
        setError(response.error || 'Erreur connexion');
        return response;
      }

      setSession(response.session || null);
      setUser(response.user || null);

      if (response.user) {
        const profile = response.profile || (await fetchProfile(response.user.id, response.user.email));
        setProfile(profile);
      }

      return response;
    },
    [fetchProfile, setError, setLoading, setSession, setUser, setProfile],
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

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    return fetchProfile(user.id, user.email);
  }, [fetchProfile, user]);

  useEffect(() => {
    if (initialized) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const blocked = await AuthService.isAutoRestoreBlocked();
        const session = blocked ? null : await AuthService.getCurrentSession();
        if (!mounted) return;
        const user = blocked ? null : await AuthService.getCurrentUser();
        if (!mounted) return;

        setSession(session);
        setUser(user);

        if (user) {
          try {
            await fetchProfile(user.id, user.email);
          } catch (profileError: any) {
            console.error('Error fetching profile on init:', profileError);
            setError(profileError?.message || 'Erreur profil');
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } catch (initError: any) {
        console.error('Error initializing auth state:', initError);
        setError(initError?.message || 'Erreur connexion');
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        if (!mounted) return;
        setInitialized(true);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchProfile, initialized, setError, setLoading, setProfile, setSession, setUser]);

  return {
    user,
    session,
    profile,
    isLoading,
    error,
    isAuthenticated: !!session,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };
}
