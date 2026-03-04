/**
 * Supabase storage layer using normalized schema.
 *
 * Expected schema:
 * - user_settings: user_id PK; daily_goals, weight_unit, volume_unit, notifications_enabled, rest_timer_sound, default_rest_timer, default_rest_timer_enabled
 * - nutrition_logs: user_id + date PK; id, calories, protein, carbs, fat, water
 * - nutrition_meals: user_id, log_date, meal_id; name, meal_type, time, calories, protein, carbs, fat, image_uri
 * - saved_foods: user_id + id PK; name, brand, calories, protein, carbs, fat, last_used, use_count
 * - workout_sessions: user_id + id PK; workout_time, name, duration, is_complete, ...
 * - workout_exercises: id, session_id, user_id, name, rest_timer, notes, exercise_db_id
 * - workout_sets: id, session_id, exercise_id, user_id, set_number (or set_order), weight, reps, completed
 * - saved_routines: user_id + id PK; name, exercises_json, created_at, updated_at
 * - prompts: user_id + id PK; title, summary, full_text, source, source_url, date_added, category
 */

import { v5 as uuidv5 } from 'uuid';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import {
  NutritionLog,
  WorkoutSession,
  Exercise,
  Set,
  Prompt,
  UserSettings,
  TrainingSettings,
  SavedRoutine,
  SavedFood,
  Meal,
  MealType,
} from '../types';
import { DEFAULT_SETTINGS } from '../constants/storageDefaults';
import { resolveExerciseDbIdFromName } from './workoutMuscles';

// workout_sets column for set ordering (DB may use set_number, set_order, order, etc.)
const SET_ORDER_COLUMN = 'set_number';

// --- Progressive overload (RPE-based prescription) ---

type PrescriptionMeta = {
  repRangeLow: number;
  repRangeHigh: number;
  smallestIncrement: number;
  defaultTargetRpe: number;
};

type PrescriptionSet = { weight: number; reps: number; rpe: number | null; completed: boolean };

type PrescriptionResult = { nextWeight: number; goal: 'add_load' | 'add_reps' | 'reduce_load' };

function computeNextPrescription(meta: PrescriptionMeta, sets: PrescriptionSet[]): PrescriptionResult | null {
  const workSets = sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
  if (workSets.length === 0) return null;

  const lastSet = workSets[workSets.length - 1];
  const workingWeight = lastSet.weight;
  const { repRangeLow, repRangeHigh, smallestIncrement, defaultTargetRpe } = meta;

  const allHitRepRangeHigh = workSets.every((s) => s.reps >= repRangeHigh);
  const lastRpe = lastSet.rpe ?? 0;
  const anyRepsLow = workSets.some((s) => s.reps <= repRangeLow - 2);

  if (allHitRepRangeHigh && lastRpe <= defaultTargetRpe + 0.5) {
    return { nextWeight: workingWeight + smallestIncrement, goal: 'add_load' };
  }
  if (lastRpe >= 10 && anyRepsLow) {
    return { nextWeight: workingWeight * 0.95, goal: 'reduce_load' };
  }
  return { nextWeight: workingWeight, goal: 'add_reps' };
}

