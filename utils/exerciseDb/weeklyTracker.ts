// ============================================================
// TMLSN FITNESS APP — Weekly Muscle Volume Tracker
// Calculates sets per muscle, activation intensity, heatmap data
// ============================================================

import {
  MuscleId,
  MuscleGroup,
  MuscleTarget,
  WeeklyMuscleVolume,
  SetRecord,
  MUSCLE_TO_GROUP,
} from './types';
import { EXERCISE_MAP } from './exerciseDatabase';

// ── Readable muscle names (for UI display) ───────────────────

export const MUSCLE_DISPLAY_NAMES: Record<MuscleId, string> = {
  chest_upper: 'Upper Chest',
  chest_mid: 'Mid Chest',
  chest_lower: 'Lower Chest',
  lats: 'Lats',
  traps_upper: 'Upper Traps',
  traps_mid: 'Mid Traps',
  traps_lower: 'Lower Traps',
  rhomboids: 'Rhomboids',
  erector_spinae: 'Erector Spinae',
  teres_major: 'Teres Major',
  front_delts: 'Front Delts',
  side_delts: 'Side Delts',
  rear_delts: 'Rear Delts',
  rotator_cuff: 'Rotator Cuff',
  biceps_long: 'Biceps (Long Head)',
  biceps_short: 'Biceps (Short Head)',
  brachialis: 'Brachialis',
  brachioradialis: 'Brachioradialis',
  triceps_long: 'Triceps (Long Head)',
  triceps_lateral: 'Triceps (Lateral Head)',
  triceps_medial: 'Triceps (Medial Head)',
  forearm_flexors: 'Forearm Flexors',
  forearm_extensors: 'Forearm Extensors',
  rectus_abdominis: 'Abs (Rectus)',
  obliques: 'Obliques',
  transverse_abdominis: 'Transverse Abs',
  serratus: 'Serratus Anterior',
  quads_rectus_femoris: 'Quads (Rectus Femoris)',
  quads_vastus_lateralis: 'Quads (Vastus Lateralis)',
  quads_vastus_medialis: 'Quads (Vastus Medialis)',
  quads_vastus_intermedius: 'Quads (Vastus Intermedius)',
  hamstrings_biceps_femoris: 'Hamstrings (Biceps Femoris)',
  hamstrings_semitendinosus: 'Hamstrings (Semitendinosus)',
  hamstrings_semimembranosus: 'Hamstrings (Semimembranosus)',
  glutes_max: 'Gluteus Maximus',
  glutes_med: 'Gluteus Medius',
  glutes_min: 'Gluteus Minimus',
  hip_flexors: 'Hip Flexors',
  adductors: 'Adductors',
  abductors: 'Abductors',
  calves_gastrocnemius: 'Calves (Gastroc)',
  calves_soleus: 'Calves (Soleus)',
  tibialis_anterior: 'Tibialis Anterior',
};

export const MUSCLE_GROUP_DISPLAY_NAMES: Record<MuscleGroup, string> = {
  chest: 'Chest',
  upper_back: 'Upper Back',
  lats: 'Lats',
  lower_back: 'Lower Back',
  front_delts: 'Front Delts',
  side_delts: 'Side Delts',
  rear_delts: 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  adductors: 'Adductors',
  calves: 'Calves',
  traps: 'Traps',
  hip_flexors: 'Hip Flexors',
};

// ── Helper: get Monday of the current week ───────────────────

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust to Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getDayOfWeek(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDay();
  return day === 0 ? 6 : day - 1; // Convert: 0=Mon, 1=Tue, ..., 6=Sun
}

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Core: Calculate weekly muscle volume from set records ─────

export function calculateWeeklyMuscleVolume(
  sets: SetRecord[]
): WeeklyMuscleVolume[] {
  // Map: muscleId → { totalSets, totalActivation, byDay }
  const volumeMap = new Map<
    MuscleId,
    { totalSets: number; totalActivation: number; byDay: Record<number, number> }
  >();

  for (const set of sets) {
    const exercise = EXERCISE_MAP.get(set.exerciseId);
    if (!exercise) continue;

    for (const muscle of exercise.muscles) {
      if (!volumeMap.has(muscle.muscleId)) {
        volumeMap.set(muscle.muscleId, {
          totalSets: 0,
          totalActivation: 0,
          byDay: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        });
      }

      const entry = volumeMap.get(muscle.muscleId)!;

      // Only count as a "set" for this muscle if activation > 40%
      // (otherwise it's just a minor stabilizer, not a meaningful set)
      const isSignificant = muscle.activationPercent >= 40;

      if (isSignificant) {
        entry.totalSets += 1;
        entry.byDay[set.dayOfWeek] = (entry.byDay[set.dayOfWeek] || 0) + 1;
      }

      // Always add to activation (for heatmap intensity)
      entry.totalActivation += muscle.activationPercent;
    }
  }

  // Convert to array
  const result: WeeklyMuscleVolume[] = [];
  volumeMap.forEach((data, muscleId) => {
    result.push({
      muscleId,
      muscleGroup: MUSCLE_TO_GROUP[muscleId],
      totalSets: data.totalSets,
      totalActivation: data.totalActivation,
      byDay: data.byDay,
    });
  });

  // Sort by total activation (highest first)
  return result.sort((a, b) => b.totalActivation - a.totalActivation);
}

