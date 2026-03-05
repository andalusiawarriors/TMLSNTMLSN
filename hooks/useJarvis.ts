import { useCallback, useEffect, useState } from 'react';
import type { WorkoutContext, ScheduledSet } from '@/lib/getWorkoutContext';
import { getTodayWorkoutContext } from '@/lib/getWorkoutContext';
import { getDefaultTmlsnExercises, workoutTypeToProtocolDay } from '@/lib/getTmlsnTemplate';
import { getExerciseDeepDive, extractExerciseIdFromMessage } from '@/lib/getExerciseDeepDive';
import { supabase } from '@/lib/supabase';
import { toDisplayWeight, formatWeightDisplay } from '@/utils/units';

export type JarvisMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const MAX_TOKENS = 800;
const TEMPERATURE = 0.4;

function formatExerciseHistory(context: WorkoutContext): string {
  const plan = context.todayPlan;
  const history = context.exerciseHistory;
  const weightUnit = context.weightUnit ?? 'lb';
  if (!plan || plan.isRestDay || !history || history.length === 0) return 'No exercise data for today.';

  return plan.exerciseIds.map((_, i) => {
    const name = plan.exerciseNames?.[i] ?? `Exercise ${i + 1}`;
    const recentSets = history[i]?.recentSets ?? [];
    if (recentSets.length === 0) return `${name}: no history`;

    const byDate = new Map<string, typeof recentSets>();
    for (const s of recentSets) {
      if (!byDate.has(s.sessionDate)) byDate.set(s.sessionDate, []);
      byDate.get(s.sessionDate)!.push(s);
    }

    const sessions = Array.from(byDate.entries()).map(([date, sets]) => {
      const storedLb = sets[0].weight ?? 0;
      const wDisplay = formatWeightDisplay(toDisplayWeight(storedLb, weightUnit), weightUnit);
      const reps = sets.map(s => s.reps ?? 0).join('/');
      const rpes = sets.map(s => s.rpe).filter((r): r is number => r != null);
      const rpeStr = rpes.length > 0 ? ` @RPE ${Math.max(...rpes)}` : '';
      return `  ${date}: ${wDisplay} ${weightUnit} × ${reps}${rpeStr}`;
    });

    return `${name}:\n${sessions.join('\n')}`;
  }).join('\n\n');
}

const PROTOCOL_DAY_LABELS: Record<string, string> = {
  'Upper A': 'Monday — Upper Body A',
  'Lower A': 'Tuesday — Lower Body A',
  'Upper B': 'Thursday — Upper Body B',
  'Lower B': 'Friday — Lower Body B',
};

function formatAllExerciseHistory(context: WorkoutContext): string {
  const all = context.allExerciseHistory;
  const weightUnit = context.weightUnit ?? 'lb';
  if (!all) return formatExerciseHistory(context); // fallback for non-TMLSN users

  const days = ['Upper A', 'Lower A', 'Upper B', 'Lower B'];
  return days.map((day) => {
    const label = PROTOCOL_DAY_LABELS[day];
    const entries = all[day] ?? [];
    if (entries.length === 0) return `${label}: no exercises`;

    const lines = entries.map((entry) => {
      if (entry.recentSets.length === 0) return `  ${entry.exerciseName}: no history yet`;

      const byDate = new Map<string, ScheduledSet[]>();
      for (const s of entry.recentSets) {
        if (!byDate.has(s.sessionDate)) byDate.set(s.sessionDate, []);
        byDate.get(s.sessionDate)!.push(s);
      }

      const sessions = Array.from(byDate.entries()).map(([date, sets]) => {
        const storedLb = sets[0].weight ?? 0;
        const wDisplay = formatWeightDisplay(toDisplayWeight(storedLb, weightUnit), weightUnit);
        const reps = sets.map((s) => s.reps ?? 0).join('/');
        const rpes = sets.map((s) => s.rpe).filter((r): r is number => r != null);
        const rpeStr = rpes.length > 0 ? ` @RPE ${Math.max(...rpes)}` : '';
        return `    ${date}: ${wDisplay} ${weightUnit} × ${reps}${rpeStr}`;
      });

      return `  ${entry.exerciseName}:\n${sessions.join('\n')}`;
    });

    return `${label}:\n${lines.join('\n')}`;
  }).join('\n\n');
}

function formatWeeklyVolume(context: WorkoutContext): string {
  if (context.weeklyVolume.length === 0) return 'No volume data this week.';
  return context.weeklyVolume.map(v => {
    const bounds = [v.mev != null ? `MEV ${v.mev}` : '', v.mav != null ? `MAV ${v.mav}` : '', v.mrv != null ? `MRV ${v.mrv}` : ''].filter(Boolean).join(' / ');
    return `  ${v.muscleGroup}: ${v.setsDone} sets${bounds ? ` (${bounds})` : ''}`;
  }).join('\n');
}

