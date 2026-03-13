// URL polyfill loaded in index.js (native only)
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL as CONFIG_URL, SUPABASE_ANON_KEY as CONFIG_KEY } from './supabaseConfig';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? CONFIG_URL).trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? CONFIG_KEY).trim();

const isValid =
  supabaseUrl.length > 0 &&
  supabaseAnonKey.length > 0 &&
  supabaseUrl.includes('supabase.co');

if (__DEV__ && !isValid) {
  console.warn(
    '[Supabase] Set your project in lib/supabaseConfig.ts (SUPABASE_URL, SUPABASE_ANON_KEY) or in .env.local. Restart with: npx expo start --clear'
  );
}

export const supabase = isValid
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: { fetch: global.fetch.bind(global) },
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const isSupabaseConfigured = (): boolean => !!supabase;

