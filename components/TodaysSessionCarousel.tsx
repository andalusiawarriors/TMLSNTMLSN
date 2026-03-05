// ============================================================
// TodaysSessionCarousel — horizontal scroll of today's exercises
// Extracted from tmlsnAI for use in FitnessHub.
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useJarvis } from '../hooks/useJarvis';
import { Colors } from '../constants/theme';
import type { WorkoutContext, ScheduledSet } from '../lib/getWorkoutContext';

// ─── Constants (match FitnessHub tile design) ───────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const PARENT_PAD = 19;
const GRID_GAP = 14;
const CARD_SIZE = Math.floor((SCREEN_WIDTH - PARENT_PAD * 2 - GRID_GAP) / 2);
const TILE_RADIUS = 38;
const MUTED = 'rgba(198,198,198,0.55)';
const WEIGHT_INCREMENT_KG = 2.5;

// ─── Types ────────────────────────────────────────────────────────────────────

type ExercisePlan = {
  name: string;
  hasHistory: boolean;
  lastStr: string;
  targetWeight: number;
  targetReps: number;
  note: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLastSets(recentSets: ScheduledSet[]): ScheduledSet[] {
  if (recentSets.length === 0) return [];
  const first = recentSets[0].sessionDate;
  return recentSets.filter((s) => s.sessionDate === first);
}

function maxRpe(sets: ScheduledSet[]): number | null {
  const vals = sets.map((s) => s.rpe).filter((r): r is number => r != null && r > 0);
  return vals.length > 0 ? Math.max(...vals) : null;
}

function avgRpe(sets: ScheduledSet[]): number | null {
  const vals = sets.map((s) => s.rpe).filter((r): r is number => r != null && r > 0);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function sessionGroups(recentSets: ScheduledSet[]): ScheduledSet[][] {
  const groups: ScheduledSet[][] = [];
  let cur: ScheduledSet[] = [];
  let lastDate: string | null = null;
  for (const s of recentSets) {
    if (lastDate !== s.sessionDate) {
      if (cur.length) groups.push(cur);
      cur = [];
      lastDate = s.sessionDate;
    }
    cur.push(s);
  }
  if (cur.length) groups.push(cur);
  return groups;
}

function rpeTrend(recentSets: ScheduledSet[]): 'up' | 'down' | 'stable' | null {
  const groups = sessionGroups(recentSets).slice(0, 3);
  if (groups.length < 2) return null;
  const avgs = groups.map(avgRpe).filter((a): a is number => a != null);
  if (avgs.length < 2) return null;
  const diff = avgs[0] - avgs[avgs.length - 1];
  if (diff >= 0.5) return 'up';
  if (diff <= -0.5) return 'down';
  return 'stable';
}

function lastSummary(lastSets: ScheduledSet[]): string {
  if (lastSets.length === 0) return '—';
  const w = lastSets[0].weight ?? 0;
  const reps = lastSets.map((s) => s.reps ?? 0).join('/');
  const rpe = maxRpe(lastSets);
  return rpe != null ? `${w}kg × ${reps}\nRPE ${rpe}` : `${w}kg × ${reps}`;
}

function computeExercisePlans(context: WorkoutContext | null): ExercisePlan[] {
  if (!context?.todayPlan || context.todayPlan.isRestDay) return [];
  const { todayPlan, exerciseHistory, trainingSettings } = context;
  const framework = trainingSettings?.volumeFramework ?? 'builder';
  const names = todayPlan.exerciseNames ?? [];
  const history = exerciseHistory ?? [];

  return todayPlan.exerciseIds.map((_, i) => {
    const name = names[i] ?? `Exercise ${i + 1}`;
    const recentSets = history[i]?.recentSets ?? [];
    const lastSets = getLastSets(recentSets);
    const lastStr = lastSummary(lastSets);

    const baseWeight =
      lastSets.find((s) => s.targetWeight != null)?.targetWeight ??
      lastSets[0]?.weight ?? 0;
    const baseReps =
      lastSets.find((s) => s.targetReps != null)?.targetReps ??
      lastSets[0]?.reps ?? 8;

    let targetWeight = baseWeight;
    let targetReps = baseReps;
    let note: string | null = null;

    if (framework === 'builder') {
      const hitTarget = lastSets.length > 0 && lastSets.every((s) => {
        const r = s.reps ?? 0;
        const t = s.targetReps ?? r;
        return t > 0 && r >= t;
      });
      const maxR = maxRpe(lastSets);
      if (maxR != null && maxR >= 9) {
        note = 'Autoregulate today.';
      } else if (hitTarget) {
        targetWeight = baseWeight + WEIGHT_INCREMENT_KG;
      }
    } else if (framework === 'ghost') {
      const trend = rpeTrend(recentSets);
      if (trend === 'up') {
        targetWeight = Math.max(0, baseWeight - WEIGHT_INCREMENT_KG);
        note = 'RPE up — reduce load.';
      } else if (trend === 'stable') {
        targetReps = baseReps + 1;
        note = 'Add a rep.';
      } else if (trend === 'down') {
        targetWeight = baseWeight + WEIGHT_INCREMENT_KG;
        note = 'Add weight.';
      }
    }

    return { name, hasHistory: lastSets.length > 0, lastStr, targetWeight, targetReps, note };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[carouselStyles.cardOuter, style]}>
      <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: TILE_RADIUS }]} />
      <View style={[StyleSheet.absoluteFill, carouselStyles.cardFill, { borderRadius: TILE_RADIUS }]} />
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.07)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
        style={[StyleSheet.absoluteFill, { borderRadius: TILE_RADIUS }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.18 }}
        style={[StyleSheet.absoluteFill, { borderRadius: TILE_RADIUS }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.22)']}
        start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: TILE_RADIUS }]}
        pointerEvents="none"
      />
      <View style={[StyleSheet.absoluteFill, carouselStyles.cardBorder, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
      {children}
    </View>
  );
}

