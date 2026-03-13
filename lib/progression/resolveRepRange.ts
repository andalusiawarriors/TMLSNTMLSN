/**
 * Canonical rep range resolution with strict priority order:
 * 1. Manual exercise setting (AsyncStorage)
 * 2. History fallback (from past sessions)
 * 3. Hardcoded default (10–12)
 *
 * Manual settings always win; history never overrides explicit exercise config.
 */

import { getAllExerciseSettings } from '../../utils/exerciseSettings';
import { toExerciseUuid, uuidToExerciseStringId } from '../../lib/getTmlsnTemplate';
import { resolveExerciseDbIdFromName } from '../../utils/workoutMuscles';

function toCanonicalExUuid(dbId: string | undefined, name: string): string {
  if (dbId) return toExerciseUuid(dbId);
  const resolved = resolveExerciseDbIdFromName(name);
  return resolved ? toExerciseUuid(resolved) : toExerciseUuid(name);
}

/** Find manual settings for an exercise: check both UUID and db id (exercise list saves under db id). */
function getManualSettingsForExercise(
  allSettings: Record<string, { repRangeLow?: number; repRangeHigh?: number; smallestIncrement?: number }>,
  exerciseId: string
): { repRangeLow: number; repRangeHigh: number; smallestIncrement: number } | null {
  if (exerciseId in allSettings) {
    const m = allSettings[exerciseId];
    return {
      repRangeLow: m.repRangeLow ?? DEFAULT_LOW,
      repRangeHigh: m.repRangeHigh ?? DEFAULT_HIGH,
      smallestIncrement: m.smallestIncrement ?? DEFAULT_INCREMENT,
    };
  }
  const dbId = uuidToExerciseStringId(exerciseId);
  if (dbId && dbId in allSettings) {
    const m = allSettings[dbId];
    return {
      repRangeLow: m.repRangeLow ?? DEFAULT_LOW,
      repRangeHigh: m.repRangeHigh ?? DEFAULT_HIGH,
      smallestIncrement: m.smallestIncrement ?? DEFAULT_INCREMENT,
    };
  }
  return null;
}

export type ResolveRepRangeInput = {
  /** Canonical exercise UUID */
  exerciseId: string;
  /** Target reps from split/program (e.g. TMLSN template) */
  splitTargetReps?: number;
  /** Rep range from history (e.g. last session exercise) */
  historyRepRangeLow?: number;
  historyRepRangeHigh?: number;
};

export type ResolveRepRangeResult = {
  repRangeLow: number;
  repRangeHigh: number;
  smallestIncrement: number;
};

const DEFAULT_LOW = 10;
const DEFAULT_HIGH = 12;
const DEFAULT_INCREMENT = 2.5;

export type ResolveRepRangeInputFull = ResolveRepRangeInput & {
  historySmallestIncrement?: number;
};

/**
 * Resolve rep range for a single exercise using canonical priority.
 * Async because it may fetch manual settings from AsyncStorage.
 */
export async function resolveRepRangeForExercise(
  input: ResolveRepRangeInputFull
): Promise<ResolveRepRangeResult> {
  const { exerciseId, historyRepRangeLow, historyRepRangeHigh, historySmallestIncrement } = input;

  const allSettings = await getAllExerciseSettings();

  // 1. Manual exercise setting — if user has configured this exercise, use it
  const manual = getManualSettingsForExercise(allSettings, exerciseId);
  if (manual) return manual;

  // 2. History fallback
  if (
    historyRepRangeLow != null &&
    historyRepRangeHigh != null &&
    historyRepRangeLow > 0 &&
    historyRepRangeHigh >= historyRepRangeLow
  ) {
    const isLegacyBodybuildingDefault = historyRepRangeLow === 8 && (historyRepRangeHigh === 8 || historyRepRangeHigh === 12);
    const effectiveLow = isLegacyBodybuildingDefault ? DEFAULT_LOW : historyRepRangeLow;
    const effectiveHigh = isLegacyBodybuildingDefault ? DEFAULT_HIGH : historyRepRangeHigh;
    return {
      repRangeLow: effectiveLow,
      repRangeHigh: effectiveHigh,
      smallestIncrement: historySmallestIncrement ?? DEFAULT_INCREMENT,
    };
  }

  // 3. Hardcoded default (10–12)
  return {
    repRangeLow: DEFAULT_LOW,
    repRangeHigh: DEFAULT_HIGH,
    smallestIncrement: historySmallestIncrement ?? DEFAULT_INCREMENT,
  };
}

/**
 * Resolve rep ranges for multiple exercises in one batch.
 * Fetches manual settings once, then resolves each.
 */
