/**
 * Audit script for decideNextPrescription (bodybuilding algorithm).
 * Run: npx tsx scripts/test-progression.ts
 */
(globalThis as any).__DEV__ = false;
import {
  decideNextPrescription,
  DifficultyBand,
  OverloadCategory,
} from '../lib/progression/decideNextPrescription';

const LB_PER_KG = 2.2046226218;

interface RunCaseOpts {
  isDeloadWeek?: boolean;
  isCalibrating?: boolean;
  blitzMode?: boolean;
  currentBand?: DifficultyBand;
  overloadCategory?: OverloadCategory;
  consecutiveSuccess?: number;
  consecutiveFailure?: number;
  consecutiveAtTop?: number;
  sessionsAtCurrentWeight?: number;
  sessionsWithoutProgress?: number;
  recentSessionScores?: number[];
  rpeBaseline?: number | null;
  avgRpeLast3Sessions?: number | null;
  avgSessionsPerWeightIncrease?: number | null;
}

interface Expected {
  action: string;
  nextWeightLb?: number;
  nextReps?: number;
  nextConsecutiveAtTop?: number;
  nextSessionsWithoutProgress?: number;
  plateauDetected?: boolean;
  volumeSuggested?: boolean;
  branch?: string;
}

function runCase(
  name: string,
  sets: Array<{ weight: number; reps: number; rpe?: number }>,
  repRangeLow: number,
  repRangeHigh: number,
  currentTargetReps: number,
  opts: RunCaseOpts,
  expected: Expected
) {
  const workingSets = sets.map((s) => ({
    weight: s.weight,
    reps: s.reps,
    rpe: s.rpe ?? null,
    completed: true,
  }));

  const result = decideNextPrescription({
    sets: workingSets,
    repRangeLow,
    repRangeHigh,
    currentTargetReps,
    overloadCategory: opts.overloadCategory ?? 'compound_small',
    currentBand: opts.currentBand ?? 'easy',
    consecutiveSuccess: opts.consecutiveSuccess ?? 0,
    consecutiveFailure: opts.consecutiveFailure ?? 0,
    consecutiveAtTop: opts.consecutiveAtTop,
    isCalibrating: opts.isCalibrating ?? false,
    isDeloadWeek: opts.isDeloadWeek ?? false,
    blitzMode: opts.blitzMode ?? false,
    sessionsAtCurrentWeight: opts.sessionsAtCurrentWeight,
    sessionsWithoutProgress: opts.sessionsWithoutProgress,
    recentSessionScores: opts.recentSessionScores,
    rpeBaseline: opts.rpeBaseline,
    avgRpeLast3Sessions: opts.avgRpeLast3Sessions,
    avgSessionsPerWeightIncrease: opts.avgSessionsPerWeightIncrease,
  });

  const nextWeightLb = result ? Math.round(result.nextWeightLb * 1000) / 1000 : null;

  let pass = result != null && result.action === expected.action;
  if (pass && expected.nextWeightLb != null) pass = Math.abs(nextWeightLb! - expected.nextWeightLb) < 0.001;
  if (pass && expected.nextReps != null) pass = result!.nextRepTarget === expected.nextReps;
  if (pass && expected.nextConsecutiveAtTop != null) pass = result!.nextConsecutiveAtTop === expected.nextConsecutiveAtTop;
  if (pass && expected.nextSessionsWithoutProgress != null) pass = result!.nextSessionsWithoutProgress === expected.nextSessionsWithoutProgress;
  if (pass && expected.plateauDetected != null) pass = result!.debug.plateauDetected === expected.plateauDetected;
  if (pass && expected.volumeSuggested != null) pass = result!.debug.volumeSuggested === expected.volumeSuggested;
  if (pass && expected.branch != null) pass = result!.debug.branch === expected.branch;

  const status = pass ? '✓ PASS' : '✗ FAIL';
  console.log(`${status}  ${name}`);
  if (!pass) {
    console.log('  Expected:', expected);
    console.log('  Got:     ', result ? {
      action: result.action,
      nextWeightLb,
      nextRepTarget: result.nextRepTarget,
      nextConsecutiveAtTop: result.nextConsecutiveAtTop,
      nextSessionsWithoutProgress: result.nextSessionsWithoutProgress,
      plateauDetected: result.debug.plateauDetected,
      volumeSuggested: result.debug.volumeSuggested,
      branch: result.debug.branch,
    } : null);
  }
  return pass;
}

console.log('=== Bodybuilding Progression Engine Audit ===\n');

// ── Core cursor / rep advance ─────────────────────────────────────────────────

const caseA = runCase(
  'A: hit target 10 → +1 rep',
  [{ weight: 135, reps: 10, rpe: 8 }, { weight: 135, reps: 10, rpe: 8 }, { weight: 135, reps: 10, rpe: 8.5 }],
  8, 12, 10, {},
  { action: 'build_reps', nextWeightLb: 135, nextReps: 11 }
);

