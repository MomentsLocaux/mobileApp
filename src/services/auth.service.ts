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
  static async ensureProfile(userId: string, email: string): Promise<Profile | null> {
    try {
      return await dataProvider.ensureProfile(userId, email);
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
      const profile = (await dataProvider.getProfile(user.id)) || (await this.ensureProfile(user.id, email));
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

      return dataProvider.getProfile(user.id);
    } catch {
      return null;
    }
  }

  static onAuthStateChange(callback: (session: Session | null, profile: Profile | null) => void) {
    const sub = dataProvider.onAuthStateChange(async (session) => {
      if (session?.user) {
        const profile = await dataProvider.getProfile(session.user.id);
        callback(session, profile);
      } else {
        callback(null, null);
      }
    });
    return { data: { subscription: sub } } as any;
  }
}
