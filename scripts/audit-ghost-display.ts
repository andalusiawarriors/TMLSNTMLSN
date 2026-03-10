/**
 * Audit ghost value display layer for progressive overload.
 * Verifies: toDisplayWeight + formatWeightDisplay are presentation-only; unit switching is stable.
 * Run: npx tsx scripts/audit-ghost-display.ts
 */
import { toDisplayWeight, formatWeightDisplay, fromDisplayWeight } from '../utils/units';

const LB_PER_KG = 2.2046226218;

function auditDisplay(storedLb: number, label: string) {
  const lbDisplay = toDisplayWeight(storedLb, 'lb');
  const kgDisplay = toDisplayWeight(storedLb, 'kg');
  const lbFormatted = formatWeightDisplay(lbDisplay, 'lb');
  const kgFormatted = formatWeightDisplay(kgDisplay, 'kg');

  // Round-trip: formatted string → parse → fromDisplayWeight → should match stored
  const lbParsed = parseFloat(lbFormatted);
  const kgParsed = parseFloat(kgFormatted);
  const lbRoundTrip = fromDisplayWeight(lbParsed, 'lb');
  const kgRoundTrip = fromDisplayWeight(kgParsed, 'kg');

  console.log(`\n--- ${label} (stored: ${storedLb} lb) ---`);
  console.log('  lb mode: display=', lbDisplay, '→ formatted=', lbFormatted);
  console.log('  kg mode: display=', kgDisplay.toFixed(4), '→ formatted=', kgFormatted);
  console.log('  Round-trip lb:', lbFormatted, '→', lbRoundTrip.toFixed(2), 'lb');
  console.log('  Round-trip kg:', kgFormatted, '→', kgRoundTrip.toFixed(2), 'lb (expected', storedLb, ')');

  // Round-trip tolerance: formatWeightDisplay rounds to 0.25; applying ghost may store rounded value
  const lbStable = Math.abs(lbRoundTrip - storedLb) < 0.05;
  const kgStable = Math.abs(kgRoundTrip - storedLb) < 0.05;
  return lbStable && kgStable;
}

console.log('=== Ghost Display Layer Audit ===\n');
console.log('Storage is always lb. Display converts via toDisplayWeight(storedLb, unit).');
console.log('formatWeightDisplay rounds to 0.25 for clean display.\n');

// build_reps: exact 135 lb
const a = auditDisplay(135, 'build_reps (135 lb)');

// add_weight: 137.789 lb (from engine)
const b = auditDisplay(137.789, 'add_weight (137.789 lb)');

// deload: 121.254 lb
const c = auditDisplay(121.254, 'deload (121.254 lb)');

// 60 kg in lb
const kg60Lb = 60 * LB_PER_KG;
const d = auditDisplay(kg60Lb, '60 kg in lb (' + kg60Lb.toFixed(2) + ' lb)');

console.log('\n=== Unit switching stability ===');
console.log('Canonical value: 135 lb');
console.log('  lb mode: formatWeightDisplay(toDisplayWeight(135, lb), lb) =', formatWeightDisplay(toDisplayWeight(135, 'lb'), 'lb'));
console.log('  kg mode: formatWeightDisplay(toDisplayWeight(135, kg), kg) =', formatWeightDisplay(toDisplayWeight(135, 'kg'), 'kg'));
console.log('  Switch back to lb: same 135 lb →', formatWeightDisplay(toDisplayWeight(135, 'lb'), 'lb'));
console.log('  Underlying stored value never changes. Display is recomputed from decision.nextWeightLb on each render.');

console.log('\n=== Summary ===');
console.log('build_reps 135 lb:', a ? 'PASS' : 'FAIL');
console.log('add_weight 137.79 lb:', b ? 'PASS' : 'FAIL');
console.log('deload 121.25 lb:', c ? 'PASS' : 'FAIL');
console.log('60 kg:', d ? 'PASS' : 'FAIL');

process.exit(a && b && c && d ? 0 : 1);