async function saveExercisePrescription(params: {
  userId: string;
  exerciseId: string;
  nextWeight: number;
  goal: 'add_load' | 'add_reps' | 'reduce_load';
}): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('exercise_progress_state').upsert(
    {
      user_id: params.userId,
      exercise_id: params.exerciseId,
      variant_key: 'default',
      next_target_weight: params.nextWeight,
      next_goal_type: params.goal,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,exercise_id,variant_key' }
  );
  if (error) {
    console.error('Supabase save exercise prescription:', error);
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXERCISE_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function toExerciseProgressId(exerciseId: string): string {
  if (UUID_REGEX.test(exerciseId)) return exerciseId;
  return uuidv5(exerciseId, EXERCISE_NAMESPACE);
}

/** Generate a UUID v4 for Supabase columns that expect UUID type. */
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- User Settings ---

export async function supabaseGetUserSettings(userId: string): Promise<UserSettings> {
  if (!supabase) {
    console.error('Supabase client not configured');
    return DEFAULT_SETTINGS;
  }
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Supabase get user settings:', error);
    return DEFAULT_SETTINGS;
  }
  if (!data) return DEFAULT_SETTINGS;
  return mapRowToUserSettings(data);
}

export async function supabaseSaveUserSettings(
  userId: string,
  settings: UserSettings
): Promise<void> {
  if (!supabase) {
    console.error('Supabase client not configured');
    throw new Error('Supabase client not configured');
  }
  const row = mapUserSettingsToRow(userId, settings);
  const { error } = await supabase
    .from('user_settings')
    .upsert(row, { onConflict: 'user_id' });
  if (error) {
    // PGRST204 means a column we're writing doesn't exist in the DB schema yet.
    // Retry with only the core columns so the save doesn't crash while migrations
    // are pending. Run the migration SQL to restore full persistence.
    if ((error as { code?: string }).code === 'PGRST204') {
      console.warn('Supabase save user settings: schema mismatch — retrying with core columns only. Run pending migrations to fix.', error.message);
      const { progress_hub_order: _pho, ...coreRow } = row as Record<string, unknown>;
      const { error: retryError } = await supabase
        .from('user_settings')
        .upsert(coreRow, { onConflict: 'user_id' });
      if (retryError) {
        console.error('Supabase save user settings (retry):', retryError);
        throw retryError;
      }
      return;
    }
    console.error('Supabase save user settings:', error);
    throw error;
  }
}

function mapRowToUserSettings(row: Record<string, unknown>): UserSettings {
  if (row.data != null && typeof row.data === 'object') {
    const s = row.data as Partial<UserSettings>;
    return {
      dailyGoals: s.dailyGoals ?? DEFAULT_SETTINGS.dailyGoals,
      weightUnit: s.weightUnit ?? 'lb',
      volumeUnit: s.volumeUnit ?? 'oz',
      notificationsEnabled: s.notificationsEnabled ?? true,
      restTimerSound: s.restTimerSound ?? true,
      defaultRestTimer: s.defaultRestTimer,
      defaultRestTimerEnabled: s.defaultRestTimerEnabled,
      progressHubOrder: Array.isArray(s.progressHubOrder) ? s.progressHubOrder : undefined,
    };
  }
  const pho = row.progress_hub_order as string[] | undefined;
  const progressHubOrder = Array.isArray(pho) ? pho : undefined;
  const dg = row.daily_goals as Record<string, number> | undefined;
  const training = row.training_settings != null
    ? (row.training_settings as TrainingSettings)
    : undefined;
  return {
    progressHubOrder,
    dailyGoals: {
      calories: dg?.calories ?? DEFAULT_SETTINGS.dailyGoals.calories,
      protein: dg?.protein ?? DEFAULT_SETTINGS.dailyGoals.protein,
      carbs: dg?.carbs ?? DEFAULT_SETTINGS.dailyGoals.carbs,
      fat: dg?.fat ?? DEFAULT_SETTINGS.dailyGoals.fat,
      water: dg?.water ?? DEFAULT_SETTINGS.dailyGoals.water,
    },
    weightUnit: (row.weight_unit as 'lb' | 'kg') ?? 'lb',
    volumeUnit: (row.volume_unit as 'oz' | 'ml') ?? 'oz',
    notificationsEnabled: row.notifications_enabled !== false,
    restTimerSound: row.rest_timer_sound !== false,
    defaultRestTimer: row.default_rest_timer != null ? Number(row.default_rest_timer) : undefined,
    defaultRestTimerEnabled:
      row.default_rest_timer_enabled != null ? Boolean(row.default_rest_timer_enabled) : undefined,
    training,
  };
}

function mapUserSettingsToRow(
  userId: string,
  s: UserSettings
): Record<string, unknown> {
  return {
    user_id: userId,
    daily_goals: s.dailyGoals,
    weight_unit: s.weightUnit,
    volume_unit: s.volumeUnit,
    notifications_enabled: s.notificationsEnabled,
    rest_timer_sound: s.restTimerSound,
    default_rest_timer: s.defaultRestTimer ?? null,
    default_rest_timer_enabled: s.defaultRestTimerEnabled ?? null,
    progress_hub_order: Array.isArray(s.progressHubOrder) ? s.progressHubOrder : null,
    training_settings: s.training ?? null,
  };
}


// --- Nutrition Logs ---

export async function supabaseGetNutritionLogs(userId: string): Promise<NutritionLog[]> {
  if (!supabase) {
    console.error('Supabase client not configured');
    return [];
  }
  const [logsData, mealsData] = await Promise.all([
    supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false }),
    supabase
      .from('nutrition_meals')
      .select('*')
      .eq('user_id', userId),
  ]);
  if (logsData.error) {
    console.error('Supabase get nutrition logs:', logsData.error);
    return [];
  }
  if (mealsData.error) {
    console.error('Supabase get nutrition meals:', mealsData.error);
  }
  const mealsByDate = groupMealsByDate(mealsData.data ?? []);
  return (logsData.data ?? []).map((r) => mapLogRowToNutritionLog(r, mealsByDate[r.date as string] ?? []));
}

