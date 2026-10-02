import '@/lib/webcrypto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { CONTESTS_ENABLED } from '@/config/contests.flags';
import { assertAppStorageBucket } from '@/utils/storage-buckets';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration');
}

const memoryAuth = new Map<string, string>();

/**
 * PKCE verifiers must survive until the email link reopens the app.
 * Session tokens stay in memory: cold start still goes through the existing SecureStore / biometric path.
 */
const authStorage = {
  getItem: (key: string) => {
    if (key.endsWith('-code-verifier')) return AsyncStorage.getItem(key);
    return Promise.resolve(memoryAuth.get(key) ?? null);
  },
  setItem: (key: string, value: string) => {
    if (key.endsWith('-code-verifier')) return AsyncStorage.setItem(key, value);
    memoryAuth.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (key.endsWith('-code-verifier')) return AsyncStorage.removeItem(key);
    memoryAuth.delete(key);
    return Promise.resolve();
  },
};

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Implicit grants put the recovery tokens in the URL hash. iOS drops that
    // fragment when it opens moments-locaux://, so the reset screen never sees them.
    flowType: 'pkce',
  },
});

const originalStorageFrom = client.storage.from.bind(client.storage);
client.storage.from = ((id: string) => {
  assertAppStorageBucket(id, CONTESTS_ENABLED);
  return originalStorageFrom(id);
}) as typeof client.storage.from;

export const supabase = client;
