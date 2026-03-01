// ============================================================
// TMLSN — Progress Hub
// 6-tile widget grid (Fitness tab). Each tile shows a live
// data preview inside it and navigates to the full screen.
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon, Line, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { format, startOfWeek, startOfMonth, startOfYear, addDays } from 'date-fns';

import { Colors, Spacing } from '../../../constants/theme';
import { AnimatedFadeInUp } from '../../../components/AnimatedFadeInUp';
import { InteractiveGlassWrapper } from '../../../components/ui/InteractiveGlassWrapper';
import { LiquidGlassSegmented } from '../../../components/ui/liquidGlass';
import { HomeGradientBackground } from '../../../components/HomeGradientBackground';

import { getWorkoutSessions, getUserSettings } from '../../../utils/storage';
import { workoutsToSetRecordsForRange } from '../../../utils/workoutMuscles';
import {
  getWeekStart,
  calculateWeeklyMuscleVolume,
  calculateHeatmap,
} from '../../../utils/weeklyMuscleTracker';
import { toDisplayVolume, formatWeightDisplay } from '../../../utils/units';
import type { WorkoutSession } from '../../../types';
import type { HeatmapData } from '../../../utils/weeklyMuscleTracker';
import { getPeriodRange, aggregateSessionsByDay } from '../../../utils/dateBins';
import type { HeatmapPeriod } from '../../../utils/dateBins';

// ── Layout constants ──────────────────────────────────────────
const SCREEN_WIDTH = Dimensions.get('window').width;
const OUTER_PAD = 20;
const GRID_GAP = 14;
const CARD_SIZE = Math.floor((SCREEN_WIDTH - OUTER_PAD * 2 - GRID_GAP) / 2);
const TILE_RADIUS = 38;
const SEGMENT_CONTROL_WIDTH = SCREEN_WIDTH - OUTER_PAD * 2;

// ── Radar axes definition ─────────────────────────────────────
const RADAR_AXES = [
  { key: 'chest',     label: 'Chest',     groups: ['chest'] },
  { key: 'back',      label: 'Back',      groups: ['upper_back', 'lats', 'lower_back', 'traps'] },
  { key: 'shoulders', label: 'Shoulders', groups: ['front_delts', 'side_delts', 'rear_delts'] },
  { key: 'arms',      label: 'Arms',      groups: ['biceps', 'triceps', 'forearms'] },
  { key: 'core',      label: 'Core',      groups: ['abs', 'obliques'] },
  { key: 'quads',     label: 'Quads',     groups: ['quads', 'hip_flexors'] },
  { key: 'legs',      label: 'Legs',      groups: ['hamstrings', 'glutes', 'adductors'] },
  { key: 'calves',    label: 'Calves',    groups: ['calves'] },
];
const N_AXES = RADAR_AXES.length;

