/**
 * Canonical progressive overload decision engine.
 * Implements the full algorithm from progressive_overload_algorithm.docx:
 *
 *  - 70% rule: weight goes up when 70%+ of sets hit the top of the rep range
 *  - 4-band difficulty system: easy → medium → hard → extreme (per exercise)
 *  - Category-based increments: compound_big / compound_small / isolation
 *  - Automatic deload every 4th week (50% weight reduction)
 *  - New exercise calibration: first session sets baseline, no increment applied
 *  - RPE band accelerator: avg RPE < 6 across last 3 sessions bumps band up
 *  - Blitz Mode: forces Extreme band, disables coaching, caps weekly increase at 10%
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
  /** Legacy goal for exercise_progress_state compatibility */
  goal: 'add_load' | 'add_reps' | 'reduce_load';
  debug: {
    hitThreshold: boolean;
    setsAtTopRange: number;
    totalSets: number;
    hitPercent: number;
    maxRpe: number | null;
    avgRpe: number | null;
    baseWeightKg: number;
    incrementKg: number;
    workingSetCount: number;
    branch: string;
    isCalibrating: boolean;
    isDeloadWeek: boolean;
    blitzMode: boolean;
  };
};

export type WorkingSet = {
  weight: number; // stored in lb
  reps: number;
  rpe: number | null;
  completed: boolean;
};

export type ProgressionInput = {
  /** Working sets; weight is in lb (storage format) */
  sets: WorkingSet[];
  repRangeLow: number;
  repRangeHigh: number;
  /** Exercise category — drives which increment table row to use */
  overloadCategory: OverloadCategory;
  /** Current difficulty band for this exercise */
  currentBand: DifficultyBand;
  /** How many consecutive sessions the user has succeeded (hit 70%+ of max reps) */
  consecutiveSuccess: number;
  /** How many consecutive sessions the user has failed */
  consecutiveFailure: number;
  /** TRUE on the very first session for a new exercise — no increment, just record baseline */
  isCalibrating: boolean;
  /** TRUE if this is week 4 of the 4-week cycle */
  isDeloadWeek: boolean;
  /** Blitz Mode: forces Extreme band, disables coaching, caps at 10% weekly increase */
  blitzMode: boolean;
  /**
   * Average RPE across the last 3 sessions on this exercise.
   * Used for the RPE band accelerator (avg < 6 → bump band up regardless of reps).
   */
  avgRpeLast3Sessions?: number | null;
};

// ─── Increment table ──────────────────────────────────────────────────────────
// Matches the document exactly (values in kg).

export const INCREMENTS: Record<OverloadCategory, Record<DifficultyBand, number>> = {
  compound_big:   { easy: 2.5,  medium: 5,   hard: 7.5, extreme: 10  },
  compound_small: { easy: 1.25, medium: 2.5, hard: 5,   extreme: 7.5 },
  isolation:      { easy: 0.5,  medium: 1,   hard: 1.5, extreme: 2.5 },
};

/** Return the kg increment for a given category + band. */
export function getIncrementKg(category: OverloadCategory, band: DifficultyBand): number {
  return INCREMENTS[category][band];
}

