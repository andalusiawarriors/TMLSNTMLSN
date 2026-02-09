import { WorkoutSplit } from '../types';

// Pre-loaded TMLSN Workout Splits
export const TMLSN_SPLITS: WorkoutSplit[] = [
  {
    id: 'tmlsn-upper-a',
    name: 'TMLSN Upper Body A',
    exercises: [
      {
        name: 'Bench Press',
        targetSets: 4,
        targetReps: 8,
        restTimer: 180, // 3 minutes
      },
      {
        name: 'Barbell Row',
        targetSets: 4,
        targetReps: 8,
        restTimer: 180,
      },
      {
        name: 'Overhead Press',
        targetSets: 3,
        targetReps: 10,
        restTimer: 120, // 2 minutes
      },
      {
        name: 'Pull-ups',
        targetSets: 3,
        targetReps: 10,
        restTimer: 120,
      },
      {
        name: 'Dumbbell Flyes',
        targetSets: 3,
        targetReps: 12,
        restTimer: 90, // 1.5 minutes
      },
      {
        name: 'Face Pulls',
        targetSets: 3,
        targetReps: 15,
        restTimer: 60, // 1 minute
      },
    ],
  },
  {
    id: 'tmlsn-lower-a',
    name: 'TMLSN Lower Body A',
    exercises: [
      {
        name: 'Squat',
        targetSets: 4,
        targetReps: 8,
        restTimer: 240, // 4 minutes
      },
      {
        name: 'Romanian Deadlift',
        targetSets: 4,
        targetReps: 10,
        restTimer: 180,
      },
      {
        name: 'Leg Press',
        targetSets: 3,
        targetReps: 12,
        restTimer: 120,
      },
      {
        name: 'Leg Curl',
        targetSets: 3,
        targetReps: 12,
        restTimer: 90,
      },
      {
        name: 'Calf Raises',
        targetSets: 4,
        targetReps: 15,
        restTimer: 60,
      },
    ],
  },
  {
    id: 'tmlsn-upper-b',
    name: 'TMLSN Upper Body B',
    exercises: [
      {
        name: 'Incline Dumbbell Press',
        targetSets: 4,
        targetReps: 10,
        restTimer: 180,
      },
      {
        name: 'Lat Pulldown',
        targetSets: 4,
        targetReps: 10,
        restTimer: 120,
      },
      {
        name: 'Dumbbell Shoulder Press',
        targetSets: 3,
        targetReps: 12,
        restTimer: 120,
      },
      {
        name: 'Cable Row',
        targetSets: 3,
        targetReps: 12,
        restTimer: 120,
      },
      {
        name: 'Lateral Raises',
        targetSets: 3,
        targetReps: 15,
        restTimer: 60,
      },
      {
        name: 'Bicep Curls',
        targetSets: 3,
        targetReps: 12,
        restTimer: 60,
      },
      {
        name: 'Tricep Extensions',
        targetSets: 3,
        targetReps: 12,
        restTimer: 60,
      },
    ],
  },
  {
    id: 'tmlsn-lower-b',
    name: 'TMLSN Lower Body B',
    exercises: [
      {
        name: 'Deadlift',
        targetSets: 4,
        targetReps: 6,
        restTimer: 240,
      },
      {
        name: 'Front Squat',
        targetSets: 3,
        targetReps: 10,
        restTimer: 180,
      },
      {
        name: 'Bulgarian Split Squat',
        targetSets: 3,
        targetReps: 10,
        restTimer: 120,
      },
      {
        name: 'Leg Extension',
        targetSets: 3,
        targetReps: 15,
        restTimer: 90,
      },
      {
        name: 'Seated Calf Raises',
        targetSets: 4,
        targetReps: 15,
        restTimer: 60,
      },
    ],
  },
  {
    id: 'tmlsn-full-body',
    name: 'TMLSN Full Body',
    exercises: [
      {
        name: 'Squat',
        targetSets: 3,
        targetReps: 10,
        restTimer: 180,
      },
      {
        name: 'Bench Press',
        targetSets: 3,
        targetReps: 10,
        restTimer: 180,
      },
      {
        name: 'Barbell Row',
        targetSets: 3,
        targetReps: 10,
        restTimer: 120,
      },
      {
        name: 'Overhead Press',
        targetSets: 3,
        targetReps: 10,
        restTimer: 120,
      },
      {
        name: 'Romanian Deadlift',
        targetSets: 3,
        targetReps: 10,
        restTimer: 120,
      },
      {
        name: 'Pull-ups',
        targetSets: 3,
        targetReps: 10,
        restTimer: 90,
      },
    ],
  },
];
