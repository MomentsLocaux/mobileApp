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
    console.log('getUser response', data);
    return data.user;
  },

  async ensureProfile(userId, email) {
    const { data: existing, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (existing) return existing as Profile;

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        display_name: email.split('@')[0],
        role: 'denicheur',
        onboarding_completed: false,
        avatar_url: null,
        bio: null,
        city: null,
        region: null,
      } as any)
      .select()
      .single();

    if (insertError) throw insertError;
    return inserted as Profile;
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
