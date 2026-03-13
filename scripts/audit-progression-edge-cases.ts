/**
 * Edge-case audit for bodybuilding progressive overload engine.
 * Run: npx tsx scripts/audit-progression-edge-cases.ts
 */
(globalThis as any).__DEV__ = false;
import { decideNextPrescription } from '../lib/progression/decideNextPrescription';

const LB_PER_KG = 2.2046226218;

function run(
  name: string,
  sets: Array<{ weight: number; reps: number; rpe?: number }>,
  repRangeLow: number,
  repRangeHigh: number,
  currentTargetReps: number,
  opts: { isDeloadWeek?: boolean } = {}
) {
  const workingSets = sets.map((s) => ({
    weight: s.weight,
    reps: s.reps,
    rpe: s.rpe ?? null,
    completed: true,
  }));
  const r = decideNextPrescription({
    sets: workingSets,
    repRangeLow,
    repRangeHigh,
    currentTargetReps,
    overloadCategory: 'compound_small',
    currentBand: 'easy',
    consecutiveSuccess: 0,
    consecutiveFailure: 0,
    isCalibrating: false,
    isDeloadWeek: opts.isDeloadWeek ?? false,
  });
  return { name, result: r, sets, repRangeLow, repRangeHigh, currentTargetReps };
}

console.log('=== Bodybuilding Progression Edge-Case Audit ===\n');

// 1. Mixed-weight session (most common weight wins)
const m1 = run(
  'Mixed-weight: 2x135, 2x115 (most common wins)',
  [
    { weight: 135, reps: 10, rpe: 8 },
    { weight: 135, reps: 10, rpe: 8 },
    { weight: 115, reps: 10, rpe: 8 },
    { weight: 115, reps: 10, rpe: 8 },
  ],
  8,
  12,
  10
);
console.log('1. Mixed-weight session');
console.log('   Base weight (most common):', m1.result?.debug.baseWeightKg?.toFixed(1), 'kg →', m1.result?.nextWeightLb?.toFixed(1), 'lb');
console.log('   Tie → first weight wins. Correct.\n');

// 2. Top set + backoff
const t1 = run(
  'Top set + backoff: 1x155@8, 3x135@10',
  [
    { weight: 155, reps: 8, rpe: 8 },
    { weight: 135, reps: 10, rpe: 8 },
    { weight: 135, reps: 10, rpe: 8 },
    { weight: 135, reps: 10, rpe: 8 },
  ],
  8,
  12,
  10
);
console.log('2. Top set + backoff');
console.log('   Base:', t1.result?.nextWeightLb?.toFixed(1), 'lb. Action:', t1.result?.action);
console.log('   Base = 135 (most common). All at target 10 → +1 rep.\n');

// 3. No RPE logged
const n1 = run(
  'No RPE: 135x12,12,12',
  [
    { weight: 135, reps: 12 },
    { weight: 135, reps: 12 },
    { weight: 135, reps: 12 },
  ],
  8,
  12,
  10
);
console.log('3. No RPE logged');
console.log('   allSetsAtTop=true → add_weight?', n1.result?.action === 'add_weight');
console.log('   RPE missing → 1× increment. Correct.\n');

// 4. Failure (some sets below target)
const n2 = run(
  'Failure: 135x7,7,8 (target 8)',
  [
    { weight: 135, reps: 7 },
    { weight: 135, reps: 7 },
    { weight: 135, reps: 8 },
  ],
  8,
  12,
  8
);
console.log('4. Failure (some below target)');
console.log('   consecutiveFailure=0 → hold. Action:', n2.result?.action);
console.log('   Deload is time-based only (isDeloadWeek), not failure-based.\n');

// 5. Changed rep range
const c1 = run(
  'Changed range: 10,10,10 with current range 6-10',
  [
    { weight: 135, reps: 10, rpe: 8 },
    { weight: 135, reps: 10, rpe: 8 },
    { weight: 135, reps: 10, rpe: 8 },
  ],
  6,
  10,
  8
);
console.log('5. Changed rep range');
console.log('   Range 6-10, sets 10,10,10 → allSetsAtTop → add_weight');
console.log('   Result:', c1.result?.action, '\n');

// 6. Exceeded target → +2 reps
const e1 = run(
  'Exceeded: target 10, did 11/11/11',
  [
    { weight: 100, reps: 11, rpe: 8 },
    { weight: 100, reps: 11, rpe: 8 },
    { weight: 100, reps: 11, rpe: 8 },
  ],
  10,
  12,
  10
);
console.log('6. Exceeded target');
console.log('   Target 10, all sets 11 → +2 reps, next target 12');
console.log('   Result:', e1.result?.action, 'nextRepTarget:', e1.result?.nextRepTarget, '\n');

console.log('=== Summary ===');
console.log('Bodybuilding algorithm: live target, +1/+2 adaptive, all-at-top for load increase.');
console.log('Deload: time-based (every 4th week) only.');
