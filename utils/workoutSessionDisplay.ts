import type { WorkoutSession } from '../types';

/**
 * Display name for a workout session:
 * - If user stated a name (or from TMLSN split / My Routine) → use it
 * - If no name (empty or "Workout") → "Empty Workout"
 */
export function getSessionDisplayName(session: WorkoutSession): string {
  const name = (session.name || '').trim();
  if (name && name !== 'Workout') return name;
  return 'Empty Workout';
}