function polarToCartesian(cx: number, cy: number, r: number, i: number) {
  const angle = (2 * Math.PI * i) / N_AXES - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function ptsStr(pts: { x: number; y: number }[]) {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

// ── Mini radar SVG (fits inside a tile) ──────────────────────
function MiniRadar({ heatmapData, size }: { heatmapData: HeatmapData[]; size: number }) {
  const CX = size / 2;
  const CY = size / 2;
  const MAX_R = size / 2 - 4;
  const LEVELS = 3;

  const normalizedValues = useMemo(() => {
    if (heatmapData.length === 0) return RADAR_AXES.map(() => 0);
    const axisVals = RADAR_AXES.map((axis) => {
      const total = axis.groups.reduce((sum, grp) => {
        const found = heatmapData.find((d) => d.muscleGroup === grp);
        return sum + (found ? found.intensity : 0);
      }, 0);
      return total / axis.groups.length;
    });
    const max = Math.max(...axisVals, 0.001);
    return axisVals.map((v) => Math.min(1, v / max));
  }, [heatmapData]);

  const gridPts = Array.from({ length: LEVELS }, (_, lvl) => {
    const r = ((lvl + 1) / LEVELS) * MAX_R;
    return ptsStr(Array.from({ length: N_AXES }, (_, i) => polarToCartesian(CX, CY, r, i)));
  });

  const dataPts = ptsStr(
    normalizedValues.map((v, i) => polarToCartesian(CX, CY, v * MAX_R, i)),
  );

  return (
    <Svg width={size} height={size}>
      {gridPts.map((pts, i) => (
        <Polygon key={i} points={pts} fill="none" stroke="rgba(198,198,198,0.10)" strokeWidth={0.8} />
      ))}
      {Array.from({ length: N_AXES }, (_, i) => {
        const outer = polarToCartesian(CX, CY, MAX_R, i);
        return (
          <Line key={i} x1={CX} y1={CY} x2={outer.x} y2={outer.y}
            stroke="rgba(198,198,198,0.10)" strokeWidth={0.8} />
        );
      })}
      <Polygon points={dataPts}
        fill="rgba(198,198,198,0.18)"
        stroke="rgba(198,198,198,0.65)"
        strokeWidth={1.5}
      />
      {normalizedValues.map((v, i) => {
        if (v <= 0) return null;
        const pt = polarToCartesian(CX, CY, v * MAX_R, i);
        return <Circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill={Colors.primaryLight} opacity={0.7} />;
      })}
    </Svg>
  );
}

// ── Mini weekly activity dots ─────────────────────────────────
function WeekDots({ sessions }: { sessions: WorkoutSession[] }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const activeDays = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      if (!s.isComplete) continue;
      const d = new Date(s.date);
      if (isNaN(d.getTime())) continue;
      const key = format(d, 'yyyy-MM-dd');
      set.add(key);
    }
    return set;
  }, [sessions]);

  return (
    <View style={dotStyles.row}>
      {DAY_LABELS.map((label, i) => {
        const dayDate = addDays(weekStart, i);
        const key = format(dayDate, 'yyyy-MM-dd');
        const active = activeDays.has(key);
        const isFuture = dayDate > today;
        return (
          <View key={i} style={dotStyles.col}>
            <View style={[
              dotStyles.dot,
              active && dotStyles.dotActive,
              isFuture && dotStyles.dotFuture,
            ]} />
            <Text style={dotStyles.label}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  col: { alignItems: 'center', gap: 4 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(198,198,198,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.18)',
  },
  dotActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryLight,
  },
  dotFuture: {
    opacity: 0.35,
  },
  label: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(198,198,198,0.38)',
    letterSpacing: 0,
  },
});

// ── Mini stat row (for progress tile) ────────────────────────
function MiniStatRow({ value, label }: { value: string; label: string }) {
  return (
    <View style={miniStyles.row}>
      <Text style={miniStyles.value}>{value}</Text>
      <Text style={miniStyles.label}>{label}</Text>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  value: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: Colors.primaryLight,
    lineHeight: 26,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(198,198,198,0.45)',
    letterSpacing: -0.1,
  },
});

// ── Mini history list (for history tile) ─────────────────────
function MiniHistory({ sessions }: { sessions: WorkoutSession[] }) {
  const recent = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3),
    [sessions],
  );

  if (recent.length === 0) {
    return <Text style={mhStyles.empty}>no sessions yet</Text>;
  }

  return (
    <View style={mhStyles.list}>
      {recent.map((s) => (
        <View key={s.id} style={mhStyles.row}>
          <Text style={mhStyles.name} numberOfLines={1}>{s.name}</Text>
          <Text style={mhStyles.date}>{format(new Date(s.date), 'MMM d')}</Text>
        </View>
      ))}
    </View>
  );
}

const mhStyles = StyleSheet.create({
  list: { gap: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(198,198,198,0.75)',
    letterSpacing: -0.2,
    flex: 1,
  },
  date: {
    fontSize: 10,
    color: 'rgba(198,198,198,0.35)',
    marginLeft: 4,
  },
  empty: {
    fontSize: 11,
    color: 'rgba(198,198,198,0.30)',
  },
});

