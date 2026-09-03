import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../types/database';
import { dataProvider } from '@/data-provider';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '@/lib/supabase/client';
import {
  getAuthRedirectUri,
  signInWithApple,
  signInWithOAuthProvider,
  type SocialProvider,
} from '@/services/oauth.service';

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

export class AuthService {
  private static profileRequests = new Map<string, Promise<Profile | null>>();
  private static explicitSignInInProgress = false;

  private static logPerf(step: string, startedAt: number) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info(`[AuthPerf] ${step}: ${Date.now() - startedAt}ms`);
    }
  }

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

  /**
   * Starts non-blocking work that is useful after authentication but must not
   * keep the user on the login screen once Supabase returned a valid session.
   */
  private static startPostSignInHydration(session: Session, user: User, startedAt: number) {
    void Promise.all([
      this.getProfileForUser(user),
      this.clearAutoRestoreBlock(),
      this.saveSession(session),
    ])
      .then(() => {
        this.logPerf('post-sign-in hydration', startedAt);
      })
      .catch((error) => {
        console.error('Post-sign-in hydration failed:', error);
      })
      .finally(() => {
        this.explicitSignInInProgress = false;
      });
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

    await this.clearAutoRestoreBlock();
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
    this.startPostSignInHydration(session, user, Date.now());
    return {
      success: true,
      session,
      user,
      profile: null,
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

  /** Coalesces profile hydration triggered by sign-in, auth events and app bootstrap. */
  static async getProfileForUser(user: User): Promise<Profile | null> {
    const existingRequest = this.profileRequests.get(user.id);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      const rawProfile =
        (await dataProvider.getProfile(user.id)) ||
        (await this.ensureProfile(user.id, user.email || ''));
      return this.attachEmail(rawProfile, user.email);
    })().finally(() => {
      this.profileRequests.delete(user.id);
    });

    this.profileRequests.set(user.id, request);
    return request;
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
      await this.saveSession(session);
      return { success: true, session, user, profile };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /** Returns as soon as OAuth yielded a session; profile/persistence continue off-screen. */
  static async finalizeOAuthSession(session: Session): Promise<AuthResponse> {
    const user = session.user;
    if (!user) return { success: false, error: 'No user returned' };

    this.startPostSignInHydration(session, user, Date.now());
    return { success: true, session, user, profile: null };
  }

  static async signInWithProvider(provider: SocialProvider): Promise<AuthResponse> {
    const startedAt = Date.now();
    this.explicitSignInInProgress = true;
    try {
      const session =
        provider === 'apple'
          ? await signInWithApple()
          : await signInWithOAuthProvider(provider);
      const response = await this.finalizeOAuthSession(session);
      this.logPerf(`signInWithProvider:${provider}:session-ready`, startedAt);
      if (!response.success) {
        this.explicitSignInInProgress = false;
      }
      return response;
    } catch (error) {
      this.explicitSignInInProgress = false;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connexion impossible',
      };
    }
  }

  static async signIn(email: string, password: string): Promise<AuthResponse> {
    const startedAt = Date.now();
    this.explicitSignInInProgress = true;
    try {
      const tokenStartedAt = Date.now();
      const { session, user } = await dataProvider.signIn(email, password);
      this.logPerf('signInWithPassword', tokenStartedAt);
      if (!session || !user) {
        this.explicitSignInInProgress = false;
        return { success: false, error: 'No session returned' };
      }
      this.startPostSignInHydration(session, user, Date.now());
      this.logPerf('signIn:session-ready', startedAt);
      return { success: true, session, user, profile: null };
    } catch (error) {
      this.explicitSignInInProgress = false;
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

  static async fullSignOut(): Promise<AuthResponse> {
    try {
      await Promise.all([
        this.clearSavedSession(),
        this.blockAutoRestore(),
        supabase.auth.signOut().catch(() => undefined),
      ]);
      const { useLumiaChatStore } = await import('@/store/lumiaChatStore');
      useLumiaChatStore.getState().clearConversation();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async requestAccountDeletion(): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: {},
      });

      if (error) {
        let message = error.message;
        const context = (error as any)?.context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            if (body && typeof body.message === 'string') {
              message = body.message;
            }
          } catch {
            // Keep the Supabase Functions error message.
          }
        }
        return { success: false, error: message };
      }

      if (data && typeof data === 'object' && data.success === false) {
        return {
          success: false,
          error: typeof data.message === 'string' ? data.message : 'Suppression impossible',
        };
      }

      await Promise.all([
        this.clearSavedSession(),
        this.blockAutoRestore(),
        supabase.auth.signOut().catch(() => undefined),
      ]);

      const { useLumiaChatStore } = await import('@/store/lumiaChatStore');
      useLumiaChatStore.getState().clearConversation();

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
      const session = await this.getCurrentSession();
      const user = session?.user ?? (await this.getCurrentUser());
      if (!user) return null;
      return this.getProfileForUser(user);
    } catch {
      return null;
    }
  }

  /** Sends a password-recovery email (redirect opens auth/reset-password). */
  static async requestPasswordReset(email: string): Promise<AuthResponse> {
    try {
      const redirectTo = getAuthRedirectUri('auth/reset-password');
      await dataProvider.requestPasswordReset(email.trim(), redirectTo);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Impossible d’envoyer l’email',
      };
    }
  }

  /** Sets a new password while a recovery (or authenticated) session is active. */
  static async updatePassword(password: string): Promise<AuthResponse> {
    try {
      await dataProvider.updatePassword(password);
      const session = await dataProvider.getSession();
      const user = session?.user ?? (await dataProvider.getUser());
      if (session) {
        await this.clearAutoRestoreBlock();
        await this.saveSession(session);
      }
      return { success: true, session, user };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Impossible de mettre à jour le mot de passe',
      };
    }
  }

  static onAuthStateChange(callback: (session: Session | null, profile: Profile | null) => void) {
    const sub = dataProvider.onAuthStateChange((session) => {
      if (!session?.user) {
        callback(null, null);
        return;
      }

      // Supabase warns against awaiting another client call inside the auth
      // callback. Defer all asynchronous work until the callback has returned.
      const belongsToExplicitSignIn = this.explicitSignInInProgress;
      setTimeout(() => {
        void (async () => {
          const blocked = !belongsToExplicitSignIn && (await this.isAutoRestoreBlocked());
          if (blocked) {
            callback(null, null);
            return;
          }

          callback(session, null);
          const profile = await this.getProfileForUser(session.user);
          callback(session, profile);
        })().catch((error) => {
          console.error('Deferred auth profile hydration failed:', error);
        });
      }, 0);
    });
    return { data: { subscription: sub } } as any;
  }
}