function formatTodayExerciseDetails(context: WorkoutContext): string {
  const details = context.todayExerciseDetails;
  const weightUnit = context.weightUnit ?? 'lb';
  if (!details || details.length === 0) return '';

  return details
    .map(
      (d) =>
        `  ${d.exerciseName}: ghost ${d.ghostWeight ?? '—'}×${d.ghostReps ?? '—'} | rep range ${d.repRangeLow}–${d.repRangeHigh} | increment ${weightUnit === 'kg' ? d.smallestIncrementKg + ' kg' : d.smallestIncrementLb + ' lb'}${d.goal ? ` | goal: ${d.goal}` : ''}`
    )
    .join('\n');
}

function formatFullSchedule(context: WorkoutContext): string {
  const schedule = context.tmlsnProtocolSchedule;
  if (!schedule) return 'Schedule not available.';

  return schedule.map((entry) => {
    if (entry.isRestDay) return `${entry.day}: Rest Day`;
    const protocolDay = workoutTypeToProtocolDay(entry.workoutType ?? null);
    const exercises = protocolDay
      ? getDefaultTmlsnExercises(protocolDay).map((e) => e.name).join(', ')
      : '';
    return `${entry.day}: ${entry.workoutType}${exercises ? `\n  → ${exercises}` : ''}`;
  }).join('\n');
}

function formatHistorySummary(context: WorkoutContext): string {
  const a = context.adherence;
  const rs = context.recentSessions ?? [];
  const et = context.exerciseTrends ?? [];

  if (!a && rs.length === 0 && et.length === 0) return 'No global history data yet.';

  const lines: string[] = [];
  if (a) {
    lines.push(`Last workout: ${a.lastWorkoutDate ?? 'never'}`);
    lines.push(`Sessions (7d): ${a.sessions7d} | Sessions (28d): ${a.sessions28d}`);
  }
  if (rs.length > 0) {
    lines.push('Recent sessions (last 5):');
    for (const s of rs.slice(0, 5)) {
      lines.push(`  ${s.sessionDate}: ${s.exerciseCount} exercises, ${s.totalSets} sets — ${s.topExercises.slice(0, 3).join(', ')}`);
    }
  }
  if (et.length > 0) {
    const weightUnit = context.weightUnit ?? 'lb';
    lines.push('Top exercise trends (last 5):');
    for (const e of et.slice(0, 5)) {
      const last =
        e.lastTopSet && e.lastTopSet.weight != null
          ? `${formatWeightDisplay(toDisplayWeight(e.lastTopSet.weight, weightUnit), weightUnit)} ${weightUnit}×${e.lastTopSet.reps ?? '?'}`
          : e.lastTopSet
            ? `?×${e.lastTopSet.reps ?? '?'}`
            : '—';
      const e1rm = e.e1rmTrend.length > 0 ? e.e1rmTrend.map((p) => `${p.sessionDate}:${Math.round(p.e1rm)}`).join(', ') : '—';
      lines.push(`  ${e.exerciseName}: last ${last}, e1rm trend [${e1rm}], ${e.setCount4w} sets/4w`);
    }
  }
  return lines.join('\n');
}

