import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

const isValid =
  supabaseUrl.length > 0 &&
  supabaseAnonKey.length > 0 &&
  supabaseUrl.includes('supabase.co');

if (__DEV__ && !isValid) {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[Supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. Add them to .env.local and restart with: npx expo start --clear'
    );
  } else if (!supabaseUrl.includes('supabase.co')) {
    console.warn('[Supabase] EXPO_PUBLIC_SUPABASE_URL does not look like a Supabase URL (should contain supabase.co). Check .env.local');
  }
}

export const supabase = isValid
  ? createClient(supabaseUrl, supabaseAnonKey, {
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

// Debug log on import (non-sensitive). Project ID helps confirm correct project.
if (__DEV__) {
  const url = supabaseUrl || '(empty)';
  const match = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectId = match ? `${match[1].slice(0, 4)}...${match[1].slice(-4)}` : '(none)';
  const masked = match ? `https://${match[1].slice(0, 4)}....supabase.co` : url;
  console.log(
    `[Supabase] init: url= ${masked} projectId= ${projectId} anonKeyExists= ${!!supabaseAnonKey}`,
  );
}
