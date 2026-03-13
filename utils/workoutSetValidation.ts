/**
 * Shared validation for workout set inputs.
 * Enforced at commit points (blur, done, check, save) — not while typing.
 */
import type { WorkoutSession } from '../types';
import { roundToGymWeight } from './units';

// ─── Validation rules ─────────────────────────────────────────────────────────

/** Weight must be > 0. Decimals allowed (1.25, 2.5, etc.). */
export function isValidWeight(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Reps must be integer >= 1. No decimals. */
export function isValidReps(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/** RPE must be integer 1–10 inclusive. */
export function isValidRpe(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 10;
}

export type IsValidCompletedSetOptions = {
  /** When true, RPE must be valid if present. When false, RPE is optional. */
  rpeRequired?: boolean;
};

/**
 * A set is valid/committable as complete if:
 * - weight is numeric and > 0
 * - reps is integer >= 1
 * - if rpeRequired and RPE is set, RPE must be 1–10 integer
 */
export function isValidCompletedSet(
  set: { weight: number; reps: number; rpe?: number | null; completed?: boolean },
  opts: IsValidCompletedSetOptions = {}
): boolean {
  if (!isValidWeight(set.weight)) return false;
  if (!isValidReps(set.reps)) return false;
  if (opts.rpeRequired && set.rpe != null && !isValidRpe(set.rpe)) return false;
  return true;
}

// ─── Parse + validate for commit ──────────────────────────────────────────────

/**
 * Parse weight from raw input. Returns valid weight > 0 or null.
 * Locale-tolerant: accepts both comma and dot as decimal separator.
 * 62,25 → 62.25, 62.25 → 62.25. Rejects malformed (62,2,5, 62..25, abc).
 */
export function parseAndValidateWeight(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/[\d]/.test(trimmed)) return null;
  const invalidChars = trimmed.replace(/[\d.,]/g, '');
  if (invalidChars.length > 0) return null;
  const separators = (trimmed.match(/[,.]/g) || []);
  if (separators.length > 1) return null;
  const normalized = trimmed.replace(',', '.');
  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

/**
 * Parse reps from raw input. Returns valid integer >= 1 or null.
 * Rejects decimals (5.5, 5,5), 0, negative, empty.
 */
export function parseAndValidateReps(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed.includes('.') || trimmed.includes(',')) return null;
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1) return null;
  return n;
}

/**
 * Parse RPE from raw input. Returns valid integer 1–10 or null.
 * Rejects decimals (5.5, 5,5), 0, >10, negative.
 */
export function parseAndValidateRpe(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed.includes('.') || trimmed.includes(',')) return null;
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 10) return null;
  return n;
}

/** Clamp/round RPE value to valid integer 1–10. Use when value comes from slider (may be 5.5). */
export function sanitizeRpe(value: number): number {
  const n = Math.round(value);
  return Math.min(10, Math.max(1, n));
}

// ─── Weight normalization (gym increments) ──────────────────────────────────────

/**
 * Normalize weight to gym increment. Avoids float artifacts (8.749999999).
 * Uses shared roundToGymWeight from units (0.25 step).
 * For algorithm output, use this so recommendations match user-entered increment system.
 */
export function normalizeWeightForStorage(value: number): number {
  const r = roundToGymWeight(value);
  return Math.round(r * 100) / 100;
}

// ─── Session-level validation ─────────────────────────────────────────────────

/**
 * Sanitize a workout session before save:
 * - drop any uncommitted set rows entirely
 * - drop invalid completed rows entirely
 * This keeps preview/ghost values in active UI state only and out of persisted history.
 */
export function sanitizeWorkoutSessionForSave(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    exercises: (session.exercises ?? []).map((ex) => ({
      ...ex,
      sets: (ex.sets ?? []).filter((s) => {
        if (!s.completed) return false;
        const valid = isValidCompletedSet({
          weight: s.weight ?? 0,
          reps: s.reps ?? 0,
          rpe: s.rpe ?? undefined,
        });
        return valid;
      }),
    })),
  };
}

/**
 * Find invalid completed sets in a session. Returns list of { exerciseName, setIndex }.
 */
export function getInvalidCompletedSets(session: WorkoutSession): { exerciseName: string; setIndex: number }[] {
  const invalid: { exerciseName: string; setIndex: number }[] = [];
  for (const ex of session.exercises ?? []) {
    for (let i = 0; i < (ex.sets ?? []).length; i++) {
      const s = ex.sets![i];
      if (s.completed && !isValidCompletedSet({ weight: s.weight ?? 0, reps: s.reps ?? 0, rpe: s.rpe ?? undefined })) {
        invalid.push({ exerciseName: ex.name ?? 'Exercise', setIndex: i + 1 });
      }
    }
  }
  return invalid;
}
