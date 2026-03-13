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
 *  - Relative RPE delta: compares session RPE to personal per-exercise baseline (EMA)
 *    rpeDelta > +1 → struggling, cap adaptive jump at +1
 *    rpeDelta < -1 → cruising, add +1 bonus to adaptive jump
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
  /**
   * How many consecutive sessions the cursor has been at repRangeHigh and hit.
   * Weight increases when this reaches 2. Reset to 0 after weight increase or miss.
   */
  nextConsecutiveAtTop: number;
  /** Legacy goal for exercise_progress_state compatibility */
  goal: 'add_load' | 'add_reps' | 'reduce_load';
  debug: {
    hitThreshold: boolean;
    setsAtTopRange: number;
    totalSets: number;
    hitPercent: number;
    maxRpe: number | null;
    avgRpe: number | null;
    rpeDelta: number | null;
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
  /**
   * The current rep cursor — where the user is targeting within the rep range.
   * Persisted as next_target_reps. Defaults to repRangeLow if not provided.
   * The engine advances this by +1 each successful session, only adding weight
   * once the cursor reaches repRangeHigh.
   */
  currentTargetReps?: number;
  /**
   * How many consecutive sessions the cursor has been at repRangeHigh and hit.
   * Weight increases after 2 consecutive such sessions (not just 1).
   * Defaults to 0.
   */
  consecutiveAtTop?: number;
  /**
   * Personal RPE baseline for this exercise — rolling EMA of past session avg RPEs.
   * null = not enough history yet (less than 1 session with RPE data).
   * Used to compute rpeDelta = sessionAvgRpe − rpeBaseline.
   *   rpeDelta > +1 → user is struggling more than usual → cap adaptive jump at +1
   *   rpeDelta < -1 → user is cruising easier than usual → +1 bonus to jump
   */
  rpeBaseline?: number | null;
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

// ─── Adaptive jump ────────────────────────────────────────────────────────────

/**
 * Max jump allowed based on the width of the rep range.
 *  ≤3 wide (e.g. 10–12) → +1 max — range is too narrow to jump faster
 *  4–5 wide (e.g. 8–12)  → +2 max
 *  ≥6 wide (e.g. 6–12)   → +3 max
 */
export function getMaxJumpForRangeWidth(rangeWidth: number): number {
  if (rangeWidth <= 3) return 1;
  if (rangeWidth <= 5) return 2;
  return 3;
}

/**
 * Decide how many reps to advance the cursor this session (+1, +2, or +3).
 *
 * Rules:
 *  +3: avg reps ≥ target+2, range ≥6 wide, ≥3 sets at target+2
 *  +2: avg reps ≥ target+1, range ≥4 wide, ≥2 sets at target+1
 *  +1: default (also forced when workSets < 3)
 *
 * RPE delta modifier (item #5 — relative to personal per-exercise baseline):
 *  rpeDelta > +1  → user is struggling more than usual → cap at +1 regardless of reps
 *  rpeDelta < -1  → user is cruising easier than usual → apply +1 bonus (capped by maxJump)
 *
 * Always capped by getMaxJumpForRangeWidth.
 */
export function computeAdaptiveJump(
  workSets: WorkingSet[],
  effectiveTarget: number,
  repRangeLow: number,
  repRangeHigh: number,
  rpeDelta?: number | null,
): number {
  const rangeWidth = repRangeHigh - repRangeLow;
  const maxJump = getMaxJumpForRangeWidth(rangeWidth);

  // RPE struggling guard: if this session is noticeably harder than baseline, be conservative.
  if (rpeDelta != null && rpeDelta > 1) return 1;

  // Min-set guard: need ≥3 completed work sets to justify a larger jump.
  if (workSets.length < 3) return 1;

  const avgReps = workSets.reduce((sum, s) => sum + s.reps, 0) / workSets.length;
  const delta = avgReps - effectiveTarget;

  let selectedJump = 1;

  // +3: consistently crushed the target across all sets.
  const setsAtTargetPlus2 = workSets.filter((s) => s.reps >= effectiveTarget + 2).length;
  if (delta >= 1.5 && rangeWidth >= 6 && setsAtTargetPlus2 >= 3) {
    selectedJump = 3;
  } else {
    // +2: clearly above target in most sets.
    const setsAtTargetPlus1 = workSets.filter((s) => s.reps >= effectiveTarget + 1).length;
    if (delta >= 0.5 && rangeWidth >= 4 && setsAtTargetPlus1 >= 2) {
      selectedJump = 2;
    }
  }

  // RPE cruising bonus: if this session is noticeably easier than baseline, add +1.
  if (rpeDelta != null && rpeDelta < -1) {
    selectedJump = Math.min(selectedJump + 1, maxJump);
  }

  return Math.min(selectedJump, maxJump);
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

  // Rep cursor: where the user is currently targeting within the range.
  // Defaults to repRangeLow for new exercises / legacy prescriptions.
  const effectiveTarget = Math.min(
    Math.max(input.currentTargetReps ?? repRangeLow, repRangeLow),
    repRangeHigh
  );

  const workSets = sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
  if (workSets.length === 0) return null;

  const baseWeightLb = getBaseWeightLb(workSets);
  const baseWeightKg = baseWeightLb * KG_PER_LB;

  const rpeVals = workSets.map((s) => s.rpe).filter((r): r is number => r != null && r > 0);
  const maxRpe = rpeVals.length > 0 ? Math.max(...rpeVals) : null;
  const avgRpe = rpeVals.length > 0 ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : null;

  // Relative RPE delta: how much harder/easier this session felt vs. personal baseline.
  // Positive = harder than usual, negative = easier than usual.
  const rpeDelta = avgRpe != null && input.rpeBaseline != null
    ? avgRpe - input.rpeBaseline
    : null;

  // How many sets hit the top of the absolute rep range (for debug/display).
  const setsAtTop = workSets.filter((s) => s.reps >= repRangeHigh).length;
  // How many sets hit the current target cursor (drives progression decisions).
  const setsAtCurrentTarget = workSets.filter((s) => s.reps >= effectiveTarget).length;
  const hitPercent = workSets.length > 0 ? setsAtCurrentTarget / workSets.length : 0;
  // Did the user hit their current target? (70%+ of sets at effectiveTarget)
  const hitThreshold = didHitRepThreshold(workSets, effectiveTarget);
  // Is the cursor already at the top of the range? If so, hitting it means: add weight.
  const atTopOfRange = effectiveTarget >= repRangeHigh;

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
      nextConsecutiveAtTop: 0,
      goal: 'add_reps',
      debug: {
        hitThreshold,
        setsAtTopRange: setsAtTop,
        totalSets: workSets.length,
        hitPercent,
        maxRpe,
        avgRpe,
        rpeDelta,
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
      nextConsecutiveAtTop: 0,
      goal: 'reduce_load',
      debug: {
        hitThreshold,
        setsAtTopRange: setsAtTop,
        totalSets: workSets.length,
        hitPercent,
        maxRpe,
        avgRpe,
        rpeDelta,
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

  const currentConsecutiveAtTop = input.consecutiveAtTop ?? 0;
  // Weight increases after 2 consecutive sessions at the top. Blitz skips the gate.
  const WEIGHT_GATE = blitzMode ? 1 : 2;

  let action: ProgressionAction;
  let nextWeightKg: number;
  let nextRepTarget: number;
  let nextConsecutiveAtTop: number;
  let reason: string;
  let branch: string;

  if (hitThreshold && atTopOfRange && currentConsecutiveAtTop + 1 >= WEIGHT_GATE) {
    // Hit the top for WEIGHT_GATE consecutive sessions — add weight, reset everything.
    action = 'add_weight';
    let rawNextKg = baseWeightKg + incrementKg;

    if (blitzMode) {
      const cap = baseWeightKg * 1.10;
      rawNextKg = Math.min(rawNextKg, cap);
    }

    nextWeightKg = roundToIncrement(rawNextKg, incrementKg);
    nextRepTarget = repRangeLow;
    nextConsecutiveAtTop = 0;
    reason = `Hit ${repRangeHigh} reps for ${WEIGHT_GATE} sessions in a row — weight goes up next session.`;
    branch = blitzMode ? 'blitz_add_weight' : 'hit_top_add_weight';
  } else if (hitThreshold && atTopOfRange) {
    // Hit the top but need one more session to confirm — hold weight at repRangeHigh.
    action = 'build_reps';
    nextWeightKg = baseWeightKg;
    nextRepTarget = repRangeHigh;
    nextConsecutiveAtTop = currentConsecutiveAtTop + 1;
    reason = `Hit ${repRangeHigh} reps — do it again next session to earn the weight increase.`;
    branch = 'confirm_top';
  } else if (hitThreshold) {
    // Hit current target but not yet at top — advance the cursor adaptively.
    action = 'build_reps';
    nextWeightKg = baseWeightKg;
    const jump = computeAdaptiveJump(workSets, effectiveTarget, repRangeLow, repRangeHigh, rpeDelta);
    nextRepTarget = Math.min(effectiveTarget + jump, repRangeHigh);
    nextConsecutiveAtTop = 0;
    reason = jump > 1
      ? `Hit ${effectiveTarget} reps comfortably (+${jump}) — aiming for ${nextRepTarget} next session.`
      : `Hit ${effectiveTarget} reps — aiming for ${nextRepTarget} next session.`;
    branch = `advance_cursor_+${jump}`;
  } else {
    // Missed current target — hold the cursor.
    action = 'build_reps';
    nextWeightKg = baseWeightKg;
    nextRepTarget = effectiveTarget;
    nextConsecutiveAtTop = 0;
    reason = `Aim for ${effectiveTarget} reps — hit 70%+ of sets to advance.`;
    branch = 'hold_cursor';
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
    nextConsecutiveAtTop,
    goal,
    debug: {
      hitThreshold,       // true = hit effectiveTarget (drives cursor advance)
      setsAtTopRange: setsAtTop,  // sets that hit absolute repRangeHigh (display only)
      totalSets: workSets.length,
      hitPercent,         // % of sets at effectiveTarget
      maxRpe,
      avgRpe,
      rpeDelta,           // deviation from personal baseline (null = no baseline yet)
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
    nextConsecutiveAtTop: 0,
    goal,
    debug: {
      hitThreshold: false,
      setsAtTopRange: 0,
      totalSets: 0,
      hitPercent: 0,
      maxRpe: null,
      avgRpe: null,
      rpeDelta: null,
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