function ExerciseCard({ plan }: { plan: ExercisePlan }) {
  return (
    <GlassCard style={carouselStyles.card}>
      <View style={carouselStyles.cardInner}>
        <Text style={carouselStyles.cardName} numberOfLines={2}>{plan.name}</Text>
        {plan.hasHistory ? (
          <View style={carouselStyles.cardDataRow}>
            <View style={carouselStyles.cardDataCol}>
              <Text style={carouselStyles.cardDataLabel}>LAST</Text>
              <Text style={carouselStyles.cardDataLast}>{plan.lastStr}</Text>
            </View>
            <View style={carouselStyles.cardVDivider} />
            <View style={[carouselStyles.cardDataCol, carouselStyles.cardDataColRight]}>
              <Text style={carouselStyles.cardDataLabel}>TODAY</Text>
              <Text style={carouselStyles.cardDataToday}>
                {plan.targetWeight > 0 ? `${plan.targetWeight}` : '—'}
                {'\n'}
                <Text style={carouselStyles.cardDataTodayUnit}>
                  {plan.targetWeight > 0 ? 'kg' : ''}{'  × '}{plan.targetReps}
                </Text>
              </Text>
            </View>
          </View>
        ) : (
          <Text style={carouselStyles.cardNoData}>No workout{'\n'}data yet</Text>
        )}
        {plan.note ? <Text style={carouselStyles.cardNote}>{plan.note}</Text> : null}
      </View>
    </GlassCard>
  );
}

