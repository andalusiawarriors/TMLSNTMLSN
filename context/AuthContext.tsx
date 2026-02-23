import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { setStorageUserId } from '../utils/storage';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
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

    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setStorageUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart Expo (npx expo start --clear).') };
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error };
    } catch (e: any) {
      const msg = e?.message ?? 'Sign up failed';
      if (msg === 'Network request failed') {
        return { error: new Error('Cannot reach Supabase. Check: 1) Restart Expo with npx expo start --clear 2) Supabase project not paused 3) .env.local has correct URL and anon key') };
      }
      return { error: e instanceof Error ? e : new Error(msg) };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart Expo (npx expo start --clear).') };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (e: any) {
      const msg = e?.message ?? 'Log in failed';
      if (msg === 'Network request failed') {
        return { error: new Error('Cannot reach Supabase. Check: 1) Restart Expo with npx expo start --clear 2) Supabase project not paused 3) .env.local has correct URL and anon key') };
      }
      return { error: e instanceof Error ? e : new Error(msg) };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setStorageUserId(null);
  }, []);

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    signUp,
    signIn,
    signOut,
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
