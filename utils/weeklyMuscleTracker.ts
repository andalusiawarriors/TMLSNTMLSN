// ============================================================
// TMLSN — Weekly Muscle Volume Tracker (in utils for Metro resolution)
// ============================================================

import {
  MuscleId,
  MuscleGroup,
  WeeklyMuscleVolume,
  SetRecord,
  MUSCLE_TO_GROUP,
} from './exerciseDb/types';
import { EXERCISE_MAP } from './exerciseDb/exerciseDatabase';

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

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getDayOfWeek(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function calculateWeeklyMuscleVolume(sets: SetRecord[]): WeeklyMuscleVolume[] {
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
      const isSignificant = muscle.activationPercent >= 40;

      if (isSignificant) {
        entry.totalSets += 1;
        entry.byDay[set.dayOfWeek] = (entry.byDay[set.dayOfWeek] || 0) + 1;
      }
      entry.totalActivation += muscle.activationPercent;
    }
  }

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

  return result.sort((a, b) => b.totalActivation - a.totalActivation);
}

export interface HeatmapData {
  muscleGroup: MuscleGroup;
  displayName: string;
  totalSets: number;
  intensity: number;
  byDay: Record<number, number>;
}

export function calculateHeatmap(weeklyVolume: WeeklyMuscleVolume[]): HeatmapData[] {
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

  let maxActivation = 0;
  groupMap.forEach((data) => {
    if (data.totalActivation > maxActivation) maxActivation = data.totalActivation;
  });

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

export const WEEKLY_SET_GUIDELINES: Record<MuscleGroup, { min: number; optimal: number; max: number }> = {
  chest: { min: 10, optimal: 16, max: 22 },
  upper_back: { min: 10, optimal: 16, max: 22 },
  lats: { min: 10, optimal: 16, max: 22 },
  lower_back: { min: 4, optimal: 8, max: 12 },
  front_delts: { min: 6, optimal: 12, max: 18 },
  side_delts: { min: 12, optimal: 18, max: 25 },
  rear_delts: { min: 8, optimal: 14, max: 20 },
  biceps: { min: 8, optimal: 14, max: 20 },
  triceps: { min: 8, optimal: 14, max: 20 },
  forearms: { min: 4, optimal: 8, max: 14 },
  abs: { min: 6, optimal: 12, max: 18 },
  obliques: { min: 4, optimal: 8, max: 14 },
  quads: { min: 10, optimal: 16, max: 22 },
  hamstrings: { min: 8, optimal: 14, max: 20 },
  glutes: { min: 8, optimal: 14, max: 20 },
  adductors: { min: 4, optimal: 8, max: 14 },
  calves: { min: 8, optimal: 14, max: 20 },
  traps: { min: 6, optimal: 12, max: 18 },
  hip_flexors: { min: 2, optimal: 4, max: 8 },
};

export function getVolumeStatus(
  group: MuscleGroup,
  totalSets: number
): 'under' | 'optimal' | 'over' {
  const guide = WEEKLY_SET_GUIDELINES[group];
  if (totalSets < guide.min) return 'under';
  if (totalSets > guide.max) return 'over';
  return 'optimal';
}
