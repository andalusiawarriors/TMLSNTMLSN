import { format, isToday } from 'date-fns';

// Date Formatting
export const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isToday(dateObj)) {
    return 'Today';
  }
  return format(dateObj, 'MMM dd, yyyy');
};

export const formatTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'h:mm a');
};

export const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

/** YYYY-MM-DD from a Date (local date, noon UTC to avoid timezone shift) */
export const toDateString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Number Formatting
export const formatNumber = (num: number, decimals: number = 0): string => {
  return num.toFixed(decimals);
};

export const calculateMacroPercentage = (current: number, goal: number): number => {
  if (goal === 0) return 0;
  return Math.round((current / goal) * 100);
};

// Workout Helpers
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const calculateTotalVolume = (weight: number, reps: number): number => {
  return weight * reps;
};

// Generate unique IDs
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Validation
export const isValidNumber = (value: string): boolean => {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0;
};

export const sanitizeNumberInput = (value: string): string => {
  // Remove any non-numeric characters except decimal point
  return value.replace(/[^0-9.]/g, '');
};

// Routine template → workout mapping
const DEFAULT_TARGET_SETS = 3;
const DEFAULT_TARGET_REPS = 8;
const DEFAULT_REST_TIMER = 120;

/**
 * Build pre-filled set rows from routine template values.
 * Uses robust number coercion; invalid values fall back to defaults.
 */
export function buildTemplateSets(
  targetSets: number | undefined | null,
  targetReps: number | undefined | null,
  suggestedWeight: number | undefined | null
): { id: string; weight: number; reps: number; completed: boolean }[] {
  const sets = Math.max(1, Math.min(99, Math.floor(Number(targetSets)) || DEFAULT_TARGET_SETS));
  const reps = Math.max(1, Math.min(999, Math.floor(Number(targetReps)) || DEFAULT_TARGET_REPS));
  const weight = (() => {
    const v = Number(suggestedWeight);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  })();
  return Array.from({ length: sets }, () => ({
    id: generateId(),
    weight,
    reps,
    completed: false,
  }));
}

/**
 * Build an Exercise from a SavedRoutine template item.
 * Uses generateId() for exercise and set IDs (no reuse of routine ids).
 * @param routineExercise - template from SavedRoutine.exercises (supports old shape without targetSets/targetReps)
 * @param defaultRestTimer - fallback when restTimer is missing/invalid (e.g. from getUserSettings)
 */
export function buildExerciseFromRoutineTemplate(
  routineExercise: {
    id?: string;
    name?: string;
    restTimer?: number;
    exerciseDbId?: string;
    targetSets?: number;
    targetReps?: number;
    suggestedWeight?: number;
  },
  defaultRestTimer: number = DEFAULT_REST_TIMER
): {
  id: string;
  name: string;
  sets: { id: string; weight: number; reps: number; completed: boolean }[];
  restTimer: number;
  exerciseDbId?: string;
} {
  const restTimer = (() => {
    const v = Number(routineExercise.restTimer);
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : defaultRestTimer;
  })();
  const sets = buildTemplateSets(
    routineExercise.targetSets,
    routineExercise.targetReps,
    routineExercise.suggestedWeight
  );
  return {
    id: generateId(),
    name: String(routineExercise.name ?? ''),
    sets,
    restTimer,
    exerciseDbId: routineExercise.exerciseDbId,
  };
}
