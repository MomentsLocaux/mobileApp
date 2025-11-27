import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../types/database';
import { dataProvider } from '@/data-provider';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '@/lib/supabase/client';

export interface AuthResponse {
  success: boolean;
  error?: string;
  session?: Session | null;
  user?: User | null;
  profile?: Profile | null;
}

export class AuthService {
  private static attachEmail(profile: Profile | null, userEmail?: string | null): Profile | null {
    if (!profile) return null;
    if (profile.email) return profile;
    if (!userEmail) return profile;
    return { ...profile, email: userEmail };
  }

  private static async saveSession(session: Session | null) {
    if (!session?.refresh_token || !session.access_token) {
      await SecureStore.deleteItemAsync('supabase_session');
      return;
    }
    await SecureStore.setItemAsync(
      'supabase_session',
      JSON.stringify({
        refresh_token: session.refresh_token,
        access_token: session.access_token,
      }),
    );
  }

  static async clearSavedSession() {
    await SecureStore.deleteItemAsync('supabase_session');
  }

  static async hasSavedSession(): Promise<boolean> {
    const stored = await SecureStore.getItemAsync('supabase_session');
    return !!stored;
  }

  static async restoreSessionWithBiometrics(): Promise<AuthResponse & { biometricUsed?: boolean }> {
    const stored = await SecureStore.getItemAsync('supabase_session');
    if (!stored) {
      return { success: false, error: 'No saved session' };
    }
    const saved = JSON.parse(stored) as { refresh_token: string; access_token: string };

    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hardware || !enrolled) {
      return { success: false, error: 'Biometric not available' };
    }

    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Déverrouiller avec Face ID / Touch ID',
      cancelLabel: 'Annuler',
      fallbackLabel: 'Code',
    });
    if (!auth.success) {
      return { success: false, error: 'Biometric auth cancelled' };
    }

    const { data, error } = await supabase.auth.setSession({
      refresh_token: saved.refresh_token,
      access_token: saved.access_token,
    });
    if (error) {
      await this.clearSavedSession();
      return { success: false, error: error.message };
    }

    const session = data.session;
    const user = session?.user ?? (await dataProvider.getUser());
    if (!session || !user) {
      return { success: false, error: 'Session invalide' };
    }
    const profile = await dataProvider.getProfile(user.id);
    return {
      success: true,
      session,
      user,
      profile: this.attachEmail(profile, user.email),
      biometricUsed: true,
    };
  }

  static async ensureProfile(userId: string, email: string): Promise<Profile | null> {
    try {
      const profile = await dataProvider.ensureProfile(userId, email);
      return this.attachEmail(profile, email);
    } catch (error) {
      console.error('Unexpected error in ensureProfile:', error);
      return null;
    }
  }

  static async signUp(email: string, password: string): Promise<AuthResponse> {
    try {
      const { session, user } = await dataProvider.signUp(email, password);
      if (!user) return { success: false, error: 'No user returned' };

      // Si confirmation email activée, session peut être nulle => on attendra le prochain sign-in pour créer le profil
      if (!session) {
        await this.clearSavedSession();
        return { success: true, session, user, profile: null };
      }

      const profile = await this.ensureProfile(user.id, email);
      await this.saveSession(session);
      return { success: true, session, user, profile };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const { session, user } = await dataProvider.signIn(email, password);
      if (!user) return { success: false, error: 'No user returned' };
      const rawProfile = (await dataProvider.getProfile(user.id)) || (await this.ensureProfile(user.id, email));
      const profile = this.attachEmail(rawProfile, user.email);
      await this.saveSession(session);
      return { success: true, session, user, profile };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async signOut(): Promise<AuthResponse> {
    try {
      await dataProvider.signOut();
      await this.clearSavedSession();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async getCurrentSession(): Promise<Session | null> {
    try {
      return dataProvider.getSession();
    } catch {
      return null;
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      return dataProvider.getUser();
    } catch {
      return null;
    }
  }

  static async getCurrentProfile(): Promise<Profile | null> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return null;

      const profile = await dataProvider.getProfile(user.id);
      return this.attachEmail(profile, user.email);
    } catch {
      return null;
    }
  }

  static onAuthStateChange(callback: (session: Session | null, profile: Profile | null) => void) {
    const sub = dataProvider.onAuthStateChange(async (session) => {
      if (session?.user) {
        const rawProfile = await dataProvider.getProfile(session.user.id);
        const profile = this.attachEmail(rawProfile, session.user.email);
        callback(session, profile);
      } else {
        callback(null, null);
      }
    });
    return { data: { subscription: sub } } as any;
  }
}
