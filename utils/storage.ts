import AsyncStorage from '@react-native-async-storage/async-storage';
import { NutritionLog, WorkoutSession, Prompt, UserSettings, DailyGoals, SavedRoutine, SavedFood } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { invalidateTodayWorkoutContextCache } from '../lib/getWorkoutContext';
import * as supabaseStorage from './supabaseStorage';
import { DEFAULT_GOALS, DEFAULT_SETTINGS, DEFAULT_PROGRESS_HUB_ORDER } from '../constants/storageDefaults';
import { logStreakWorkout } from './streak';

// Current user ID for Supabase-backed storage (set by AuthContext on login/logout)
let _storageUserId: string | null = null;

export function setStorageUserId(userId: string | null): void {
  _storageUserId = userId;
}

export function getStorageUserId(): string | null {
  return _storageUserId;
}

// Storage Keys (used when not logged in)
const KEYS = {
  NUTRITION_LOGS: '@tmlsn/nutrition_logs',
  WORKOUT_SESSIONS: '@tmlsn/workout_sessions',
  PROMPTS: '@tmlsn/prompts',
  USER_SETTINGS: '@tmlsn/user_settings',
  WORKOUT_SPLITS: '@tmlsn/workout_splits',
  SAVED_ROUTINES: '@tmlsn/saved_routines',
  SAVED_FOODS: '@tmlsn/saved_foods',
};

const SESSION_COMPLETED_DATE_KEY = 'TMLSN_session_completed_date';
const ACTIVE_WORKOUT_DRAFT_KEY = 'TMLSN_active_workout_draft';

export type ActiveWorkoutDraft = {
  version: 1;
  savedAt: string;
  workout: WorkoutSession;
  currentExerciseIndex: number;
};

export function getSessionCompletedDateStorageKey(userId?: string | null): string {
  return `${SESSION_COMPLETED_DATE_KEY}:${userId ?? getStorageUserId() ?? 'anonymous'}`;
}

export function getActiveWorkoutDraftStorageKey(userId?: string | null): string {
  return `${ACTIVE_WORKOUT_DRAFT_KEY}:${userId ?? getStorageUserId() ?? 'anonymous'}`;
}

export async function getSessionCompletedDate(userId?: string | null): Promise<string | null> {
  return AsyncStorage.getItem(getSessionCompletedDateStorageKey(userId));
}

export async function setSessionCompletedDate(
  dateYMD: string,
  userId?: string | null
): Promise<void> {
  await AsyncStorage.setItem(getSessionCompletedDateStorageKey(userId), dateYMD);
}

export async function clearSessionCompletedDate(userId?: string | null): Promise<void> {
  await AsyncStorage.removeItem(getSessionCompletedDateStorageKey(userId));
}

