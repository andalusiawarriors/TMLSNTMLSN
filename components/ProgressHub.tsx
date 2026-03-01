// ============================================================
// TMLSN — Progress Hub (extracted for embedding in home tabs)
// 6-tile widget grid. Each tile shows a live data preview.
// iOS-style reorder: blur overlay, jiggle, long-press to drag.
// ============================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Pressable,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon, Line, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { format, startOfWeek, addDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';

import { Colors, Spacing } from '../constants/theme';
import { AnimatedFadeInUp } from './AnimatedFadeInUp';
import TiltPressable from './TiltPressable';

import { getWorkoutSessions, getProgressHubOrder, saveProgressHubOrder } from '../utils/storage';
import { getSessionDisplayName } from '../utils/workoutSessionDisplay';
import { workoutsToSetRecordsForRange } from '../utils/workoutMuscles';
import {
  getWeekStart,
  calculateWeeklyMuscleVolume,
  calculateHeatmap,
} from '../utils/weeklyMuscleTracker';
import type { WorkoutSession } from '../types';
import type { HeatmapData } from '../utils/weeklyMuscleTracker';
import { getPeriodRange, aggregateSessionsByDay } from '../utils/dateBins';
import type { HeatmapPeriod } from '../utils/dateBins';
import { DEFAULT_PROGRESS_HUB_ORDER } from '../constants/storageDefaults';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PARENT_PAD = 19;
const GRID_GAP = 14;
const CARD_SIZE = Math.floor((SCREEN_WIDTH - PARENT_PAD * 2 - GRID_GAP) / 2);
const TILE_RADIUS = 38;

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
      set.add(format(d, 'yyyy-MM-dd'));
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
            <View style={[dotStyles.dot, active && dotStyles.dotActive, isFuture && dotStyles.dotFuture]} />
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
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(198,198,198,0.14)', borderWidth: 1, borderColor: 'rgba(198,198,198,0.18)' },
  dotActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryLight },
  dotFuture: { opacity: 0.35 },
  label: { fontSize: 9, fontWeight: '500', color: 'rgba(198,198,198,0.38)' },
});

