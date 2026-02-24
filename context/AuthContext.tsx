import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { setStorageUserId } from '../utils/storage';

// If signup still fails, common causes:
// - Wrong Supabase URL/anon key (project mismatch)
// - Email auth provider disabled in Supabase (Authentication > Providers)
// - Network failure (device/emulator can't reach Supabase)
// - Password policy (e.g. min length, complexity)

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  debugCreateTestUser?: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSession(null);
      setUser(null);
      setIsLoading(false);
      setStorageUserId(null);
      return;
    }

    supabase!.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setStorageUserId(session?.user?.id ?? null);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
        setStorageUserId(null);
      })
      .finally(() => setIsLoading(false));

    const { data: { subscription } } = supabase!.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      if (__DEV__) {
        console.log('[Auth] onAuthStateChange:', event, 'sessionExists=', !!session, 'userId=', uid ?? '(null)');
      }
      setSession(session);
      setUser(session?.user ?? null);
      setStorageUserId(uid);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      const err = new Error('Supabase not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart Expo (npx expo start --clear).');
      Alert.alert('Sign up failed', err.message);
      return { error: err };
    }
    if (!email.trim() || !password) {
      const err = new Error('Please enter email and password');
      Alert.alert('Sign up failed', err.message);
      return { error: err };
    }
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (__DEV__) {
        console.log('[Auth] signUp result: data.user?.id=', data?.user?.id, 'data.session=', data?.session ? 'exists' : 'null', 'error=', error?.message ?? null);
      }
      if (error) {
        Alert.alert('Sign up failed', error.message);
        return { error };
      }
      // User created even if session is null (e.g. email confirmation enabled)
      if (data?.user?.id) {
        setStorageUserId(data.user.id);
      }
      if (data?.session === null && data?.user) {
        Alert.alert('Account created', 'Check your email to confirm. You can log in after confirming.');
      } else {
        Alert.alert('Success', 'Account created');
      }
      return { error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign up failed';
      const friendly = msg === 'Network request failed'
        ? 'Cannot reach Supabase. Check: 1) Restart Expo with npx expo start --clear 2) Supabase project not paused 3) .env.local has correct URL and anon key'
        : msg;
      Alert.alert('Sign up failed', friendly);
      return { error: e instanceof Error ? e : new Error(msg) };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      const err = new Error('Supabase not configured.');
      Alert.alert('Log in failed', err.message);
      return { error: err };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (__DEV__) {
        console.log('[Auth] signIn result: userId=', data?.user?.id ?? null, 'error=', error?.message ?? null);
      }
      if (error) {
        Alert.alert('Log in failed', error.message);
        return { error };
      }
      if (data?.user?.id) {
        setStorageUserId(data.user.id);
      }
      Alert.alert('Success', 'Logged in');
      return { error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Log in failed';
      const friendly = msg === 'Network request failed'
        ? 'Cannot reach Supabase. Check: 1) Restart Expo with npx expo start --clear 2) Supabase project not paused 3) .env.local has correct URL and anon key'
        : msg;
      Alert.alert('Log in failed', friendly);
      return { error: e instanceof Error ? e : new Error(msg) };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (__DEV__) console.log('[Auth] signOut pressed');
    if (!supabase) {
      setStorageUserId(null);
      if (__DEV__) console.log('[Auth] signOut success');
      Alert.alert('Logged out', 'You have been logged out');
      return;
    }
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[Auth] signOut error:', error);
        Alert.alert('Log out failed', error.message);
        return;
      }
      setStorageUserId(null);
      if (__DEV__) console.log('[Auth] signOut success');
      Alert.alert('Logged out', 'You have been logged out');
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[Auth] signOut error:', err);
      Alert.alert('Log out failed', err.message);
    }
  }, []);

  // TEMP DEBUG: quick test signup
  const debugCreateTestUser = useCallback(async () => {
    const email = `test${Date.now()}@gmail.com`;
    const password = 'Test123456!';
    if (!supabase) {
      Alert.alert('Debug', 'Supabase not configured');
      return;
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    console.log('[Auth] debugCreateTestUser:', { email, userId: data?.user?.id, error: error?.message });
    Alert.alert(
      error ? 'Debug signup failed' : 'Debug signup OK',
      error ? error.message : `User: ${data?.user?.id ?? 'created'}`,
    );
    if (!error && data?.user?.id) setStorageUserId(data.user.id);
  }, []);

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    signUp,
    signIn,
    signOut,
    ...(__DEV__ && { debugCreateTestUser }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useSession() {
  const { session, isLoading } = useAuth();
  return { session, isLoading };
}
