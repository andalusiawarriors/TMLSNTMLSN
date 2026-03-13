/**
 * Audit script for decideNextPrescription (bodybuilding algorithm).
 * Run: npx tsx scripts/test-progression.ts
 */
(globalThis as any).__DEV__ = true;
import { decideNextPrescription } from '../lib/progression/decideNextPrescription';

const LB_PER_KG = 2.2046226218;

function runCase(
  name: string,
  sets: Array<{ weight: number; reps: number; rpe?: number }>,
  repRangeLow: number,
  repRangeHigh: number,
  currentTargetReps: number,
  opts: { isDeloadWeek?: boolean; isCalibrating?: boolean },
  expected: { action: string; nextWeightLb?: number; nextReps?: number }
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
    overloadCategory: 'compound_small',
    currentBand: 'easy',
    consecutiveSuccess: 0,
    consecutiveFailure: 0,
    isCalibrating: opts.isCalibrating ?? false,
    isDeloadWeek: opts.isDeloadWeek ?? false,
  });

  const nextWeightLb = result ? Math.round(result.nextWeightLb * 1000) / 1000 : null;
  const pass =
    result &&
    result.action === expected.action &&
    (expected.nextWeightLb == null || Math.abs(nextWeightLb! - expected.nextWeightLb) < 0.001) &&
    (expected.nextReps == null || result.nextRepTarget === expected.nextReps);

  console.log(`\n--- ${name} ---`);
  console.log('Input:', { sets, repRangeLow, repRangeHigh, currentTargetReps, opts });
  console.log('Expected:', expected);
  console.log('Result:', result ? { action: result.action, nextWeightLb, nextRepTarget: result.nextRepTarget } : null);
  console.log('PASS:', pass);
  return pass;
}

console.log('=== Bodybuilding Progression Engine Audit ===\n');

// Case A: 10/10/10 @ 8-12, target 10 → +1 rep, next target 11
const caseA = runCase(
  'Case A (hit target 10 → +1 rep)',
  [
    { weight: 135, reps: 10, rpe: 8 },
    { weight: 135, reps: 10, rpe: 8 },
    { weight: 135, reps: 10, rpe: 8.5 },
  ],
  8,
  12,
  10,
  {},
  { action: 'build_reps', nextWeightLb: 135, nextReps: 11 }
);

// Case B: 10/10/10 @ 8-12, target 10, 60 kg → same
const caseB = runCase(
  'Case B (hit target, weight unchanged)',
  [
    { weight: 60 * LB_PER_KG, reps: 10, rpe: 8 },
    { weight: 60 * LB_PER_KG, reps: 10, rpe: 8 },
    { weight: 60 * LB_PER_KG, reps: 10, rpe: 8.5 },
  ],
  8,
  12,
  10,
  {},
  { action: 'build_reps', nextWeightLb: 60 * LB_PER_KG, nextReps: 11 }
);

// Case C: 12/12/12 @ 8-12 → all at top → add weight, reset to 8
const caseC = runCase(
  'Case C (all at top → add weight)',
  [
    { weight: 135, reps: 12, rpe: 8 },
    { weight: 135, reps: 12, rpe: 8 },
    { weight: 135, reps: 12, rpe: 8.5 },
  ],
  8,
  12,
  10,
  {},
  { action: 'add_weight', nextReps: 8 }
);

// Case D: deload week → weight reduces
const caseD = runCase(
  'Case D (deload week)',
  [
    { weight: 135, reps: 7, rpe: 8.5 },
    { weight: 135, reps: 7, rpe: 9 },
    { weight: 135, reps: 8, rpe: 9 },
  ],
  8,
  12,
  8,
  { isDeloadWeek: true },
  { action: 'deload' }
);

// Case E: 11/11/11 @ 10-12, target 10 → hit target → +1 rep (width 2 caps at +1)
const caseE = runCase(
  'Case E (hit target → +1 rep)',
  [
    { weight: 100, reps: 11, rpe: 8 },
    { weight: 100, reps: 11, rpe: 8 },
    { weight: 100, reps: 11, rpe: 8 },
  ],
  10,
  12,
  10,
  {},
  { action: 'build_reps', nextWeightLb: 100, nextReps: 11 }
);

// Phase 2: 8–12 (width 4), target 8, 9/9/9/10 → avg 9.25 >= 9 → +2 → next 10
const caseF = runCase(
  'Case F (Phase 2 +2 jump: 8–12, overshoot)',
  [
    { weight: 135, reps: 9, rpe: 8 },
    { weight: 135, reps: 9, rpe: 8 },
    { weight: 135, reps: 9, rpe: 8 },
    { weight: 135, reps: 10, rpe: 8.5 },
  ],
  8,
  12,
  8,
  {},
  { action: 'build_reps', nextWeightLb: 135, nextReps: 10 }
);

// Phase 2: 6–12 (width 6), target 6, 8/8/8/9 → 4 sets at 8+, avg 8.25 → +3 → next 9
const caseG = runCase(
  'Case G (Phase 2 +3 jump: 6–12, bottom overshoot)',
  [
    { weight: 185, reps: 8, rpe: 8 },
    { weight: 185, reps: 8, rpe: 8 },
    { weight: 185, reps: 8, rpe: 8 },
    { weight: 185, reps: 9, rpe: 8.5 },
  ],
  6,
  12,
  6,
  {},
  { action: 'build_reps', nextWeightLb: 185, nextReps: 9 }
);

// Audit tightening: 6/6/6/12 — only 1 set at target+1 (7); +2 guard blocks outlier-driven jump → +1
const caseH = runCase(
  'Case H (Audit: 6/6/6/12 outlier blocked → +1)',
  [
    { weight: 185, reps: 6, rpe: 8 },
    { weight: 185, reps: 6, rpe: 8 },
    { weight: 185, reps: 6, rpe: 8 },
    { weight: 185, reps: 12, rpe: 9 },
  ],
  6,
  12,
  6,
  {},
  { action: 'build_reps', nextWeightLb: 185, nextReps: 7 }
);

console.log('\n=== Summary ===');
console.log('Case A (hit target +1):', caseA ? 'PASS' : 'FAIL');
console.log('Case B (weight unchanged):', caseB ? 'PASS' : 'FAIL');
console.log('Case C (add weight):', caseC ? 'PASS' : 'FAIL');
console.log('Case D (deload):', caseD ? 'PASS' : 'FAIL');
console.log('Case E (hit target +1):', caseE ? 'PASS' : 'FAIL');
console.log('Case F (Phase 2 +2):', caseF ? 'PASS' : 'FAIL');
console.log('Case G (Phase 2 +3):', caseG ? 'PASS' : 'FAIL');
console.log('Case H (Audit outlier blocked):', caseH ? 'PASS' : 'FAIL');
console.log('All pass:', caseA && caseB && caseC && caseD && caseE && caseF && caseG && caseH);

process.exit(caseA && caseB && caseC && caseD && caseE && caseF && caseG && caseH ? 0 : 1);