function MiniProgressBars({ sessions }: { sessions: WorkoutSession[] }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const CHART_H = 44;
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const dailyMins = useMemo(() => {
    const mins = [0, 0, 0, 0, 0, 0, 0];
    for (const s of sessions) {
      if (!s.isComplete) continue;
      const d = new Date(s.date);
      if (isNaN(d.getTime())) continue;
      const dayIdx = Math.floor((d.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
      if (dayIdx >= 0 && dayIdx < 7) mins[dayIdx] += s.duration ?? 0;
    }
    return mins;
  }, [sessions]);

  const maxMins = Math.max(...dailyMins, 1);

  return (
    <View style={miniBarStyles.wrap}>
      <View style={miniBarStyles.barsRow}>
        {dailyMins.map((m, i) => {
          const h = maxMins > 0 && m > 0 ? Math.max(6, (m / maxMins) * CHART_H) : 4;
          const isEmpty = m === 0;
          return (
            <View key={i} style={miniBarStyles.col}>
              <View style={[miniBarStyles.barBg, { height: CHART_H }]}>
                <View
                  style={[
                    miniBarStyles.barFill,
                    { height: h },
                    isEmpty && { backgroundColor: 'rgba(198,198,198,0.22)' },
                  ]}
                />
              </View>
              <Text style={miniBarStyles.label}>{DAY_LABELS[i]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const miniBarStyles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 56 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  barBg: {
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(198,198,198,0.08)',
    borderRadius: 3,
    minHeight: 4,
  },
  barFill: {
    width: '100%',
    backgroundColor: Colors.primaryLight,
    borderRadius: 2,
    minHeight: 4,
  },
  label: { fontSize: 9, fontWeight: '500', color: 'rgba(198,198,198,0.45)' },
});

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
  value: { fontSize: 22, fontWeight: '700', letterSpacing: -0.6, color: Colors.primaryLight, lineHeight: 26 },
  label: { fontSize: 11, fontWeight: '500', color: 'rgba(198,198,198,0.45)', letterSpacing: -0.1 },
});

function MiniHistory({ sessions }: { sessions: WorkoutSession[] }) {
  const recent = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3),
    [sessions],
  );
  if (recent.length === 0) return <Text style={mhStyles.empty}>no sessions yet</Text>;
  return (
    <View style={mhStyles.list}>
      {recent.map((s) => (
        <View key={s.id} style={mhStyles.row}>
          <Text style={mhStyles.name} numberOfLines={1}>{getSessionDisplayName(s)}</Text>
          <Text style={mhStyles.date}>{format(new Date(s.date), 'MMM d')}</Text>
        </View>
      ))}
    </View>
  );
}

const mhStyles = StyleSheet.create({
  list: { gap: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 11, fontWeight: '600', color: 'rgba(198,198,198,0.75)', letterSpacing: -0.2, flex: 1 },
  date: { fontSize: 10, color: 'rgba(198,198,198,0.35)', marginLeft: 4 },
  empty: { fontSize: 11, color: 'rgba(198,198,198,0.30)' },
});

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
  value: { fontSize: 42, fontWeight: '700', letterSpacing: -1.5, color: Colors.primaryLight, lineHeight: 46 },
  sub: { fontSize: 12, fontWeight: '500', color: 'rgba(198,198,198,0.42)', letterSpacing: -0.1 },
});

interface TileData {
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

function TileCard({ item, index, animTrigger, children, reorderMode }: { item: TileData; index: number; animTrigger: number; children?: React.ReactNode; reorderMode?: boolean }) {
  const router = useRouter();
  return (
    <AnimatedFadeInUp delay={50 + index * 45} duration={440} trigger={animTrigger}>
      <View style={tileStyles.tileWrap}>
        <TiltPressable
          style={{ width: CARD_SIZE, height: CARD_SIZE }}
          borderRadius={TILE_RADIUS}
          shadowStyle={tileStyles.shadow}
          onPress={reorderMode ? undefined : () => router.push(item.route as any)}
        >
          <View style={tileStyles.glass}>
            <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]} />
            <View style={[StyleSheet.absoluteFillObject, tileStyles.fill, { borderRadius: TILE_RADIUS }]} />
            <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }} style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
            <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.18 }} style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.22)']} start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
            <View style={[StyleSheet.absoluteFillObject, tileStyles.border, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
            {children ? <View style={tileStyles.widgetContent}>{children}</View> : null}
            <View style={tileStyles.label}>
              <Text style={tileStyles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={tileStyles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
            </View>
          </View>
        </TiltPressable>
      </View>
    </AnimatedFadeInUp>
  );
}

function TileCardInner({ item, children }: { item: TileData; children?: React.ReactNode }) {
  return (
    <View style={[tileStyles.tileWrap, { width: CARD_SIZE, height: CARD_SIZE }]}>
      <View style={[tileStyles.glass, { width: CARD_SIZE, height: CARD_SIZE }]}>
        <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]} />
        <View style={[StyleSheet.absoluteFillObject, tileStyles.fill, { borderRadius: TILE_RADIUS }]} />
        <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }} style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
        <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.18 }} style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.22)']} start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFillObject, tileStyles.border, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
        {children ? <View style={tileStyles.widgetContent}>{children}</View> : null}
        <View style={tileStyles.label}>
          <Text style={tileStyles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={tileStyles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

const tileStyles = StyleSheet.create({
  tileWrap: { width: CARD_SIZE, height: CARD_SIZE, borderRadius: TILE_RADIUS, overflow: 'visible' as const },
  shadow: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.34, shadowRadius: 22, elevation: 12 },
  glass: { flex: 1, borderRadius: TILE_RADIUS, overflow: 'hidden', backgroundColor: 'transparent' },
  fill: { backgroundColor: 'rgba(47, 48, 49, 0.30)' },
  border: { borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },
  widgetContent: { position: 'absolute', top: 18, left: 18, right: 18, bottom: 60, justifyContent: 'center', alignItems: 'center' },
  label: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, lineHeight: 21, color: Colors.primaryLight },
  subtitle: { fontSize: 12, fontWeight: '500', color: 'rgba(198,198,198,0.55)', marginTop: 5, letterSpacing: -0.1 },
});

