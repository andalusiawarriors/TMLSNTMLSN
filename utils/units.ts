/**
 * Centralized unit conversion for weight (kg/lb) and fluid (ml/oz).
 * Storage units: workout set weight = lb; nutrition water/fluid = oz (US fl oz).
 * Use at display/save boundaries only to avoid double conversion.
 */

// ── Exact conversion factors (exported for aggregate volume in kg) ──
export const LB_PER_KG = 2.2046226218;
export const KG_PER_LB = 0.45359237;
const ML_PER_FL_OZ_US = 29.5735295625;
const FL_OZ_PER_ML = 0.0338140227;

export type WeightUnit = 'kg' | 'lb';
export type VolumeUnit = 'oz' | 'ml';

/** Gym-typical weight increments: 0, 0.25, 0.5, 0.75, 1, 1.25, … (kg or lb). */
const GYM_WEIGHT_INCREMENT = 0.25;

/** Round to avoid float artifacts (e.g. 8.749999999 → 8.75). Use after any gym weight calculation. */
export function roundToGymPrecision(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Round weight to the nearest gym increment (0.25). */
export function roundToGymWeight(value: number): number {
  const r = Math.round(value / GYM_WEIGHT_INCREMENT) * GYM_WEIGHT_INCREMENT;
  return roundToGymPrecision(r);
}

/** Stored weight is in lb. Convert to display value in the given unit. Kg rounded to 4 decimals to avoid lb→kg float noise while preserving e.g. 58.125. */
export function toDisplayWeight(storedWeightLb: number, unit: WeightUnit): number {
  if (unit === 'lb') return storedWeightLb;
  const kg = storedWeightLb * KG_PER_LB;
  return Math.round(kg * 10000) / 10000;
}

/** Display value is in the given unit. Convert to storage (lb). */
export function fromDisplayWeight(displayWeight: number, unit: WeightUnit): number {
  if (unit === 'lb') return displayWeight;
  return displayWeight * LB_PER_KG;
}

/**
 * Workout volume = weight * reps. Stored weight is in lb, so rawVolume is in lb.
 * Convert to display value in the given weight unit. Kg rounded to 4 decimals to avoid lb→kg float noise.
 */
export function toDisplayVolume(rawVolumeLb: number, unit: WeightUnit): number {
  if (unit === 'lb') return rawVolumeLb;
  const kg = rawVolumeLb * KG_PER_LB;
  return Math.round(kg * 10000) / 10000;
}

/** Stored fluid is in oz (US fl oz). Convert to display value in the given unit. */
export function toDisplayFluid(storedOz: number, unit: VolumeUnit): number {
  if (unit === 'oz') return storedOz;
  return storedOz * ML_PER_FL_OZ_US;
}

/** Display value is in the given unit. Convert to storage (oz). */
export function fromDisplayFluid(displayFluid: number, unit: VolumeUnit): number {
  if (unit === 'oz') return displayFluid;
  return displayFluid * FL_OZ_PER_ML;
}

/**
 * Safe parse for numeric input (weight or reps). Handles empty string, locale decimals.
 * float: locale-tolerant (62,25 and 62.25 both parse). int: rejects decimals.
 * Returns null if invalid or empty.
 */
export function parseNumericInput(
  raw: string,
  mode: 'float' | 'int'
): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (mode === 'float') {
    if (!/[\d]/.test(trimmed)) return null;
    const invalidChars = trimmed.replace(/[\d.,]/g, '');
    if (invalidChars.length > 0) return null;
    const separators = (trimmed.match(/[,.]/g) || []);
    if (separators.length > 1) return null;
    const normalized = trimmed.replace(',', '.');
    const n = parseFloat(normalized);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (trimmed.includes('.') || trimmed.includes(',')) return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Format weight for display: round to nearest gym increment, then show using device locale.
 * Locale-aware: comma decimal (62,25) or dot decimal (62.25) per user's locale.
 */
export function formatWeightDisplay(value: number, _unit: WeightUnit): string {
  const rounded = roundToGymWeight(value);
  if (rounded % 1 === 0) return String(Math.round(rounded));
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
  return formatter.format(rounded);
}

/** Format total volume for display: round to nearest gym increment (0.25), then show with no trailing zeros (1392 → "1392", 1392.5 → "1392.5"). */
export function formatVolumeDisplay(value: number, _unit: WeightUnit): string {
  const rounded = roundToGymWeight(value);
  if (rounded % 1 === 0) return String(Math.round(rounded));
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

/** Format fluid for display: ml = integer, oz = 1 decimal. */
export function formatFluidDisplay(value: number, unit: VolumeUnit): string {
  if (unit === 'ml') return String(Math.round(value));
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}