// ── Heatmap: Group muscle volumes into simplified body groups ─

export interface HeatmapData {
  muscleGroup: MuscleGroup;
  displayName: string;
  totalSets: number;
  intensity: number; // 0–1 normalized for color mapping
  byDay: Record<number, number>;
}

export function calculateHeatmap(
  weeklyVolume: WeeklyMuscleVolume[]
): HeatmapData[] {
  // Aggregate by muscle group
  const groupMap = new Map<
    MuscleGroup,
    { totalSets: number; totalActivation: number; byDay: Record<number, number> }
  >();

  for (const vol of weeklyVolume) {
    const group = vol.muscleGroup;
    if (!groupMap.has(group)) {
      groupMap.set(group, {
        totalSets: 0,
        totalActivation: 0,
        byDay: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      });
    }

    const entry = groupMap.get(group)!;
    entry.totalSets += vol.totalSets;
    entry.totalActivation += vol.totalActivation;
    for (let d = 0; d < 7; d++) {
      entry.byDay[d] += vol.byDay[d] || 0;
    }
  }

  // Find max activation across all groups (for normalization)
  let maxActivation = 0;
  groupMap.forEach((data) => {
    if (data.totalActivation > maxActivation) {
      maxActivation = data.totalActivation;
    }
  });

  // Build heatmap data
  const heatmap: HeatmapData[] = [];
  groupMap.forEach((data, group) => {
    heatmap.push({
      muscleGroup: group,
      displayName: MUSCLE_GROUP_DISPLAY_NAMES[group],
      totalSets: data.totalSets,
      intensity: maxActivation > 0 ? data.totalActivation / maxActivation : 0,
      byDay: data.byDay,
    });
  });

  return heatmap.sort((a, b) => b.intensity - a.intensity);
}

// ── Intensity → Color (for the body heatmap visual) ──────────

/**
 * Maps 0–1 intensity to a color from cold (untrained) to hot (heavily trained).
 * Returns a hex color string.
 *
 * 0.0       → #E8E8E8 (light gray — untrained)
 * 0.01–0.25 → #A8D8EA (light blue — lightly hit)
 * 0.25–0.50 → #4ECDC4 (teal — moderate)
 * 0.50–0.75 → #FFD93D (yellow — well trained)
 * 0.75–0.90 → #FF6B35 (orange — heavily trained)
 * 0.90–1.00 → #E63946 (red — maximally stimulated)
 */
export function intensityToColor(intensity: number): string {
  if (intensity <= 0) return '#E8E8E8';
  if (intensity <= 0.25) return lerpColor('#A8D8EA', '#4ECDC4', intensity / 0.25);
  if (intensity <= 0.50) return lerpColor('#4ECDC4', '#FFD93D', (intensity - 0.25) / 0.25);
  if (intensity <= 0.75) return lerpColor('#FFD93D', '#FF6B35', (intensity - 0.50) / 0.25);
  return lerpColor('#FF6B35', '#E63946', (intensity - 0.75) / 0.25);
}

function lerpColor(a: string, b: string, t: number): string {
  const clamp = Math.max(0, Math.min(1, t));
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * clamp);
  const g = Math.round(g1 + (g2 - g1) * clamp);
  const bl = Math.round(b1 + (b2 - b1) * clamp);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

// ── Volume guidelines (for UI feedback) ──────────────────────

export const WEEKLY_SET_GUIDELINES: Record<MuscleGroup, { min: number; optimal: number; max: number }> = {
  chest:       { min: 10, optimal: 16, max: 22 },
  upper_back:  { min: 10, optimal: 16, max: 22 },
  lats:        { min: 10, optimal: 16, max: 22 },
  lower_back:  { min: 4,  optimal: 8,  max: 12 },
  front_delts: { min: 6,  optimal: 12, max: 18 },
  side_delts:  { min: 12, optimal: 18, max: 25 },
  rear_delts:  { min: 8,  optimal: 14, max: 20 },
  biceps:      { min: 8,  optimal: 14, max: 20 },
  triceps:     { min: 8,  optimal: 14, max: 20 },
  forearms:    { min: 4,  optimal: 8,  max: 14 },
  abs:         { min: 6,  optimal: 12, max: 18 },
  obliques:    { min: 4,  optimal: 8,  max: 14 },
  quads:       { min: 10, optimal: 16, max: 22 },
  hamstrings:  { min: 8,  optimal: 14, max: 20 },
  glutes:      { min: 8,  optimal: 14, max: 20 },
  adductors:   { min: 4,  optimal: 8,  max: 14 },
  calves:      { min: 8,  optimal: 14, max: 20 },
  traps:       { min: 6,  optimal: 12, max: 18 },
  hip_flexors: { min: 2,  optimal: 4,  max: 8 },
};

/**
 * Returns 'under' | 'optimal' | 'over' based on weekly set guidelines.
 */
export function getVolumeStatus(
  group: MuscleGroup,
  totalSets: number
): 'under' | 'optimal' | 'over' {
  const guide = WEEKLY_SET_GUIDELINES[group];
  if (totalSets < guide.min) return 'under';
  if (totalSets > guide.max) return 'over';
  return 'optimal';
}
