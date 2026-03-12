import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { formatLocalYMD } from '../lib/time';
import {
  supabaseDeleteWorkoutStreak,
  supabaseGetWorkoutStreak,
  supabaseUpsertWorkoutStreak,
  type WorkoutStreakStateRow,
} from './supabaseStorage';

const STORAGE_KEY = 'tmlsn_workout_streak_v2';

export interface StreakData {
  streakStart: Date | null;
  streakDead: boolean;
  days: number;
}

export interface StreakState extends StreakData {
  streakStartYmd: string | null;
  lastWorkout: Date | null;
  lastWorkoutYmd: string | null;
  exemptWeek: string | null;
}

export type PersistedStreakState = {
  streakStartYmd: string | null;
  lastWorkoutYmd: string | null;
  lastWorkoutAt: string | null;
  streakDead: boolean;
  exemptWeek: string | null;
};

const EMPTY_STATE: PersistedStreakState = {
  streakStartYmd: null,
  lastWorkoutYmd: null,
  lastWorkoutAt: null,
  streakDead: false,
  exemptWeek: null,
};

function getScopedStorageKey(userId: string | null): string {
  return `${STORAGE_KEY}:${userId ?? 'anonymous'}`;
}

function parseLocalYMD(ymd: string | null | undefined): Date | null {
  if (!ymd) return null;
  const [year, month, day] = ymd.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function diffLocalDays(fromYmd: string, toYmd: string): number {
  const from = parseLocalYMD(fromYmd);
  const to = parseLocalYMD(toYmd);
  if (!from || !to) return 0;
  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toMidnight = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.floor((fromMidnight - toMidnight) / 86400000);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getCurrentLocalWeekKey(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const dayOffset = Math.floor((d.getTime() - yearStart.getTime()) / 86400000);
  return `${d.getFullYear()}-W${String(Math.ceil((dayOffset + 1) / 7)).padStart(2, '0')}`;
}

function normalizePersistedState(raw: unknown): PersistedStreakState | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const streakStartYmd =
    typeof data.streakStartYmd === 'string'
      ? data.streakStartYmd
      : typeof data.streakStart === 'string'
        ? formatLocalYMD(new Date(data.streakStart))
        : null;
  const lastWorkoutAt =
    typeof data.lastWorkoutAt === 'string'
      ? data.lastWorkoutAt
      : typeof data.lastWorkout === 'string'
        ? data.lastWorkout
        : null;
  const lastWorkoutYmd =
    typeof data.lastWorkoutYmd === 'string'
      ? data.lastWorkoutYmd
      : lastWorkoutAt
        ? formatLocalYMD(new Date(lastWorkoutAt))
        : streakStartYmd;

  return {
    streakStartYmd,
    lastWorkoutYmd,
    lastWorkoutAt,
    streakDead: Boolean(data.streakDead ?? false),
    exemptWeek: typeof data.exemptWeek === 'string' ? data.exemptWeek : null,
  };
}

async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function readLocalState(userId: string | null): Promise<PersistedStreakState | null> {
  try {
    const scopedRaw = await AsyncStorage.getItem(getScopedStorageKey(userId));
    if (scopedRaw) {
      return normalizePersistedState(JSON.parse(scopedRaw));
    }

    const legacyRaw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!legacyRaw) return null;
    const legacy = normalizePersistedState(JSON.parse(legacyRaw));
    if (!legacy) return null;
    await AsyncStorage.setItem(getScopedStorageKey(userId), JSON.stringify(legacy));
    return legacy;
  } catch (e) {
    console.warn('streak local read error', e);
    return null;
  }
}

async function writeLocalState(userId: string | null, state: PersistedStreakState): Promise<void> {
  await AsyncStorage.setItem(getScopedStorageKey(userId), JSON.stringify(state));
}

function resolveState(
  persisted: PersistedStreakState | null,
  now: Date = new Date()
): { persisted: PersistedStreakState; state: StreakState; changed: boolean } {
  const base = persisted ?? EMPTY_STATE;
  const todayYmd = formatLocalYMD(now);
  const currentWeek = getCurrentLocalWeekKey(now);
  const gap = base.lastWorkoutYmd ? diffLocalDays(todayYmd, base.lastWorkoutYmd) : 0;
  const streakDead =
    base.streakDead || (!!base.lastWorkoutYmd && gap > 1 && base.exemptWeek !== currentWeek);
  const nextPersisted =
    streakDead === base.streakDead ? base : { ...base, streakDead };
  const days = !streakDead && nextPersisted.streakStartYmd
    ? Math.max(0, diffLocalDays(todayYmd, nextPersisted.streakStartYmd))
    : 0;

  return {
    persisted: nextPersisted,
    changed: streakDead !== base.streakDead,
    state: {
      streakStart: parseLocalYMD(nextPersisted.streakStartYmd),
      streakStartYmd: nextPersisted.streakStartYmd,
      lastWorkout: nextPersisted.lastWorkoutAt ? new Date(nextPersisted.lastWorkoutAt) : parseLocalYMD(nextPersisted.lastWorkoutYmd),
      lastWorkoutYmd: nextPersisted.lastWorkoutYmd,
      exemptWeek: nextPersisted.exemptWeek,
      streakDead,
      days,
    },
  };
}

