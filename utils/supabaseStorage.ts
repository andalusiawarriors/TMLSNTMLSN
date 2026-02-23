import { supabase } from '../lib/supabase';
import {
  NutritionLog,
  WorkoutSession,
  Prompt,
  UserSettings,
  SavedRoutine,
  SavedFood,
} from '../types';
import { DEFAULT_SETTINGS } from '../constants/storageDefaults';

export async function supabaseGetNutritionLogs(userId: string): Promise<NutritionLog[]> {
  const { data, error } = await supabase!
    .from('nutrition_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) {
    console.error('Supabase get nutrition logs:', error);
    return [];
  }
  return (data ?? []).map((r) => r.data as NutritionLog);
}

export async function supabaseSaveNutritionLog(userId: string, log: NutritionLog): Promise<void> {
  const { error } = await supabase!.from('nutrition_logs').upsert(
    { user_id: userId, date: log.date, data: log },
    { onConflict: 'user_id,date' }
  );
  if (error) throw error;
}

export async function supabaseGetWorkoutSessions(userId: string): Promise<WorkoutSession[]> {
  const { data, error } = await supabase!
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) {
    console.error('Supabase get workout sessions:', error);
    return [];
  }
  return (data ?? []).map((r) => r.data as WorkoutSession);
}

export async function supabaseSaveWorkoutSession(
  userId: string,
  session: WorkoutSession
): Promise<void> {
  const { error } = await supabase!.from('workout_sessions').insert({
    user_id: userId,
    id: session.id,
    date: session.date,
    data: session,
  });
  if (error) throw error;
}

export async function supabaseGetPrompts(userId: string): Promise<Prompt[]> {
  const { data, error } = await supabase!
    .from('prompts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Supabase get prompts:', error);
    return [];
  }
  return data?.data ?? [];
}

export async function supabaseSavePrompts(userId: string, prompts: Prompt[]): Promise<void> {
  const { error } = await supabase!
    .from('prompts')
    .upsert({ user_id: userId, data: prompts }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function supabaseGetUserSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase!
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Supabase get user settings:', error);
    return DEFAULT_SETTINGS;
  }
  return data?.data ?? DEFAULT_SETTINGS;
}

export async function supabaseSaveUserSettings(
  userId: string,
  settings: UserSettings
): Promise<void> {
  const { error } = await supabase!
    .from('user_settings')
    .upsert({ user_id: userId, data: settings }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function supabaseGetSavedRoutines(userId: string): Promise<SavedRoutine[]> {
  const { data, error } = await supabase!
    .from('saved_routines')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Supabase get saved routines:', error);
    return [];
  }
  return data?.data ?? [];
}

export async function supabaseSaveSavedRoutine(
  userId: string,
  routine: SavedRoutine
): Promise<void> {
  const routines = await supabaseGetSavedRoutines(userId);
  const updated = routines.filter((r) => r.id !== routine.id);
  updated.push(routine);
  const { error } = await supabase!
    .from('saved_routines')
    .upsert({ user_id: userId, data: updated }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function supabaseGetSavedFoods(userId: string): Promise<SavedFood[]> {
  const { data, error } = await supabase!
    .from('saved_foods')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Supabase get saved foods:', error);
    return [];
  }
  const foods: SavedFood[] = data?.data ?? [];
  return foods.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
}

export async function supabaseSaveSavedFood(
  userId: string,
  food: Omit<SavedFood, 'id' | 'lastUsed' | 'useCount'>
): Promise<void> {
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
    if (food.brand) existing.brand = food.brand;
  } else {
    foods.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: food.name,
      brand: food.brand,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      lastUsed: new Date().toISOString(),
      useCount: 1,
    });
  }
  const { error } = await supabase!
    .from('saved_foods')
    .upsert({ user_id: userId, data: foods }, { onConflict: 'user_id' });
  if (error) throw error;
}