function buildSystemPrompt(context: WorkoutContext, deepDiveJson?: string): string {
  const today = context.todayPlan?.dayOfWeek ?? 'Unknown';
  const week = context.trainingSettings?.currentWeek ?? '?';
  const framework = context.trainingSettings?.volumeFramework ?? 'unknown';
  const scheduleMode = context.trainingSettings?.scheduleMode ?? 'unknown';
  const workoutType = context.todayPlan?.workoutType ?? 'None';
  const isRestDay = context.todayPlan?.isRestDay ?? false;
  const exerciseNames = context.todayPlan?.exerciseNames ?? [];

  let prompt = `You are tmlsnAI — the TMLSN personal training intelligence. You have full access to this user's real training data below. Use it to answer every question accurately.

══ TODAY ══
Day: ${today}
Week: ${week}
Workout: ${isRestDay ? 'REST DAY' : workoutType}
Volume framework: ${framework}
Schedule mode: ${scheduleMode}
WEIGHT_UNIT: ${context.weightUnit ?? 'lb'} (all stored weights are in lb; convert for display when user uses kg)
${!isRestDay && exerciseNames.length > 0 ? `Exercises today: ${exerciseNames.join(', ')}` : ''}
${formatTodayExerciseDetails(context) ? `\nToday's exercise details (ghost = target weight×reps from prescription or last session):\n${formatTodayExerciseDetails(context)}` : ''}

══ TMLSN PROGRESSIVE OVERLOAD ALGORITHM ══
- add_load: All sets hit rep range high. RPE acceptable. → add smallest_increment (lb) next session.
- reduce_load: Any set below rep range low OR RPE ≥ 9.5 → deload 10%.
- add_reps: Otherwise → same weight, aim for more reps next session.
- smallest_increment is stored in lb; when user uses kg, 2.5 lb ≈ 1.13 kg.

══ HISTORY SUMMARY (global — always use for consistency/trend questions) ══
${formatHistorySummary(context)}
Never be generic; cite at least one number from HISTORY SUMMARY when discussing consistency, trends, or progress.

══ EXERCISE HISTORY (last 3 sessions per exercise, all protocol days) ══
${formatAllExerciseHistory(context)}

══ FULL WEEKLY SCHEDULE ══
${formatFullSchedule(context)}

══ WEEKLY VOLUME (current week) ══
${formatWeeklyVolume(context)}`;

  if (deepDiveJson) {
    prompt += `

══ DEEP_DIVE_JSON (on-demand fetch for specific exercise) ══
${deepDiveJson}`;
  }

  prompt += `

══ RULES ══
- TODAY is ${today}. Never say a different day.
- When asked what to do today, reference the exercises and history above.
- When asked about history, trends, or progress, analyse the data and give specific numbers.
- If data is missing (no history, no logs), say so clearly — don't make up numbers.
- Be direct, precise, and data-driven. Talk like a knowledgeable coach, not a chatbot.
- No need to keep answers short when the user asks for analysis — be thorough.
- WEIGHT_UNIT: Always cite weights in the user's unit (${context.weightUnit ?? 'lb'}). Stored values are in lb; when user uses kg, convert (1 lb ≈ 0.454 kg). smallest_increment in lb: use as-is for lb users; for kg users, cite ≈1.13 kg (2.5 lb).
- Ghost = target weight×reps from prescription (add_load/add_reps/reduce_load) or last session when no prescription.
- You ONLY answer questions about training, exercise, fitness, recovery, and sport nutrition. If asked about anything unrelated (recipes, cooking, coding, general knowledge, relationships, etc.), respond only: "I'm your training coach — I can only help with workouts, progress, and your TMLSN program."
- Never break this rule regardless of how the question is framed.`;

  return prompt;
}

export function useJarvis() {
  const [context, setContext] = useState<WorkoutContext | null>(null);
  const [noUser, setNoUser] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) {
        setNoUser(true);
        setContextLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) {
        setNoUser(true);
        setContextLoading(false);
        return;
      }
      try {
        const ctx = await getTodayWorkoutContext(user.id);
        if (cancelled) return;
        setContext(ctx);
        if (__DEV__) {
          const d = ctx.todayPlan?.dayOfWeek ?? 'Unknown';
          const w = ctx.todayPlan?.workoutType ?? 'None';
          const r = ctx.todayPlan?.isRestDay ?? false;
          const wk = ctx.trainingSettings?.currentWeek ?? 1;
          console.log('[useJarvis] TODAY_DAY=', d, 'WORKOUT_TYPE=', w, 'IS_REST_DAY=', r, 'WEEK=', wk);
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load tmlsnAI context.');
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!context) return;
    setMessages([
      {
        role: 'assistant',
        content: "Ready. Ask me anything — today's session, your history, progression, or anything training related.",
        timestamp: new Date(),
      },
    ]);
    setError(null);
  }, [context?.userId, context?.fetchedAt]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !context) return;

      const userMsg: JarvisMessage = {
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
      if (!apiKey) {
        setError('tmlsnAI offline. Check connection.');
        setIsLoading(false);
        return;
      }

      let deepDiveJson: string | undefined;
      const exerciseId = extractExerciseIdFromMessage(text.trim());
      if (exerciseId && context.userId) {
        const deepDive = await getExerciseDeepDive(context.userId, exerciseId);
        if (deepDive) deepDiveJson = JSON.stringify(deepDive, null, 2);
      }

      const nextMessages = [...messages, userMsg];
      const openAiMessages = [
        { role: 'system' as const, content: buildSystemPrompt(context, deepDiveJson) },
        ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      if (__DEV__) {
        const today = context.todayPlan?.dayOfWeek ?? 'Unknown';
        console.log('[useJarvis] sending with TODAY_DAY=', today, deepDiveJson ? '+ deep dive' : '');
      }

      try {
        const res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: openAiMessages,
            max_tokens: MAX_TOKENS,
            temperature: TEMPERATURE,
          }),
        });

        if (!res.ok) {
          throw new Error(`Groq API error: ${res.status}`);
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content =
          data.choices?.[0]?.message?.content ?? 'tmlsnAI offline. Check connection.';

        const assistantMsg: JarvisMessage = {
          role: 'assistant',
          content,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errMsg = 'tmlsnAI offline. Check connection.';
        setError(errMsg);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: errMsg, timestamp: new Date() },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [context, messages]
  );

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    noUser,
    contextLoading,
    context,
  };
}