export async function supabaseGetNutritionLogByDate(
  userId: string,
  dateString: string
): Promise<NutritionLog | null> {
  if (!supabase) {
    console.error('Supabase client not configured');
    return null;
  }
  const [logRes, mealsRes] = await Promise.all([
    supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateString)
      .maybeSingle(),
    supabase
      .from('nutrition_meals')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', dateString)
      .order('time', { ascending: true }),
  ]);
  if (logRes.error) {
    console.error('Supabase get nutrition log by date:', logRes.error);
    return null;
  }
  if (!logRes.data) return null;
  const meals = (mealsRes.data ?? []).map(mapMealRowToMeal);
  return mapLogRowToNutritionLog(logRes.data, meals);
}

export async function supabaseSaveNutritionLog(userId: string, log: NutritionLog): Promise<void> {
  if (!supabase) {
    console.error('Supabase client not configured');
    throw new Error('Supabase client not configured');
  }
  const logRow = {
    user_id: userId,
    date: log.date,
    id: log.id,
    calories: log.calories,
    protein: log.protein,
    carbs: log.carbs,
    fat: log.fat,
    water: log.water ?? 0,
  };
  const { error: upsertError } = await supabase
    .from('nutrition_logs')
    .upsert(logRow, { onConflict: 'user_id,date' });
  if (upsertError) {
    console.error('Supabase save nutrition log (upsert):', upsertError);
    throw upsertError;
  }

  const { error: deleteError } = await supabase
    .from('nutrition_meals')
    .delete()
    .eq('user_id', userId)
    .eq('log_date', log.date);
  if (deleteError) {
    console.error('Supabase save nutrition log (delete meals):', deleteError);
    throw deleteError;
  }

  if (log.meals && log.meals.length > 0) {
    const mealRows = log.meals.map((m) => mapMealToRow(userId, log.date, m));
    const { error: insertError } = await supabase.from('nutrition_meals').insert(mealRows);
    if (insertError) {
      console.error('Supabase save nutrition log (insert meals):', insertError);
      throw insertError;
    }
  }
}

function groupMealsByDate(rows: Record<string, unknown>[]): Record<string, Meal[]> {
  const byDate: Record<string, Meal[]> = {};
  for (const r of rows) {
    const d = (r.log_date as string) ?? '';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(mapMealRowToMeal(r));
  }
  for (const arr of Object.values(byDate)) {
    arr.sort((a, b) => a.time.localeCompare(b.time));
  }
  return byDate;
}

function mapLogRowToNutritionLog(row: Record<string, unknown>, meals: Meal[]): NutritionLog {
  return {
    id: String(row.id ?? row.date ?? ''),
    date: String(row.date ?? ''),
    calories: Number(row.calories ?? 0),
    protein: Number(row.protein ?? 0),
    carbs: Number(row.carbs ?? 0),
    fat: Number(row.fat ?? 0),
    water: Number(row.water ?? 0),
    meals,
  };
}

