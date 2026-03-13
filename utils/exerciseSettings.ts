// ============================================================
// TMLSN — Exercise Settings
// Per-exercise user config: rep ranges, smallest increment, favorites.
// Stored locally in AsyncStorage (user-specific, device-local).
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStorageUserId } from './storageUserId';

const SETTINGS_KEY_PREFIX = '@tmlsn/exercise_settings_v1';

function getSettingsKey(): string {
  return `${SETTINGS_KEY_PREFIX}:${getStorageUserId() ?? 'anonymous'}`;
}

export interface ExerciseUserSettings {
  /** Minimum reps for the TMLSN auto-progression algorithm */
  repRangeLow: number;
  /** Maximum reps — when all sets hit this, weight goes up */
  repRangeHigh: number;
  /** Smallest weight increment available (e.g. 2.5 for big bar, 1.25 for micro plates) */
  smallestIncrement: number;
  /** User-starred this exercise */
  favorite: boolean;
  /** ISO timestamp of the last session where this exercise was done */
  lastDoneAt?: string;
}

export const DEFAULT_EXERCISE_SETTINGS: ExerciseUserSettings = {
  repRangeLow: 10,
  repRangeHigh: 12,
  smallestIncrement: 2.5,
  favorite: false,
};

type SettingsMap = Record<string, ExerciseUserSettings>;

// ── Private helpers ──────────────────────────────────────────

async function readAll(): Promise<SettingsMap> {
  try {
    const raw = await AsyncStorage.getItem(getSettingsKey());
    return raw ? (JSON.parse(raw) as SettingsMap) : {};
  } catch {
    return {};
  }
}

async function writeAll(map: SettingsMap): Promise<void> {
  await AsyncStorage.setItem(getSettingsKey(), JSON.stringify(map));
}

// ── Public API ───────────────────────────────────────────────

/** Get settings for a single exercise. Returns defaults if never configured. */
export async function getExerciseSettings(
  exerciseId: string,
): Promise<ExerciseUserSettings> {
  const map = await readAll();
  return map[exerciseId]
    ? { ...DEFAULT_EXERCISE_SETTINGS, ...map[exerciseId] }
    : { ...DEFAULT_EXERCISE_SETTINGS };
}

/** Persist settings for a single exercise (partial update supported). */
export async function saveExerciseSettings(
  exerciseId: string,
  settings: Partial<ExerciseUserSettings>,
): Promise<void> {
  const map = await readAll();
  const existing = map[exerciseId] ?? { ...DEFAULT_EXERCISE_SETTINGS };
  map[exerciseId] = { ...existing, ...settings };
  await writeAll(map);
}

/** Return the full settings map for all exercises that have been configured. */
export async function getAllExerciseSettings(): Promise<SettingsMap> {
  return readAll();
}

/** Reset rep ranges and increment to defaults for an exercise. Preserves favorite and lastDoneAt. */
export async function resetRepRangesToDefault(exerciseId: string): Promise<void> {
  const map = await readAll();
  const existing = map[exerciseId] ?? { ...DEFAULT_EXERCISE_SETTINGS };
  map[exerciseId] = {
    ...existing,
    repRangeLow: DEFAULT_EXERCISE_SETTINGS.repRangeLow,
    repRangeHigh: DEFAULT_EXERCISE_SETTINGS.repRangeHigh,
    smallestIncrement: DEFAULT_EXERCISE_SETTINGS.smallestIncrement,
  };
  await writeAll(map);
}

/** Reset rep ranges and increment to defaults for all exercises. Preserves favorites and lastDoneAt. */
export async function resetAllRepRangesToDefault(): Promise<number> {
  const map = await readAll();
  let count = 0;
  for (const exerciseId of Object.keys(map)) {
    const existing = map[exerciseId] ?? { ...DEFAULT_EXERCISE_SETTINGS };
    map[exerciseId] = {
      ...existing,
      repRangeLow: DEFAULT_EXERCISE_SETTINGS.repRangeLow,
      repRangeHigh: DEFAULT_EXERCISE_SETTINGS.repRangeHigh,
      smallestIncrement: DEFAULT_EXERCISE_SETTINGS.smallestIncrement,
    };
    count++;
  }
  if (count > 0) await writeAll(map);
  return count;
}

/** Toggle the favorite flag for an exercise. Returns new state. */
export async function toggleFavorite(exerciseId: string): Promise<boolean> {
  const map = await readAll();
  const existing = map[exerciseId] ?? { ...DEFAULT_EXERCISE_SETTINGS };
  const newFav = !existing.favorite;
  map[exerciseId] = { ...existing, favorite: newFav };
  await writeAll(map);
  return newFav;
}

/** Called after a workout completes — updates lastDoneAt for each exercise done. */
export async function markExercisesDone(
  exerciseIds: string[],
  isoDate: string,
): Promise<void> {
  if (exerciseIds.length === 0) return;
  const map = await readAll();
  for (const id of exerciseIds) {
    const existing = map[id] ?? { ...DEFAULT_EXERCISE_SETTINGS };
    map[id] = { ...existing, lastDoneAt: isoDate };
  }
  await writeAll(map);
}