const BANDS: DifficultyBand[] = ['easy', 'medium', 'hard', 'extreme'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round to nearest valid exercise increment to avoid ugly decimals (e.g. 42.75 kg). */
function roundToIncrement(valueKg: number, incrementKg: number): number {
  const inc = incrementKg > 0 ? incrementKg : 2.5;
  const r = Math.round(valueKg / inc) * inc;
  return roundToGymPrecision(r);
}

/** Prefer most common working weight; if tied, use first working-set weight. Returns lb. */
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

/**
 * Resolve the next band based on consecutive success / failure counts.
 *  - 1+ consecutive success  → move up one band
 *  - 2+ consecutive failures → drop one band
 *  - RPE accelerator: avg RPE < 6 across last 3 sessions → bump up regardless of reps
 *  - Otherwise               → stay
 */
export function getNextBand(
  currentBand: DifficultyBand,
  consecutiveSuccess: number,
  consecutiveFailure: number,
  avgRpeLast3Sessions?: number | null
): DifficultyBand {
  const i = BANDS.indexOf(currentBand);

  if (avgRpeLast3Sessions != null && avgRpeLast3Sessions < 6) {
    return BANDS[Math.min(i + 1, BANDS.length - 1)];
  }
  if (consecutiveFailure >= 2) return BANDS[Math.max(i - 1, 0)];
  if (consecutiveSuccess >= 1) return BANDS[Math.min(i + 1, BANDS.length - 1)];
  return currentBand;
}

/**
 * Did the user hit 70%+ of sets at the top of the rep range?
 * This is the core trigger for a weight increase per the 70% rule.
 */
export function didHitRepThreshold(sets: WorkingSet[], repRangeHigh: number): boolean {
  const completedSets = sets.filter((s) => s.completed && s.reps > 0);
  if (completedSets.length === 0) return false;
  const hitsAtTop = completedSets.filter((s) => s.reps >= repRangeHigh).length;
  return hitsAtTop / completedSets.length >= 0.70;
}

/** Is this week a deload week? Counter is a multiple of 4 and greater than 0. */
export function isDeloadWeek(weekCounter: number): boolean {
  return weekCounter > 0 && weekCounter % 4 === 0;
}

/** Deload weight: 50% of current working weight. */
export function getDeloadWeight(currentWeightKg: number): number {
  return currentWeightKg * 0.50;
}

// ─── Main engine ──────────────────────────────────────────────────────────────

/**
 * Decide the next prescription after a logged session.
 * Runs through the full 6-step decision tree from the spec.
 * All internal calculations use kg; returns both kg and lb for callers.
 */
export function decideNextPrescription(input: ProgressionInput): ProgressionDecision | null {
  const {
    sets,
    repRangeLow,
    repRangeHigh,
    overloadCategory,
    currentBand,
    consecutiveSuccess,
    consecutiveFailure,
    isCalibrating,
    isDeloadWeek: deloadWeek,
    blitzMode,
    avgRpeLast3Sessions,
  } = input;

  const workSets = sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
  if (workSets.length === 0) return null;

  const baseWeightLb = getBaseWeightLb(workSets);
  const baseWeightKg = baseWeightLb * KG_PER_LB;

  const rpeVals = workSets.map((s) => s.rpe).filter((r): r is number => r != null && r > 0);
  const maxRpe = rpeVals.length > 0 ? Math.max(...rpeVals) : null;
  const avgRpe = rpeVals.length > 0 ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : null;

  const setsAtTop = workSets.filter((s) => s.reps >= repRangeHigh).length;
  const hitPercent = workSets.length > 0 ? setsAtTop / workSets.length : 0;
  const hitThreshold = didHitRepThreshold(workSets, repRangeHigh);

  // ── Step 1: Calibration ───────────────────────────────────────────────────
  // First session on a new exercise — record baseline only, no increment applied.
  if (isCalibrating) {
    if (__DEV__) {
      console.log('[Progression] Calibration session — baseline recorded, no increment.');
    }
    return {
      action: 'calibrate',
      nextWeightKg: baseWeightKg,
      nextWeightLb: baseWeightLb,
      nextRepTarget: repRangeLow,
      repRangeLow,
      repRangeHigh,
      reason: 'Calibrating — your first session sets your baseline. Progression starts next session.',
      nextBand: 'easy',
      goal: 'add_reps',
      debug: {
        hitThreshold,
        setsAtTopRange: setsAtTop,
        totalSets: workSets.length,
        hitPercent,
        maxRpe,
        avgRpe,
        baseWeightKg,
        incrementKg: 0,
        workingSetCount: workSets.length,
        branch: 'calibration',
        isCalibrating: true,
        isDeloadWeek: false,
        blitzMode,
      },
    };
  }

  // ── Step 2: Blitz Mode forces Extreme band ────────────────────────────────
  const activeBand: DifficultyBand = blitzMode ? 'extreme' : currentBand;

  // ── Step 3: Deload week (auto, every 4th week, disabled in Blitz Mode) ───
  if (deloadWeek && !blitzMode) {
    const deloadWeightKg = getDeloadWeight(baseWeightKg);
    const incrementKg = INCREMENTS[overloadCategory][activeBand];
    const nextWeightKg = roundToIncrement(deloadWeightKg, incrementKg);
    const nextWeightLb = roundToGymPrecision(nextWeightKg * LB_PER_KG);

    if (__DEV__) {
      console.log('[Progression] Deload week — weight reduced to 50%.');
    }

    return {
      action: 'deload',
      nextWeightKg,
      nextWeightLb,
      nextRepTarget: repRangeLow,
      repRangeLow,
      repRangeHigh,
      reason: 'This is your deload week. Weight reduced to 50% to allow full recovery.',
      nextBand: currentBand, // band never changes during a deload week
      goal: 'reduce_load',
      debug: {
        hitThreshold,
        setsAtTopRange: setsAtTop,
        totalSets: workSets.length,
        hitPercent,
        maxRpe,
        avgRpe,
        baseWeightKg,
        incrementKg,
        workingSetCount: workSets.length,
        branch: 'deload_week',
        isCalibrating: false,
        isDeloadWeek: true,
        blitzMode,
      },
    };
  }

  // ── Step 4: Evaluate rep performance and update band ─────────────────────
  let newConsecutiveSuccess = consecutiveSuccess;
  let newConsecutiveFailure = consecutiveFailure;

  if (hitThreshold) {
    newConsecutiveSuccess += 1;
    newConsecutiveFailure = 0;
  } else {
    newConsecutiveFailure += 1;
    newConsecutiveSuccess = 0;
  }

  const nextBand: DifficultyBand = blitzMode
    ? 'extreme'
    : getNextBand(currentBand, newConsecutiveSuccess, newConsecutiveFailure, avgRpeLast3Sessions);

  // ── Step 5: Calculate next weight ────────────────────────────────────────
  const incrementKg = INCREMENTS[overloadCategory][nextBand];

  let action: ProgressionAction;
  let nextWeightKg: number;
  let nextRepTarget: number;
  let reason: string;
  let branch: string;

  if (hitThreshold) {
    action = 'add_weight';
    let rawNextKg = baseWeightKg + incrementKg;

    // Blitz Mode cap: weekly increase cannot exceed 10% of current working weight
    if (blitzMode) {
      const cap = baseWeightKg * 1.10;
      rawNextKg = Math.min(rawNextKg, cap);
    }

    nextWeightKg = roundToIncrement(rawNextKg, incrementKg);
    nextRepTarget = repRangeLow;
    reason = `Hit 70%+ of sets at ${repRangeHigh} reps — weight goes up next session.`;
    branch = blitzMode ? 'blitz_add_weight' : 'hit_threshold_add_weight';
  } else {
    action = 'build_reps';
    // Keep exact base weight — only add_weight and deload round to increment
    nextWeightKg = baseWeightKg;
    nextRepTarget = repRangeHigh;
    reason = `Keep the weight and build to ${repRangeHigh} reps — you haven't earned the increase yet.`;
    branch = 'build_reps';
  }

  const nextWeightLb =
    action === 'build_reps'
      ? baseWeightLb
      : roundToGymPrecision(nextWeightKg * LB_PER_KG);

  const goal: ProgressionDecision['goal'] =
    action === 'add_weight' ? 'add_load' : 'add_reps';

  return {
    action,
    nextWeightKg,
    nextWeightLb,
    nextRepTarget,
    repRangeLow,
    repRangeHigh,
    reason,
    nextBand,
    goal,
    debug: {
      hitThreshold,
      setsAtTopRange: setsAtTop,
      totalSets: workSets.length,
      hitPercent,
      maxRpe,
      avgRpe,
      baseWeightKg,
      incrementKg,
      workingSetCount: workSets.length,
      branch,
      isCalibrating: false,
      isDeloadWeek: deloadWeek,
      blitzMode,
    },
  };
}

// ─── Legacy compatibility ──────────────────────────────────────────────────────

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
      ? 'Deload prescribed — weight reduced to allow recovery.'
      : action === 'add_weight'
        ? 'Sets hit the 70% threshold — load increases.'
        : 'Keep the weight and build reps to earn the next increase.';

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
      hitThreshold: false,
      setsAtTopRange: 0,
      totalSets: 0,
      hitPercent: 0,
      maxRpe: null,
      avgRpe: null,
      baseWeightKg: nextWeightKg,
      incrementKg: 2.5,
      workingSetCount: 0,
      branch: 'from_prescription',
      isCalibrating: false,
      isDeloadWeek: false,
      blitzMode: false,
    },
  };
}
