// TMLSN App Type Definitions

// Nutrition Tracker Types
export interface NutritionLog {
  id: string;
  date: string; // ISO date string
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number; // in oz or ml
  meals: Meal[];
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Meal {
  id: string;
  name: string;
  mealType?: MealType; // optional for backwards compatibility with existing logs
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUri?: string; // Optional photo
}

export interface DailyGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}

// Workout Tracker Types
export interface WorkoutSession {
  id: string;
  date: string;
  name: string;
  exercises: Exercise[];
  duration: number; // in minutes
  isComplete: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  sets: Set[];
  restTimer?: number; // in seconds
  notes?: string;
}

export interface Set {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface WorkoutSplit {
  id: string;
  name: string;
  exercises: WorkoutExerciseTemplate[];
}

export interface WorkoutExerciseTemplate {
  name: string;
  targetSets: number;
  targetReps: number;
  suggestedWeight?: number;
  restTimer: number; // recommended rest in seconds
}

// Prompt Vault Types
export interface Prompt {
  id: string;
  title: string;
  summary: string;
  fullText: string;
  source: string; // e.g., "Newsletter 007"
  sourceUrl: string;
  dateAdded: string;
  category?: string;
}

// User Settings
export interface UserSettings {
  dailyGoals: DailyGoals;
  weightUnit: 'lb' | 'kg';
  volumeUnit: 'oz' | 'ml';
  notificationsEnabled: boolean;
  restTimerSound: boolean;
}

// Notification Types
export interface ContentNotification {
  id: string;
  type: 'newsletter' | 'youtube';
  title: string;
  message: string;
  url: string;
  date: string;
}