const ALL_TILE_DEFS: Record<string, Omit<TileData, 'subtitle'>> = {
  progress: { id: 'progress', title: 'progress.', route: '/progress-graph' },
  strength: { id: 'strength', title: 'strength.', route: '/strength-muscles' },
  history: { id: 'history', title: 'history.', route: '/workout-history' },
  activity: { id: 'activity', title: 'activity', route: '/progress-heatmap' },
  'active-days': { id: 'active-days', title: 'active days', route: '/progress-heatmap' },
  workouts: { id: 'workouts', title: 'workouts', route: '/workout-history' },
};

function ReorderableTile({
  item,
  index,
  children,
  isDragging,
  onActivate,
  onDragUpdate,
  onDragEnd,
}: {
  item: TileData;
  index: number;
  children: React.ReactNode;
  isDragging: boolean;
  onActivate: () => void;
  onDragUpdate: (tx: number, ty: number, ax: number, ay: number) => void;
  onDragEnd: () => void;
}) {
  const jiggle = useSharedValue(0);
  useEffect(() => {
    if (!isDragging) {
      jiggle.value = withRepeat(withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      jiggle.value = withTiming(0, { duration: 100 });
    }
  }, [isDragging]);
  const jiggleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(jiggle.value, [0, 1], [-2, 2]) }],
  }));

  const pan = Gesture.Pan()
    .activateAfterLongPress(400)
    .onStart(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      runOnJS(onActivate)();
    })
    .onUpdate((e: { translationX: number; translationY: number; absoluteX: number; absoluteY: number }) => {
      runOnJS(onDragUpdate)(e.translationX, e.translationY, e.absoluteX, e.absoluteY);
    })
    .onEnd(() => {
      runOnJS(onDragEnd)();
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.reorderTileSlot, jiggleStyle, isDragging && { opacity: 0.4 }]}
      >
        <TileCardInner item={item}>{children}</TileCardInner>
      </Animated.View>
    </GestureDetector>
  );
}

