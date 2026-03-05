import { useCallback, useEffect, useState } from 'react';
import type { WorkoutContext } from '@/lib/getWorkoutContext';
import { getTodayWorkoutContext } from '@/lib/getWorkoutContext';
import { generateBriefing } from '@/lib/generateBriefing';
import { supabase } from '@/lib/supabase';

export type JarvisMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const MAX_TOKENS = 400;
const TEMPERATURE = 0.4;

function buildSystemPrompt(context: WorkoutContext): string {
  const today = context.todayPlan?.dayOfWeek ?? 'Unknown';
  const workoutType = context.todayPlan?.workoutType ?? 'None';
  const isRestDay = context.todayPlan?.isRestDay ?? false;
  const exerciseCount = context.todayPlan?.exerciseIds?.length ?? 0;
  const exerciseNames = context.todayPlan?.exerciseNames ?? [];
  const week = context.trainingSettings?.currentWeek ?? 1;

  return `You are tmlsnAI, the TMLSN training intelligence system.

SOURCE OF TRUTH (must use):
- TODAY_DAY: ${today}
- WEEK: ${week}
- WORKOUT_TYPE: ${workoutType}
- IS_REST_DAY: ${isRestDay}
- EXERCISE_COUNT: ${exerciseCount}
- TODAY_EXERCISES: ${JSON.stringify(exerciseNames)}

RULES:
- Never calculate the day yourself. Never infer Friday/Monday/etc. Only use TODAY_DAY above.
- If TODAY_DAY is Unknown, respond: "I cannot determine today's day/schedule from your data."
- If user asks what day it is, respond with TODAY_DAY in one sentence, then schedule in one sentence.
- If WORKOUT_TYPE is set (e.g. TMLSN Upper Body B) but EXERCISE_COUNT is 0, respond: "Exercises are not configured for today. Add them in Training Settings → Protocol Templates."
- If user asks what exercises to do today, list the exercises from TODAY_EXERCISES above.

You have access to the user's training data. Be precise and data-driven. Reference their actual data.
Keep answers under 100 words. No bullet points.

USER CONTEXT:
${JSON.stringify(context)}`;
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
    const briefing = generateBriefing(context);
    setMessages([
      { role: 'assistant', content: briefing, timestamp: new Date() },
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

      const nextMessages = [...messages, userMsg];
      const openAiMessages = [
        { role: 'system' as const, content: buildSystemPrompt(context) },
        ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      if (__DEV__) {
        const today = context.todayPlan?.dayOfWeek ?? 'Unknown';
        console.log('[useJarvis] sending with TODAY_DAY=', today);
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
