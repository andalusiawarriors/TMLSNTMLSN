import { formatWeightDisplay, toDisplayWeight } from '../../utils/units';
import { decideNextPrescription, type DifficultyBand } from './decideNextPrescription';
import type { ExercisePrescriptionRow } from '../../utils/supabaseStorage';
import { resolveOverloadCategory } from '../../utils/supabaseStorage';

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
  prescription?: ExercisePrescriptionRow | { nextWeight: number | null; goal: string } | null;
  weightUnit: 'kg' | 'lb';
  isDeloadWeek?: boolean;
  blitzMode?: boolean;
};

function toActionPhrase(action: 'deload' | 'add_weight' | 'build_reps' | 'calibrate'): DisplayPrescriptionSnapshot['action'] {
  if (action === 'deload') return 'deload';
  if (action === 'add_weight') return 'increase weight';
  return 'build reps';
}

export function buildDisplayPrescriptionSnapshot(
  input: BuildDisplayPrescriptionSnapshotInput
): DisplayPrescriptionSnapshot {
  const {
    exerciseName,
    exerciseDbId,
    repRangeLow,
    repRangeHigh,
    recentSets,
    prescription,
    weightUnit,
    isDeloadWeek = false,
    blitzMode = false,
  } = input;

  const difficultyBand: DifficultyBand =
    (prescription && 'difficultyBand' in prescription ? prescription.difficultyBand : 'easy') as DifficultyBand;
  const consecutiveSuccess =
    prescription && 'consecutiveSuccess' in prescription ? prescription.consecutiveSuccess : 0;
  const consecutiveFailure =
    prescription && 'consecutiveFailure' in prescription ? prescription.consecutiveFailure : 0;
  const isCalibrating =
    prescription && 'isCalibrating' in prescription ? prescription.isCalibrating : false;

  const workingSets = recentSets
    .filter((set) => set.weight > 0 && set.reps > 0)
    .map((set) => ({
      weight: set.weight,
      reps: set.reps,
      rpe: set.rpe ?? null,
      completed: true,
    }));

  if (workingSets.length > 0) {
    const decision = decideNextPrescription({
      sets: workingSets,
      repRangeLow,
      repRangeHigh,
      overloadCategory: resolveOverloadCategory(exerciseDbId, exerciseName),
      currentBand: difficultyBand,
      consecutiveSuccess,
      consecutiveFailure,
      isCalibrating,
      isDeloadWeek,
      blitzMode,
    });

    if (decision) {
      const previousWeight = workingSets[workingSets.length - 1]?.weight ?? 0;
      const loadChangePercent =
        previousWeight > 0 && (decision.action === 'add_weight' || decision.action === 'deload')
          ? Math.round(((decision.nextWeightLb - previousWeight) / previousWeight) * 1000) / 10
          : null;
      const maxRpe = decision.debug.maxRpe ?? null;
      return {
        ghostWeight: formatWeightDisplay(toDisplayWeight(decision.nextWeightLb, weightUnit), weightUnit),
        ghostReps: String(decision.nextRepTarget),
        nextWeightLb: decision.nextWeightLb,
        action: toActionPhrase(decision.action),
        reason: decision.reason,
        goal: decision.goal,
        loadChangePercent,
        fromProgressionEngine: true,
        workingSetsAnalyzed: workingSets.length,
        maxRpe,
        hitTopRange: decision.debug.hitThreshold,
      };
    }

    const lastSet = workingSets[workingSets.length - 1];
    const maxRpe = workingSets.reduce<number | null>((acc, set) => {
      if (set.rpe == null || set.rpe <= 0) return acc;
      return acc == null ? set.rpe : Math.max(acc, set.rpe);
    }, null);
    return {
      ghostWeight: formatWeightDisplay(toDisplayWeight(lastSet.weight, weightUnit), weightUnit),
      ghostReps: String(lastSet.reps),
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

  if (prescription?.nextWeight != null) {
    return {
      ghostWeight: formatWeightDisplay(toDisplayWeight(prescription.nextWeight, weightUnit), weightUnit),
      ghostReps: String(prescription.goal === 'add_load' ? repRangeLow : repRangeHigh),
      nextWeightLb: prescription.nextWeight,
      action:
        prescription.goal === 'add_load'
          ? 'increase weight'
          : prescription.goal === 'reduce_load'
            ? 'deload'
            : 'build reps',
      reason: 'reason' in prescription ? prescription.reason : null,
      goal: prescription.goal,
      loadChangePercent: null,
      fromProgressionEngine: false,
      workingSetsAnalyzed: 0,
      maxRpe: null,
      hitTopRange: null,
    };
  }

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