function getWorkoutSessionLocalYMD(session: WorkoutSession): string | null {
  if (!session?.date) return null;
  const parsed = new Date(session.date);
  if (Number.isNaN(parsed.getTime())) {
    return typeof session.date === 'string' && session.date.length >= 10
      ? session.date.slice(0, 10)
      : null;
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

async function syncSessionCompletedDateFromHistory(userId?: string | null): Promise<void> {
  const todayYMD = new Date();
  const today = `${todayYMD.getFullYear()}-${String(todayYMD.getMonth() + 1).padStart(2, '0')}-${String(todayYMD.getDate()).padStart(2, '0')}`;
  const sessions = await getWorkoutSessions();
  const hasWorkoutToday = sessions.some((session) => getWorkoutSessionLocalYMD(session) === today);

  if (hasWorkoutToday) {
    await setSessionCompletedDate(today, userId);
    return;
  }

  await clearSessionCompletedDate(userId);
}

export async function getActiveWorkoutDraft(userId?: string | null): Promise<ActiveWorkoutDraft | null> {
  const raw = await AsyncStorage.getItem(getActiveWorkoutDraftStorageKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ActiveWorkoutDraft;
    if (
      parsed?.version !== 1 ||
      !parsed?.savedAt ||
      !parsed?.workout?.id ||
      !parsed?.workout?.date ||
      !Array.isArray(parsed?.workout?.exercises)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveActiveWorkoutDraft(
  draft: ActiveWorkoutDraft,
  userId?: string | null
): Promise<void> {
  await AsyncStorage.setItem(getActiveWorkoutDraftStorageKey(userId), JSON.stringify(draft));
}

export async function clearActiveWorkoutDraft(userId?: string | null): Promise<void> {
  await AsyncStorage.removeItem(getActiveWorkoutDraftStorageKey(userId));
}

export { DEFAULT_GOALS, DEFAULT_SETTINGS };

// Nutrition Storage Functions
// TEMP: Nutrition uses AsyncStorage only while Supabase nutrition schema is being finalized.
export const saveNutritionLog = async (log: NutritionLog): Promise<void> => {
  if (isSupabaseConfigured() && !getStorageUserId()) {
    return;
  }
  try {
    const existingLogs = await getNutritionLogs();
    const updatedLogs = existingLogs.filter(l => l.date !== log.date);
    updatedLogs.push(log);
    await AsyncStorage.setItem(KEYS.NUTRITION_LOGS, JSON.stringify(updatedLogs));
  } catch (error) {
    console.error('Error saving nutrition log:', error);
    throw error;
  }
};

// TEMP: Nutrition uses AsyncStorage only while Supabase nutrition schema is being finalized.
export const getNutritionLogs = async (): Promise<NutritionLog[]> => {
  if (isSupabaseConfigured() && !getStorageUserId()) {
    return [];
  }
  try {
    const data = await AsyncStorage.getItem(KEYS.NUTRITION_LOGS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting nutrition logs:', error);
    return [];
  }
};

// TEMP: Nutrition uses AsyncStorage only while Supabase nutrition schema is being finalized.
export const getTodayNutritionLog = async (): Promise<NutritionLog | null> => {
  try {
    const logs = await getNutritionLogs();
    const today = new Date().toISOString().split('T')[0];
    return logs.find(log => log.date === today) || null;
  } catch (error) {
    console.error('Error getting today nutrition log:', error);
    return null;
  }
};

// TEMP: Nutrition uses AsyncStorage only while Supabase nutrition schema is being finalized.
export const getNutritionLogByDate = async (dateString: string): Promise<NutritionLog | null> => {
  try {
    const logs = await getNutritionLogs();
    return logs.find(log => log.date === dateString) || null;
  } catch (error) {
    console.error('Error getting nutrition log by date:', error);
    return null;
  }
};

/** Delete all nutrition (food) logs from local storage. */
export const clearAllNutritionLogs = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.NUTRITION_LOGS, JSON.stringify([]));
  } catch (error) {
    console.error('Error clearing nutrition logs:', error);
    throw error;
  }
};

// Workout Storage Functions
export const saveWorkoutSession = async (session: WorkoutSession): Promise<void> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && !uid) {
    return;
  }
  const { sanitizeWorkoutSessionForSave } = await import('./workoutSetValidation');
  const sessionSanitized = sanitizeWorkoutSessionForSave(session) as WorkoutSession;
  const { resolveRepRangesForSession } = await import('@/lib/progression/resolveRepRange');
  const sessionResolved = (await resolveRepRangesForSession(sessionSanitized)) as WorkoutSession;
  if (uid && isSupabaseConfigured()) {
    try {
      await supabaseStorage.supabaseSaveWorkoutSession(uid, sessionResolved);
      invalidateTodayWorkoutContextCache(uid);
      return;
    } catch (error) {
      console.error('Error saving workout session:', error);
      throw error;
    }
  }
  try {
    const existingSessions = await getWorkoutSessions();
    // Upsert by id: replace existing session with same id (e.g. user edits then re-finishes)
    const updatedSessions = [...existingSessions.filter((s: WorkoutSession) => s.id !== sessionResolved.id), sessionResolved];
    await AsyncStorage.setItem(KEYS.WORKOUT_SESSIONS, JSON.stringify(updatedSessions));
    invalidateTodayWorkoutContextCache(uid ?? undefined);
  } catch (error) {
    console.error('Error saving workout session:', error);
    throw error;
  }
};

/**
 * Single canonical finalize for finishing a workout. Persists session + exercises + sets once,
 * runs progressive overload prescription compute + upserts to exercise_progress_state, then marks
 * the session complete. Idempotent: calling again for the same sessionId (e.g. double-tap Save)
 * re-persists the same data without duplicating rows (Supabase: upsert session, delete+reinsert
 * exercises/sets for that sessionId; AsyncStorage: filter-by-id then push).
 * Call this from workout-save Save button only; do not persist on Finish (Finish only navigates).
 */
export async function finalizeWorkoutSession(
  session: WorkoutSession,
  _opts?: { userId?: string | null }
): Promise<string> {
  const sessionId = session.id;
  if (__DEV__) {
    console.group('[Finalize] start sessionId=' + sessionId);
  }
  const duration =
    session.duration != null && session.duration > 0
      ? session.duration
      : Math.round((Date.now() - new Date(session.date).getTime()) / 60000);
  const sessionCompleted: WorkoutSession = {
    ...session,
    isComplete: true,
    duration,
  };
  await saveWorkoutSession(sessionCompleted);
  if (__DEV__) {
    console.log('[Finalize] saved session/exercises/sets');
  }
  await logStreakWorkout();
  if (__DEV__) {
    console.log('[Finalize] prescriptions updated (via saveWorkoutSession); streak logged');
    console.log('[Finalize] complete');
    console.groupEnd();
  }
  return sessionId;
}

/** Update the name of an existing workout session. */
export const updateWorkoutSessionName = async (sessionId: string, name: string): Promise<void> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && uid) {
    try {
      await supabaseStorage.supabaseUpdateWorkoutSessionName(uid, sessionId, name);
      return;
    } catch (error) {
      console.error('Error updating workout session name:', error);
      throw error;
    }
  }
  try {
    const existingSessions = await getWorkoutSessions();
    const updatedSessions = existingSessions.map((s) =>
      s.id === sessionId ? { ...s, name: name.trim() || s.name } : s
    );
    await AsyncStorage.setItem(KEYS.WORKOUT_SESSIONS, JSON.stringify(updatedSessions));
  } catch (error) {
    console.error('Error updating workout session name:', error);
    throw error;
  }
};

