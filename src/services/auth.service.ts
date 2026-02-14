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

const LOGOUT_BLOCK_KEY = 'auth_logout_blocked';
const LEGACY_SESSION_KEY = 'supabase_session';
const SESSION_ACCESS_KEY = 'supabase_session_access_token';
const SESSION_REFRESH_KEY = 'supabase_session_refresh_token';
const LAST_EMAIL_KEY = 'auth_last_email';

export class AuthService {
  private static attachEmail(profile: Profile | null, userEmail?: string | null): Profile | null {
    if (!profile) return null;
    if (profile.email) return profile;
    if (!userEmail) return profile;
    return { ...profile, email: userEmail };
  }

  private static async saveSession(session: Session | null) {
    if (!session?.refresh_token || !session.access_token) {
      await Promise.all([
        SecureStore.deleteItemAsync(LEGACY_SESSION_KEY),
        SecureStore.deleteItemAsync(SESSION_ACCESS_KEY),
        SecureStore.deleteItemAsync(SESSION_REFRESH_KEY),
      ]);
      return;
    }
    // Store tokens separately to avoid SecureStore value-size warnings on a single payload.
    await Promise.all([
      SecureStore.setItemAsync(SESSION_ACCESS_KEY, session.access_token),
      SecureStore.setItemAsync(SESSION_REFRESH_KEY, session.refresh_token),
      SecureStore.deleteItemAsync(LEGACY_SESSION_KEY),
    ]);
  }

  private static async saveLastEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    await SecureStore.setItemAsync(LAST_EMAIL_KEY, normalized);
  }

  static async getLastEmail(): Promise<string | null> {
    const value = await SecureStore.getItemAsync(LAST_EMAIL_KEY);
    return value || null;
  }

  static async clearSavedSession() {
    await Promise.all([
      SecureStore.deleteItemAsync(LEGACY_SESSION_KEY),
      SecureStore.deleteItemAsync(SESSION_ACCESS_KEY),
      SecureStore.deleteItemAsync(SESSION_REFRESH_KEY),
    ]);
  }

  private static async blockAutoRestore() {
    await SecureStore.setItemAsync(LOGOUT_BLOCK_KEY, '1');
  }

  static async clearAutoRestoreBlock() {
    await SecureStore.deleteItemAsync(LOGOUT_BLOCK_KEY);
  }

  static async isAutoRestoreBlocked(): Promise<boolean> {
    const flag = await SecureStore.getItemAsync(LOGOUT_BLOCK_KEY);
    return !!flag;
  }

  static async hasSavedSession(): Promise<boolean> {
    const [accessToken, refreshToken, legacy] = await Promise.all([
      SecureStore.getItemAsync(SESSION_ACCESS_KEY),
      SecureStore.getItemAsync(SESSION_REFRESH_KEY),
      SecureStore.getItemAsync(LEGACY_SESSION_KEY),
    ]);
    return !!(accessToken && refreshToken) || !!legacy;
  }

  static async restoreSessionWithBiometrics(): Promise<AuthResponse & { biometricUsed?: boolean }> {
    const [accessToken, refreshToken, legacy] = await Promise.all([
      SecureStore.getItemAsync(SESSION_ACCESS_KEY),
      SecureStore.getItemAsync(SESSION_REFRESH_KEY),
      SecureStore.getItemAsync(LEGACY_SESSION_KEY),
    ]);

    let saved: { refresh_token: string; access_token: string } | null = null;

    if (accessToken && refreshToken) {
      saved = { access_token: accessToken, refresh_token: refreshToken };
    } else if (legacy) {
      try {
        const parsed = JSON.parse(legacy) as { refresh_token?: string; access_token?: string };
        if (parsed?.refresh_token && parsed?.access_token) {
          saved = {
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
          };
          // One-time migration to the split keys.
          await Promise.all([
            SecureStore.setItemAsync(SESSION_ACCESS_KEY, parsed.access_token),
            SecureStore.setItemAsync(SESSION_REFRESH_KEY, parsed.refresh_token),
            SecureStore.deleteItemAsync(LEGACY_SESSION_KEY),
          ]);
        }
      } catch {
        await SecureStore.deleteItemAsync(LEGACY_SESSION_KEY);
      }
    }

    if (!saved) {
      return { success: false, error: 'No saved session' };
    }

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
    await this.clearAutoRestoreBlock();
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
      await this.clearAutoRestoreBlock();
      await this.saveLastEmail(email);
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
      await this.clearAutoRestoreBlock();
      await this.saveLastEmail(email);
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
      // Soft sign-out: on ne révoque pas la session côté Supabase pour conserver
      // le refresh token et permettre une reconnexion biométrique.
      await this.blockAutoRestore();
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
