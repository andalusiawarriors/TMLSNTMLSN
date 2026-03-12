// ============================================================
// TodaysSessionCarousel — redesign v4
// Changes:
//  1. SF Pro Semi Bold (fontWeight '600') throughout
//  2. Silver gradient start button with white text
//  3. Gold gradient on weight text
//  4. Numbered exercise rows (1, 2, 3…)
//  5. 15px table text, reduced PAD for wider layout
//  6. Centred white date at very top (replaces eyebrow date)
//  7. metaDot + metaBadge removed (TMS label gone)
//  8. Redesigned WeekProgressBar (below)
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useRouter } from 'expo-router';
import { ShinyText } from './ShinyText';
import { useJarvis } from '../hooks/useJarvis';
import { useActiveWorkout } from '../context/ActiveWorkoutContext';
import { useAuth } from '../context/AuthContext';
import { AnimatedFadeInUp } from './AnimatedFadeInUp';
import { TMLSN_SPLITS } from '../constants/workoutSplits';
import type { WorkoutContext, ScheduledSet } from '../lib/getWorkoutContext';
import { formatLocalYMD } from '../lib/time';
import { toDisplayWeight, formatWeightDisplay } from '../utils/units';
import type { WeightUnit } from '../utils/units';
import { decideNextPrescription } from '../lib/progression/decideNextPrescription';
import { EXERCISE_MAP } from '../utils/exerciseDb/exerciseDatabase';
import type { OverloadCategory } from '../lib/progression/decideNextPrescription';
import { getSessionCompletedDate } from '../utils/storage';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const PAD    = 16;
const TEXT   = '#edf0f2';
const SUB    = '#7a8690';
const QS     = '#ABABAB';
const BORDER = 'rgba(255,255,255,0.05)';

// Gradient stops
const SILVER = ['#B8BABC', '#D6D8DA', '#A0A4A8', '#6B6F74'] as const;
const SILVER_LOCS = [0, 0.37, 0.69, 1] as const;
const GOLD_GRAD = ['#D4B896', '#A8895E'] as const;
const MAX_DISPLAY_ROWS = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

type LiftRow = {
  name: string;
  sets: number;
  reps: number;
  weightVal: string;
  weightLabel: string;
  weightUnit: WeightUnit;
  percentChange: string | null;
  signal: string;
  isNew: boolean;
  overloadType: 'up' | 'same' | 'deload' | null;
  prevWeight: number;   // last session weight (display units)
  prevSets: number;
  prevReps: number;
};

// ─── History helpers ──────────────────────────────────────────────────────────

function getLastSets(recentSets: ScheduledSet[]): ScheduledSet[] {
  if (recentSets.length === 0) return [];
  const first = recentSets[0].sessionDate;
  return recentSets.filter((s) => s.sessionDate === first);
}

// ─── Compute lift rows ────────────────────────────────────────────────────────

