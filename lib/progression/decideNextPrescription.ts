/**
 * Bodybuilding progressive overload decision engine (Phase 1 + Phase 2).
 *
 * Phase 1: Threshold-based; atTop first, then atTarget, then hold.
 * Phase 2: Adaptive rep jumps when at target:
 *   - 10–12 (width 2–3): +1 only
 *   - 8–12 (width 4–5): +1 or +2 when overshoot
 *   - 6–12 (width 6+): +1, +2, or rare +3 when clearly underloaded at bottom
 * Band-based increment (difficulty_band retained).
 */

import { KG_PER_LB, LB_PER_KG, roundToGymPrecision } from '../../utils/units';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DifficultyBand = 'easy' | 'medium' | 'hard' | 'extreme';
export type OverloadCategory = 'compound_big' | 'compound_small' | 'isolation';
export type ProgressionAction = 'deload' | 'add_weight' | 'build_reps' | 'calibrate';

export type ProgressionDecision = {
  action: ProgressionAction;
  nextWeightKg: number;
  nextWeightLb: number;
  nextRepTarget: number;
  repRangeLow: number;
  repRangeHigh: number;
  reason: string;
  nextBand: DifficultyBand;
  goal: 'add_load' | 'add_reps' | 'reduce_load';
  debug: {
    branch: string;
    atTargetThreshold: boolean;
    atTopThreshold: boolean;
    allSetsAtTop: boolean;
    baseWeightKg: number;
    incrementKg: number;
    workingSetCount: number;
    newConsecutiveSuccess: number;
    newConsecutiveFailure: number;
  };
};

export type WorkingSet = {
  weight: number; // stored in lb
  reps: number;
  rpe: number | null;
  completed: boolean;
};

export type ProgressionInput = {
  sets: WorkingSet[];
  repRangeLow: number;
  repRangeHigh: number;
  currentTargetReps: number;
  overloadCategory: OverloadCategory;
  currentBand: DifficultyBand;
  consecutiveSuccess: number;
  consecutiveFailure: number;
  isCalibrating: boolean;
  isDeloadWeek: boolean;
};

// ─── Threshold constant ───────────────────────────────────────────────────────

const THRESHOLD = 0.70;

// ─── Band-based increments (kg) ───────────────────────────────────────────────

export const INCREMENTS: Record<OverloadCategory, Record<DifficultyBand, number>> = {
  compound_big:   { easy: 2.5,  medium: 5,   hard: 7.5, extreme: 10  },
  compound_small: { easy: 1.25, medium: 2.5, hard: 5,   extreme: 7.5 },
  isolation:      { easy: 0.5,  medium: 1,   hard: 1.5, extreme: 2.5 },
};

export function getIncrementKg(category: OverloadCategory, band: DifficultyBand): number {
  return INCREMENTS[category][band];
}

// ─── Threshold helpers ────────────────────────────────────────────────────────

/** 70%+ of working sets have reps >= currentTargetReps */
function atTargetThreshold(sets: WorkingSet[], currentTargetReps: number): boolean {
  const completed = sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
  if (completed.length === 0) return false;
  const hits = completed.filter((s) => s.reps >= currentTargetReps).length;
  return hits / completed.length >= THRESHOLD;
}

/** 70%+ of working sets have reps >= repRangeHigh */
function atTopThreshold(sets: WorkingSet[], repRangeHigh: number): boolean {
  const completed = sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
  if (completed.length === 0) return false;
  const hits = completed.filter((s) => s.reps >= repRangeHigh).length;
  return hits / completed.length >= THRESHOLD;
}

/** 100% of working sets at top (optional stronger signal) */
function allSetsAtTop(sets: WorkingSet[], repRangeHigh: number): boolean {
  const completed = sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
  return completed.length > 0 && completed.every((s) => s.reps >= repRangeHigh);
}

/** Mean reps across completed working sets (Phase 2 adaptive jump). */
function getAvgReps(workSets: WorkingSet[]): number {
  if (workSets.length === 0) return 0;
  const sum = workSets.reduce((acc, s) => acc + s.reps, 0);
  return sum / workSets.length;
}

/** Count sets with reps >= threshold (Phase 2 guards against outlier-driven jumps). */
function countSetsAtOrAbove(workSets: WorkingSet[], threshold: number): number {
  return workSets.filter((s) => s.reps >= threshold).length;
}

/** Max allowed jump by range width (Phase 2). */
function getMaxJumpForRangeWidth(rangeWidth: number): number {
  if (rangeWidth <= 3) return 1;
  if (rangeWidth <= 5) return 2;
  return 3;
}

/**
 * Phase 2 adaptive jump: +1 default, +2 when overshoot and width >= 4, +3 rare when underloaded at bottom.
 * Only called when atTargetThreshold (not at top).
 * Guards: require set-count thresholds to avoid outlier-driven jumps (audit tightening).
 */