function mapMealRowToMeal(row: Record<string, unknown>): Meal {
  return {
    id: String(row.meal_id ?? row.id ?? ''),
    name: String(row.name ?? ''),
    mealType: (row.meal_type as MealType) ?? undefined,
    time: String(row.time ?? ''),
    calories: Number(row.calories ?? 0),
    protein: Number(row.protein ?? 0),
    carbs: Number(row.carbs ?? 0),
    fat: Number(row.fat ?? 0),
    imageUri: row.image_uri != null ? String(row.image_uri) : undefined,
  };
}

function mapMealToRow(userId: string, logDate: string, m: Meal): Record<string, unknown> {
  return {
    user_id: userId,
    log_date: logDate,
    meal_id: m.id,
    name: m.name ?? '',
    meal_type: m.mealType ?? null,
    time: m.time ?? '',
    calories: m.calories ?? 0,
    protein: m.protein ?? 0,
    carbs: m.carbs ?? 0,
    fat: m.fat ?? 0,
    image_uri: m.imageUri ?? null,
  };
}

// --- Saved Foods ---

export async function supabaseGetSavedFoods(userId: string): Promise<SavedFood[]> {
  if (!supabase) {
    console.error('Supabase client not configured');
    return [];
  }
  const { data, error } = await supabase
    .from('saved_foods')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    console.error('Supabase get saved foods:', error);
    return [];
  }
  const foods: SavedFood[] = (data ?? []).map(mapSavedFoodRowToSavedFood);
  return foods.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
}

export async function supabaseSaveSavedFood(
  userId: string,
  food: Omit<SavedFood, 'id' | 'lastUsed' | 'useCount'>
): Promise<void> {
  if (!supabase) {
    console.error('Supabase client not configured');
    throw new Error('Supabase client not configured');
  }
  const foods = await supabaseGetSavedFoods(userId);
  const normalised = food.name.trim().toLowerCase();
  const existing = foods.find((f) => f.name.trim().toLowerCase() === normalised);
  if (existing) {
    existing.lastUsed = new Date().toISOString();
    existing.useCount += 1;
    existing.calories = food.calories;
    existing.protein = food.protein;
    existing.carbs = food.carbs;
    existing.fat = food.fat;
    if (food.brand != null) existing.brand = food.brand;
    const { error } = await supabase
      .from('saved_foods')
      .update({
        last_used: existing.lastUsed,
        use_count: existing.useCount,
        calories: existing.calories,
        protein: existing.protein,
        carbs: existing.carbs,
        fat: existing.fat,
        brand: existing.brand ?? null,
      })
      .eq('user_id', userId)
      .eq('id', existing.id);
    if (error) {
      console.error('Supabase save saved food (update):', error);
      throw error;
    }
  } else {
    const newFood: SavedFood = {
      id: generateUuid(),
      name: food.name,
      brand: food.brand,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      lastUsed: new Date().toISOString(),
      useCount: 1,
    };
    const { error } = await supabase.from('saved_foods').insert(mapSavedFoodToRow(userId, newFood));
    if (error) {
      console.error('Supabase save saved food (insert):', error);
      throw error;
    }
  }
}

function mapSavedFoodRowToSavedFood(row: Record<string, unknown>): SavedFood {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    brand: row.brand != null ? String(row.brand) : undefined,
    calories: Number(row.calories ?? 0),
    protein: Number(row.protein ?? 0),
    carbs: Number(row.carbs ?? 0),
    fat: Number(row.fat ?? 0),
    lastUsed: String(row.last_used ?? new Date().toISOString()),
    useCount: Number(row.use_count ?? 0),
  };
}

function mapSavedFoodToRow(userId: string, f: SavedFood): Record<string, unknown> {
  return {
    user_id: userId,
    id: f.id,
    name: f.name,
    brand: f.brand ?? null,
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    last_used: f.lastUsed,
    use_count: f.useCount,
  };
}

