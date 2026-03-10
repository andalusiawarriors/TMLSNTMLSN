/**
 * Audit script for decideNextPrescription.
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
  incrementKg: number,
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
    incrementKg,
  });

  const nextWeightLb = result ? Math.round(result.nextWeightLb * 1000) / 1000 : null;
  const pass =
    result &&
    result.action === expected.action &&
    (expected.nextWeightLb == null || Math.abs(nextWeightLb! - expected.nextWeightLb) < 0.001) &&
    (expected.nextReps == null || result.nextRepTarget === expected.nextReps);

  console.log(`\n--- ${name} ---`);
  console.log('Input:', { sets, repRangeLow, repRangeHigh, incrementKg });
  console.log('Expected:', expected);
  console.log('Result:', result ? { action: result.action, nextWeightLb, nextRepTarget: result.nextRepTarget } : null);
  console.log('PASS:', pass);
  return pass;
}

console.log('=== Progression Engine Audit ===\n');

// Case A: 135 x 10,10,10 @ RPE 8,8,8.5, range 8-12 → build_reps, next weight exactly 135 lb, next reps 12
const caseA = runCase(
  'Case A (build_reps preserves exact weight)',
  [
    { weight: 135, reps: 10, rpe: 8 },
    { weight: 135, reps: 10, rpe: 8 },
    { weight: 135, reps: 10, rpe: 8.5 },
  ],
  8,
  12,
  2.5,
  { action: 'build_reps', nextWeightLb: 135, nextReps: 12 }
);

// Case B: 60 kg x 10,10,10 (132.277 lb) → build_reps, next weight exactly 60 kg (132.277 lb)
const caseB = runCase(
  'Case B (build_reps preserves 60 kg)',
  [
    { weight: 60 * LB_PER_KG, reps: 10, rpe: 8 },
    { weight: 60 * LB_PER_KG, reps: 10, rpe: 8 },
    { weight: 60 * LB_PER_KG, reps: 10, rpe: 8.5 },
  ],
  8,
  12,
  2.5,
  { action: 'build_reps', nextWeightLb: 60 * LB_PER_KG, nextReps: 12 }
);

// Case C: 135 x 12,12,12 → add_weight, weight increases by increment
const caseC = runCase(
  'Case C (add_weight increases weight)',
  [
    { weight: 135, reps: 12, rpe: 8 },
    { weight: 135, reps: 12, rpe: 8 },
    { weight: 135, reps: 12, rpe: 8.5 },
  ],
  8,
  12,
  2.5,
  { action: 'add_weight', nextWeightLb: 137.789, nextReps: 8 }
);

// Case D: 135 x 7,7,8 → deload, weight reduces and rounds
const caseD = runCase(
  'Case D (deload reduces weight)',
  [
    { weight: 135, reps: 7, rpe: 8.5 },
    { weight: 135, reps: 7, rpe: 9 },
    { weight: 135, reps: 8, rpe: 9 },
  ],
  8,
  12,
  2.5,
  { action: 'deload', nextWeightLb: 121.254 }
);

console.log('\n=== Summary ===');
console.log('Case A (build_reps 135 lb):', caseA ? 'PASS' : 'FAIL');
console.log('Case B (build_reps 60 kg):', caseB ? 'PASS' : 'FAIL');
console.log('Case C (add_weight):', caseC ? 'PASS' : 'FAIL');
console.log('Case D (deload):', caseD ? 'PASS' : 'FAIL');
console.log('All pass:', caseA && caseB && caseC && caseD);

process.exit(caseA && caseB && caseC && caseD ? 0 : 1);