const caseB = runCase(
  'B: hit target (kg weight), unchanged',
  [{ weight: 60 * LB_PER_KG, reps: 10, rpe: 8 }, { weight: 60 * LB_PER_KG, reps: 10, rpe: 8 }, { weight: 60 * LB_PER_KG, reps: 10, rpe: 8.5 }],
  8, 12, 10, {},
  { action: 'build_reps', nextWeightLb: 60 * LB_PER_KG, nextReps: 11 }
);

const caseD = runCase(
  'D: deload week → weight reduces',
  [{ weight: 135, reps: 7, rpe: 8.5 }, { weight: 135, reps: 7, rpe: 9 }, { weight: 135, reps: 8, rpe: 9 }],
  8, 12, 8, { isDeloadWeek: true },
  { action: 'deload' }
);

const caseE = runCase(
  'E: narrow range (10–12) caps at +1',
  [{ weight: 100, reps: 11, rpe: 8 }, { weight: 100, reps: 11, rpe: 8 }, { weight: 100, reps: 11, rpe: 8 }],
  10, 12, 10, {},
  { action: 'build_reps', nextWeightLb: 100, nextReps: 11 }
);

const caseF = runCase(
  'F: +2 jump — 8–12 range, overshoot',
  [{ weight: 135, reps: 9, rpe: 8 }, { weight: 135, reps: 9, rpe: 8 }, { weight: 135, reps: 9, rpe: 8 }, { weight: 135, reps: 10, rpe: 8.5 }],
  8, 12, 8, {},
  { action: 'build_reps', nextWeightLb: 135, nextReps: 10 }
);

const caseG = runCase(
  'G: +3 jump — 6–12 range, bottom overshoot',
  [{ weight: 185, reps: 8, rpe: 8 }, { weight: 185, reps: 8, rpe: 8 }, { weight: 185, reps: 8, rpe: 8 }, { weight: 185, reps: 9, rpe: 8.5 }],
  6, 12, 6, {},
  { action: 'build_reps', nextWeightLb: 185, nextReps: 9 }
);

const caseH = runCase(
  'H: outlier set blocked — 6/6/6/12 → +1 only',
  [{ weight: 185, reps: 6 }, { weight: 185, reps: 6 }, { weight: 185, reps: 6 }, { weight: 185, reps: 12 }],
  6, 12, 6, {},
  { action: 'build_reps', nextWeightLb: 185, nextReps: 7 }
);

// ── Weight gate (2-session confirm-top) ───────────────────────────────────────

const caseC1 = runCase(
  'C1: first hit at top → confirm_top (not add_weight yet)',
  [{ weight: 135, reps: 12 }, { weight: 135, reps: 12 }, { weight: 135, reps: 12 }],
  8, 12, 12, { consecutiveAtTop: 0 },
  { action: 'build_reps', nextReps: 12, nextConsecutiveAtTop: 1, branch: 'confirm_top' }
);

const caseC2 = runCase(
  'C2: second hit at top → add_weight, reset to low',
  [{ weight: 135, reps: 12 }, { weight: 135, reps: 12 }, { weight: 135, reps: 12 }],
  8, 12, 12, { consecutiveAtTop: 1 },
  { action: 'add_weight', nextReps: 8 }
);

// ── Calibration ───────────────────────────────────────────────────────────────

const caseCalib = runCase(
  'Calib: first session → calibrate, no increment',
  [{ weight: 100, reps: 10 }, { weight: 100, reps: 10 }, { weight: 100, reps: 10 }],
  8, 12, 8, { isCalibrating: true },
  { action: 'calibrate', nextWeightLb: 100, nextReps: 8 }
);

// ── Grace period ──────────────────────────────────────────────────────────────

const caseGrace = runCase(
  'Grace: miss at new weight (session 0) → no plateau increment',
  [{ weight: 135, reps: 6 }, { weight: 135, reps: 6 }, { weight: 135, reps: 6 }],
  8, 12, 8, { sessionsAtCurrentWeight: 0, sessionsWithoutProgress: 0 },
  { action: 'build_reps', nextReps: 8, nextSessionsWithoutProgress: 0, branch: 'grace_period' }
);

const casePostGrace = runCase(
  'PostGrace: miss after grace (session 2) → plateau counter starts',
  [{ weight: 135, reps: 6 }, { weight: 135, reps: 6 }, { weight: 135, reps: 6 }],
  8, 12, 8, { sessionsAtCurrentWeight: 2, sessionsWithoutProgress: 0 },
  { action: 'build_reps', nextReps: 8, nextSessionsWithoutProgress: 1, branch: 'hold_cursor' }
);

// ── Plateau detection (#12) ───────────────────────────────────────────────────

const casePlateau = runCase(
  'Plateau: SWP=2 miss → SWP=3, plateauDetected',
  [{ weight: 135, reps: 6 }, { weight: 135, reps: 6 }, { weight: 135, reps: 6 }],
  8, 12, 8, { sessionsAtCurrentWeight: 5, sessionsWithoutProgress: 2 },
  { action: 'build_reps', nextSessionsWithoutProgress: 3, plateauDetected: true, volumeSuggested: false }
);

