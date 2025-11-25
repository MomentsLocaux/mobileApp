import { useState } from 'react';
import { useAuthStore } from '../store';
import { AuthService } from '../services/auth.service';

export const useAuth = () => {
  const {
    user,
    session,
    profile,
    isLoading,
    setProfile,
    setLoading,
    setUser,
    setSession,
    reset,
  } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    const result = await AuthService.signIn(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Sign in failed');
      return false;
    }

    setSession(result.session ?? null);
    setUser(result.user ?? null);
    if (result.profile) {
      setProfile(result.profile);
    }

    return true;
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    const result = await AuthService.signUp(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Sign up failed');
      return false;
    }

    setSession(result.session ?? null);
    setUser(result.user ?? null);
    if (result.profile) {
      setProfile(result.profile);
    }

    return true;
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    const result = await AuthService.signOut();
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Sign out failed');
      return false;
    }

    reset();
    return true;
  };

  const refreshProfile = async () => {
    if (!user) return null;
    try {
      const currentProfile = await AuthService.getCurrentProfile();
      if (currentProfile) {
        setProfile(currentProfile);
      }
      return currentProfile;
    } catch (error) {
      console.error('Error refreshing profile:', error);
      return null;
    }
  };

  return {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !!session,
    error,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };
};
