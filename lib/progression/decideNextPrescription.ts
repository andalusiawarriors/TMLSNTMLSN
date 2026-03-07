/**
 * Canonical progressive overload decision engine.
 * Single source of truth for all progression logic across the app.
 */

import { KG_PER_LB, LB_PER_KG } from '../../utils/units';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProgressionAction = 'deload' | 'add_weight' | 'build_reps';

export type ProgressionDecision = {
  action: ProgressionAction;
  nextWeightKg: number;
  nextWeightLb: number;
  nextRepTarget: number;
  repRangeLow: number;
  repRangeHigh: number;
  reason: string;
  /** Legacy goal for exercise_progress_state compatibility */
  goal: 'add_load' | 'add_reps' | 'reduce_load';
  debug: {
    hitTopRange: boolean;
    setsBelowLowCount: number;
    maxRpe: number | null;
    baseWeightKg: number;
    incrementKg: number;
    workingSetCount: number;
    branch: string;
  };
};

export type WorkingSet = {
  weight: number;
  reps: number;
  rpe: number | null;
  completed: boolean;
};

export type ProgressionInput = {
  /** Working sets; weight is in lb (storage format) */
  sets: WorkingSet[];
  repRangeLow: number;
  repRangeHigh: number;
  /** Increment in kg (e.g. 2.5) */
  incrementKg: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round to nearest valid exercise increment; avoid ugly decimals (e.g. 42.75 kg when increment is 2.5). */
function roundToIncrement(valueKg: number, incrementKg: number): number {
  const inc = incrementKg > 0 ? incrementKg : 2.5;
  return Math.round(valueKg / inc) * inc;
}

/** Prefer most common working weight; if tied, first working-set weight. Returns lb (storage unit). */
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

// ─── Main engine ───────────────────────────────────────────────────────────────

/**
 * Decide the next prescription from a set of working sets.
 * All internal calculations use kg; returns both kg and lb for callers.
 */
export function decideNextPrescription(input: ProgressionInput): ProgressionDecision | null {
  const { sets, repRangeLow, repRangeHigh, incrementKg } = input;

  const workSets = sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
  if (workSets.length === 0) return null;

  const baseWeightLb = getBaseWeightLb(workSets);
  const baseWeightKg = baseWeightLb * KG_PER_LB;
  const hitTopRange = workSets.every((s) => s.reps >= repRangeHigh);
  const setsBelowLow = workSets.filter((s) => s.reps < repRangeLow);
  const atLeast2BelowLow = setsBelowLow.length >= 2;
  const rpeVals = workSets.map((s) => s.rpe).filter((r): r is number => r != null && r > 0);
  const maxRpe = rpeVals.length > 0 ? Math.max(...rpeVals) : null;

  // [AUDIT] Temporary debug logging – remove after verification
  if (__DEV__) {
    console.log('[Progression AUDIT]', {
      repRangeLow,
      repRangeHigh,
      incrementKg,
      analyzedSets: workSets.map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.rpe })),
      maxRpe,
      belowLowCount: setsBelowLow.length,
      allAtHigh: hitTopRange,
      addWeightCondition: `hitTopRange=${hitTopRange} (reps>=${repRangeHigh}) AND maxRpe<9=${maxRpe != null && maxRpe < 9}`,
    });
  }

  let action: ProgressionAction;
  let nextWeightKg: number;
  let nextRepTarget: number;
  let reason: string;
  let branch: string;

  if (maxRpe != null && maxRpe >= 9.5) {
    action = 'deload';
    nextWeightKg = roundToIncrement(baseWeightKg * 0.9, incrementKg);
    nextRepTarget = repRangeLow;
    reason = 'Effort was too high (RPE ≥ 9.5), so a deload is prescribed.';
    branch = 'maxRpe>=9.5';
  } else if (atLeast2BelowLow) {
    action = 'deload';
    nextWeightKg = roundToIncrement(baseWeightKg * 0.9, incrementKg);
    nextRepTarget = repRangeLow;
    reason = 'At least two sets dropped below the rep floor, so a deload is prescribed.';
    branch = 'atLeast2BelowLow';
  } else if (hitTopRange && (maxRpe == null || maxRpe < 9)) {
    action = 'add_weight';
    nextWeightKg = roundToIncrement(baseWeightKg + incrementKg, incrementKg);
    nextRepTarget = repRangeLow;
    reason = 'All sets hit the top of the rep range with RPE under 9, so load increases.';
    branch = 'hitTopRange_and_maxRpe<9';
  } else {
    action = 'build_reps';
    // Preserve exact base weight; do not round to increment (only add_weight/deload change weight)
    nextWeightKg = baseWeightKg;
    nextRepTarget = repRangeHigh;
    reason = 'You have not fully earned a load increase yet, so keep the weight and build reps.';
    branch = hitTopRange ? 'maxRpe>=9_blocked' : 'didNotHitTopRange';
  }

  // For build_reps, nextWeightLb = baseWeightLb exactly; for add_weight/deload, derive from rounded kg
  const nextWeightLb =
    action === 'build_reps'
      ? baseWeightLb
      : Math.round(nextWeightKg * LB_PER_KG * 1000) / 1000;

  const goal: ProgressionDecision['goal'] =
    action === 'deload' ? 'reduce_load' : action === 'add_weight' ? 'add_load' : 'add_reps';

  if (__DEV__) {
    console.log('[Progression AUDIT] final action:', action, 'branch:', branch);
  }

  return {
    action,
    nextWeightKg,
    nextWeightLb,
    nextRepTarget,
    repRangeLow,
    repRangeHigh,
    reason,
    goal,
    debug: {
      hitTopRange,
      setsBelowLowCount: setsBelowLow.length,
      maxRpe,
      baseWeightKg,
      incrementKg,
      workingSetCount: workSets.length,
      branch,
    },
  };
}

/** Convert legacy prescription format to ProgressionDecision for display. */
export function prescriptionToDecision(
  nextWeightLb: number,
  goal: 'add_load' | 'add_reps' | 'reduce_load',
  repRangeLow: number,
  repRangeHigh: number
): ProgressionDecision {
  const nextWeightKg = nextWeightLb * KG_PER_LB;
  const action: ProgressionAction =
    goal === 'reduce_load' ? 'deload' : goal === 'add_load' ? 'add_weight' : 'build_reps';
  const nextRepTarget = action === 'add_weight' ? repRangeLow : repRangeHigh;
  const reason =
    action === 'deload'
      ? 'Effort was too high or multiple sets dropped below the rep floor, so a deload is prescribed.'
      : action === 'add_weight'
        ? 'All sets hit the top of the rep range with RPE under 9, so load increases.'
        : 'You have not fully earned a load increase yet, so keep the weight and build reps.';

  return {
    action,
    nextWeightKg,
    nextWeightLb,
    nextRepTarget,
    repRangeLow,
    repRangeHigh,
    reason,
    goal,
    debug: {
      hitTopRange: false,
      setsBelowLowCount: 0,
      maxRpe: null,
      baseWeightKg: nextWeightKg,
      incrementKg: 2.5,
      workingSetCount: 0,
      branch: 'from_prescription',
    },
  };
}
