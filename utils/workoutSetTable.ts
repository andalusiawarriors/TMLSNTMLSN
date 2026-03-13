/**
 * Shared logic for set table: build prevSets (last session per-set) and ghost weight/reps.
 * Ghost values come from the canonical progressive overload engine when history exists.
 * Used by both active workout and edit past workout so behavior does not diverge.
 */
import type { Exercise, WorkoutSession } from '../types';
import { buildDisplayPrescriptionSnapshot } from '../lib/progression/buildDisplayPrescriptionSnapshot';
import type { ExercisePrescriptionRow } from './supabaseStorage';

export type PrevSet = { weight: number; reps: number };

export type GhostResult = {
  prevSets: PrevSet[];
  ghostWeight: string | null;
  ghostReps: string | null;
  loadChangePercent: number | null;
  /** Human-readable reason for the prescription (e.g. "Add weight", "Build reps", "Deload") */
  ghostReason: string | null;
  /** True when ghost comes from canonical engine; false when fallback (no history) or stale DB */
  fromProgressionEngine: boolean;
};

function findLastSessionWithExercise(
  exercise: Exercise,
  recentSessions: WorkoutSession[]
): { matchEx: { sets?: Array<{ weight?: number; reps?: number; rpe?: number | null; completed?: boolean }> }; doneSets: Array<{ weight: number; reps: number; rpe?: number | null }> } | null {
  const exNameLower = exercise.name?.toLowerCase() ?? '';
  for (const session of recentSessions) {
    const matchEx = session.exercises?.find(
      (e) =>
        (exercise.exerciseDbId && e.exerciseDbId === exercise.exerciseDbId) ||
        e.name?.toLowerCase() === exNameLower
    );
    if (matchEx) {
      const allSets = matchEx.sets ?? [];
      const doneSets = allSets.filter((s) => (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0);
      if (doneSets.length > 0) {
        return { matchEx, doneSets };
      }
    }
  }
  return null;
}

/**
 * Build prevSets and ghost from the shared display prescription snapshot.
 * When history exists: use the unified display-side progression output.
 * When no history: fallback to DB prescription or last set; ghostReason indicates "No history yet".
 *
 * Prescriptions map accepts the full ExercisePrescriptionRow so the shared helper
 * uses the real difficulty band and consecutive-success counters.
 */
export function buildPrevSetsAndGhost(
  exercise: Exercise,
  prescriptions: Record<string, ExercisePrescriptionRow | { nextWeight: number; goal: string }>,
  recentSessions: WorkoutSession[],
  weightUnit: 'kg' | 'lb'
): GhostResult {
  const exKey = exercise.exerciseDbId ?? exercise.name;
  const prescription = exKey ? (prescriptions[exKey] ?? null) : null;

  let ghostWeight: string | null = null;
  let ghostReps: string | null = null;
  let prevSets: PrevSet[] = [];
  let loadChangePercent: number | null = null;
  let ghostReason: string | null = null;
  let fromProgressionEngine = false;

  const last = findLastSessionWithExercise(exercise, recentSessions);

  if (last) {
    const { matchEx, doneSets } = last;
    prevSets = (matchEx.sets ?? []).map((s) => ({ weight: s.weight ?? 0, reps: s.reps ?? 0 }));

    const snapshot = buildDisplayPrescriptionSnapshot({
      exerciseName: exercise.name ?? '',
      exerciseDbId: exercise.exerciseDbId,
      repRangeLow: exercise.repRangeLow ?? 10,
      repRangeHigh: exercise.repRangeHigh ?? 12,
      recentSets: doneSets,
      prescription,
      weightUnit,
    });

    ghostWeight = snapshot.ghostWeight;
    ghostReps = snapshot.ghostReps;
    loadChangePercent = snapshot.loadChangePercent;
    ghostReason =
      snapshot.action === 'increase weight'
        ? 'Add weight'
        : snapshot.action === 'deload'
          ? 'Deload'
          : snapshot.action === 'build reps'
            ? 'Build reps'
            : snapshot.reason;
    fromProgressionEngine = snapshot.fromProgressionEngine;
  } else if (prescription) {
    // No last session in recentSessions, but prescription exists (e.g. from older session).
    // Use persisted state so ghost reflects save/recompute output.
    const snapshot = buildDisplayPrescriptionSnapshot({
      exerciseName: exercise.name ?? '',
      exerciseDbId: exercise.exerciseDbId,
      repRangeLow: exercise.repRangeLow ?? 10,
      repRangeHigh: exercise.repRangeHigh ?? 12,
      recentSets: [],
      prescription,
      weightUnit,
    });

    ghostWeight = snapshot.ghostWeight;
    ghostReps = snapshot.ghostReps;
    loadChangePercent = snapshot.loadChangePercent;
    ghostReason =
      snapshot.action === 'increase weight'
        ? 'Add weight'
        : snapshot.action === 'deload'
          ? 'Deload'
          : snapshot.action === 'build reps'
            ? 'Build reps'
            : snapshot.reason;
    fromProgressionEngine = snapshot.fromProgressionEngine;
  }

  return {
    prevSets,
    ghostWeight,
    ghostReps,
    loadChangePercent,
    ghostReason,
    fromProgressionEngine,
  };
}
