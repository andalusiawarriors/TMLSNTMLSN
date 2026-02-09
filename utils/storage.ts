import AsyncStorage from '@react-native-async-storage/async-storage';
import { NutritionLog, WorkoutSession, Prompt, UserSettings, DailyGoals } from '../types';

// Storage Keys
const KEYS = {
  NUTRITION_LOGS: '@tmlsn/nutrition_logs',
  WORKOUT_SESSIONS: '@tmlsn/workout_sessions',
  PROMPTS: '@tmlsn/prompts',
  USER_SETTINGS: '@tmlsn/user_settings',
  WORKOUT_SPLITS: '@tmlsn/workout_splits',
};

// Default Values
export const DEFAULT_GOALS: DailyGoals = {
  calories: 2500,
  protein: 150,
  carbs: 250,
  fat: 80,
  water: 128, // oz
};

export const DEFAULT_SETTINGS: UserSettings = {
  dailyGoals: DEFAULT_GOALS,
  weightUnit: 'lb',
  volumeUnit: 'oz',
  notificationsEnabled: true,
  restTimerSound: true,
};

// Nutrition Storage Functions
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

export const getNutritionLogs = async (): Promise<NutritionLog[]> => {
  try {
    const data = await AsyncStorage.getItem(KEYS.NUTRITION_LOGS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting nutrition logs:', error);
    return [];
  }
};

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

// Workout Storage Functions
export const saveWorkoutSession = async (session: WorkoutSession): Promise<void> => {
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

// Prompt Storage Functions
export const savePrompts = async (prompts: Prompt[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.PROMPTS, JSON.stringify(prompts));
  } catch (error) {
    console.error('Error saving prompts:', error);
    throw error;
  }
};

export const getPrompts = async (): Promise<Prompt[]> => {
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
  try {
    await AsyncStorage.setItem(KEYS.USER_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving user settings:', error);
    throw error;
  }
};

export const getUserSettings = async (): Promise<UserSettings> => {
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