// --- Workout Sessions (normalized: sessions + exercises + sets) ---

export async function supabaseGetWorkoutSessions(userId: string): Promise<WorkoutSession[]> {
  if (!supabase) {
    console.error('Supabase client not configured');
    return [];
  }
  const { data: sessionsData, error: sessionsError } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('workout_time', { ascending: false });
  if (sessionsError) {
    console.error('Supabase get workout sessions:', sessionsError);
    return [];
  }
  const sessionRows = sessionsData ?? [];
  if (sessionRows.length === 0) return [];

  const sessionIds = sessionRows.map((r) => r.id as string);

  const { data: exercisesData, error: exercisesError } = await supabase
    .from('workout_exercises')
    .select('*')
    .eq('user_id', userId)
    .in('session_id', sessionIds);
  if (exercisesError) {
    console.error('Supabase get workout exercises:', exercisesError);
    return [];
  }
  const exerciseRows = exercisesData ?? [];

  const { data: setsData, error: setsError } = await supabase
    .from('workout_sets')
    .select('*')
    .eq('user_id', userId)
    .in('session_id', sessionIds);
  if (setsError) {
    console.error('Supabase get workout sets:', setsError);
    return [];
  }
  const setRows = setsData ?? [];

  const exercisesBySession = groupBy(exerciseRows, 'session_id');
  const setsByExercise = groupBy(setRows, 'exercise_id');

  return sessionRows.map((r) =>
    assembleWorkoutSession(r, exercisesBySession[String(r.id)] ?? [], setsByExercise)
  );
}

export async function supabaseGetRecentWorkouts(
  userId: string,
  limit: number = 10
): Promise<WorkoutSession[]> {
  const sessions = await supabaseGetWorkoutSessions(userId);
  return sessions.slice(0, limit);
}

/**
 * Persist workout session, exercises, and sets; then run prescription compute and upsert
 * exercise_progress_state. Idempotent for the same sessionId: repeat calls (e.g. double-tap
 * Save) upsert session by id, delete exercises/sets for session_id then reinsert, so final
 * DB state is the same and no duplicate rows.
 */
