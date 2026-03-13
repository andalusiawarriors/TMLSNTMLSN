import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkoutContext, ScheduledSet } from '@/lib/getWorkoutContext';
import { getTodayWorkoutContext } from '@/lib/getWorkoutContext';
import { getDefaultTmlsnExercises, workoutTypeToProtocolDay } from '@/lib/getTmlsnTemplate';
import { getExerciseDeepDive, extractExerciseIdFromMessage } from '@/lib/getExerciseDeepDive';
import { uuidToExerciseName } from '@/lib/getTmlsnTemplate';
import { supabase } from '@/lib/supabase';
import { toDisplayWeight, formatWeightDisplay } from '@/utils/units';

export type JarvisMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export type UseJarvisResult = ReturnType<typeof useJarvis>;

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
  if (!details || details.length === 0) return '';

  return details
    .map((d) => {
      const ghost = `${d.ghostWeight ?? '—'}×${d.ghostReps ?? '—'}`;
      const actionPhrase = d.action ?? '—';
      const inc = d.incrementDisplay;
      const based = d.basedOn
        ? ` | last session ${d.basedOn.lastSessionDate} | ${d.basedOn.workingSetsAnalyzed} working sets | maxRPE ${d.basedOn.maxRpe ?? '—'} | hitTopRange ${d.basedOn.hitTopRange}`
        : '';
      return `  ${d.exerciseName}: ghost ${ghost} | action: ${actionPhrase} | rep range ${d.repRangeLow}–${d.repRangeHigh} | increment ${inc}${based}`;
    })
    .join('\n');
}

