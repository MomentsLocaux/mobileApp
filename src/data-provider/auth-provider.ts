import { supabase } from '@/lib/supabase/client';
import type { IAuthProvider } from './types';
import type { Profile, Database } from '@/types/database';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export const authProvider: IAuthProvider = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { session: data.session, user: data.user };
  },

  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return { session: data.session, user: data.user };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  async ensureProfile(userId, email) {
    const { data: existing, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (existing) {
      return { ...(existing as Profile), email: email ?? null };
    }

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        display_name: email ? email.split('@')[0] : 'Utilisateur',
        role: 'particulier',
        onboarding_completed: false,
        avatar_url: null,
        bio: null,
        city: null,
        region: null,
        status: 'active',
      } as unknown as Database['public']['Tables']['profiles']['Insert'])
      .select()
      .single();

    // Concurrent ensureProfile calls (sign-in + auth init) can both try INSERT.
    if (insertError?.code === '23505') {
      const { data: raced, error: refetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (refetchError) throw refetchError;
      if (raced) {
        return { ...(raced as Profile), email: email ?? null };
      }
    }

    if (insertError) throw insertError;
    return { ...(inserted as Profile), email: email ?? null };
  },

  async requestPasswordReset(email, redirectTo) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      callback(session);
    });
    return {
      unsubscribe: () => data.subscription.unsubscribe(),
    };
  },

};
