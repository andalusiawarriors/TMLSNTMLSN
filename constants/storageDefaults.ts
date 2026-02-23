import { DailyGoals, UserSettings } from '../types';

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
  defaultRestTimer: 120,
  defaultRestTimerEnabled: true,
};
