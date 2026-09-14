import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { CONTESTS_ENABLED } from '@/config/contests.flags';
import { assertAppStorageBucket } from '@/utils/storage-buckets';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration');
}

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const originalStorageFrom = client.storage.from.bind(client.storage);
client.storage.from = ((id: string) => {
  assertAppStorageBucket(id, CONTESTS_ENABLED);
  return originalStorageFrom(id);
}) as typeof client.storage.from;

export const supabase = client;
