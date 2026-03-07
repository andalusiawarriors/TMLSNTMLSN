/**
 * useSupabaseUser
 * Thin wrapper around AuthContext — returns the currently signed-in Supabase User
 * or null when signed out / auth not yet resolved.
 */
import { useAuth } from '../context/AuthContext';

export function useSupabaseUser() {
  const { user } = useAuth();
  return user; // User | null
}