// ── Big featured number (active days / workouts tiles) ───────
function BigStat({ value, sub }: { value: string; sub: string }) {
  return (
    <View style={bigStyles.wrap}>
      <Text style={bigStyles.value}>{value}</Text>
      <Text style={bigStyles.sub}>{sub}</Text>
    </View>
  );
}

const bigStyles = StyleSheet.create({
  wrap: { gap: 2 },
  value: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1.5,
    color: Colors.primaryLight,
    lineHeight: 46,
  },
  sub: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(198,198,198,0.42)',
    letterSpacing: -0.1,
  },
});

// ── Tile card ─────────────────────────────────────────────────

interface TileData {
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

function TileCard({
  item,
  index,
  animTrigger,
  children,
}: {
  item: TileData;
  index: number;
  animTrigger: number;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <AnimatedFadeInUp delay={50 + index * 45} duration={440} trigger={animTrigger}>
      <View style={tileStyles.shadow}>
        <InteractiveGlassWrapper
          width={CARD_SIZE}
          height={CARD_SIZE}
          borderRadius={TILE_RADIUS}
          onRelease={() => router.push(item.route as any)}
        >
          <View style={tileStyles.glass}>
            <BlurView
              intensity={26}
              tint="dark"
              style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]}
            />
            <View style={[StyleSheet.absoluteFillObject, tileStyles.fill, { borderRadius: TILE_RADIUS }]} />
            <LinearGradient
              colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.07)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.85, y: 0.85 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.18 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.22)']}
              start={{ x: 0.5, y: 0.55 }}
              end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]}
              pointerEvents="none"
            />
            <View
              style={[StyleSheet.absoluteFillObject, tileStyles.border, { borderRadius: TILE_RADIUS }]}
              pointerEvents="none"
            />

            {/* Widget content area — fills top portion */}
            {children ? (
              <View style={tileStyles.widgetContent}>
                {children}
              </View>
            ) : null}

            {/* Bottom label */}
            <View style={tileStyles.label}>
              <Text style={tileStyles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={tileStyles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
            </View>
          </View>
        </InteractiveGlassWrapper>
      </View>
    </AnimatedFadeInUp>
  );
}

const tileStyles = StyleSheet.create({
  shadow: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: TILE_RADIUS,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 12,
  },
  glass: {
    flex: 1,
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  fill: {
    backgroundColor: 'rgba(47, 48, 49, 0.30)',
  },
  border: {
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.22)',
  },
  widgetContent: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    bottom: 60, // leave room for label at bottom
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 21,
    color: Colors.primaryLight,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(198,198,198,0.55)',
    marginTop: 5,
    letterSpacing: -0.1,
  },
});

