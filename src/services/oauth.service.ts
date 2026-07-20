import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase/client';

export type SocialProvider = 'google' | 'apple' | 'facebook';

WebBrowser.maybeCompleteAuthSession();

export function getAuthRedirectUri(path: 'auth/callback' | 'auth/reset-password' = 'auth/callback'): string {
  return Linking.createURL(path);
}

function getRedirectUri(): string {
  return getAuthRedirectUri('auth/callback');
}

export type AuthRedirectParams = {
  code?: string;
  access_token?: string;
  refresh_token?: string;
  type?: string;
  error?: string;
};

export function parseAuthRedirectUrl(url: string): AuthRedirectParams {
  if (url.includes('#')) {
    const hash = url.split('#')[1] ?? '';
    const params = new URLSearchParams(hash);
    return {
      access_token: params.get('access_token') ?? undefined,
      refresh_token: params.get('refresh_token') ?? undefined,
      type: params.get('type') ?? undefined,
      error: params.get('error_description') ?? params.get('error') ?? undefined,
    };
  }

  const parsed = Linking.parse(url);
  const qp = parsed.queryParams ?? {};
  const str = (key: string) => {
    const v = qp[key];
    return typeof v === 'string' ? v : undefined;
  };

  return {
    code: str('code'),
    type: str('type'),
    access_token: str('access_token'),
    refresh_token: str('refresh_token'),
    error: str('error_description') ?? str('error'),
  };
}

export async function establishSessionFromRedirect(url: string) {
  const params = parseAuthRedirectUrl(url);
  if (params.error) throw new Error(params.error);

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    if (!data.session) throw new Error('Session introuvable après connexion');
    return { session: data.session, type: params.type };
  }

  if (params.access_token && params.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    if (!data.session) throw new Error('Session introuvable après connexion');
    return { session: data.session, type: params.type };
  }

  throw new Error('Réponse OAuth invalide');
}

type BrowserOAuthProvider = 'google' | 'facebook' | 'apple';

async function signInWithBrowserOAuth(provider: BrowserOAuthProvider) {
  const redirectTo = getRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('URL OAuth indisponible');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Connexion annulée');
  }
  if (result.type !== 'success') {
    throw new Error('Connexion impossible');
  }

  const { session } = await establishSessionFromRedirect(result.url);
  return session;
}

/** Google / Facebook via Supabase OAuth + in-app browser (PKCE). */
export async function signInWithOAuthProvider(provider: Exclude<SocialProvider, 'apple'>) {
  return signInWithBrowserOAuth(provider);
}

/** Apple Sign In (native on iOS, OAuth fallback elsewhere). */
export async function signInWithApple() {
  if (Platform.OS === 'ios') {
    const AppleAuthentication = await import('expo-apple-authentication');
    const available = await AppleAuthentication.isAvailableAsync();
    if (available) {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Jeton Apple manquant');

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
      if (!data.session) throw new Error('Session introuvable après connexion Apple');
      return data.session;
    }
  }

  return signInWithBrowserOAuth('apple');
}

/** Handles a cold-start / deep-link redirect (auth/callback or password recovery). */
export async function completeOAuthFromUrl(url: string) {
  const { session } = await establishSessionFromRedirect(url);
  return session;
}

export async function completeAuthRedirectFromUrl(url: string) {
  return establishSessionFromRedirect(url);
}
