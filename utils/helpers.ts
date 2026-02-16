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