export async function supabaseSaveWorkoutSession(
  userId: string,
  session: WorkoutSession
): Promise<void> {
  if (!supabase) {
    console.error('Supabase client not configured');
    throw new Error('Supabase client not configured');
  }

  const sessionRow = {
    user_id: userId,
    id: session.id,
    workout_time: session.date,
    name: session.name ?? '',
    duration: Number(session.duration ?? 0),
    is_complete: Boolean(session.isComplete ?? false),
  };
  const { error: upsertError } = await supabase
    .from('workout_sessions')
    .upsert(sessionRow, { onConflict: 'user_id,id' });
  if (upsertError) {
    console.error('Supabase save workout session (upsert):', JSON.stringify(upsertError, null, 2));
    throw upsertError;
  }

  const { error: deleteSetsError } = await supabase
    .from('workout_sets')
    .delete()
    .eq('user_id', userId)
    .eq('session_id', session.id);
  if (deleteSetsError) {
    console.error('Supabase save workout session (delete sets):', JSON.stringify(deleteSetsError, null, 2));
    throw deleteSetsError;
  }

  const { error: deleteExError } = await supabase
    .from('workout_exercises')
    .delete()
    .eq('user_id', userId)
    .eq('session_id', session.id);
  if (deleteExError) {
    console.error('Supabase save workout session (delete exercises):', JSON.stringify(deleteExError, null, 2));
    throw deleteExError;
  }

  if (session.exercises && session.exercises.length > 0) {
    const exerciseRows = session.exercises.map((ex) => ({
      user_id: userId,
      id: ex.id,
      session_id: session.id,
      name: ex.name ?? '',
      rest_timer: ex.restTimer ?? null,
      notes: ex.notes ?? null,
      exercise_db_id: ex.exerciseDbId ?? resolveExerciseDbIdFromName(ex.name) ?? null,
      rep_range_low: ex.repRangeLow ?? 8,
      rep_range_high: ex.repRangeHigh ?? 12,
      smallest_increment: ex.smallestIncrement ?? 2.5,
      default_target_rpe: ex.defaultTargetRpe ?? 8.5,
    }));
    const { error: insertExError } = await supabase.from('workout_exercises').insert(exerciseRows);
    if (insertExError) {
      console.error('Supabase save workout session (insert exercises):', JSON.stringify(insertExError, null, 2));
      throw insertExError;
    }

    const setRows: Record<string, unknown>[] = [];
    for (const ex of session.exercises) {
      if (!ex.sets?.length) continue;
      for (let i = 0; i < ex.sets.length; i++) {
        const s = ex.sets[i];
        setRows.push({
          user_id: userId,
          id: s.id,
          session_id: session.id,
          exercise_id: ex.id,
          [SET_ORDER_COLUMN]: i + 1,
          weight: Number(s.weight ?? 0),
          reps: Number(s.reps ?? 0),
          completed: Boolean(s.completed ?? false),
          notes: s.notes ?? null,
          rpe: s.rpe != null ? Number(s.rpe) : null,
        });
      }
    }
    if (setRows.length > 0) {
      type WorkoutSetInsert = Database['public']['Tables']['workout_sets']['Insert'];
      const { error: insertSetsError } = await supabase
        .from('workout_sets')
        .insert(setRows as WorkoutSetInsert[]);
      if (insertSetsError) {
        console.error('Supabase save workout session (insert sets):', JSON.stringify(insertSetsError, null, 2));
        throw insertSetsError;
      }

      for (const ex of session.exercises) {
        if (!ex.sets?.length) continue;
        const meta: PrescriptionMeta = {
          repRangeLow: ex.repRangeLow ?? 8,
          repRangeHigh: ex.repRangeHigh ?? 12,
          smallestIncrement: ex.smallestIncrement ?? 2.5,
          defaultTargetRpe: ex.defaultTargetRpe ?? 8.5,
        };
        const prescriptionSets: PrescriptionSet[] = ex.sets.map((s) => ({
          weight: Number(s.weight ?? 0),
          reps: Number(s.reps ?? 0),
          rpe: s.rpe ?? null,
          completed: Boolean(s.completed ?? false),
        }));
        const prescription = computeNextPrescription(meta, prescriptionSets);
        if (!prescription) continue;
        const canonicalId = ex.exerciseDbId ?? ex.name ?? ex.id;
        const exerciseId = toExerciseProgressId(canonicalId);
        await saveExercisePrescription({
          userId,
          exerciseId,
          nextWeight: prescription.nextWeight,
          goal: prescription.goal,
        });
      }
    }
  }
}

/**
 * Fetch the next-session prescription (target weight + goal) for a set of
 * canonical exercise IDs.  Returns a map keyed by the same canonical ID that
 * was passed in (exerciseDbId ?? exercise.name).
 */
export async function supabaseGetExercisePrescriptions(
  userId: string,
  canonicalIds: string[]
): Promise<Record<string, { nextWeight: number; goal: string }>> {
  if (!supabase || canonicalIds.length === 0) return {};
  const progressIds = canonicalIds.map((id) => toExerciseProgressId(id));
  const progressToCanonical: Record<string, string> = {};
  canonicalIds.forEach((id) => { progressToCanonical[toExerciseProgressId(id)] = id; });

  const { data, error } = await supabase
    .from('exercise_progress_state')
    .select('exercise_id, next_target_weight, next_goal_type')
    .eq('user_id', userId)
    .in('exercise_id', progressIds);

  if (error || !data) return {};

  const result: Record<string, { nextWeight: number; goal: string }> = {};
  for (const row of data) {
    if (row.next_target_weight == null) continue;
    const canonical = progressToCanonical[row.exercise_id] ?? row.exercise_id;
    result[canonical] = {
      nextWeight: row.next_target_weight,
      goal: row.next_goal_type ?? 'add_reps',
    };
  }
  return result;
}

