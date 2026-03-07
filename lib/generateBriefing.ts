import type {
  WorkoutContext,
  ScheduledSet,
  VolumeStatus,
  TrainingSettings,
} from './getWorkoutContext';
import { decideNextPrescription } from './progression/decideNextPrescription';
import { toDisplayWeight } from '../utils/units';

function getLastSessionSets(recentSets: ScheduledSet[]): ScheduledSet[] {
  if (recentSets.length === 0) return [];
  const firstDate = recentSets[0].sessionDate;
  return recentSets.filter((s) => s.sessionDate === firstDate);
}

function lastSessionSummary(lastSets: ScheduledSet[], weightUnit: 'kg' | 'lb'): string {
  if (lastSets.length === 0) return '—';
  const wLb = lastSets[0].weight ?? 0;
  const w = toDisplayWeight(wLb, weightUnit);
  const reps = lastSets.map((s) => s.reps ?? 0).join(',');
  const rpeVals = lastSets.map((s) => s.rpe).filter((r): r is number => r != null && r > 0);
  const rpe = rpeVals.length > 0 ? Math.max(...rpeVals) : null;
  if (rpe != null) return `${w} ${weightUnit} × ${reps} (RPE ${rpe})`;
  return `${w} ${weightUnit} × ${reps}`;
}

function volumeMessage(
  v: VolumeStatus,
  framework: NonNullable<TrainingSettings['volumeFramework']>
): string {
  if (framework !== 'tmlsn_protocol') return '';
  const { setsDone, mev, mav, mrv } = v;
  if (mev == null && mav == null && mrv == null) return `${v.muscleGroup}: ${setsDone} sets`;
  if (mrv != null && setsDone >= mrv) return `${v.muscleGroup}: at MRV. Deload incoming. One more quality session.`;
  if (mav != null && mrv != null && setsDone >= mav) return `${v.muscleGroup}: approaching ceiling. Keep quality high.`;
  if (mev != null && mav != null && setsDone >= mev) return `${v.muscleGroup}: in range. Push intensity.`;
  if (mev != null && setsDone < mev) return `${v.muscleGroup}: below MEV. Increase volume today.`;
  return `${v.muscleGroup}: ${setsDone} sets`;
}

export function generateBriefing(context: WorkoutContext): string {
  const { trainingSettings, todayPlan, exerciseHistory, weeklyVolume } = context;
  const framework = trainingSettings?.volumeFramework ?? 'builder';
  const week = trainingSettings?.currentWeek ?? 1;
  const day = todayPlan?.dayOfWeek ?? 'Unknown';
  const protocolName = todayPlan?.workoutType ?? trainingSettings?.scheduleMode ?? '';

  if (day === 'Unknown' || !todayPlan) {
    return 'Day unknown. Cannot determine schedule.';
  }

  if (todayPlan.isRestDay) {
    return `${day}  ·  Week ${week}\n${protocolName || 'Rest Day'}\n\nRest day. Recovery is training.`;
  }

  if (todayPlan.exerciseIds.length === 0) {
    return `${day}  ·  Week ${week}\n${protocolName || 'Training'}\n\nNo exercises configured. Add them in Training Settings → Protocol Templates.`;
  }

  const lines: string[] = [];
  lines.push(`${day}  ·  Week ${week}`);
  lines.push(protocolName || 'Training');
  lines.push('');

  const history = exerciseHistory ?? [];
  const names = todayPlan.exerciseNames ?? [];
  const details = context.todayExerciseDetails ?? [];
  const weightUnit = (context.weightUnit ?? 'lb') as 'kg' | 'lb';

  for (let i = 0; i < todayPlan.exerciseIds.length; i++) {
    const displayName = names[i] ?? `Exercise ${i + 1}`;
    const hist = history[i];
    const recentSets = hist?.recentSets ?? [];
    const lastSets = getLastSessionSets(recentSets);
    const hasHistory = lastSets.length > 0;

    lines.push(displayName);

    if (!hasHistory) {
      lines.push('No workout data for this exercise');
      lines.push('');
      continue;
    }

    const lastStr = lastSessionSummary(lastSets, weightUnit);
    const exDetail = details[i];
    const repRangeLow = exDetail?.repRangeLow ?? 8;
    const repRangeHigh = exDetail?.repRangeHigh ?? 12;
    const incrementKg = exDetail?.smallestIncrementKg ?? 2.5;

    const workingSets = lastSets.map((s) => ({
      weight: s.weight ?? 0,
      reps: s.reps ?? 0,
      rpe: s.rpe ?? null,
      completed: true,
    }));

    const decision = decideNextPrescription({
      sets: workingSets,
      repRangeLow,
      repRangeHigh,
      incrementKg,
    });

    const targetWeight =
      weightUnit === 'kg' ? (decision?.nextWeightKg ?? 0) : (decision?.nextWeightLb ?? 0);
    const targetReps = decision?.nextRepTarget ?? repRangeLow;
    const note = decision?.reason ?? null;

    lines.push(`Last    ${lastStr}`);
    lines.push(
      `Target  ${targetWeight > 0 ? `${targetWeight} ${weightUnit}` : '—'}  ×  ${targetReps}`
    );
    if (note) lines.push(note);
    lines.push('');
  }

  // Volume section
  const volumeLines: string[] = [];
  if (framework === 'tmlsn_protocol' && weeklyVolume.length > 0) {
    for (const v of weeklyVolume) {
      const msg = volumeMessage(v, framework);
      if (msg) volumeLines.push(msg);
    }
  } else if (weeklyVolume.length > 0) {
    for (const v of weeklyVolume) {
      volumeLines.push(`${v.muscleGroup}: ${v.setsDone} sets`);
    }
  }

  if (volumeLines.length > 0) {
    lines.push('── Volume ──');
    lines.push(...volumeLines);
    lines.push('');
  }

  lines.push('Session ready.');

  return lines.join('\n').trim();
}
