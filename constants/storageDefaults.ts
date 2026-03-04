import { DailyGoals, TrainingSettings, UserSettings } from '../types';

export const DEFAULT_GOALS: DailyGoals = {
  calories: 2500,
  protein: 150,
  carbs: 250,
  fat: 80,
  water: 128, // oz
};

export const DEFAULT_PROGRESS_HUB_ORDER = [
  'progress', 'strength', 'history', 'activity', 'active-days', 'workouts',
] as const;

export const DEFAULT_TRAINING_SETTINGS: TrainingSettings = {
  volumeFramework: 'rp',
  scheduleMode: 'tmlsn',
  weekReset: 'monday',
  allowMidWeekEdits: true,
  scheduleNotifications: true,
  scheduleReminderEnabled: true,
  useRpeForOverload: true,
  rpMuscleTargets: {
    chest:      { mev: 8,  mav: 16, mrv: 22 },
    back:       { mev: 10, mav: 18, mrv: 25 },
    quads:      { mev: 8,  mav: 16, mrv: 20 },
    hamstrings: { mev: 6,  mav: 12, mrv: 16 },
    shoulders:  { mev: 8,  mav: 16, mrv: 20 },
    biceps:     { mev: 6,  mav: 14, mrv: 20 },
    triceps:    { mev: 6,  mav: 14, mrv: 18 },
    calves:     { mev: 8,  mav: 16, mrv: 20 },
    glutes:     { mev: 4,  mav: 12, mrv: 16 },
    core:       { mev: 6,  mav: 16, mrv: 20 },
  },
  rangeMuscleTargets: {
    chest:      { min: 8,  max: 22 },
    back:       { min: 10, max: 25 },
    quads:      { min: 8,  max: 20 },
    hamstrings: { min: 6,  max: 16 },
    shoulders:  { min: 8,  max: 20 },
    biceps:     { min: 6,  max: 20 },
    triceps:    { min: 6,  max: 18 },
    calves:     { min: 8,  max: 20 },
    glutes:     { min: 4,  max: 16 },
    core:       { min: 6,  max: 20 },
  },
};

export const DEFAULT_SETTINGS: UserSettings = {
  dailyGoals: DEFAULT_GOALS,
  weightUnit: 'lb',
  volumeUnit: 'oz',
  notificationsEnabled: true,
  restTimerSound: true,
  defaultRestTimer: 120,
  defaultRestTimerEnabled: true,
  bodyMapGender: 'male',
  progressHubOrder: [...DEFAULT_PROGRESS_HUB_ORDER],
  training: DEFAULT_TRAINING_SETTINGS,
};