function computeLiftRows(context: WorkoutContext | null): LiftRow[] {
  if (!context?.todayPlan || context.todayPlan.isRestDay) return [];
  const { todayPlan, exerciseHistory, todayExerciseDetails } = context;
  const weightUnit: WeightUnit = (context.weightUnit ?? 'lb') as WeightUnit;
  const names     = todayPlan.exerciseNames ?? [];
  const history   = exerciseHistory ?? [];
  const details   = todayExerciseDetails ?? [];

  const split = TMLSN_SPLITS.find((s) => s.name === (todayPlan.workoutType ?? ''));

  return todayPlan.exerciseIds.map((_, i) => {
    const name     = names[i] ?? `Exercise ${i + 1}`;
    const recent   = history[i]?.recentSets ?? [];
    const lastSets = getLastSets(recent);
    const exDetail = details[i];
    const splitEx  = split?.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase());

    // ── Rep range: todayExerciseDetails (manual → split → history → default) first, then split, then history fallback ─
    const repRangeLow  = exDetail?.repRangeLow ?? splitEx?.targetReps ?? lastSets.find((s) => s.targetReps != null)?.targetReps ?? 8;
    const repRangeHigh = exDetail?.repRangeHigh ?? splitEx?.targetReps ?? (repRangeLow + 4);

    // ── Sets: split definition or workout history ─────────────────────────────
    const baseSets = splitEx?.targetSets ?? (lastSets.length || 3);

    // Stored weight is in lb; convert to display unit for all UI
    const baseWeightStored = lastSets.find((s) => s.targetWeight != null)?.targetWeight ??
                            lastSets[0]?.weight ?? 0;
    const baseWeight = toDisplayWeight(baseWeightStored, weightUnit);

    if (lastSets.length === 0) {
      return { name, sets: baseSets, reps: repRangeLow, weightVal: '—', weightLabel: '', weightUnit, percentChange: null, signal: '', isNew: true, overloadType: null, prevWeight: 0, prevSets: 0, prevReps: 0 };
    }

    // Use todayExerciseDetails when available (from buildTodayExerciseDetails with persisted progression state)
    if (exDetail?.ghostWeight && exDetail.ghostReps && exDetail.ghostWeight !== '—') {
      const targetWeightDisplay = exDetail.nextWeightLb != null
        ? toDisplayWeight(exDetail.nextWeightLb, weightUnit)
        : baseWeight;
      const overloadType = exDetail.action === 'increase weight' ? 'up' : 'same';
      const displayReps = parseInt(exDetail.ghostReps, 10) || repRangeHigh;
      const weightVal = exDetail.ghostWeight;
      const weightLabel = targetWeightDisplay > 0 ? weightUnit : '';
      const signal = overloadType === 'up' ? '↑' : '';
      let percentChange: string | null = null;
      if (baseWeight > 0 && targetWeightDisplay !== baseWeight) {
        const pct = ((targetWeightDisplay - baseWeight) / baseWeight) * 100;
        percentChange = pct > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
      } else if (baseWeight > 0 && overloadType === 'same') {
        percentChange = '0%';
      }
      return { name, sets: baseSets, reps: displayReps, weightVal, weightLabel, weightUnit, percentChange, signal, isNew: false, overloadType, prevWeight: baseWeight, prevSets: lastSets.length, prevReps: lastSets[0]?.reps ?? repRangeLow };
    }

    // Fallback: run engine with state from todayExerciseDetails (from exercise_progress_state) or defaults
    const exerciseId = todayPlan.exerciseIds[i];
    const overloadCategory: OverloadCategory =
      (exerciseId ? EXERCISE_MAP.get(exerciseId)?.overloadCategory : undefined) ?? 'compound_small';

    const decision = decideNextPrescription({
      sets: lastSets.map((s) => ({
        weight: s.weight ?? 0,
        reps: s.reps ?? 0,
        rpe: s.rpe ?? null,
        completed: true,
      })),
      repRangeLow,
      repRangeHigh,
      overloadCategory,
      currentBand: (exDetail?.currentBand as 'easy' | 'medium' | 'hard' | 'extreme') ?? 'easy',
      consecutiveSuccess: exDetail?.consecutiveSuccess ?? 0,
      consecutiveFailure: exDetail?.consecutiveFailure ?? 0,
      isCalibrating: false,
      isDeloadWeek: false,
      blitzMode: false,
    });

    const targetWeightDisplay = weightUnit === 'kg'
      ? (decision?.nextWeightKg ?? baseWeight)
      : toDisplayWeight(decision?.nextWeightLb ?? baseWeightStored, weightUnit);
    const overloadType = decision?.action === 'add_weight' ? 'up' : 'same';
    const displayReps = decision?.nextRepTarget ?? repRangeHigh;

    const weightVal   = targetWeightDisplay > 0 ? formatWeightDisplay(targetWeightDisplay, weightUnit) : '—';
    const weightLabel = targetWeightDisplay > 0 ? weightUnit : '';
    const signal      = overloadType === 'up' ? '↑' : '';

    let percentChange: string | null = null;
    if (baseWeight > 0 && targetWeightDisplay !== baseWeight) {
      const pct = ((targetWeightDisplay - baseWeight) / baseWeight) * 100;
      percentChange = pct > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
    } else if (baseWeight > 0 && overloadType === 'same') {
      percentChange = '0%';
    }

    return { name, sets: baseSets, reps: displayReps, weightVal, weightLabel, weightUnit, percentChange, signal, isNew: false, overloadType, prevWeight: baseWeight, prevSets: lastSets.length, prevReps: lastSets[0]?.reps ?? repRangeLow };
  });
}

