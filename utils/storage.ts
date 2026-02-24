import AsyncStorage from '@react-native-async-storage/async-storage';
import { NutritionLog, WorkoutSession, Prompt, UserSettings, DailyGoals, SavedRoutine, SavedFood } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import * as supabaseStorage from './supabaseStorage';
import { DEFAULT_GOALS, DEFAULT_SETTINGS } from '../constants/storageDefaults';

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

export { DEFAULT_GOALS, DEFAULT_SETTINGS };

// Nutrition Storage Functions
// TEMP: Nutrition uses AsyncStorage only while Supabase nutrition schema is being finalized.
export const saveNutritionLog = async (log: NutritionLog): Promise<void> => {
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

// Workout Storage Functions
export const saveWorkoutSession = async (session: WorkoutSession): Promise<void> => {
  const uid = getStorageUserId();
  if (uid && isSupabaseConfigured()) {
    try {
      await supabaseStorage.supabaseSaveWorkoutSession(uid, session);
      return;
    } catch (error) {
      console.error('Error saving workout session:', error);
      throw error;
    }
  }
  try {
    const existingSessions = await getWorkoutSessions();
    const updatedSessions = [...existingSessions, session];
    await AsyncStorage.setItem(KEYS.WORKOUT_SESSIONS, JSON.stringify(updatedSessions));
  } catch (error) {
    console.error('Error saving workout session:', error);
    throw error;
  }
};

export const getWorkoutSessions = async (): Promise<WorkoutSession[]> => {
  const uid = getStorageUserId();
  if (uid && isSupabaseConfigured()) {
    return supabaseStorage.supabaseGetWorkoutSessions(uid);
  }
  try {
    const data = await AsyncStorage.getItem(KEYS.WORKOUT_SESSIONS);
    return data ? JSON.parse(data) : [];
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

// Saved Routines (templates for My Routines)
export const getSavedRoutines = async (): Promise<SavedRoutine[]> => {
  const uid = getStorageUserId();
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

// Saved Foods Storage Functions
export const getSavedFoods = async (): Promise<SavedFood[]> => {
  const uid = getStorageUserId();
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

// Clear all data (for testing/reset)
export const clearAllData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};
