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
 *  - Rolling session score (item #10): 3-session hit-% avg smooths band decisions
 *  - Performance trend (item #11): linear slope of recent scores surfaces improvement / decline
 *  - Plateau detection (item #12): 3+ consecutive genuine misses → plateauDetected flag
 *  - Volume suggestion (item #8): 4+ sessions stuck → suggest adding a set in reason
 *  - Velocity memory (item #9): EMA of sessions-per-weight-step per exercise
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
  /**
   * Updated sessions-at-current-weight counter.
   * Reset to 0 on weight increase, incremented each session otherwise.
   */
  nextSessionsAtCurrentWeight: number;
  /**
   * Rolling window of the last ≤3 session hit-% scores (0.0–1.0).
   * Used for rolling avg score (#10) and performance trend (#11).
   */
  nextRecentSessionScores: number[];
  /**
   * Consecutive genuine misses (hold_cursor branch, excluding grace and confirm_top).
   * ≥3 → plateau; ≥4 → volume suggestion (#8). Reset on any progress or weight increase.
   */
  nextSessionsWithoutProgress: number;
  /**
   * EMA (α=0.3) of sessions needed per weight step for this exercise.
   * Updated on every weight increase. NULL until first increment. Velocity memory (#9).
   */
  nextAvgSessionsPerWeightIncrease: number | null;
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
    intraSessionFatigue: boolean;
    /** Raw hit-% for this session (0.0–1.0). */
    sessionScore: number;
    /** Rolling avg of recent session scores (null = < 2 sessions of history). */
    rollingAvgScore: number | null;
    /** Linear slope of recent scores: positive = improving, negative = declining. */
    performanceTrend: number | null;
    /** TRUE when sessionsWithoutProgress ≥ 3 — user is genuinely plateaued. */
    plateauDetected: boolean;
    /** TRUE when sessionsWithoutProgress ≥ 4 — engine is suggesting adding a set. */
    volumeSuggested: boolean;
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
  /**
   * Sessions completed at the current working weight since the last weight increase.
   * During the grace period (< GRACE_SESSIONS), a miss does NOT increment consecutiveFailure
   * and the band cannot drop — the user is still adapting to the new load.
   * Defaults to 0 (no grace protection) for existing exercises.
   */
  sessionsAtCurrentWeight?: number;
  /**
   * Rolling window of the last ≤3 session hit-% scores (0.0–1.0).
   * [] = no history yet. Appended each session and trimmed to 3.
   * Used for rolling avg score (item #10) and performance trend (item #11).
   */
  recentSessionScores?: number[];
  /**
   * Consecutive sessions where the rep cursor did not advance (genuine miss, not grace).
   * ≥3 → plateauDetected; ≥4 → volume suggestion (#8/#12).
   * Defaults to 0.
   */
  sessionsWithoutProgress?: number;
  /**
   * EMA (α=0.3) of sessions-to-weight-increase for this exercise.
   * Updated on add_weight. NULL = no weight increase yet. Velocity memory (#9).
   */
  avgSessionsPerWeightIncrease?: number | null;
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
 * Intra-session fatigue (item #6):
 *  reps dropped >25% from set 1 to last → cap at +1 (user didn't recover between sets)
 *
 * Always capped by getMaxJumpForRangeWidth.
 */
export function computeAdaptiveJump(
  workSets: WorkingSet[],
  effectiveTarget: number,
  repRangeLow: number,
  repRangeHigh: number,
  rpeDelta?: number | null,
  intraSessionFatigue?: boolean,
): number {
  const rangeWidth = repRangeHigh - repRangeLow;
  const maxJump = getMaxJumpForRangeWidth(rangeWidth);

  // RPE struggling guard: if this session is noticeably harder than baseline, be conservative.
  if (rpeDelta != null && rpeDelta > 1) return 1;

  // Intra-session fatigue guard: significant rep drop means recovery is incomplete.
  if (intraSessionFatigue) return 1;

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

// ─── Intra-session fatigue detection ──────────────────────────────────────────

/**
 * Detects meaningful rep drop across a session — a proxy for under-recovery.
 * TRUE when reps in the last working set are >25% lower than the first working set.
 * Requires at least 2 sets.
 *
 * Used as a conservative modifier in computeAdaptiveJump:
 *   if fatigued → cap adaptive jump at +1 even if rep signal says +2/+3.
 *
 * Note: only considers same-weight sets (mixed-weight drop-sets are excluded).
 */
export function detectIntraSessionFatigue(workSets: WorkingSet[]): boolean {
  if (workSets.length < 2) return false;
  const firstReps = workSets[0].reps;
  if (firstReps <= 0) return false;
  const lastReps = workSets[workSets.length - 1].reps;
  return lastReps < firstReps * 0.75; // >25% drop
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

  // Intra-session fatigue: reps dropped >25% from set 1 to last set.
  const intraSessionFatigue = detectIntraSessionFatigue(workSets);

  // How many sets hit the top of the absolute rep range (for debug/display).
  const setsAtTop = workSets.filter((s) => s.reps >= repRangeHigh).length;
  // How many sets hit the current target cursor (drives progression decisions).
  const setsAtCurrentTarget = workSets.filter((s) => s.reps >= effectiveTarget).length;
  const hitPercent = workSets.length > 0 ? setsAtCurrentTarget / workSets.length : 0;
  // Did the user hit their current target? (70%+ of sets at effectiveTarget)
  const hitThreshold = didHitRepThreshold(workSets, effectiveTarget);
  // Is the cursor already at the top of the range? If so, hitting it means: add weight.
  const atTopOfRange = effectiveTarget >= repRangeHigh;

  // ── Multi-session scoring (items #10, #11, #12) ───────────────────────────
  // sessionScore: raw hit-% for this session (identical to hitPercent but named explicitly).
  const sessionScore = hitPercent;

  // Rolling window: append this session's score and keep the last 3.
  const prevScores = input.recentSessionScores ?? [];
  const nextRecentSessionScores = [...prevScores, sessionScore].slice(-3);

  // Rolling avg: average of the last ≤3 session scores.
  // < 2 data points → too noisy to be meaningful, return null.
  const rollingAvgScore = nextRecentSessionScores.length >= 2
    ? nextRecentSessionScores.reduce((a, b) => a + b, 0) / nextRecentSessionScores.length
    : null;

  // Performance trend: linear slope of recent scores, (last − first) / (n − 1).
  // Positive = improving, negative = declining. null when < 2 data points.
  const performanceTrend = nextRecentSessionScores.length >= 2
    ? (nextRecentSessionScores[nextRecentSessionScores.length - 1] - nextRecentSessionScores[0]) /
      (nextRecentSessionScores.length - 1)
    : null;

  // Plateau and volume counters — resolved per branch below.
  const currentSWP = input.sessionsWithoutProgress ?? 0;
  const currentAvgSPWI = input.avgSessionsPerWeightIncrease ?? null;

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
      nextSessionsAtCurrentWeight: 0,
      nextRecentSessionScores: [],
      nextSessionsWithoutProgress: 0,
      nextAvgSessionsPerWeightIncrease: null,
      goal: 'add_reps',
      debug: {
        hitThreshold,
        setsAtTopRange: setsAtTop,
        totalSets: workSets.length,
        hitPercent,
        maxRpe,
        avgRpe,
        rpeDelta,
        intraSessionFatigue,
        sessionScore,
        rollingAvgScore,
        performanceTrend,
        plateauDetected: false,
        volumeSuggested: false,
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
      nextSessionsAtCurrentWeight: (input.sessionsAtCurrentWeight ?? 0) + 1,
      nextRecentSessionScores, // record the deload session score
      nextSessionsWithoutProgress: 0, // deload resets the plateau counter
      nextAvgSessionsPerWeightIncrease: currentAvgSPWI,
      goal: 'reduce_load',
      debug: {
        hitThreshold,
        setsAtTopRange: setsAtTop,
        totalSets: workSets.length,
        hitPercent,
        maxRpe,
        avgRpe,
        rpeDelta,
        intraSessionFatigue,
        sessionScore,
        rollingAvgScore,
        performanceTrend,
        plateauDetected: false,
        volumeSuggested: false,
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
  const currentSessionsAtWeight = input.sessionsAtCurrentWeight ?? 0;
  // Grace period: first 2 sessions at a new weight are adaptation sessions.
  // Misses during grace don't count as failures (band can't drop, counter unchanged).
  const GRACE_SESSIONS = 2;
  const inGracePeriod = currentSessionsAtWeight < GRACE_SESSIONS;

  let newConsecutiveSuccess = consecutiveSuccess;
  let newConsecutiveFailure = consecutiveFailure;

  if (hitThreshold) {
    newConsecutiveSuccess += 1;
    newConsecutiveFailure = 0;
  } else if (!inGracePeriod) {
    // Only penalise misses outside the grace window
    newConsecutiveFailure += 1;
    newConsecutiveSuccess = 0;
  }
  // (during grace: leave both counters unchanged on a miss)

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
  let nextSessionsAtCurrentWeight: number;
  let nextSessionsWithoutProgress: number;
  let nextAvgSessionsPerWeightIncrease: number | null;
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
    nextSessionsAtCurrentWeight = 0; // reset: new weight starts a fresh grace window
    nextSessionsWithoutProgress = 0; // weight increased — progress made, reset plateau counter
    // Velocity memory (#9): EMA of sessions needed to earn each weight step.
    nextAvgSessionsPerWeightIncrease = currentAvgSPWI == null
      ? currentSessionsAtWeight
      : currentAvgSPWI * 0.7 + currentSessionsAtWeight * 0.3;
    reason = `Hit ${repRangeHigh} reps for ${WEIGHT_GATE} sessions in a row — weight goes up next session.`;
    branch = blitzMode ? 'blitz_add_weight' : 'hit_top_add_weight';
  } else if (hitThreshold && atTopOfRange) {
    // Hit the top but need one more session to confirm — hold weight at repRangeHigh.
    action = 'build_reps';
    nextWeightKg = baseWeightKg;
    nextRepTarget = repRangeHigh;
    nextConsecutiveAtTop = currentConsecutiveAtTop + 1;
    nextSessionsAtCurrentWeight = currentSessionsAtWeight + 1;
    nextSessionsWithoutProgress = 0; // confirm_top is on-track, not a plateau
    nextAvgSessionsPerWeightIncrease = currentAvgSPWI;
    reason = `Hit ${repRangeHigh} reps — do it again next session to earn the weight increase.`;
    branch = 'confirm_top';
  } else if (hitThreshold) {
    // Hit current target but not yet at top — advance the cursor adaptively.
    action = 'build_reps';
    nextWeightKg = baseWeightKg;
    const jump = computeAdaptiveJump(workSets, effectiveTarget, repRangeLow, repRangeHigh, rpeDelta, intraSessionFatigue);
    nextRepTarget = Math.min(effectiveTarget + jump, repRangeHigh);
    nextConsecutiveAtTop = 0;
    nextSessionsAtCurrentWeight = currentSessionsAtWeight + 1;
    nextSessionsWithoutProgress = 0; // cursor advanced — not stuck
    nextAvgSessionsPerWeightIncrease = currentAvgSPWI;
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
    nextSessionsAtCurrentWeight = currentSessionsAtWeight + 1;
    nextAvgSessionsPerWeightIncrease = currentAvgSPWI;
    if (inGracePeriod) {
      // Grace period miss: expected adaptation, don't count as plateau.
      nextSessionsWithoutProgress = 0;
      reason = `Adaptation session ${currentSessionsAtWeight + 1}/${GRACE_SESSIONS} at this weight — keep going.`;
      branch = 'grace_period';
    } else {
      // Genuine miss: increment plateau counter (#12).
      nextSessionsWithoutProgress = currentSWP + 1;
      const PLATEAU_THRESHOLD = 3;
      const VOLUME_THRESHOLD = 4;
      if (nextSessionsWithoutProgress >= VOLUME_THRESHOLD) {
        // #8: suggest adding a set to break the plateau.
        reason = `Aim for ${effectiveTarget} reps — you've been stuck here a while. Consider adding 1 extra set next session to build work capacity.`;
      } else if (nextSessionsWithoutProgress >= PLATEAU_THRESHOLD) {
        reason = `Aim for ${effectiveTarget} reps — you're plateauing. Focus on quality reps and make sure recovery is solid.`;
      } else {
        reason = `Aim for ${effectiveTarget} reps — hit 70%+ of sets to advance.`;
      }
      branch = 'hold_cursor';
    }
  }

  const plateauDetected = nextSessionsWithoutProgress >= 3;
  const volumeSuggested = nextSessionsWithoutProgress >= 4;

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
    nextSessionsAtCurrentWeight,
    nextRecentSessionScores,
    nextSessionsWithoutProgress,
    nextAvgSessionsPerWeightIncrease,
    goal,
    debug: {
      hitThreshold,         // true = hit effectiveTarget (drives cursor advance)
      setsAtTopRange: setsAtTop,  // sets that hit absolute repRangeHigh (display only)
      totalSets: workSets.length,
      hitPercent,           // % of sets at effectiveTarget
      maxRpe,
      avgRpe,
      rpeDelta,             // deviation from personal baseline (null = no baseline yet)
      intraSessionFatigue,  // reps dropped >25% from set 1 to last (under-recovery signal)
      sessionScore,         // raw hit-% for this session (= hitPercent, named explicitly)
      rollingAvgScore,      // avg of ≤3 recent scores (null if < 2 sessions)
      performanceTrend,     // slope of recent scores (null if < 2 sessions)
      plateauDetected,      // sessionsWithoutProgress ≥ 3
      volumeSuggested,      // sessionsWithoutProgress ≥ 4 → engine suggested +1 set
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
    nextSessionsAtCurrentWeight: 0,
    nextRecentSessionScores: [],
    nextSessionsWithoutProgress: 0,
    nextAvgSessionsPerWeightIncrease: null,
    goal,
    debug: {
      hitThreshold: false,
      setsAtTopRange: 0,
      totalSets: 0,
      hitPercent: 0,
      maxRpe: null,
      avgRpe: null,
      rpeDelta: null,
      intraSessionFatigue: false,
      sessionScore: 0,
      rollingAvgScore: null,
      performanceTrend: null,
      plateauDetected: false,
      volumeSuggested: false,
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