// ─── Skeleton pulse block ─────────────────────────────────────────────────────

function SkeletonBlock({
  height,
  width,
  borderRadius = 10,
  delay = 0,
  style,
}: {
  height: number;
  width?: number | string;
  borderRadius?: number;
  delay?: number;
  style?: object;
}) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0.75, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [delay]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { height, borderRadius, backgroundColor: '#2F3031' },
        width !== undefined ? { width: width as any } : { alignSelf: 'stretch' },
        animStyle,
        style,
      ]}
    />
  );
}

// ─── Silver gradient title text ───────────────────────────────────────────────

function SilverTitleText({ text }: { text: string }) {
  return (
    <MaskedView
      style={{ marginBottom: 0, alignSelf: 'flex-start', marginLeft: -(PAD + 4) }}
      maskElement={
        <Text style={[S.sessionName, { backgroundColor: 'transparent' }]}>{text}</Text>
      }
    >
      <LinearGradient
        colors={SILVER}
        locations={SILVER_LOCS}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <Text style={[S.sessionName, { opacity: 0 }]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

// ─── Gold gradient weight text ────────────────────────────────────────────────

function GoldWeightText({ text, style }: { text: string; style: object }) {
  if (text === '—') {
    return <Text style={[style, { color: '#404a52' }]}>{text}</Text>;
  }
  return (
    <MaskedView
      style={{ flexShrink: 0 }}
      maskElement={
        <Text style={[style, { backgroundColor: 'transparent' }]} numberOfLines={1}>{text}</Text>
      }
    >
      <LinearGradient
        colors={GOLD_GRAD}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={[style, { opacity: 0 }]} numberOfLines={1}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

// ─── Exercise row (flippable) ─────────────────────────────────────────────────

function LiftItem({ row, index }: { row: LiftRow; index: number }) {
  const [flipped, setFlipped] = useState(false);
  const scaleX = useSharedValue(1);

  const toggle = useCallback(() => {
    const next = !flipped;
    scaleX.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.ease) }, (done) => {
      'worklet';
      if (done) {
        runOnJS(setFlipped)(next);
        scaleX.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.ease) });
      }
    });
  }, [flipped]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: scaleX.value }] }));

  return (
    <Pressable onPress={toggle}>
      <Animated.View style={[S.exRowRect, animStyle]}>
        {flipped ? (
          // ── Back: last session ──────────────────────────────────────────────
          <View style={S.exRow}>
            <Text style={[S.exNum, { color: QS }]}>{index + 1}</Text>
            <Text style={S.exBackLabel} numberOfLines={1}>last session</Text>
            <View style={S.exRight}>
              <View style={S.exDataBlock}>
                <Text style={[S.exDataValue, { color: QS }]}>{row.prevSets > 0 ? row.prevSets : '—'}</Text>
                <Text style={S.exDataLabel}>sets</Text>
              </View>
              <View style={S.exDataBlock}>
                <Text style={[S.exDataValue, { color: QS }]}>{row.prevReps > 0 ? row.prevReps : '—'}</Text>
                <Text style={S.exDataLabel}>reps</Text>
              </View>
              <View style={[S.exDataBlock, S.exDataBlockWide]}>
                <Text style={[S.exDataValue, { color: QS }]}>
                  {row.prevWeight > 0 ? formatWeightDisplay(row.prevWeight, row.weightUnit) : '—'}
                </Text>
                <Text style={S.exDataLabel}>{row.weightLabel || 'kg'}</Text>
              </View>
              <View style={[S.exDataBlock, S.exDataBlockPercent]} />
            </View>
          </View>
        ) : (
          // ── Front: today's targets ──────────────────────────────────────────
          <View style={S.exRow}>
            <Text style={S.exNum}>{index + 1}</Text>
            <Text style={S.exName} numberOfLines={1} ellipsizeMode="tail">{row.name}</Text>
            <View style={S.exRight}>
              <View style={S.exDataBlock}>
                <Text style={S.exDataValue} numberOfLines={1}>{row.sets}</Text>
                <Text style={S.exDataLabel}>sets</Text>
              </View>
              <View style={S.exDataBlock}>
                <Text style={S.exDataValue} numberOfLines={1}>{row.reps}</Text>
                <Text style={S.exDataLabel}>reps</Text>
              </View>
              <View style={[S.exDataBlock, S.exDataBlockWide]}>
                {row.weightVal === '—' ? (
                  <Text style={[S.exDataValue, { color: QS }]}>—</Text>
                ) : (
                  <GoldWeightText text={row.weightVal} style={S.exDataValue} />
                )}
                <Text style={S.exDataLabel}>{row.weightLabel || 'kg'}</Text>
              </View>
              <View style={[S.exDataBlock, S.exDataBlockPercent]}>
                {row.percentChange ? (
                  <Text
                    style={[S.exDataValue, {
                      color: row.percentChange === '0%' ? '#C2C3C3'
                        : row.percentChange.startsWith('-') ? '#FF0D0D'
                        : 'rgba(96, 243, 133, 0.6)',
                    }]}
                    numberOfLines={1}
                  >
                    {row.percentChange}
                  </Text>
                ) : (
                  <Text style={[S.exDataValue, { color: QS }]}>—</Text>
                )}
              </View>
            </View>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Silver gradient start button ─────────────────────────────────────────────

function StartButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginBottom: 3 })}
    >
      <LinearGradient
        colors={SILVER}
        locations={SILVER_LOCS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={S.startBtn}
      >
        <Text style={S.startBtnIcon}>▶</Text>
        <Text style={S.startBtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TodaysSessionCarousel({ animTrigger = 0 }: { animTrigger?: number }) {
  const router              = useRouter();
  const { activeWorkout }   = useActiveWorkout();
  const { user } = useAuth();
  const { context, contextLoading, refresh } = useJarvis();
  const [showAll, setShowAll] = useState(false);
  const [sessionDoneToday, setSessionDoneToday] = useState(false);

  // Check if user already completed today's recommended session
  useEffect(() => {
    (async () => {
      try {
        const stored = await getSessionCompletedDate(user?.id);
        const today  = formatLocalYMD(new Date());
        setSessionDoneToday(stored === today);
      } catch {
        setSessionDoneToday(false);
      }
    })();
  }, [animTrigger, user?.id]); // re-check on focus and auth switch

  // Refresh Jarvis context every time the Fitness tab is focused
  const firstMountRef = useRef(false);
  useEffect(() => {
    if (!firstMountRef.current) { firstMountRef.current = true; return; }
    refresh();
  }, [animTrigger]);
  const liftRows    = computeLiftRows(context);
  const isRestDay   = context?.todayPlan?.isRestDay ?? false;
  const scheduleMode = context?.trainingSettings?.scheduleMode ?? 'ghost';

  // ── Session already done today ──
  if (sessionDoneToday && !activeWorkout && !contextLoading) {
    return (
      <View style={S.hero}>
        <ShinyText
          text="all caught up."
          speed={5}
          delay={0}
          spread={120}
          yoyo={false}
          color="#b5b5b5"
          shineColor="#ffffff"
          direction="right"
          style={S.sessionName}
          containerStyle={{ marginBottom: 0, marginLeft: -(PAD + 4) }}
        />
        <Text style={S.eyebrow}>see you tomorrow</Text>
      </View>
    );
  }

  // ── Loading ──
  if (contextLoading) {
    return (
      <View style={S.hero}>
        {/* Title skeleton */}
        <SkeletonBlock height={42} width="62%" borderRadius={8} delay={0} style={{ marginLeft: -(PAD + 4), marginBottom: 8 }} />
        {/* Eyebrow skeleton */}
        <SkeletonBlock height={13} width={88} borderRadius={4} delay={80} style={{ marginLeft: -(PAD + 4), marginBottom: 20 }} />
        {/* Exercise row skeletons */}
        <View style={[S.exList, { marginBottom: 8 }]}>
          <SkeletonBlock height={55} borderRadius={16} delay={160} />
          <SkeletonBlock height={55} borderRadius={16} delay={240} />
          <SkeletonBlock height={55} borderRadius={16} delay={320} />
        </View>
        {/* Button skeleton */}
        <View style={S.startBtnWrap}>
          <SkeletonBlock height={55} borderRadius={16} delay={400} />
        </View>
      </View>
    );
  }

  if (!context) return null;

  // ── Rest day — same as no session today ──
  if (isRestDay) {
    return (
      <View style={S.hero}>
        <ShinyText
          text="No session today."
          speed={5}
          delay={0}
          spread={120}
          yoyo={false}
          color="#b5b5b5"
          shineColor="#ffffff"
          direction="right"
          style={S.sessionName}
          containerStyle={{ marginBottom: 0, marginLeft: -(PAD + 4) }}
        />
        <Text style={S.eyebrow}>rest day</Text>
        <View style={S.startBtnWrap}>
          <StartButton
            label="Start Session"
            onPress={() => router.push('/fitness-hub-your-routines' as any)}
          />
        </View>
        {scheduleMode !== 'tmlsn' && (
          <Pressable onPress={() => router.push('/week-builder' as any)} style={{ marginTop: 10 }}>
            <Text style={S.secondaryLink}>or build your week →</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ── No exercises but a named session exists — show name + start button ──
  if (liftRows.length === 0) {
    const wt = context?.todayPlan?.workoutType;
    if (!wt) return null;
    return (
      <View style={S.hero}>
        <ShinyText
          text={wt}
          speed={5}
          delay={0}
          spread={120}
          yoyo={false}
          color="#b5b5b5"
          shineColor="#ffffff"
          direction="right"
          style={S.sessionName}
          containerStyle={{ marginBottom: 0, marginLeft: -(PAD + 4) }}
        />
        <Text style={S.eyebrow}>today's session</Text>
        <View style={S.startBtnWrap}>
          <StartButton
            label={`Start ${wt}`}
            onPress={() => {
              if (activeWorkout) return;
              const split = TMLSN_SPLITS.find((s) => s.name === wt);
              if (split) {
                router.replace({ pathname: '/(tabs)/workout', params: { startSplitId: split.id } } as any);
              } else {
                router.push('/fitness-hub-tmlsn-routines' as any);
              }
            }}
          />
        </View>
      </View>
    );
  }

  // ── Full session ──
  const todayPlan   = context.todayPlan as any;
  const sessionName = todayPlan?.sessionName ?? todayPlan?.label ??
                      context.todayPlan?.workoutType ?? context.todayPlan?.dayOfWeek ?? "Today's Session";
  const displayRows = showAll ? liftRows : liftRows.slice(0, MAX_DISPLAY_ROWS);
  const remaining   = liftRows.length - MAX_DISPLAY_ROWS;
  const remainingRows = !showAll && remaining > 0 ? liftRows.slice(MAX_DISPLAY_ROWS) : [];
  const remainingNames = remainingRows.map((r) => r.name.toLowerCase()).join(', ');

  return (
    <View style={S.hero}>

      {/* Session name — shiny text (Customize: 5s, 0s delay, 120° spread, #b5b5b5/#ffffff, left, no yoyo) */}
      <ShinyText
        text={sessionName}
        speed={5}
        delay={0}
        spread={120}
        yoyo={false}
        color="#b5b5b5"
        shineColor="#ffffff"
        direction="right"
        style={S.sessionName}
        containerStyle={{ marginBottom: 0, marginLeft: -(PAD + 4) }}
      />

      {/* Eyebrow — below session name */}
      <Text style={S.eyebrow}>today's session</Text>

      {/* Exercise list */}
      <View style={S.exList}>
        {displayRows.map((row, i) => (
          <AnimatedFadeInUp key={i} delay={i * 55} duration={300} trigger={animTrigger} distance={10}>
            <LiftItem row={row} index={i} />
          </AnimatedFadeInUp>
        ))}
        {!showAll && remaining > 0 && (
          <AnimatedFadeInUp delay={displayRows.length * 55} duration={300} trigger={animTrigger} distance={10}>
            <Pressable onPress={() => setShowAll(true)}>
              <View style={S.exRowRect}>
                <View style={S.moreRowContent}>
                  <Text style={S.moreText} numberOfLines={1}>+ {remaining} exercise{remaining !== 1 ? 's' : ''}</Text>
                  <Text style={S.moreNames} numberOfLines={1} ellipsizeMode="tail">
                    {remainingNames}
                  </Text>
                </View>
              </View>
            </Pressable>
          </AnimatedFadeInUp>
        )}
        {showAll && remaining > 0 && (
          <Pressable onPress={() => setShowAll(false)}>
            <View style={S.exRowRect}>
              <View style={S.moreRowContent}>
                <Text style={S.moreText}>− {remaining} exercise{remaining !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          </Pressable>
        )}
      </View>

      {/* Start button — same width/height as rows */}
      <View style={S.startBtnWrap}>
        <StartButton
          label={`Start ${sessionName}`}
          onPress={() => {
            if (activeWorkout) return;
            const workoutType = todayPlan?.workoutType ?? sessionName;
            const split = TMLSN_SPLITS.find((s) => s.name === workoutType);
            if (split) {
              router.replace({ pathname: '/(tabs)/workout', params: { startSplitId: split.id } } as any);
            } else {
              router.push('/fitness-hub-tmlsn-routines' as any);
            }
          }}
        />
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  hero: {
    paddingHorizontal: PAD,
    paddingBottom: 24,
  },

  // Eyebrow — auto width, SF Pro 16, -5% tracking, #979798
  eyebrow: {
    fontSize: 16,
    fontWeight: '600',
    color: '#979798',
    letterSpacing: -0.8,
    textAlign: 'left',
    textAlignVertical: 'top',
    marginTop: -8,
    marginBottom: 10,
    marginLeft: -(PAD + 4),
    alignSelf: 'flex-start',
  },

  // Exercise list — full width from session name to 4px from right edge
  exList: {
    gap: 6,
    marginBottom: 6,
    marginLeft: -(PAD + 4),
    marginRight: 4 - PAD,
    overflow: 'visible',
  },
  exRowRect: {
    backgroundColor: '#2F3031',
    borderRadius: 16,
    minHeight: 55,
    overflow: 'visible',
    justifyContent: 'center',
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 12,
    gap: 4,
  },
  exNum: {
    fontSize: 18,
    fontWeight: '600',
    color: '#C2C3C3',
    letterSpacing: -0.9,
    width: 20,
    textAlign: 'right',
    flexShrink: 0,
  },
  exName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    textTransform: 'lowercase',
    flex: 1,
    minWidth: 0,
    marginLeft: 4,
    flexShrink: 1,
  },
  exRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  exDataBlock: {
    alignItems: 'center',
    width: 30,
    minWidth: 30,
    flexShrink: 0,
  },
  exDataBlockWide: {
    width: 56,
    minWidth: 56,
    overflow: 'hidden',
  },
  exDataBlockPercent: {
    width: 52,
    minWidth: 52,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  exDataValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  exDataLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: SUB,
    marginTop: 2,
    textAlign: 'center',
  },
  exBackLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ABABAB',
    textTransform: 'lowercase',
    letterSpacing: -0.1,
    flex: 1,
    minWidth: 0,
    marginLeft: 4,
    flexShrink: 1,
  },
  moreRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingLeft: 18,
    paddingRight: 12,
    flex: 1,
  },
  moreText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'lowercase',
  },
  moreNames: {
    width: 168,
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '500',
    color: '#ABABAB',
    textTransform: 'lowercase',
  },

  // Session name — SF Pro Semi Bold 35, -5% tracking, 117.2% line-height, left/top aligned
  sessionName: {
    height: 42,
    fontSize: 35,
    fontWeight: '600',
    letterSpacing: -1.75,
    lineHeight: 41,
    textAlign: 'left',
    textAlignVertical: 'top',
    textTransform: 'lowercase',
  },

  startBtnWrap: {
    marginLeft: -(PAD + 4),
    marginRight: 4 - PAD,
  },
  // Start button (gradient applied via LinearGradient child)
  startBtn: {
    width: '100%',
    height: 55,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startBtnIcon: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  secondaryLink: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '400',
    color: '#ABABAB',
  },
});
