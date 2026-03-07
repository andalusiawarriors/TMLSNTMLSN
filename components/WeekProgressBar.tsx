// ============================================================
// WeekProgressBar — redesign v2
// Shows 7 day circles (Mon–Sun) with letter labels.
// Circle states:
//   done  → filled, MUTED
//   today → filled, GOLD
//   rest  → small dash, dimmed
//   empty → dim ring
// Below: "X sessions this week" / "X of Y this week"
// ============================================================

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getUserSettings, getWorkoutSessions } from '../utils/storage';
import { DEFAULT_TRAINING_SETTINGS } from '../constants/storageDefaults';
import type { TrainingSettings, WeekReset } from '../types';
import type { WorkoutSession } from '../types';
import { formatLocalYMD } from '../lib/time';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const MUTED  = '#404a52';
const SUB    = '#7a8690';
const GOLD   = '#D4B896';
const S2     = '#1e2022';

// Mon–Sun abbreviations
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMondayYMD(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatLocalYMD(d);
}

function getWeekStartYMD(date: Date, weekReset: WeekReset, customDay?: number): string {
  if (weekReset === 'monday') return getMondayYMD(date);
  if (weekReset === 'rolling') return formatLocalYMD(date);
  if (weekReset === 'custom_day' && customDay != null && customDay >= 0 && customDay <= 6) {
    const d = new Date(date);
    const currentDay = d.getDay();
    let diff = customDay - currentDay;
    if (diff > 0) diff -= 7;
    else if (diff < -6) diff += 7;
    d.setDate(d.getDate() + diff);
    return formatLocalYMD(d);
  }
  return getMondayYMD(date);
}

function getWeekDateRange(weekReset: WeekReset, customDay?: number): { start: string; end: string; dates: string[] } {
  const today = new Date();

  if (weekReset === 'rolling') {
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(formatLocalYMD(d));
    }
    return { start: dates[0]!, end: dates[6]!, dates };
  }

  const startYMD  = getWeekStartYMD(today, weekReset, customDay);
  const startDate = new Date(startYMD + 'T12:00:00');
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    dates.push(formatLocalYMD(d));
  }
  return { start: dates[0]!, end: dates[6]!, dates };
}

function getCompletedDatesInRange(sessions: WorkoutSession[], start: string, end: string): Set<string> {
  const completed = new Set<string>();
  for (const s of sessions) {
    if (!s.isComplete) continue;
    const ymd = s.date.split('T')[0];
    if (ymd && ymd >= start && ymd <= end) completed.add(ymd);
  }
  return completed;
}

type DayState = 'done' | 'today' | 'empty' | 'rest';
type DayItem  = { ymd: string; state: DayState; isRest: boolean };

function buildDayItems(
  scheduleMode: 'tmlsn' | 'builder' | 'ghost',
  dates: string[],
  completed: Set<string>,
  todayYMD: string,
): DayItem[] {
  const tmsRestIndices = new Set([2, 6]); // Wed, Sun for tmlsn

  return dates.map((ymd, i) => {
    const isRest  = scheduleMode === 'tmlsn' && tmsRestIndices.has(i);
    const isToday = ymd === todayYMD;
    const isDone  = completed.has(ymd);

    let state: DayState = 'empty';
    if (isToday)     state = 'today';
    else if (isDone) state = 'done';
    else if (isRest) state = 'rest';

    return { ymd, state, isRest };
  });
}

// ─── Day circle component ─────────────────────────────────────────────────────

function DayCircle({ item, letter }: { item: DayItem; letter: string }) {
  const isToday  = item.state === 'today';
  const isDone   = item.state === 'done';
  const isRest   = item.state === 'rest';

  return (
    <View style={W.dayItem}>
      <Text style={[W.dayLetter, isToday && W.dayLetterToday]}>
        {letter}
      </Text>
      {isRest ? (
        <View style={W.restDash} />
      ) : (
        <View style={[
          W.circle,
          isDone  && W.circleDone,
          isToday && W.circleToday,
        ]} />
      )}
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WeekProgressBar() {
  const [training,  setTraining]  = useState<TrainingSettings | null>(null);
  const [sessions,  setSessions]  = useState<WorkoutSession[]>([]);

  const load = useCallback(async () => {
    const [settings, workoutSessions] = await Promise.all([
      getUserSettings(),
      getWorkoutSessions(),
    ]);
    const t = settings.training ?? DEFAULT_TRAINING_SETTINGS;
    setTraining({ ...DEFAULT_TRAINING_SETTINGS, ...t });
    setSessions(workoutSessions);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Skeleton ──
  if (!training) {
    return (
      <View style={W.container}>
        <View style={W.circleRow}>
          {DAY_LETTERS.map((l, i) => (
            <View key={i} style={W.dayItem}>
              <View style={W.skeletonLetter} />
              <View style={W.circle} />
            </View>
          ))}
        </View>
        <View style={W.skeletonLabel} />
      </View>
    );
  }

  const scheduleMode = (training.scheduleMode ?? 'ghost') as 'tmlsn' | 'builder' | 'ghost';
  const weekReset    = training.weekReset ?? 'monday';
  const customDay    = (training as TrainingSettings & { customWeekStartDay?: number })?.customWeekStartDay;
  const target       = scheduleMode === 'tmlsn'
    ? 5
    : scheduleMode === 'builder'
    ? (training.weeklySessionTarget ?? 4)
    : undefined;

  const { start, end, dates } = getWeekDateRange(weekReset, customDay);
  const completed = getCompletedDatesInRange(sessions, start, end);
  const todayYMD  = formatLocalYMD(new Date());
  const dayItems  = buildDayItems(scheduleMode, dates, completed, todayYMD);

  const countText = target != null
    ? `${completed.size} of ${target} sessions this week`
    : `${completed.size} session${completed.size !== 1 ? 's' : ''} this week`;

  return (
    <View style={W.container}>
      <View style={W.circleRow}>
        {dayItems.map((item, i) => (
          <DayCircle key={item.ymd} item={item} letter={DAY_LETTERS[i]!} />
        ))}
      </View>
      <Text style={W.countLabel}>
        <Text style={W.countNum}>{completed.size}</Text>
        {target != null ? ` of ${target} sessions this week` : ` session${completed.size !== 1 ? 's' : ''} this week`}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CIRCLE_SIZE = 22;

const W = StyleSheet.create({
  container: {
    marginBottom: 22,
  },

  circleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  dayItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },

  dayLetter: {
    fontSize: 10,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.2,
  },
  dayLetterToday: {
    color: GOLD,
  },

  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: S2,
  },
  circleDone: {
    backgroundColor: MUTED,
    borderColor: MUTED,
  },
  circleToday: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },

  restDash: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: (CIRCLE_SIZE - 2) / 2,
  },

  countLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
  },
  countNum: {
    color: SUB,
    fontWeight: '600',
  },

  // Skeleton
  skeletonLetter: {
    width: 8,
    height: 10,
    borderRadius: 2,
    backgroundColor: 'rgba(198,198,198,0.06)',
  },
  skeletonLabel: {
    alignSelf: 'center',
    width: 120,
    height: 12,
    borderRadius: 2,
    backgroundColor: 'rgba(198,198,198,0.06)',
    marginTop: 2,
  },
});