export async function resolveRepRangesForExercises(
  items: ResolveRepRangeInputFull[]
): Promise<Map<string, ResolveRepRangeResult>> {
  const allSettings = await getAllExerciseSettings();
  const result = new Map<string, ResolveRepRangeResult>();

  for (const input of items) {
    const { exerciseId, historyRepRangeLow, historyRepRangeHigh, historySmallestIncrement } = input;

    const manual = getManualSettingsForExercise(allSettings, exerciseId);
    if (manual) {
      result.set(exerciseId, manual);
    } else if (
      historyRepRangeLow != null &&
      historyRepRangeHigh != null &&
      historyRepRangeLow > 0 &&
      historyRepRangeHigh >= historyRepRangeLow
    ) {
      // Legacy bodybuilding default: persisted sessions may have rep_range_low: 8 from old split.
      // Treat 8 as stale and use current default (10–12) so UI shows 10.
      const isLegacyBodybuildingDefault = historyRepRangeLow === 8 && (historyRepRangeHigh === 8 || historyRepRangeHigh === 12);
      const effectiveLow = isLegacyBodybuildingDefault ? DEFAULT_LOW : historyRepRangeLow;
      const effectiveHigh = isLegacyBodybuildingDefault ? DEFAULT_HIGH : historyRepRangeHigh;
      result.set(exerciseId, {
        repRangeLow: effectiveLow,
        repRangeHigh: effectiveHigh,
        smallestIncrement: historySmallestIncrement ?? DEFAULT_INCREMENT,
      });
    } else {
      result.set(exerciseId, {
        repRangeLow: DEFAULT_LOW,
        repRangeHigh: DEFAULT_HIGH,
        smallestIncrement: historySmallestIncrement ?? DEFAULT_INCREMENT,
      });
    }
  }

  return result;
}

/**
 * Resolve rep ranges for all exercises in a workout session.
 * Returns a new session with resolved repRangeLow, repRangeHigh, smallestIncrement.
 * Used before persisting to ensure manual settings override template/history.
 */
export async function resolveRepRangesForSession(
  session: { exercises?: Array<{ exerciseDbId?: string; name: string; repRangeLow?: number | null; repRangeHigh?: number | null; smallestIncrement?: number | null }> }
): Promise<typeof session> {
  if (!session.exercises?.length) return session;

  const items: ResolveRepRangeInputFull[] = session.exercises.map((ex) => ({
    exerciseId: toCanonicalExUuid(ex.exerciseDbId, ex.name),
    historyRepRangeLow: ex.repRangeLow ?? undefined,
    historyRepRangeHigh: ex.repRangeHigh ?? undefined,
    historySmallestIncrement: ex.smallestIncrement ?? undefined,
  }));

  const resolved = await resolveRepRangesForExercises(items);

  const exercises = session.exercises.map((ex) => {
    const canonicalId = toCanonicalExUuid(ex.exerciseDbId, ex.name);
    const r = resolved.get(canonicalId);
    if (!r) return ex;
    return {
      ...ex,
      repRangeLow: r.repRangeLow,
      repRangeHigh: r.repRangeHigh,
      smallestIncrement: r.smallestIncrement,
    };
  });

  return { ...session, exercises };
}

/** Sync version for when we already have manual settings (e.g. from batch). */
export function resolveRepRangeSync(
  input: ResolveRepRangeInput & {
    manualRepRangeLow?: number;
    manualRepRangeHigh?: number;
    manualSmallestIncrement?: number;
    historySmallestIncrement?: number;
  }
): ResolveRepRangeResult {
  const {
    historyRepRangeLow,
    historyRepRangeHigh,
    manualRepRangeLow,
    manualRepRangeHigh,
    manualSmallestIncrement,
    historySmallestIncrement,
  } = input;

  if (manualRepRangeLow != null && manualRepRangeHigh != null && manualRepRangeLow > 0 && manualRepRangeHigh >= manualRepRangeLow) {
    return {
      repRangeLow: manualRepRangeLow,
      repRangeHigh: manualRepRangeHigh,
      smallestIncrement: manualSmallestIncrement ?? historySmallestIncrement ?? DEFAULT_INCREMENT,
    };
  }
  if (
    historyRepRangeLow != null &&
    historyRepRangeHigh != null &&
    historyRepRangeLow > 0 &&
    historyRepRangeHigh >= historyRepRangeLow
  ) {
    const isLegacyBodybuildingDefault = historyRepRangeLow === 8 && (historyRepRangeHigh === 8 || historyRepRangeHigh === 12);
    const effectiveLow = isLegacyBodybuildingDefault ? DEFAULT_LOW : historyRepRangeLow;
    const effectiveHigh = isLegacyBodybuildingDefault ? DEFAULT_HIGH : historyRepRangeHigh;
    return {
      repRangeLow: effectiveLow,
      repRangeHigh: effectiveHigh,
      smallestIncrement: historySmallestIncrement ?? DEFAULT_INCREMENT,
    };
  }
  return {
    repRangeLow: DEFAULT_LOW,
    repRangeHigh: DEFAULT_HIGH,
    smallestIncrement: DEFAULT_INCREMENT,
  };
}
