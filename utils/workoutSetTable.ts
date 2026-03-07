/**
 * Shared logic for set table: build prevSets (last session per-set) and ghost weight/reps.
 * Ghost values come from the canonical progressive overload engine when history exists.
 * Used by both active workout and edit past workout so behavior does not diverge.
 */
import type { Exercise, WorkoutSession } from '../types';
import { toDisplayWeight, formatWeightDisplay } from './units';
import { decideNextPrescription } from '../lib/progression/decideNextPrescription';

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
 * Build prevSets and ghost from canonical progression engine.
 * When history exists: run decideNextPrescription and use its output.
 * When no history: fallback to DB prescription or last set; ghostReason indicates "No history yet".
 */
export function buildPrevSetsAndGhost(
  exercise: Exercise,
  prescriptions: Record<string, { nextWeight: number; goal: string }>,
  recentSessions: WorkoutSession[],
  weightUnit: 'kg' | 'lb'
): GhostResult {
  const exKey = exercise.exerciseDbId ?? exercise.name;
  const prescription = exKey ? prescriptions[exKey] : null;

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

    const repRangeLow = exercise.repRangeLow ?? 8;
    const repRangeHigh = exercise.repRangeHigh ?? 12;
    const incrementKg = (exercise.smallestIncrement ?? 2.5) as number;

    const workingSets = doneSets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      rpe: s.rpe ?? null,
      completed: true,
    }));

    const decision = decideNextPrescription({
      sets: workingSets,
      repRangeLow,
      repRangeHigh,
      overloadCategory: 'compound_small',
      currentBand: 'easy',
      consecutiveSuccess: 0,
      consecutiveFailure: 0,
      isCalibrating: false,
      isDeloadWeek: false,
      blitzMode: false,
    });

    // [AUDIT] Temporary debug – remove after verification
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[buildPrevSetsAndGhost AUDIT]', {
        exerciseName: exercise.name,
        repRangeLow,
        repRangeHigh,
        incrementKg,
        doneSetsCount: doneSets.length,
        fromProgressionEngine: !!decision,
        usedPrescriptionFallback: !decision && !!prescription,
      });
    }

    if (decision) {
      fromProgressionEngine = true;
      ghostWeight = formatWeightDisplay(toDisplayWeight(decision.nextWeightLb, weightUnit), weightUnit);
      ghostReps = String(decision.nextRepTarget);
      ghostReason =
        decision.action === 'add_weight'
          ? 'Add weight'
          : decision.action === 'deload'
            ? 'Deload'
            : 'Build reps';

      const prevWeight = doneSets[doneSets.length - 1].weight;
      if (prevWeight > 0 && (decision.action === 'add_weight' || decision.action === 'deload')) {
        loadChangePercent = Math.round(((decision.nextWeightLb - prevWeight) / prevWeight) * 1000) / 10;
      }
    } else {
      const lastSet = doneSets[doneSets.length - 1];
      ghostWeight = formatWeightDisplay(toDisplayWeight(lastSet.weight, weightUnit), weightUnit);
      ghostReps = String(lastSet.reps);
      ghostReason = 'Last session';
    }
  } else if (prescription) {
    ghostWeight = formatWeightDisplay(toDisplayWeight(prescription.nextWeight, weightUnit), weightUnit);
    ghostReps = String(
      prescription.goal === 'add_load'
        ? (exercise.repRangeLow ?? 8)
        : (exercise.repRangeHigh ?? 12)
    );
    ghostReason = prescription.goal === 'add_load' ? 'Add weight' : prescription.goal === 'reduce_load' ? 'Deload' : 'Build reps';
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