async function persistState(userId: string | null, state: PersistedStreakState): Promise<void> {
  await writeLocalState(userId, state);
  if (!userId) return;
  try {
    await supabaseUpsertWorkoutStreak(userId, state);
  } catch (e) {
    console.warn('streak remote save error', e);
  }
}

/** Prefer the newer of two states by lastWorkoutYmd, then lastWorkoutAt. Prevents offline rollback. */
export function preferNewer(
  remote: PersistedStreakState,
  local: PersistedStreakState | null
): { state: PersistedStreakState; source: 'remote' | 'local' } {
  if (!local) return { state: remote, source: 'remote' };
  const rYmd = remote.lastWorkoutYmd ?? '';
  const lYmd = local.lastWorkoutYmd ?? '';
  if (lYmd > rYmd) return { state: local, source: 'local' };
  if (lYmd < rYmd) return { state: remote, source: 'remote' };
  const rAt = remote.lastWorkoutAt ?? '';
  const lAt = local.lastWorkoutAt ?? '';
  return lAt > rAt ? { state: local, source: 'local' } : { state: remote, source: 'remote' };
}

async function loadPersistedState(userId: string | null): Promise<PersistedStreakState | null> {
  const local = await readLocalState(userId);
  if (!userId) return local;

  try {
    const remote = await supabaseGetWorkoutStreak(userId);
    if (remote) {
      const { state: merged, source } = preferNewer(remote, local);
      await writeLocalState(userId, merged);
      if (source === 'local' && local) {
        await supabaseUpsertWorkoutStreak(userId, merged);
      }
      return merged;
    }
    if (local) {
      await supabaseUpsertWorkoutStreak(userId, local);
      return local;
    }
  } catch (e) {
    console.warn('streak remote read error', e);
  }

  return local;
}

export async function getStreakState(now: Date = new Date()): Promise<StreakState> {
  try {
    const userId = await getCurrentUserId();
    const persisted = await loadPersistedState(userId);
    const resolved = resolveState(persisted, now);
    if (resolved.changed) {
      await persistState(userId, resolved.persisted);
    }
    return resolved.state;
  } catch (e) {
    console.warn('streak get error', e);
    return {
      streakStart: null,
      streakStartYmd: null,
      lastWorkout: null,
      lastWorkoutYmd: null,
      exemptWeek: null,
      streakDead: false,
      days: 0,
    };
  }
}

/**
 * Get current streak data (days since streak start). Returns 0 if streak is dead or never started.
 */
export async function getStreakData(): Promise<StreakData> {
  const state = await getStreakState();
  return {
    streakStart: state.streakStart,
    streakDead: state.streakDead,
    days: state.days,
  };
}

export function getStreakCountdownSeconds(
  lastWorkoutYmd: string | null,
  exemptWeek: string | null,
  now: Date = new Date()
): number {
  if (!lastWorkoutYmd) return 0;
  if (exemptWeek === getCurrentLocalWeekKey(now)) return 86400;

  const todayYmd = formatLocalYMD(now);
  const gap = diffLocalDays(todayYmd, lastWorkoutYmd);
  if (gap > 1) return 0;

  const deadline = addLocalDays(startOfLocalDay(now), gap === 0 ? 2 : 1);
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000));
}

/**
 * Log a completed workout to the streak. Call this when the user finishes a workout or routine.
 */
export async function logStreakWorkout(): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    const persisted = await loadPersistedState(userId);
    const now = new Date();
    const todayYmd = formatLocalYMD(now);
    const currentWeek = getCurrentLocalWeekKey(now);
    const resolved = resolveState(persisted, now).persisted;

    if (resolved.lastWorkoutYmd === todayYmd && !resolved.streakDead) {
      return;
    }

    const gap = resolved.lastWorkoutYmd ? diffLocalDays(todayYmd, resolved.lastWorkoutYmd) : 0;
    const shouldRestart =
      resolved.streakDead ||
      !resolved.streakStartYmd ||
      !resolved.lastWorkoutYmd ||
      (gap > 1 && resolved.exemptWeek !== currentWeek);

    const nextState: PersistedStreakState = {
      streakStartYmd: shouldRestart ? todayYmd : resolved.streakStartYmd,
      lastWorkoutYmd: todayYmd,
      lastWorkoutAt: now.toISOString(),
      streakDead: false,
      exemptWeek: resolved.exemptWeek,
    };

    await persistState(userId, nextState);
  } catch (e) {
    console.warn('streak log error', e);
  }
}

export async function useStreakRestDay(): Promise<void> {
  const userId = await getCurrentUserId();
  const persisted = await loadPersistedState(userId);
  const nextState: PersistedStreakState = {
    ...(persisted ?? EMPTY_STATE),
    exemptWeek: getCurrentLocalWeekKey(new Date()),
  };
  await persistState(userId, nextState);
}

export async function resetStreakState(): Promise<void> {
  const userId = await getCurrentUserId();
  try {
    await AsyncStorage.removeItem(getScopedStorageKey(userId));
    if (userId) {
      await supabaseDeleteWorkoutStreak(userId);
    }
  } catch (e) {
    console.warn('streak reset error', e);
  }
}