function ReorderModal({
  tiles,
  getTileContent,
  draggingIndex,
  setDraggingIndex,
  moveToIndex,
  onDone,
  onCancel,
  dragX,
  dragY,
}: {
  tiles: TileData[];
  getTileContent: (item: TileData) => React.ReactNode;
  draggingIndex: number | null;
  setDraggingIndex: (n: number | null) => void;
  moveToIndex: (from: number, to: number) => void;
  onDone: () => void;
  onCancel: () => void;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
}) {
  const insets = useSafeAreaInsets();
  const gridRef = React.useRef<View>(null);
  const [gridScreenPos, setGridScreenPos] = useState({ x: 0, y: 0 });
  const [gridLayout, setGridLayout] = useState({ x: 0, y: 0 });
  const draggingRef = React.useRef(draggingIndex);
  draggingRef.current = draggingIndex;

  const handleDragUpdate = useCallback((tx: number, ty: number, ax: number, ay: number) => {
    dragX.value = tx;
    dragY.value = ty;
    const idx = draggingRef.current;
    if (idx === null) return;
    const relX = ax - gridScreenPos.x;
    const relY = ay - gridScreenPos.y;
    const col = Math.max(0, Math.min(1, Math.floor(relX / (CARD_SIZE + GRID_GAP))));
    const row = Math.max(0, Math.min(2, Math.floor(relY / (CARD_SIZE + GRID_GAP))));
    const toIndex = Math.max(0, Math.min(tiles.length - 1, row * 2 + col));
    if (toIndex !== idx) {
      moveToIndex(idx, toIndex);
      setDraggingIndex(toIndex);
    }
  }, [gridScreenPos, tiles.length, moveToIndex, setDraggingIndex, dragX, dragY]);

  const handleDragEnd = useCallback(() => {
    setDraggingIndex(null);
    dragX.value = withSpring(0);
    dragY.value = withSpring(0);
  }, [setDraggingIndex, dragX, dragY]);

  const floatingStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }],
    zIndex: 1000,
  }));

  const draggedItem = draggingIndex != null ? tiles[draggingIndex] : null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={reorderModalStyles.container}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, reorderModalStyles.darkOverlay]} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.listContent, styles.reorderContent, { paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <View
            ref={gridRef}
            style={styles.reorderGrid}
            onLayout={(e) => {
              const { x, y } = e.nativeEvent.layout;
              setGridLayout({ x, y });
              gridRef.current?.measureInWindow((wx, wy) => setGridScreenPos({ x: wx, y: wy }));
            }}
          >
            {tiles.map((item, index) => (
              <ReorderableTile
                key={item.id}
                item={item}
                index={index}
                isDragging={draggingIndex === index}
                onActivate={() => setDraggingIndex(index)}
                onDragUpdate={handleDragUpdate}
                onDragEnd={handleDragEnd}
              >
                {getTileContent(item)}
              </ReorderableTile>
            ))}
          </View>
          {draggedItem != null && draggingIndex != null && (
            <Animated.View
              style={[
                reorderModalStyles.floatingTile,
                {
                  left: gridLayout.x + (draggingIndex % 2) * (CARD_SIZE + GRID_GAP),
                  top: gridLayout.y + Math.floor(draggingIndex / 2) * (CARD_SIZE + GRID_GAP),
                },
                floatingStyle,
              ]}
              pointerEvents="none"
            >
              <TileCardInner item={draggedItem}>{getTileContent(draggedItem)}</TileCardInner>
            </Animated.View>
          )}
          <View style={styles.reorderActions}>
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onDone} style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const reorderModalStyles = StyleSheet.create({
  container: { flex: 1 },
  darkOverlay: { backgroundColor: 'rgba(0,0,0,0.5)' },
  floatingTile: {
    position: 'absolute',
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
});

export function ProgressHub() {
  const [animTrigger, setAnimTrigger] = useState(0);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const heatPeriod: HeatmapPeriod = 'month';
  const [radarHeatmap, setRadarHeatmap] = useState<HeatmapData[]>([]);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [order, setOrder] = useState<string[]>([...DEFAULT_PROGRESS_HUB_ORDER]);

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      const load = async () => {
        const [allSessions, savedOrder] = await Promise.all([
          getWorkoutSessions(),
          getProgressHubOrder(),
        ]);
        setSessions(allSessions);
        setOrder(savedOrder);
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
    const labels: Record<HeatmapPeriod, string> = { week: 'this week', month: 'this month', year: 'this year', all: 'all time' };
    return { activeDays: ad, totalWorkouts: tw, periodLabel: labels[heatPeriod] };
  }, [sessions, heatPeriod]);

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

  const subtitles: Record<string, string> = useMemo(
    () => ({
      progress: 'tap to open',
      strength: 'tap to open',
      history: 'all sessions',
      activity: periodLabel,
      'active-days': `${activeDays} ${periodLabel}`,
      workouts: `${totalWorkouts} ${periodLabel}`,
    }),
    [activeDays, totalWorkouts, periodLabel],
  );

  const tiles: TileData[] = useMemo(() => {
    const defs = order
      .filter((id) => ALL_TILE_DEFS[id])
      .map((id) => ({
        ...ALL_TILE_DEFS[id],
        subtitle: subtitles[id] ?? '',
      })) as TileData[];
    return defs.length > 0 ? defs : (DEFAULT_PROGRESS_HUB_ORDER as unknown as string[]).map((id) => ({
      ...ALL_TILE_DEFS[id],
      subtitle: subtitles[id] ?? '',
    })) as TileData[];
  }, [order, subtitles]);

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [displayOrder, setDisplayOrder] = useState<string[]>([]);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  useEffect(() => {
    if (isReorderMode) setDisplayOrder([...order]);
  }, [isReorderMode, order]);

  const moveToIndex = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setDisplayOrder((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
    setOrder((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }, []);

  const handleDoneReorder = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await saveProgressHubOrder(displayOrder.length ? displayOrder : order);
    setIsReorderMode(false);
    setDraggingIndex(null);
    setAnimTrigger((t) => t + 1);
  }, [order, displayOrder]);

  const handleCancelReorder = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    getProgressHubOrder().then(setOrder);
    setIsReorderMode(false);
    setDraggingIndex(null);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: TileData; index: number }) => {
      let content: React.ReactNode = null;
      if (item.id === 'progress') {
        content = (
          <View style={{ alignSelf: 'flex-start', gap: 6 }}>
            <MiniStatRow value={String(progressStats.count)} label="sessions" />
            <MiniStatRow value={`${progressStats.totalMins}m`} label="total" />
            {progressStats.best > 0 && <MiniStatRow value={`${progressStats.best}m`} label="best" />}
          </View>
        );
      } else if (item.id === 'strength') {
        content = <MiniRadar heatmapData={radarHeatmap} size={CARD_SIZE - 56} />;
      } else if (item.id === 'activity') {
        content = <WeekDots sessions={sessions} />;
      } else if (item.id === 'history') {
        content = <View style={{ alignSelf: 'flex-start', width: '100%' }}><MiniHistory sessions={sessions} /></View>;
      } else if (item.id === 'active-days') {
        content = <BigStat value={String(activeDays)} sub="days active" />;
      } else if (item.id === 'workouts') {
        content = <BigStat value={String(totalWorkouts)} sub="sessions" />;
      }
      return (
        <TileCard item={item} index={index} animTrigger={animTrigger} reorderMode={isReorderMode}>
          {content}
        </TileCard>
      );
    },
    [animTrigger, radarHeatmap, sessions, progressStats, activeDays, totalWorkouts, isReorderMode],
  );

  const reorderTiles = useMemo(() => {
    const ord = displayOrder.length ? displayOrder : order;
    return ord
      .filter((id) => ALL_TILE_DEFS[id])
      .map((id) => ({
        ...ALL_TILE_DEFS[id],
        subtitle: subtitles[id] ?? '',
      })) as TileData[];
  }, [displayOrder, order, subtitles]);

  const getTileContent = useCallback((item: TileData) => {
    if (item.id === 'progress') return <View style={{ alignSelf: 'flex-start', gap: 6 }}><MiniStatRow value={String(progressStats.count)} label="sessions" /><MiniStatRow value={`${progressStats.totalMins}m`} label="total" />{progressStats.best > 0 && <MiniStatRow value={`${progressStats.best}m`} label="best" />}</View>;
    if (item.id === 'strength') return <MiniRadar heatmapData={radarHeatmap} size={CARD_SIZE - 56} />;
    if (item.id === 'activity') return <WeekDots sessions={sessions} />;
    if (item.id === 'history') return <View style={{ alignSelf: 'flex-start', width: '100%' }}><MiniHistory sessions={sessions} /></View>;
    if (item.id === 'active-days') return <BigStat value={String(activeDays)} sub="days active" />;
    if (item.id === 'workouts') return <BigStat value={String(totalWorkouts)} sub="sessions" />;
    return null;
  }, [progressStats, radarHeatmap, sessions, activeDays, totalWorkouts]);

  if (isReorderMode) {
    return (
      <ReorderModal
        tiles={reorderTiles}
        getTileContent={getTileContent}
        draggingIndex={draggingIndex}
        setDraggingIndex={setDraggingIndex}
        moveToIndex={moveToIndex}
        onDone={handleDoneReorder}
        onCancel={handleCancelReorder}
        dragX={dragX}
        dragY={dragY}
      />
    );
  }

  return (
    <View>
      <FlatList
        data={tiles}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderItem}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[styles.listContent, { overflow: 'visible' as const }]}
        style={{ overflow: 'visible' as const }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setIsReorderMode(true);
        }}
        style={({ pressed }) => [styles.reorderPill, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.reorderPillText}>Reorder</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 0,
    gap: GRID_GAP,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: 'center',
  },
  columnWrapper: {
    gap: GRID_GAP,
  },
  reorderContent: {
    paddingBottom: 100,
  },
  reorderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    width: PARENT_PAD * 2 + CARD_SIZE * 2 + GRID_GAP,
    alignSelf: 'center',
  },
  reorderTileSlot: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
  reorderActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
    alignSelf: 'center',
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.35)',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(198,198,198,0.8)',
  },
  doneBtn: {
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: 'rgba(198,198,198,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.35)',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
  reorderPill: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(198,198,198,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.25)',
  },
  reorderPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(198,198,198,0.9)',
  },
});