function ExercisePager({ plans }: { plans: ExercisePlan[] }) {
  const [page, setPage] = useState(0);

  const pages: ExercisePlan[][] = [];
  for (let i = 0; i < plans.length; i += 4) {
    pages.push(plans.slice(i, i + 4));
  }
  const pageCount = pages.length;

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          setPage(Math.round(x / SCREEN_WIDTH));
        }}
        style={carouselStyles.pagerScroll}
      >
        {pages.map((pagePlans, pi) => (
          <View key={pi} style={carouselStyles.pagerPage}>
            <View style={carouselStyles.pagerRow}>
              {([0, 1] as const).map((col) =>
                pagePlans[col] ? (
                  <ExerciseCard key={col} plan={pagePlans[col]!} />
                ) : (
                  <View key={col} style={carouselStyles.cardPlaceholder} />
                )
              )}
            </View>
            {(pagePlans[2] || pagePlans[3]) ? (
              <View style={[carouselStyles.pagerRow, { marginTop: GRID_GAP }]}>
                {([2, 3] as const).map((col) =>
                  pagePlans[col] ? (
                    <ExerciseCard key={col} plan={pagePlans[col]!} />
                  ) : (
                    <View key={col} style={carouselStyles.cardPlaceholder} />
                  )
                )}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
      {pageCount > 1 && (
        <View style={carouselStyles.pageDots}>
          {Array.from({ length: pageCount }).map((_, i) => (
            <View key={i} style={[carouselStyles.pageDot, i === page && carouselStyles.pageDotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TodaysSessionCarousel() {
  const jarvis = useJarvis();
  const { context, contextLoading, noUser } = jarvis;
  const exercisePlans = computeExercisePlans(context);
  const isRestDay = context?.todayPlan?.isRestDay ?? false;

  if (contextLoading) {
    return (
      <View style={carouselStyles.section}>
        <Text style={carouselStyles.sectionLabel}>TODAY'S SESSION</Text>
        <View style={carouselStyles.stateWrap}>
          <ActivityIndicator color={MUTED} size="small" />
          <Text style={carouselStyles.stateText}>  Initialising...</Text>
        </View>
      </View>
    );
  }

  if (noUser || isRestDay || exercisePlans.length === 0) {
    return null;
  }

  return (
    <View style={carouselStyles.section}>
      <Text style={carouselStyles.sectionLabel}>TODAY'S SESSION</Text>
      <ExercisePager plans={exercisePlans} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const carouselStyles = StyleSheet.create({
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: MUTED,
    marginBottom: 10,
    marginTop: 4,
  },
  stateWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, flexDirection: 'row' },
  stateText: { fontSize: 14, color: MUTED, textAlign: 'center' },

  pagerScroll: { marginHorizontal: -PARENT_PAD },
  pagerPage: { width: SCREEN_WIDTH, paddingHorizontal: PARENT_PAD },
  pagerRow: { flexDirection: 'row', gap: GRID_GAP },

  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
  },
  pageDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(198,198,198,0.25)',
  },
  pageDotActive: {
    backgroundColor: '#D4B896',
    width: 14,
  },

  cardOuter: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: TILE_RADIUS,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 12,
    overflow: 'hidden',
  },
  cardFill: { backgroundColor: 'rgba(47, 48, 49, 0.30)' },
  cardBorder: { borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },
  card: {},
  cardPlaceholder: { width: CARD_SIZE, height: CARD_SIZE },

  cardInner: {
    flex: 1,
    padding: 13,
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primaryLight,
    letterSpacing: -0.4,
    lineHeight: 19,
  },
  cardDataRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  cardDataCol: { flex: 1 },
  cardDataColRight: { alignItems: 'flex-end' },
  cardVDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(198,198,198,0.15)',
    marginHorizontal: 10,
  },
  cardDataLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: MUTED,
    marginBottom: 4,
  },
  cardDataLast: {
    fontSize: 11,
    color: '#D4B896',
    fontWeight: '500',
    lineHeight: 16,
  },
  cardDataToday: {
    fontSize: 16,
    color: Colors.primaryLight,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 20,
    textAlign: 'right',
  },
  cardDataTodayUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: MUTED,
  },
  cardNoData: {
    fontSize: 11,
    color: MUTED,
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 10,
  },
  cardNote: {
    fontSize: 10,
    color: '#D4B896',
    fontStyle: 'italic',
    marginTop: 6,
  },
});
