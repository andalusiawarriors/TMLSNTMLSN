// ============================================================
// TMLSN FITNESS APP — Exercise Database & Muscle Heatmap Types
// ============================================================

// All muscles trackable in the system
export type MuscleId =
  // CHEST
  | 'chest_upper' | 'chest_mid' | 'chest_lower'
  // BACK
  | 'lats' | 'traps_upper' | 'traps_mid' | 'traps_lower' | 'rhomboids' | 'erector_spinae' | 'teres_major'
  // SHOULDERS
  | 'front_delts' | 'side_delts' | 'rear_delts' | 'rotator_cuff'
  // ARMS
  | 'biceps_long' | 'biceps_short' | 'brachialis' | 'brachioradialis'
  | 'triceps_long' | 'triceps_lateral' | 'triceps_medial'
  | 'forearm_flexors' | 'forearm_extensors'
  // CORE
  | 'rectus_abdominis' | 'obliques' | 'transverse_abdominis' | 'serratus'
  // LEGS
  | 'quads_rectus_femoris' | 'quads_vastus_lateralis' | 'quads_vastus_medialis' | 'quads_vastus_intermedius'
  | 'hamstrings_biceps_femoris' | 'hamstrings_semitendinosus' | 'hamstrings_semimembranosus'
  | 'glutes_max' | 'glutes_med' | 'glutes_min'
  | 'hip_flexors' | 'adductors' | 'abductors'
  | 'calves_gastrocnemius' | 'calves_soleus' | 'tibialis_anterior';

// Simplified muscle groups for the body heatmap visual
export type MuscleGroup =
  | 'chest' | 'upper_back' | 'lats' | 'lower_back'
  | 'front_delts' | 'side_delts' | 'rear_delts'
  | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques'
  | 'quads' | 'hamstrings' | 'glutes' | 'adductors'
  | 'calves' | 'traps' | 'hip_flexors';

export interface MuscleTarget {
  muscleId: MuscleId;
  activationPercent: number; // 0–100: how much this exercise activates this muscle
}

export type EquipmentType =
  | 'barbell' | 'dumbbell' | 'cable' | 'machine'
  | 'bodyweight' | 'kettlebell' | 'ez_bar'
  | 'smith_machine' | 'resistance_band' | 'trx'
  | 'medicine_ball' | 'plate' | 'trap_bar';

export type ExerciseCategory =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'forearms' | 'quads' | 'hamstrings' | 'glutes'
  | 'calves' | 'abs' | 'full_body' | 'cardio' | 'olympic';

export type MovementType = 'compound' | 'isolation';
export type ForceType = 'push' | 'pull' | 'legs' | 'static' | 'hinge' | 'rotation';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: EquipmentType[];
  movementType: MovementType;
  forceType: ForceType;
  muscles: MuscleTarget[];
  description: string;
  tips?: string;
}

// ── Weekly Muscle Tracking ──────────────────────────────────

export interface SetRecord {
  exerciseId: string;
  reps: number;
  weight?: number; // kg or lbs based on user pref
  rpe?: number;    // rate of perceived exertion 1-10
  date: string;    // ISO date
  dayOfWeek: number; // 0=Mon … 6=Sun
}

export interface WeeklyMuscleVolume {
  muscleId: MuscleId;
  muscleGroup: MuscleGroup;
  totalSets: number;
  totalActivation: number; // sum of (sets × activationPercent) — used for heatmap intensity
  byDay: Record<number, number>; // dayOfWeek → sets
}

// Mapping from detailed muscle IDs → simplified heatmap groups
export const MUSCLE_TO_GROUP: Record<MuscleId, MuscleGroup> = {
  chest_upper: 'chest', chest_mid: 'chest', chest_lower: 'chest',
  lats: 'lats', teres_major: 'lats',
  traps_upper: 'traps', traps_mid: 'traps', traps_lower: 'traps',
  rhomboids: 'upper_back', erector_spinae: 'lower_back',
  front_delts: 'front_delts', side_delts: 'side_delts', rear_delts: 'rear_delts', rotator_cuff: 'rear_delts',
  biceps_long: 'biceps', biceps_short: 'biceps', brachialis: 'biceps', brachioradialis: 'forearms',
  triceps_long: 'triceps', triceps_lateral: 'triceps', triceps_medial: 'triceps',
  forearm_flexors: 'forearms', forearm_extensors: 'forearms',
  rectus_abdominis: 'abs', transverse_abdominis: 'abs', serratus: 'abs', obliques: 'obliques',
  quads_rectus_femoris: 'quads', quads_vastus_lateralis: 'quads', quads_vastus_medialis: 'quads', quads_vastus_intermedius: 'quads',
  hamstrings_biceps_femoris: 'hamstrings', hamstrings_semitendinosus: 'hamstrings', hamstrings_semimembranosus: 'hamstrings',
  glutes_max: 'glutes', glutes_med: 'glutes', glutes_min: 'glutes',
  hip_flexors: 'hip_flexors', adductors: 'adductors', abductors: 'glutes',
  calves_gastrocnemius: 'calves', calves_soleus: 'calves', tibialis_anterior: 'calves',
};
