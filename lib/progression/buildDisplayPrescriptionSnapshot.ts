/**
 * Display-side snapshot: reads persisted progression state only.
 * Does NOT call decideNextPrescription. Save/recompute is the primary source of truth.
 */
import { formatWeightDisplay, toDisplayWeight } from '../../utils/units';
import type { ExercisePrescriptionRow } from '../../utils/supabaseStorage';

export type DisplayHistorySet = {
  weight: number;
  reps: number;
  rpe?: number | null;
};

export type DisplayPrescriptionSnapshot = {
  ghostWeight: string | null;
  ghostReps: string | null;
  nextWeightLb: number | null;
  action: 'increase weight' | 'build reps' | 'deload' | null;
  reason: string | null;
  goal: string | null;
  loadChangePercent: number | null;
  fromProgressionEngine: boolean;
  workingSetsAnalyzed: number;
  maxRpe: number | null;
  hitTopRange: boolean | null;
};

type BuildDisplayPrescriptionSnapshotInput = {
  exerciseName: string;
  exerciseDbId?: string | null;
  repRangeLow: number;
  repRangeHigh: number;
  recentSets: DisplayHistorySet[];
  prescription?: ExercisePrescriptionRow | { nextWeight: number | null; goal: string; nextTargetReps?: number } | null;
  weightUnit: 'kg' | 'lb';
  isDeloadWeek?: boolean;
};

function goalToAction(goal: string): DisplayPrescriptionSnapshot['action'] {
  if (goal === 'add_load') return 'increase weight';
  if (goal === 'reduce_load') return 'deload';
  return 'build reps';
}

export function buildDisplayPrescriptionSnapshot(
  input: BuildDisplayPrescriptionSnapshotInput
): DisplayPrescriptionSnapshot {
  const {
    repRangeLow,
    repRangeHigh,
    recentSets,
    prescription,
    weightUnit,
  } = input;

  const workingSets = recentSets.filter((set) => set.weight > 0 && set.reps > 0);
  const lastSet = workingSets.length > 0 ? workingSets[workingSets.length - 1] : null;

  const hasPrescription =
    prescription &&
    (prescription.nextWeight != null || ('nextTargetReps' in prescription && prescription.nextTargetReps != null));

  // 1. When prescription exists: use persisted state directly (no re-decision)
  if (hasPrescription && prescription) {
    const nextWeight = prescription.nextWeight ?? lastSet?.weight ?? 0;
    const nextTargetReps =
      (prescription && 'nextTargetReps' in prescription && prescription.nextTargetReps != null)
        ? prescription.nextTargetReps
        : repRangeLow;
    const goal = prescription.goal ?? 'add_reps';

    let loadChangePercent: number | null = null;
    if (lastSet && lastSet.weight > 0 && (goal === 'add_load' || goal === 'reduce_load') && nextWeight > 0) {
      loadChangePercent = Math.round(((nextWeight - lastSet.weight) / lastSet.weight) * 1000) / 10;
    }

    const maxRpe = workingSets.reduce<number | null>((acc, set) => {
      if (set.rpe == null || set.rpe <= 0) return acc;
      return acc == null ? set.rpe : Math.max(acc, set.rpe);
    }, null);

    return {
      ghostWeight: formatWeightDisplay(toDisplayWeight(nextWeight, weightUnit), weightUnit),
      ghostReps: String(nextTargetReps),
      nextWeightLb: nextWeight > 0 ? nextWeight : null,
      action: goalToAction(goal),
      reason: 'reason' in prescription ? prescription.reason : null,
      goal,
      loadChangePercent,
      fromProgressionEngine: true,
      workingSetsAnalyzed: 0,
      maxRpe,
      hitTopRange: null,
    };
  }

  // 2. No prescription but has recentSets: fallback to last set
  if (lastSet) {
    const maxRpe = workingSets.reduce<number | null>((acc, set) => {
      if (set.rpe == null || set.rpe <= 0) return acc;
      return acc == null ? set.rpe : Math.max(acc, set.rpe);
    }, null);
    return {
      ghostWeight: formatWeightDisplay(toDisplayWeight(lastSet.weight, weightUnit), weightUnit),
      ghostReps: String(repRangeLow),
      nextWeightLb: lastSet.weight,
      action: null,
      reason: 'Last session',
      goal: null,
      loadChangePercent: null,
      fromProgressionEngine: false,
      workingSetsAnalyzed: workingSets.length,
      maxRpe,
      hitTopRange: null,
    };
  }

  // 3. No prescription, no sets
  return {
    ghostWeight: null,
    ghostReps: null,
    nextWeightLb: null,
    action: null,
    reason: null,
    goal: null,
    loadChangePercent: null,
    fromProgressionEngine: false,
    workingSetsAnalyzed: 0,
    maxRpe: null,
    hitTopRange: null,
  };
}