export async function supabaseUpdateWorkoutSessionName(
  userId: string,
  sessionId: string,
  name: string
): Promise<void> {
  if (!supabase) {
    console.error('Supabase client not configured');
    throw new Error('Supabase client not configured');
  }
  const { error } = await supabase
    .from('workout_sessions')
    .update({ name: name.trim() || '' })
    .eq('user_id', userId)
    .eq('id', sessionId);
  if (error) {
    console.error('Supabase update workout session name:', error);
    throw error;
  }
}

export async function supabaseDeleteWorkoutSession(userId: string, sessionId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase client not configured');
  await supabase.from('workout_sets').delete().eq('user_id', userId).eq('session_id', sessionId);
  await supabase.from('workout_exercises').delete().eq('user_id', userId).eq('session_id', sessionId);
  const { error } = await supabase.from('workout_sessions').delete().eq('user_id', userId).eq('id', sessionId);
  if (error) throw error;
}

function groupBy<T extends Record<string, unknown>>(
  rows: T[],
  key: string
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const r of rows) {
    const k = String(r[key] ?? '');
    if (!out[k]) out[k] = [];
    out[k].push(r);
  }
  return out;
}

function getSetOrder(sr: Record<string, unknown>): number {
  return Number(
    sr[SET_ORDER_COLUMN] ?? sr.set_order ?? sr.order ?? sr.position ?? 0
  );
}

function assembleWorkoutSession(
  sessionRow: Record<string, unknown>,
  exerciseRows: Record<string, unknown>[],
  setsByExercise: Record<string, Record<string, unknown>[]>
): WorkoutSession {
  const exercises: Exercise[] = exerciseRows
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((er) => {
      const setRowsForEx = (setsByExercise[String(er.id)] ?? [])
        .sort((a, b) => getSetOrder(a) - getSetOrder(b));
      const sets: Set[] = setRowsForEx.map((sr) => ({
        id: String(sr.id ?? ''),
        weight: Number(sr.weight ?? 0),
        reps: Number(sr.reps ?? 0),
        completed: Boolean(sr.completed ?? false),
        notes: sr.notes != null ? String(sr.notes) : undefined,
        rpe: sr.rpe != null ? Number(sr.rpe) : null,
      }));
      return {
        id: String(er.id ?? ''),
        name: String(er.name ?? ''),
        sets,
        restTimer: er.rest_timer != null ? Number(er.rest_timer) : undefined,
        notes: er.notes != null ? String(er.notes) : undefined,
        exerciseDbId: er.exercise_db_id != null ? String(er.exercise_db_id) : undefined,
      };
    });
  return {
    id: String(sessionRow.id ?? ''),
    date: String(sessionRow.workout_time ?? sessionRow.date ?? ''),
    name: String(sessionRow.name ?? ''),
    exercises,
    duration: Number(sessionRow.duration ?? 0),
    isComplete: Boolean(sessionRow.is_complete ?? false),
  };
}

// --- Prompts (normalized: one row per prompt) ---

export async function supabaseGetPrompts(userId: string): Promise<Prompt[]> {
  if (!supabase) {
    console.error('Supabase client not configured');
    return [];
  }
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    console.error('Supabase get prompts:', JSON.stringify(error, null, 2));
    return [];
  }
  const rawRows = data ?? [];
  let prompts: Prompt[];
  const first = rawRows[0] as Record<string, unknown> | undefined;
  if (rawRows.length > 0 && first?.data != null && first?.full_text === undefined) {
    prompts = parsePromptsFromJsonb(rawRows);
  } else {
    prompts = rawRows.map(mapPromptRowToPrompt);
  }
  prompts.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  return prompts;
}