export const getWorkoutSessions = async (): Promise<WorkoutSession[]> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && !uid) {
    return [];
  }
  if (uid && isSupabaseConfigured()) {
    return supabaseStorage.supabaseGetWorkoutSessions(uid);
  }
  try {
    const data = await AsyncStorage.getItem(KEYS.WORKOUT_SESSIONS);
    const sessions: WorkoutSession[] = data ? JSON.parse(data) : [];
    // Match Supabase order: most recent first (progression uses first match as "last session")
    return sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error getting workout sessions:', error);
    return [];
  }
};

export const getRecentWorkouts = async (limit: number = 10): Promise<WorkoutSession[]> => {
  try {
    const sessions = await getWorkoutSessions();
    return sessions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting recent workouts:', error);
    return [];
  }
};

export const deleteWorkoutSession = async (sessionId: string): Promise<void> => {
  const uid = getStorageUserId();
  const draft = await getActiveWorkoutDraft(uid ?? undefined);
  if (draft?.workout?.id === sessionId) {
    await clearActiveWorkoutDraft(uid ?? undefined);
  }
  if (isSupabaseConfigured() && !uid) {
    return;
  }
  if (uid && isSupabaseConfigured()) {
    try {
      await supabaseStorage.supabaseDeleteWorkoutSession(uid, sessionId);
      await syncSessionCompletedDateFromHistory(uid);
      invalidateTodayWorkoutContextCache(uid);
      return;
    } catch (error) {
      console.error('Error deleting workout session:', error);
      throw error;
    }
  }
  try {
    const existingSessions = await getWorkoutSessions();
    const updatedSessions = existingSessions.filter((s) => s.id !== sessionId);
    await AsyncStorage.setItem(KEYS.WORKOUT_SESSIONS, JSON.stringify(updatedSessions));
    await syncSessionCompletedDateFromHistory(uid ?? undefined);
    invalidateTodayWorkoutContextCache(uid ?? undefined);
  } catch (error) {
    console.error('Error deleting workout session:', error);
    throw error;
  }
};

export const deleteAllWorkoutSessions = async (): Promise<void> => {
  const uid = getStorageUserId();
  await clearActiveWorkoutDraft(uid ?? undefined);
  if (isSupabaseConfigured() && !uid) {
    return;
  }
  if (uid && isSupabaseConfigured()) {
    try {
      await supabaseStorage.supabaseDeleteAllWorkoutSessions(uid);
      await clearSessionCompletedDate(uid);
      invalidateTodayWorkoutContextCache(uid);
      return;
    } catch (error) {
      console.error('Error deleting all workout sessions:', error);
      throw error;
    }
  }
  try {
    await AsyncStorage.setItem(KEYS.WORKOUT_SESSIONS, JSON.stringify([]));
    await clearSessionCompletedDate(uid ?? undefined);
    invalidateTodayWorkoutContextCache(uid ?? undefined);
  } catch (error) {
    console.error('Error deleting all workout sessions:', error);
    throw error;
  }
};

