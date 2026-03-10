/**
 * TMLSN Protocol — exercise IDs from TMLSN_SPLITS per protocol day.
 */

import { v5 as uuidv5 } from 'uuid';
import { EXERCISE_DATABASE, EXERCISE_MAP } from '@/utils/exerciseDb/exerciseDatabase';
import { TMLSN_SPLITS } from '@/constants/workoutSplits';
import { resolveExerciseDbIdFromName } from '@/utils/workoutMuscles';

const EXERCISE_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Convert exercise string id to UUID (matches workout_logs.exercise_id). */
export function toExerciseUuid(stringId: string): string {
  if (UUID_REGEX.test(stringId)) return stringId;
  return uuidv5(stringId, EXERCISE_NAMESPACE);
}

/** Convert UUID back to exercise string id for display. */
export function uuidToExerciseStringId(uuid: string): string | null {
  for (const ex of EXERCISE_DATABASE) {
    if (uuidv5(ex.id, EXERCISE_NAMESPACE) === uuid) return ex.id;
  }
  return null;
}

/** Get exercise name from UUID. */
export function uuidToExerciseName(uuid: string): string {
  const stringId = uuidToExerciseStringId(uuid);
  return stringId ? (EXERCISE_MAP.get(stringId)?.name ?? 'Unknown') : 'Unknown';
}

export type ProtocolDay = 'Upper A' | 'Lower A' | 'Upper B' | 'Lower B';

const WORKOUT_TYPE_TO_PROTOCOL_DAY: Record<string, ProtocolDay> = {
  'TMLSN Upper Body A': 'Upper A',
  'TMLSN Lower Body A': 'Lower A',
  'TMLSN Upper Body B': 'Upper B',
  'TMLSN Lower Body B': 'Lower B',
};

export function workoutTypeToProtocolDay(workoutType: string | null): ProtocolDay | null {
  if (!workoutType) return null;
  return WORKOUT_TYPE_TO_PROTOCOL_DAY[workoutType] ?? null;
}

const PROTOCOL_DAY_TO_SPLIT_ID: Record<ProtocolDay, string> = {
  'Upper A': 'tmlsn-upper-a',
  'Lower A': 'tmlsn-lower-a',
  'Upper B': 'tmlsn-upper-b',
  'Lower B': 'tmlsn-lower-b',
};

export interface TmlsnExercise {
  id: string;
  name: string;
}

/** Exercises (id + name) from TMLSN_SPLITS for the given protocol day. */
export function getDefaultTmlsnExercises(protocolDay: ProtocolDay): TmlsnExercise[] {
  const splitId = PROTOCOL_DAY_TO_SPLIT_ID[protocolDay];
  const split = TMLSN_SPLITS.find((s) => s.id === splitId);
  if (!split?.exercises?.length) return [];

  const result: TmlsnExercise[] = [];
  for (const ex of split.exercises) {
    const dbId = resolveExerciseDbIdFromName(ex.name);
    if (dbId) result.push({ id: toExerciseUuid(dbId), name: ex.name });
  }
  return result;
}

/** Exercise UUIDs from TMLSN_SPLITS for the given protocol day. */
export function getDefaultTmlsnExerciseIds(protocolDay: ProtocolDay): string[] {
  return getDefaultTmlsnExercises(protocolDay).map((e) => e.id);
}