/** Structured prescription for exercise-specific questions. Single source of truth. */
function formatExercisePrescriptionForQuestion(
  context: WorkoutContext,
  exerciseId: string | null
): string {
  if (!exerciseId || !context.todayExerciseDetails || !context.todayPlan) return '';
  let detail = context.todayExerciseDetails[context.todayPlan.exerciseIds.indexOf(exerciseId)];
  if (!detail) {
    const askedName = uuidToExerciseName(exerciseId).toLowerCase();
    detail = context.todayExerciseDetails.find(
      (d) => d.exerciseName?.toLowerCase() === askedName
    ) ?? null;
  }
  if (!detail) return '';

  const base = detail.basedOn;
  return JSON.stringify(
    {
      exerciseName: detail.exerciseName,
      action: detail.action,
      nextWeightDisplay: detail.ghostWeight,
      nextRepTarget: detail.ghostReps,
      repRangeLow: detail.repRangeLow,
      repRangeHigh: detail.repRangeHigh,
      incrementDisplay: detail.incrementDisplay,
      reason: detail.reason,
      workingSetsAnalyzed: base?.workingSetsAnalyzed ?? 0,
      maxRpe: base?.maxRpe ?? null,
      allSetsAtTopRange: base?.hitTopRange ?? false,
      lastSessionDate: base?.lastSessionDate ?? null,
    },
    null,
    2
  );
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

function buildSystemPrompt(context: WorkoutContext, deepDiveJson?: string, exerciseIdForQuestion?: string | null): string {
  const today = context.todayPlan?.dayOfWeek ?? 'Unknown';
  const week = context.trainingSettings?.currentWeek ?? '?';
  const framework = context.trainingSettings?.volumeFramework ?? 'unknown';
  const scheduleMode = context.trainingSettings?.scheduleMode ?? 'unknown';
  const workoutType = context.todayPlan?.workoutType ?? 'None';
  const isRestDay = context.todayPlan?.isRestDay ?? false;
  const exerciseNames = context.todayPlan?.exerciseNames ?? [];

  const prescriptionJson = formatExercisePrescriptionForQuestion(context, exerciseIdForQuestion ?? null);

  let prompt = `You are tmlsnAI — the TMLSN personal training intelligence. You have full access to this user's real training data below. Use it to answer every question accurately.

══ TODAY ══
Day: ${today}
Week: ${week}
Workout: ${isRestDay ? 'REST DAY' : workoutType}
Volume framework: ${framework}
Schedule mode: ${scheduleMode}
WEIGHT_UNIT: ${context.weightUnit ?? 'lb'} (all stored weights are in lb; convert for display when user uses kg)
${!isRestDay && exerciseNames.length > 0 ? `Exercises today: ${exerciseNames.join(', ')}` : ''}
${formatTodayExerciseDetails(context) ? `\nToday's exercise details (ghost = exact target from canonical progression engine):\n${formatTodayExerciseDetails(context)}` : ''}
${prescriptionJson ? `\n══ EXERCISE_SPECIFIC_PRESCRIPTION (exact computed prescription — use this when the user asks about a specific exercise) ══\n${prescriptionJson}

══ EXERCISE_EXPLANATION_TEMPLATE (strict — follow exactly) ══
The prescription is based on the FULL set of working sets from the last session (workingSetsAnalyzed), not a single set. Never imply one set alone caused the decision.

For action = "build reps":
- Keep the same weight. Aim for the top of the rep range (repRangeHigh).
- Do NOT tell the user to exceed the range (e.g. "try to beat 12").
- Do NOT say "either weight or reps" or improvise with endurance/volume language.
- Instead of "you didn't quite hit the top of the range" → say: "you have not yet earned a load increase across your working sets".
- Instead of "try to beat 12" → say: "aim to hit [repRangeHigh] reps at this weight" (use the value from the prescription JSON).
- Keep it short and deterministic.

For action = "increase weight":
- You earned a load increase. Next session: add incrementDisplay to the weight, aim for repRangeLow–repRangeHigh.

For action = "deload":
- RPE too high or sets below range. Reduce ~10% next session.` : ''}

══ TMLSN PROGRESSIVE OVERLOAD ALGORITHM ══
- increase weight: All working sets hit rep range high AND max RPE < 9 → add increment next session.
- deload: Any set RPE ≥ 9.5 OR at least 2 sets below rep range low → reduce 10%.
- build reps: Otherwise → keep the same weight, aim for top of rep range.
- Increment is in the user's unit (e.g. 2.5 kg or 5.5 lb). Do not mention lb≈kg conversions.

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
- WEIGHT_UNIT: Always cite weights in the user's unit (${context.weightUnit ?? 'lb'}).
- PRESCRIPTION: When the user asks about a specific exercise (e.g. "what does my bench look like?", "ghost for bench?"), use EXERCISE_SPECIFIC_PRESCRIPTION and follow EXERCISE_EXPLANATION_TEMPLATE exactly. The decision is based on the full workingSetsAnalyzed, not one set — never imply a single set caused it. For build_reps: keep same weight, aim for top of range, do not say "try to beat X" or "either weight or reps". Use precise wording: "you have not yet earned a load increase across your working sets" and "aim to hit [repRangeHigh] reps at this weight". Never leak enum strings. Keep answers short and deterministic.
- Ghost = exact target from canonical engine. Never contradict it.
- You ONLY answer questions about training, exercise, fitness, recovery, and sport nutrition. If asked about anything unrelated (recipes, cooking, coding, general knowledge, relationships, etc.), respond only: "I'm your training coach — I can only help with workouts, progress, and your TMLSN program."
- Never break this rule regardless of how the question is framed.`;

  return prompt;
}

export function useJarvis() {
  const [context, setContext] = useState<WorkoutContext | null>(null);
  const [noUser, setNoUser] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(Symbol('jarvis-request'));

  const loadContext = useCallback(async () => {
    if (!supabase) {
      setContext(null);
      setNoUser(true);
      setContextLoading(false);
      setContextError(null);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setContext(null);
      setNoUser(true);
      setContextLoading(false);
      setContextError(null);
      return;
    }
    const requestId = Symbol('jarvis-request');
    requestIdRef.current = requestId;
    setContextLoading(true);
    setContextError(null);
    try {
      const ctx = await getTodayWorkoutContext(user.id);
      if (requestIdRef.current !== requestId) return;
      setContext(ctx);
      setContextError(null);
      if (__DEV__) {
        const d = ctx.todayPlan?.dayOfWeek ?? 'Unknown';
        const w = ctx.todayPlan?.workoutType ?? 'None';
        const r = ctx.todayPlan?.isRestDay ?? false;
        const wk = ctx.trainingSettings?.currentWeek ?? 1;
        console.log('[useJarvis] TODAY_DAY=', d, 'WORKOUT_TYPE=', w, 'IS_REST_DAY=', r, 'WEEK=', wk);
      }
    } catch (e) {
      if (requestIdRef.current !== requestId) return;
      const msg = e instanceof Error ? e.message : 'Failed to load tmlsnAI context.';
      setContext(null);
      setContextError(msg);
    } finally {
      if (requestIdRef.current === requestId) {
        setContextLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

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
        { role: 'system' as const, content: buildSystemPrompt(context, deepDiveJson, exerciseId) },
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
    contextError,
    context,
    refresh: loadContext,
  };
}