export const updateWorkoutSession = async (session: WorkoutSession): Promise<void> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && !uid) {
    return;
  }
  if (uid && isSupabaseConfigured()) {
    try {
      await supabaseStorage.supabaseSaveWorkoutSession(uid, session);
      return;
    } catch (error) {
      console.error('Error updating workout session:', error);
      throw error;
    }
  }
  try {
    const existingSessions = await getWorkoutSessions();
    const updatedSessions = existingSessions.map((s) => s.id === session.id ? session : s);
    await AsyncStorage.setItem(KEYS.WORKOUT_SESSIONS, JSON.stringify(updatedSessions));
  } catch (error) {
    console.error('Error updating workout session:', error);
    throw error;
  }
};

// Saved Routines (templates for My Routines)
export const getSavedRoutines = async (): Promise<SavedRoutine[]> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && !uid) {
    return [];
  }
  if (uid && isSupabaseConfigured()) {
    return supabaseStorage.supabaseGetSavedRoutines(uid);
  }
  try {
    const data = await AsyncStorage.getItem(KEYS.SAVED_ROUTINES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting saved routines:', error);
    return [];
  }
};

export const saveSavedRoutine = async (routine: SavedRoutine): Promise<void> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && !uid) {
    return;
  }
  if (uid && isSupabaseConfigured()) {
    try {
      await supabaseStorage.supabaseSaveSavedRoutine(uid, routine);
      return;
    } catch (error) {
      console.error('Error saving routine:', error);
      throw error;
    }
  }
  try {
    const routines = await getSavedRoutines();
    const updated = routines.filter((r) => r.id !== routine.id);
    updated.push(routine);
    await AsyncStorage.setItem(KEYS.SAVED_ROUTINES, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving routine:', error);
    throw error;
  }
};

export const deleteSavedRoutine = async (routineId: string): Promise<void> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && !uid) {
    return;
  }
  if (uid && isSupabaseConfigured()) {
    try {
      await supabaseStorage.supabaseDeleteSavedRoutine(uid, routineId);
      return;
    } catch (error) {
      console.error('Error deleting routine:', error);
      throw error;
    }
  }
  try {
    const routines = await getSavedRoutines();
    const updated = routines.filter((r) => r.id !== routineId);
    await AsyncStorage.setItem(KEYS.SAVED_ROUTINES, JSON.stringify(updated));
  } catch (error) {
    console.error('Error deleting routine:', error);
    throw error;
  }
};

// Saved Foods Storage Functions
export const getSavedFoods = async (): Promise<SavedFood[]> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && !uid) {
    return [];
  }
  if (uid && isSupabaseConfigured()) {
    return supabaseStorage.supabaseGetSavedFoods(uid);
  }
  try {
    const data = await AsyncStorage.getItem(KEYS.SAVED_FOODS);
    const foods: SavedFood[] = data ? JSON.parse(data) : [];
    return foods.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
  } catch (error) {
    console.error('Error getting saved foods:', error);
    return [];
  }
};

export const saveSavedFood = async (food: Omit<SavedFood, 'id' | 'lastUsed' | 'useCount'>): Promise<void> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && !uid) {
    return;
  }
  if (uid && isSupabaseConfigured()) {
    try {
      await supabaseStorage.supabaseSaveSavedFood(uid, food);
      return;
    } catch (error) {
      console.error('Error saving food:', error);
    }
    return;
  }
  try {
    const foods = await getSavedFoods();
    const normalised = food.name.trim().toLowerCase();
    const existing = foods.find((f) => f.name.trim().toLowerCase() === normalised);
    if (existing) {
      existing.lastUsed = new Date().toISOString();
      existing.useCount += 1;
      existing.calories = food.calories;
      existing.protein = food.protein;
      existing.carbs = food.carbs;
      existing.fat = food.fat;
      if (food.brand) existing.brand = food.brand;
    } else {
      foods.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: food.name, brand: food.brand, calories: food.calories,
        protein: food.protein, carbs: food.carbs, fat: food.fat,
        lastUsed: new Date().toISOString(), useCount: 1,
      });
    }
    await AsyncStorage.setItem(KEYS.SAVED_FOODS, JSON.stringify(foods));
  } catch (error) {
    console.error('Error saving food:', error);
  }
};

// Prompt Storage Functions
export const savePrompts = async (prompts: Prompt[]): Promise<void> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && !uid) {
    return;
  }
  if (uid && isSupabaseConfigured()) {
    try {
      await supabaseStorage.supabaseSavePrompts(uid, prompts);
      return;
    } catch (error) {
      console.error('Error saving prompts:', error);
      throw error;
    }
  }
  try {
    await AsyncStorage.setItem(KEYS.PROMPTS, JSON.stringify(prompts));
  } catch (error) {
    console.error('Error saving prompts:', error);
    throw error;
  }
};

