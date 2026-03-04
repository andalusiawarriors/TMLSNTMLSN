/**
 * Shared logic for set table: build prevSets (last session per-set) and ghost weight/reps.
 * Used by both active workout and edit past workout so behavior does not diverge.
 */
import type { Exercise, WorkoutSession } from '../types';
import { toDisplayWeight, formatWeightDisplay } from './units';

export type PrevSet = { weight: number; reps: number };

export function buildPrevSetsAndGhost(
  exercise: Exercise,
  prescriptions: Record<string, { nextWeight: number; goal: string }>,
  recentSessions: WorkoutSession[],
  weightUnit: 'kg' | 'lb'
): { prevSets: PrevSet[]; ghostWeight: string | null; ghostReps: string | null; loadChangePercent: number | null } {
  const exKey = exercise.exerciseDbId ?? exercise.name;
  const prescription = exKey ? prescriptions[exKey] : null;

  let ghostWeight: string | null = null;
  let ghostReps: string | null = null;
  let prevSets: PrevSet[] = [];
  let loadChangePercent: number | null = null;

  if (prescription) {
    ghostWeight = formatWeightDisplay(toDisplayWeight(prescription.nextWeight, weightUnit), weightUnit);
    ghostReps = String(
      prescription.goal === 'add_load'
        ? (exercise.repRangeLow ?? 8)
        : (exercise.repRangeHigh ?? 12)
    );
  }

  if (exercise.name) {
    const exNameLower = exercise.name.toLowerCase();
    for (const session of recentSessions) {
      const matchEx = session.exercises?.find(
        (e) =>
          (exercise.exerciseDbId && e.exerciseDbId === exercise.exerciseDbId) ||
          e.name.toLowerCase() === exNameLower
      );
      if (matchEx) {
        const allSets = matchEx.sets ?? [];
        const doneSets = allSets.filter((s) => s.weight > 0 && s.reps > 0);
        if (doneSets.length > 0) {
          prevSets = allSets.map((s) => ({ weight: s.weight, reps: s.reps }));
          if (!prescription) {
            const last = doneSets[doneSets.length - 1];
            ghostWeight = formatWeightDisplay(toDisplayWeight(last.weight, weightUnit), weightUnit);
            ghostReps = String(last.reps);
          } else if (prescription.goal === 'add_load' || prescription.goal === 'reduce_load') {
            // Compute the actual % change vs last session's last set
            const prevWeight = doneSets[doneSets.length - 1].weight;
            if (prevWeight > 0) {
              loadChangePercent = Math.round(((prescription.nextWeight - prevWeight) / prevWeight) * 1000) / 10;
            }
          }
          break;
        }
      }
    }
  }

  return { prevSets, ghostWeight, ghostReps, loadChangePercent };
}
