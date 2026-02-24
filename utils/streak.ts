import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'tmlsn_workout_streak_v2';

export interface StreakData {
  streakStart: Date | null;
  streakDead: boolean;
  days: number;
}

/**
 * Get current streak data (days since streak start). Returns 0 if streak is dead or never started.
 */
export async function getStreakData(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    let streakStart: Date | null = null;
    let streakDead = false;

    if (raw) {
      const s = JSON.parse(raw);
      if (s.streakStart) streakStart = new Date(s.streakStart);
      if (s.streakDead) streakDead = true;
    }

    if (streakDead || !streakStart) {
      return { streakStart: null, streakDead, days: 0 };
    }

    const now = new Date();
    const ms = now.getTime() - streakStart.getTime();
    const days = Math.max(0, Math.floor(ms / 86400000));
    return { streakStart, streakDead, days };
  } catch (e) {
    console.warn('streak get error', e);
    return { streakStart: null, streakDead: false, days: 0 };
  }
}

/**
 * Log a completed workout to the streak. Call this when the user finishes a workout or routine.
 */
export async function logStreakWorkout(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const now = new Date();
    let streakStart: Date | null = null;
    let streakDead = false;
    let exemptWeek: string | null = null;

    if (raw) {
      const s = JSON.parse(raw);
      if (s.streakStart) streakStart = new Date(s.streakStart);
      if (s.streakDead) streakDead = true;
      if (s.exemptWeek) exemptWeek = s.exemptWeek;
    }

    const newStart = (streakDead || !streakStart) ? now : streakStart;

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      streakStart: newStart.toISOString(),
      lastWorkout: now.toISOString(),
      exemptWeek: exemptWeek ?? null,
    }));
  } catch (e) {
    console.warn('streak log error', e);
  }
}