export const getPrompts = async (): Promise<Prompt[]> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && !uid) {
    return [];
  }
  if (uid && isSupabaseConfigured()) {
    return supabaseStorage.supabaseGetPrompts(uid);
  }
  try {
    const data = await AsyncStorage.getItem(KEYS.PROMPTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting prompts:', error);
    return [];
  }
};

// Settings Storage Functions
export const saveUserSettings = async (settings: UserSettings): Promise<void> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && !uid) {
    return;
  }
  if (uid && isSupabaseConfigured()) {
    try {
      await supabaseStorage.supabaseSaveUserSettings(uid, settings);
      return;
    } catch (error) {
      console.error('Error saving user settings:', error);
      throw error;
    }
  }
  try {
    await AsyncStorage.setItem(KEYS.USER_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving user settings:', error);
    throw error;
  }
};

export const getUserSettings = async (): Promise<UserSettings> => {
  const uid = getStorageUserId();
  if (isSupabaseConfigured() && !uid) {
    return DEFAULT_SETTINGS;
  }
  if (uid && isSupabaseConfigured()) {
    return supabaseStorage.supabaseGetUserSettings(uid);
  }
  try {
    const data = await AsyncStorage.getItem(KEYS.USER_SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error getting user settings:', error);
    return DEFAULT_SETTINGS;
  }
};

// --- Exercise progression state (Supabase only) ---

export type ExerciseProgressStateRow = {
  exerciseId: string;
  currentBand: string;
  consecutiveSuccess: number;
  consecutiveFailure: number;
  updatedAt?: string;
};

/** Fetch progression state for exercises. Returns map keyed by exerciseId. Defaults when missing. */
export async function getExerciseProgressState(
  userId: string,
  exerciseIds: string[]
): Promise<Record<string, ExerciseProgressStateRow>> {
  const uid = getStorageUserId();
  if (!uid || !isSupabaseConfigured() || userId !== uid || exerciseIds.length === 0) {
    return {};
  }
  const prescriptions = await supabaseStorage.supabaseGetExercisePrescriptions(uid, exerciseIds);
  const result: Record<string, ExerciseProgressStateRow> = {};
  for (const id of exerciseIds) {
    const rx = prescriptions[id];
    result[id] = {
      exerciseId: id,
      currentBand: rx?.difficultyBand ?? 'easy',
      consecutiveSuccess: rx?.consecutiveSuccess ?? 0,
      consecutiveFailure: rx?.consecutiveFailure ?? 0,
    };
  }
  return result;
}

/** Upsert progression state rows. Used after workout save; storage layer delegates to Supabase. */
export async function upsertExerciseProgressState(
  userId: string,
  rows: Array<{ exerciseId: string; currentBand: string; consecutiveSuccess: number; consecutiveFailure: number; nextWeight?: number; goal?: string; reason?: string }>
): Promise<void> {
  const uid = getStorageUserId();
  if (!uid || !isSupabaseConfigured() || userId !== uid) return;
  await supabaseStorage.supabaseUpsertExerciseProgressState(uid, rows);
}

/** Progress Hub widget order. Uses UserSettings.progressHubOrder. */
export const getProgressHubOrder = async (): Promise<string[]> => {
  const settings = await getUserSettings();
  const order = settings.progressHubOrder;
  if (Array.isArray(order) && order.length > 0) return order;
  return [...DEFAULT_PROGRESS_HUB_ORDER];
};

/** Save Progress Hub widget order to user account. */
export const saveProgressHubOrder = async (order: string[]): Promise<void> => {
  const settings = await getUserSettings();
  await saveUserSettings({ ...settings, progressHubOrder: order });
};

let _promptsMigrationAttempted = false;

/** One-time migration: copy local prompts to Supabase. Does not delete local data. */
export const migrateLocalPromptsToSupabase = async (): Promise<number> => {
  if (_promptsMigrationAttempted) return 0;
  _promptsMigrationAttempted = true;
  const uid = getStorageUserId();
  if (!uid || !isSupabaseConfigured()) return 0;
  try {
    const data = await AsyncStorage.getItem(KEYS.PROMPTS);
    const local = data ? JSON.parse(data) : [];
    if (!Array.isArray(local) || local.length === 0) return 0;
    await supabaseStorage.supabaseSavePrompts(uid, local);
    if (__DEV__) console.log('[migrateLocalPromptsToSupabase] migrated:', local.length);
    return local.length;
  } catch (e) {
    if (__DEV__) console.warn('[migrateLocalPromptsToSupabase] failed:', e);
    return 0;
  }
};

// Clear all data (for testing/reset)
export const clearAllData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};