export async function supabaseSavePrompts(userId: string, prompts: Prompt[]): Promise<void> {
  if (!supabase) {
    console.error('Supabase client not configured');
    throw new Error('Supabase client not configured');
  }
  if (prompts.length === 0) return;
  const rows = prompts.map((p) => ({
    user_id: userId,
    id: p.id,
    title: p.title ?? '',
    summary: p.summary ?? '',
    full_text: p.fullText ?? '',
    source: p.source ?? '',
    source_url: p.sourceUrl ?? '',
    date_added: p.dateAdded ?? new Date().toISOString(),
    category: p.category ?? null,
  }));
  const { error } = await supabase.from('prompts').upsert(rows, { onConflict: 'user_id,id' });
  if (error) {
    console.error('Supabase save prompts:', JSON.stringify(error, null, 2));
    throw error;
  }
}

function parsePromptsFromJsonb(rows: Record<string, unknown>[]): Prompt[] {
  const out: Prompt[] = [];
  for (const row of rows) {
    const data = row.data;
    if (!Array.isArray(data)) continue;
    for (const elem of data) {
      const o = elem as Record<string, unknown>;
      out.push({
        id: String(o.id ?? ''),
        title: String(o.title ?? ''),
        summary: String(o.summary ?? ''),
        fullText: String(o.fullText ?? o.full_text ?? ''),
        source: String(o.source ?? ''),
        sourceUrl: String(o.sourceUrl ?? o.source_url ?? ''),
        dateAdded: String(o.dateAdded ?? o.date_added ?? ''),
        category: o.category != null ? String(o.category) : undefined,
      });
    }
  }
  return out;
}

function mapPromptRowToPrompt(row: Record<string, unknown>): Prompt {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    summary: String(row.summary ?? ''),
    fullText: String(row.full_text ?? ''),
    source: String(row.source ?? ''),
    sourceUrl: String(row.source_url ?? ''),
    dateAdded: String(row.date_added ?? ''),
    category: row.category != null ? String(row.category) : undefined,
  };
}

// --- Saved Routines (normalized: exercises_json) ---

export async function supabaseGetSavedRoutines(userId: string): Promise<SavedRoutine[]> {
  if (!supabase) {
    console.error('Supabase client not configured');
    return [];
  }
  const { data, error } = await supabase
    .from('saved_routines')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    console.error('Supabase get saved routines:', error);
    return [];
  }
  return (data ?? []).map(mapSavedRoutineRowToRoutine);
}

export async function supabaseSaveSavedRoutine(
  userId: string,
  routine: SavedRoutine
): Promise<void> {
  if (!supabase) {
    console.error('Supabase client not configured');
    throw new Error('Supabase client not configured');
  }
  const row = {
    user_id: userId,
    id: routine.id,
    name: routine.name ?? '',
    exercises_json: routine.exercises ?? [],
  };
  const { error } = await supabase
    .from('saved_routines')
    .upsert(row, { onConflict: 'user_id,id' });
  if (error) {
    console.error('Supabase save saved routine:', error);
    throw error;
  }
}

export async function supabaseDeleteSavedRoutine(
  userId: string,
  routineId: string
): Promise<void> {
  if (!supabase) {
    console.error('Supabase client not configured');
    throw new Error('Supabase client not configured');
  }
  const { error } = await supabase
    .from('saved_routines')
    .delete()
    .eq('user_id', userId)
    .eq('id', routineId);
  if (error) {
    console.error('Supabase delete saved routine:', error);
    throw error;
  }
}

function mapSavedRoutineRowToRoutine(row: Record<string, unknown>): SavedRoutine {
  const ex = row.exercises_json;
  const exercises = Array.isArray(ex)
    ? (
      ex as {
        id?: string;
        name?: string;
        restTimer?: number;
        exerciseDbId?: string;
        targetSets?: number;
        targetReps?: number;
        suggestedWeight?: number;
      }[]
    ).map((e) => ({
      id: String(e?.id ?? ''),
      name: String(e?.name ?? ''),
      restTimer: Number(e?.restTimer ?? 0),
      exerciseDbId: e?.exerciseDbId,
      targetSets: Number(e?.targetSets ?? 3),
      targetReps: Number(e?.targetReps ?? 8),
      suggestedWeight:
        e?.suggestedWeight != null && e.suggestedWeight >= 0 ? Number(e.suggestedWeight) : undefined,
    }))
    : [];
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    exercises,
  };
}