// ── Volume suggestion (#8) ────────────────────────────────────────────────────

const caseVolume = runCase(
  'Volume: SWP=3 miss → SWP=4, volumeSuggested',
  [{ weight: 135, reps: 6 }, { weight: 135, reps: 6 }, { weight: 135, reps: 6 }],
  8, 12, 8, { sessionsAtCurrentWeight: 5, sessionsWithoutProgress: 3 },
  { action: 'build_reps', nextSessionsWithoutProgress: 4, plateauDetected: true, volumeSuggested: true }
);

// ── RPE delta modifier (#5) ───────────────────────────────────────────────────

const caseRpeDeltaStruggle = runCase(
  'RPE delta: struggling (+2 over baseline) → cap at +1',
  // session avgRpe ≈ 10, baseline 8 → delta +2 > 1 → cap at +1
  [{ weight: 135, reps: 10, rpe: 10 }, { weight: 135, reps: 10, rpe: 10 }, { weight: 135, reps: 10, rpe: 10 }],
  6, 12, 8, { rpeBaseline: 8 },
  { action: 'build_reps', nextReps: 9 }  // +1 only (not +2 which data would otherwise give)
);

const caseRpeDeltaCruise = runCase(
  'RPE delta: cruising (−3 under baseline) → bonus +1 on top of +2 base',
  // sets 9/9/9 @ target 8: delta=1, width=6 → base +2; cruising bonus → +3; nextReps=11
  [{ weight: 135, reps: 9, rpe: 5 }, { weight: 135, reps: 9, rpe: 5 }, { weight: 135, reps: 9, rpe: 5 }],
  6, 12, 8, { rpeBaseline: 8 },
  { action: 'build_reps', nextReps: 11 }  // +2 base + cruising bonus = +3 → 8+3=11
);

// ── Intra-session fatigue (#6) ────────────────────────────────────────────────

const caseFatigue = runCase(
  'Fatigue: reps drop >25% set1→last → cap at +1',
  // 12 → 8: drop of 33% → fatigued → +1 even though range would allow +2
  [{ weight: 135, reps: 12 }, { weight: 135, reps: 10 }, { weight: 135, reps: 8 }],
  6, 12, 8, {},
  { action: 'build_reps', nextReps: 9 }  // +1 only
);

// ── Blitz mode ────────────────────────────────────────────────────────────────

const caseBlitz = runCase(
  'Blitz: first hit at top → add_weight immediately (no 2-session gate)',
  [{ weight: 135, reps: 12 }, { weight: 135, reps: 12 }, { weight: 135, reps: 12 }],
  8, 12, 12, { blitzMode: true, consecutiveAtTop: 0 },
  { action: 'add_weight', nextReps: 8 }
);

// ── RPE band accelerator ──────────────────────────────────────────────────────

const caseRpeAccel = runCase(
  'RPE accelerator: avgRpeLast3 < 6 → bump band (reflected in increment)',
  // With avgRpeLast3=5, band bumps from easy to medium. Not add_weight but next band is medium.
  [{ weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 10 }],
  8, 12, 10, { avgRpeLast3Sessions: 5, currentBand: 'easy' },
  { action: 'build_reps', nextReps: 11 }
);

// ── Miss resets SWP when progress made ───────────────────────────────────────

const caseSWPReset = runCase(
  'SWP reset: cursor advances → SWP resets to 0',
  [{ weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 10 }],
  8, 12, 10, { sessionsWithoutProgress: 3 },
  { action: 'build_reps', nextSessionsWithoutProgress: 0 }
);

// ─────────────────────────────────────────────────────────────────────────────

const cases: Record<string, boolean> = {
  'A (hit target +1)': caseA,
  'B (weight unchanged)': caseB,
  'D (deload)': caseD,
  'E (narrow range +1)': caseE,
  'F (+2 jump)': caseF,
  'G (+3 jump)': caseG,
  'H (outlier blocked)': caseH,
  'C1 (confirm_top)': caseC1,
  'C2 (add_weight)': caseC2,
  'Calibration': caseCalib,
  'Grace period': caseGrace,
  'Post-grace miss': casePostGrace,
  'Plateau detection': casePlateau,
  'Volume suggestion': caseVolume,
  'RPE struggling': caseRpeDeltaStruggle,
  'RPE cruising': caseRpeDeltaCruise,
  'Intra fatigue': caseFatigue,
  'Blitz mode': caseBlitz,
  'RPE accelerator': caseRpeAccel,
  'SWP reset on progress': caseSWPReset,
};

const passed = Object.values(cases).filter(Boolean).length;
const total = Object.values(cases).length;

console.log(`\n=== Summary: ${passed}/${total} passed ===`);
const allPass = passed === total;
if (!allPass) {
  const failed = Object.entries(cases).filter(([, v]) => !v).map(([k]) => k);
  console.log('Failed:', failed.join(', '));
}

process.exit(allPass ? 0 : 1);