// ── Main screen ───────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  const [animTrigger, setAnimTrigger] = useState(0);
  const [progressSegment, setProgressSegment] = useState<'Nutrition' | 'Fitness'>('Fitness');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  const heatPeriod: HeatmapPeriod = 'month';

  // Radar heatmap (current week)
  const [radarHeatmap, setRadarHeatmap] = useState<HeatmapData[]>([]);

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      const load = async () => {
        const allSessions = await getWorkoutSessions();
        setSessions(allSessions);

        // Compute this-week radar data
        const weekStart = getWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const setRecords = workoutsToSetRecordsForRange(allSessions, weekStart, weekEnd);
        const weeklyVolume = calculateWeeklyMuscleVolume(setRecords);
        setRadarHeatmap(calculateHeatmap(weeklyVolume));
      };
      load();
    }, []),
  );

  // Active days + total workouts this month
  const { activeDays, totalWorkouts, periodLabel } = useMemo(() => {
    const { start, end } = getPeriodRange(heatPeriod, sessions);
    const workoutsMap = aggregateSessionsByDay(sessions, 'workouts');
    let ad = 0;
    let tw = 0;
    for (const [dateKey, v] of workoutsMap) {
      const d = new Date(dateKey + 'T12:00:00');
      if (d >= start && d < end) {
        if (v > 0) ad += 1;
        tw += v;
      }
    }
    const labels: Record<HeatmapPeriod, string> = {
      week: 'this week',
      month: 'this month',
      year: 'this year',
      all: 'all time',
    };
    return { activeDays: ad, totalWorkouts: tw, periodLabel: labels[heatPeriod] };
  }, [sessions, heatPeriod]);

  // Progress stats (month)
  const progressStats = useMemo(() => {
    const { start, end } = getPeriodRange(heatPeriod, sessions);
    const inPeriod = sessions.filter((s) => {
      const d = new Date(s.date);
      return !isNaN(d.getTime()) && d >= start && d < end && s.isComplete;
    });
    const totalMins = inPeriod.reduce((a, s) => a + (s.duration ?? 0), 0);
    const best = inPeriod.reduce((a, s) => Math.max(a, s.duration ?? 0), 0);
    return { count: inPeriod.length, totalMins, best };
  }, [sessions, heatPeriod]);

  const tiles: TileData[] = useMemo(
    () => [
      { id: 'progress',    title: 'progress.',   subtitle: 'tap to open',                  route: '/progress-graph' },
      { id: 'strength',    title: 'strength.',   subtitle: 'tap to open',                  route: '/strength-muscles' },
      { id: 'activity',    title: 'activity',    subtitle: periodLabel,                     route: '/progress-heatmap' },
      { id: 'history',     title: 'history.',    subtitle: 'all sessions',                  route: '/workout-history' },
      { id: 'active-days', title: 'active days', subtitle: `${activeDays} ${periodLabel}`, route: '/progress-heatmap' },
      { id: 'workouts',    title: 'workouts',    subtitle: `${totalWorkouts} ${periodLabel}`, route: '/workout-history' },
    ],
    [activeDays, totalWorkouts, periodLabel],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: TileData; index: number }) => {
      let content: React.ReactNode = null;

      if (item.id === 'progress') {
        content = (
          <View style={{ alignSelf: 'flex-start', gap: 6 }}>
            <MiniStatRow value={String(progressStats.count)} label="sessions" />
            <MiniStatRow value={`${progressStats.totalMins}m`} label="total" />
            {progressStats.best > 0 && (
              <MiniStatRow value={`${progressStats.best}m`} label="best" />
            )}
          </View>
        );
      } else if (item.id === 'strength') {
        content = <MiniRadar heatmapData={radarHeatmap} size={CARD_SIZE - 56} />;
      } else if (item.id === 'activity') {
        content = <WeekDots sessions={sessions} />;
      } else if (item.id === 'history') {
        content = (
          <View style={{ alignSelf: 'flex-start', width: '100%' }}>
            <MiniHistory sessions={sessions} />
          </View>
        );
      } else if (item.id === 'active-days') {
        content = <BigStat value={String(activeDays)} sub="days active" />;
      } else if (item.id === 'workouts') {
        content = <BigStat value={String(totalWorkouts)} sub="sessions" />;
      }

      return (
        <TileCard item={item} index={index} animTrigger={animTrigger}>
          {content}
        </TileCard>
      );
    },
    [animTrigger, radarHeatmap, sessions, progressStats, activeDays, totalWorkouts],
  );

  const listHeader = (
    <AnimatedFadeInUp delay={0} duration={380} trigger={animTrigger}>
      <View style={{ marginTop: Spacing.sm, marginBottom: 4 }}>
        <LiquidGlassSegmented
          options={[
            { key: 'Nutrition', label: 'Nutrition' },
            { key: 'Fitness', label: 'Fitness' },
          ]}
          value={progressSegment}
          onChange={(k) => setProgressSegment(k as 'Nutrition' | 'Fitness')}
          width={SEGMENT_CONTROL_WIDTH}
        />
      </View>
    </AnimatedFadeInUp>
  );

  return (
    <View style={styles.wrapper}>
      <HomeGradientBackground />
      <FlatList
        data={progressSegment === 'Fitness' ? tiles : []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingHorizontal: OUTER_PAD,
    gap: GRID_GAP,
  },
  columnWrapper: {
    gap: GRID_GAP,
  },
});
