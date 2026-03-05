import type {
  WorkoutContext,
  ScheduledSet,
  VolumeStatus,
  TrainingSettings,
} from './getWorkoutContext';

const WEIGHT_INCREMENT_KG = 2.5;

function getLastSessionSets(recentSets: ScheduledSet[]): ScheduledSet[] {
  if (recentSets.length === 0) return [];
  const firstDate = recentSets[0].sessionDate;
  return recentSets.filter((s) => s.sessionDate === firstDate);
}

function hitTargetRepsAcrossAllSets(lastSets: ScheduledSet[]): boolean {
  if (lastSets.length === 0) return false;
  return lastSets.every((s) => {
    const reps = s.reps ?? 0;
    const target = s.targetReps ?? reps;
    return target > 0 && reps >= target;
  });
}

function maxRpeFromSets(sets: ScheduledSet[]): number | null {
  const rpes = sets.map((s) => s.rpe).filter((r): r is number => r != null && r > 0);
  return rpes.length > 0 ? Math.max(...rpes) : null;
}

function avgRpeFromSets(sets: ScheduledSet[]): number | null {
  const rpes = sets.map((s) => s.rpe).filter((r): r is number => r != null && r > 0);
  if (rpes.length === 0) return null;
  return rpes.reduce((a, b) => a + b, 0) / rpes.length;
}

function getSessionGroups(recentSets: ScheduledSet[]): ScheduledSet[][] {
  const groups: ScheduledSet[][] = [];
  let current: ScheduledSet[] = [];
  let lastDate: string | null = null;
  for (const s of recentSets) {
    if (lastDate !== s.sessionDate) {
      if (current.length > 0) groups.push(current);
      current = [];
      lastDate = s.sessionDate;
    }
    current.push(s);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

type RpeTrend = 'up' | 'down' | 'stable';

function getRpeTrend(recentSets: ScheduledSet[]): RpeTrend | null {
  const groups = getSessionGroups(recentSets).slice(0, 3);
  if (groups.length < 2) return null;
  const avgs = groups.map((g) => avgRpeFromSets(g)).filter((a): a is number => a != null);
  if (avgs.length < 2) return null;
  const newest = avgs[0];
  const oldest = avgs[avgs.length - 1];
  const diff = newest - oldest;
  if (diff >= 0.5) return 'up';
  if (diff <= -0.5) return 'down';
  return 'stable';
}

function lastSessionSummary(lastSets: ScheduledSet[]): string {
  if (lastSets.length === 0) return '—';
  const w = lastSets[0].weight ?? 0;
  const reps = lastSets.map((s) => s.reps ?? 0).join(',');
  const rpe = maxRpeFromSets(lastSets);
  if (rpe != null) return `${w}×${reps} (RPE ${rpe})`;
  return `${w}×${reps}`;
}

function lastSessionTargetWeight(lastSets: ScheduledSet[]): number | null {
  const w = lastSets.find((s) => s.targetWeight != null)?.targetWeight ?? lastSets[0]?.weight;
  return w != null ? w : null;
}

function lastSessionTargetReps(lastSets: ScheduledSet[]): number | null {
  const r = lastSets.find((s) => s.targetReps != null)?.targetReps ?? lastSets[0]?.reps;
  return r != null ? r : null;
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

    const lastStr = lastSessionSummary(lastSets);
    let targetWeight: number;
    let targetReps: number;
    let note: string | null = null;

    if (framework === 'builder') {
      const baseWeight = lastSessionTargetWeight(lastSets) ?? 0;
      const baseReps = lastSessionTargetReps(lastSets) ?? 8;
      const hitTarget = hitTargetRepsAcrossAllSets(lastSets);
      const maxRpe = maxRpeFromSets(lastSets);

      if (maxRpe != null && maxRpe >= 9) {
        targetWeight = baseWeight;
        targetReps = baseReps;
        note = 'Autoregulate today.';
      } else if (hitTarget) {
        targetWeight = baseWeight + WEIGHT_INCREMENT_KG;
        targetReps = baseReps;
      } else {
        targetWeight = baseWeight;
        targetReps = baseReps;
      }
    } else if (framework === 'ghost') {
      const baseWeight = lastSessionTargetWeight(lastSets) ?? 0;
      const baseReps = lastSessionTargetReps(lastSets) ?? 8;
      const trend = getRpeTrend(recentSets);

      if (trend === 'up') {
        targetWeight = Math.max(0, baseWeight - WEIGHT_INCREMENT_KG);
        targetReps = baseReps;
        note = 'RPE trending up. Reduce load.';
      } else if (trend === 'stable') {
        targetWeight = baseWeight;
        targetReps = baseReps + 1;
        note = 'Add a rep.';
      } else if (trend === 'down') {
        targetWeight = baseWeight + WEIGHT_INCREMENT_KG;
        targetReps = baseReps;
        note = 'Add weight.';
      } else {
        targetWeight = baseWeight;
        targetReps = baseReps;
      }
    } else {
      const baseWeight = lastSessionTargetWeight(lastSets) ?? 0;
      const baseReps = lastSessionTargetReps(lastSets) ?? 8;
      targetWeight = baseWeight;
      targetReps = baseReps;
    }

    lines.push(`Last    ${lastStr}`);
    lines.push(`Target  ${targetWeight > 0 ? `${targetWeight} kg` : '—'}  ×  ${targetReps}`);
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
