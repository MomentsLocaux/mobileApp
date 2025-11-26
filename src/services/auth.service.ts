import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../types/database';
import { dataProvider } from '@/data-provider';

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
        return { success: true, session, user, profile: null };
      }

      const profile = await this.ensureProfile(user.id, email);
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