function computeAdaptiveJump(
  workSets: WorkingSet[],
  repRangeLow: number,
  repRangeHigh: number,
  currentTargetReps: number
): number {
  const rangeWidth = repRangeHigh - repRangeLow;
  const avgReps = getAvgReps(workSets);
  const maxJump = getMaxJumpForRangeWidth(rangeWidth);

  // Minimum set count: +2/+3 only with 3+ sets (avoid 1–2 outlier sets driving jump)
  if (workSets.length < 3) return 1;

  let selectedJump = 1;
  const setsAtTargetPlus2 = countSetsAtOrAbove(workSets, currentTargetReps + 2);
  const setsAtTargetPlus1 = countSetsAtOrAbove(workSets, currentTargetReps + 1);

  // +3 guard: avgReps + at least 3 sets at target+2 (not just one outlier)
  if (
    avgReps >= currentTargetReps + 2 &&
    rangeWidth >= 6 &&
    currentTargetReps <= repRangeLow + 2 &&
    setsAtTargetPlus2 >= 3
  ) {
    selectedJump = 3;
  } else if (
    avgReps >= currentTargetReps + 1 &&
    rangeWidth >= 4 &&
    setsAtTargetPlus1 >= 2
  ) {
    selectedJump = 2;
  }

  return Math.min(selectedJump, maxJump);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundToIncrement(valueKg: number, incrementKg: number): number {
  const inc = incrementKg > 0 ? incrementKg : 2.5;
  const r = Math.round(valueKg / inc) * inc;
  return roundToGymPrecision(r);
}

function getBaseWeightLb(workSets: WorkingSet[]): number {
  if (workSets.length === 0) return 0;
  const firstWeightLb = workSets[0].weight;
  const byWeight = new Map<number, number>();
  for (const s of workSets) {
    byWeight.set(s.weight, (byWeight.get(s.weight) ?? 0) + 1);
  }
  let bestWeightLb = firstWeightLb;
  let bestCount = 0;
  for (const [lb, count] of byWeight) {
    if (count > bestCount || (count === bestCount && lb === firstWeightLb)) {
      bestCount = count;
      bestWeightLb = lb;
    }
  }
  return bestWeightLb;
}

export function isDeloadWeek(weekCounter: number): boolean {
  return weekCounter > 0 && weekCounter % 4 === 0;
}

export function getDeloadWeight(currentWeightKg: number): number {
  return currentWeightKg * 0.5;
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function decideNextPrescription(input: ProgressionInput): ProgressionDecision | null {
  const {
    sets,
    repRangeLow,
    repRangeHigh,
    currentTargetReps,
    overloadCategory,
    currentBand,
    consecutiveSuccess,
    consecutiveFailure,
    isCalibrating,
    isDeloadWeek: deloadWeek,
  } = input;

  const workSets = sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
  if (workSets.length === 0) return null;

  const baseWeightLb = getBaseWeightLb(workSets);
  const baseWeightKg = baseWeightLb * KG_PER_LB;

  const atTop = atTopThreshold(workSets, repRangeHigh);
  const atTarget = atTargetThreshold(workSets, currentTargetReps);
  const allTop = allSetsAtTop(workSets, repRangeHigh);

  const incrementKg = getIncrementKg(overloadCategory, currentBand);

  // ── Step 1: Calibration ───────────────────────────────────────────────────
  if (isCalibrating) {
    return {
      action: 'calibrate',
      nextWeightKg: baseWeightKg,
      nextWeightLb: baseWeightLb,
      nextRepTarget: repRangeLow,
      repRangeLow,
      repRangeHigh,
      reason: 'First session — baseline set. Progression starts next time.',
      nextBand: currentBand,
      goal: 'add_reps',
      debug: {
        branch: 'calibration',
        atTargetThreshold: atTarget,
        atTopThreshold: atTop,
        allSetsAtTop: allTop,
        baseWeightKg,
        incrementKg: 0,
        workingSetCount: workSets.length,
        newConsecutiveSuccess: 0,
        newConsecutiveFailure: 0,
      },
    };
  }

  // ── Step 2: Deload week ───────────────────────────────────────────────────
  if (deloadWeek) {
    const deloadWeightKg = getDeloadWeight(baseWeightKg);
    const nextWeightKg = roundToIncrement(deloadWeightKg, incrementKg);
    const nextWeightLb = roundToGymPrecision(nextWeightKg * LB_PER_KG);

    return {
      action: 'deload',
      nextWeightKg,
      nextWeightLb,
      nextRepTarget: repRangeLow,
      repRangeLow,
      repRangeHigh,
      reason: 'Deload week — weight reduced for recovery.',
      nextBand: currentBand,
      goal: 'reduce_load',
      debug: {
        branch: 'deload_week',
        atTargetThreshold: atTarget,
        atTopThreshold: atTop,
        allSetsAtTop: allTop,
        baseWeightKg,
        incrementKg,
        workingSetCount: workSets.length,
        newConsecutiveSuccess: 0,
        newConsecutiveFailure: 0,
      },
    };
  }

  // ── Step 3: atTopThreshold (70%+ at repRangeHigh) → add weight ──────────────
  if (atTop) {
    const nextWeightKg = roundToIncrement(baseWeightKg + incrementKg, incrementKg);
    const nextWeightLb = roundToGymPrecision(nextWeightKg * LB_PER_KG);

    return {
      action: 'add_weight',
      nextWeightKg,
      nextWeightLb,
      nextRepTarget: repRangeLow,
      repRangeLow,
      repRangeHigh,
      reason: `Hit 70%+ of sets at ${repRangeHigh} reps — weight increases, target resets to ${repRangeLow}.`,
      nextBand: currentBand,
      goal: 'add_load',
      debug: {
        branch: 'at_top_threshold',
        atTargetThreshold: atTarget,
        atTopThreshold: atTop,
        allSetsAtTop: allTop,
        baseWeightKg,
        incrementKg,
        workingSetCount: workSets.length,
        newConsecutiveSuccess: consecutiveSuccess + 1,
        newConsecutiveFailure: 0,
      },
    };
  }

  // ── Step 4: atTargetThreshold (and not at top) → adaptive jump (+1, +2, or +3) ─
  if (atTarget) {
    const jump = computeAdaptiveJump(workSets, repRangeLow, repRangeHigh, currentTargetReps);
    const nextTarget = Math.min(currentTargetReps + jump, repRangeHigh);
    const branch = jump === 3 ? 'plus_3_rep' : jump === 2 ? 'plus_2_rep' : 'plus_1_rep';

    return {
      action: 'build_reps',
      nextWeightKg: baseWeightKg,
      nextWeightLb: baseWeightLb,
      nextRepTarget: nextTarget,
      repRangeLow,
      repRangeHigh,
      reason: jump > 1
        ? `Hit target with overshoot — next target ${nextTarget} (+${jump}).`
        : `Hit target — next target ${nextTarget}.`,
      nextBand: currentBand,
      goal: 'add_reps',
      debug: {
        branch,
        atTargetThreshold: atTarget,
        atTopThreshold: atTop,
        allSetsAtTop: allTop,
        baseWeightKg,
        incrementKg,
        workingSetCount: workSets.length,
        newConsecutiveSuccess: consecutiveSuccess + 1,
        newConsecutiveFailure: 0,
      },
    };
  }

  // ── Step 5: Miss → hold ─────────────────────────────────────────────────────
  return {
    action: 'build_reps',
    nextWeightKg: baseWeightKg,
    nextWeightLb: baseWeightLb,
    nextRepTarget: currentTargetReps,
    repRangeLow,
    repRangeHigh,
    reason: "Didn't hit target — same target next time.",
    nextBand: currentBand,
    goal: 'add_reps',
    debug: {
      branch: 'hold',
      atTargetThreshold: atTarget,
      atTopThreshold: atTop,
      allSetsAtTop: allTop,
      baseWeightKg,
      incrementKg,
      workingSetCount: workSets.length,
      newConsecutiveSuccess: 0,
      newConsecutiveFailure: consecutiveFailure + 1,
    },
  };
}

// ─── Legacy compatibility ──────────────────────────────────────────────────────

/** Convert legacy prescription format to ProgressionDecision for display. */
export function prescriptionToDecision(
  nextWeightLb: number,
  goal: 'add_load' | 'add_reps' | 'reduce_load',
  repRangeLow: number,
  repRangeHigh: number,
  nextTargetReps?: number
): ProgressionDecision {
  const nextWeightKg = nextWeightLb * KG_PER_LB;
  const action: ProgressionAction =
    goal === 'reduce_load' ? 'deload' : goal === 'add_load' ? 'add_weight' : 'build_reps';
  const nextRepTarget =
    nextTargetReps ?? (action === 'add_weight' ? repRangeLow : repRangeHigh);
  const reason =
    action === 'deload'
      ? 'Deload prescribed — weight reduced to allow recovery.'
      : action === 'add_weight'
        ? 'Load increased — target resets to bottom of range.'
        : 'Keep the weight and build reps.';

  return {
    action,
    nextWeightKg,
    nextWeightLb,
    nextRepTarget,
    repRangeLow,
    repRangeHigh,
    reason,
    nextBand: 'easy',
    goal,
    debug: {
      branch: 'from_prescription',
      atTargetThreshold: false,
      atTopThreshold: false,
      allSetsAtTop: false,
      baseWeightKg: nextWeightKg,
      incrementKg: 2.5,
      workingSetCount: 0,
      newConsecutiveSuccess: 0,
      newConsecutiveFailure: 0,
    },
  };
}
