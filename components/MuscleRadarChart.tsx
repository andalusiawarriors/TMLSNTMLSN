// ============================================================
// TMLSN — Muscle Radar Chart
// Spider/radar chart showing major muscle group coverage.
// Built with react-native-svg. Liquid glass card wrapper.
// ============================================================

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Svg, { Polygon, Line, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  createAnimatedComponent,
  useSharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';
import type { HeatmapData } from '../utils/weeklyMuscleTracker';
import { WEEKLY_SET_GUIDELINES } from '../utils/weeklyMuscleTracker';
import type { MuscleGroup } from '../utils/exerciseDb/types';

const AnimatedCircle = createAnimatedComponent(Circle);
const AnimatedPolygonSvg = createAnimatedComponent(Polygon);

const STAGGER_MS = 300;
const SLIDE_DURATION = 900;

// ── Radar axes definition ──────────────────────────────────

export interface RadarAxis {
  key: string;
  label: string;
  groups: string[]; // MuscleGroup keys to sum
}

export const RADAR_AXES: RadarAxis[] = [
  { key: 'back',      label: 'Back',      groups: ['upper_back', 'lats', 'lower_back', 'traps'] },
  { key: 'chest',     label: 'Chest',     groups: ['chest'] },
  { key: 'legs',      label: 'Legs',      groups: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'hip_flexors'] },
  { key: 'core',      label: 'Core',      groups: ['abs', 'obliques'] },
  { key: 'arms',      label: 'Arms',      groups: ['biceps', 'triceps', 'forearms'] },
  { key: 'shoulders', label: 'Shoulders', groups: ['front_delts', 'side_delts', 'rear_delts'] },
];

const WEEKLY_OPTIMAL_PER_AXIS = RADAR_AXES.map((axis) =>
  axis.groups.reduce((sum, g) => sum + WEEKLY_SET_GUIDELINES[g as MuscleGroup].optimal, 0),
);

export type RadarTimeRange = 'week' | 'month' | 'year' | 'all';

function timeRangeMultiplier(range: RadarTimeRange): number {
  switch (range) {
    case 'week':  return 1;
    case 'month': return 4.33;
    case 'year':  return 52;
    case 'all':   return 52;
  }
}

// ── Geometry helpers ────────────────────────────────────────

const N_AXES = RADAR_AXES.length;
const LEVELS = 4; // concentric grid rings

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleIndex: number,
  total: number,
): { x: number; y: number } {
  // Start at top (−90°), rotate clockwise
  const angle = (2 * Math.PI * angleIndex) / total - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function pointsString(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

// ── Radar point (dot) — slides from center to target along axis ─

function RadarPoint({
  index,
  centerX,
  centerY,
  targetX,
  targetY,
  r,
  fill,
  opacity,
}: {
  index: number;
  centerX: number;
  centerY: number;
  targetX: number;
  targetY: number;
  r: number;
  fill: string;
  opacity: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * STAGGER_MS,
      withTiming(1, { duration: SLIDE_DURATION, easing: Easing.out(Easing.quad) }),
    );
  }, [index]);

  const animatedProps = useAnimatedProps(() => ({
    cx: centerX + (targetX - centerX) * progress.value,
    cy: centerY + (targetY - centerY) * progress.value,
    opacity: opacity * progress.value,
  }));

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      r={r}
      fill={fill}
    />
  );
}

// ── Radar axis label with staggered appear ───────────────────
// Rendered as RN Text overlay (entering doesn't work reliably with SVG G)

function RadarAxisLabel({
  index,
  x,
  y,
  anchor,
  label,
  fill,
}: {
  index: number;
  x: number;
  y: number;
  anchor: 'middle' | 'start' | 'end';
  label: string;
  fill: string;
}) {
  const textAlign = anchor === 'start' ? 'left' : anchor === 'end' ? 'right' : 'center';
  const translateX = anchor === 'start' ? 0 : anchor === 'end' ? -60 : -30;

  return (
    <Animated.View
      entering={FadeIn.delay(index * STAGGER_MS).duration(SLIDE_DURATION)}
      style={[
        styles.labelOverlay,
        {
          position: 'absolute',
          left: x,
          top: y - 4,
          width: 60,
          transform: [{ translateX }],
        },
      ]}
      pointerEvents="none"
    >
      <Text style={[styles.labelText, { color: fill, textAlign }]}>{label}</Text>
    </Animated.View>
  );
}

// ── Smooth polygon — each vertex slides from center to target ─

function SmoothPolygon({
  values,
  cx,
  cy,
  maxRadius,
  color,
}: {
  values: number[];
  cx: number;
  cy: number;
  maxRadius: number;
  color: string;
}) {
  const targets = useMemo(
    () => values.map((v, i) => polarToCartesian(cx, cy, v * maxRadius, i, N_AXES)),
    [values, cx, cy, maxRadius],
  );

  const centerStr = useMemo(() => {
    return Array.from({ length: N_AXES }, () => `${cx.toFixed(2)},${cy.toFixed(2)}`).join(' ');
  }, [cx, cy]);

  const [pts, setPts] = useState(centerStr);

  const p0 = useSharedValue(0);
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);
  const p3 = useSharedValue(0);
  const p4 = useSharedValue(0);
  const p5 = useSharedValue(0);

  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const updatePts = useCallback((t0: number, t1: number, t2: number, t3: number, t4: number, t5: number) => {
    const tg = targetsRef.current;
    const lerp = (i: number, t: number) => {
      const tx = tg[i]?.x ?? cx;
      const ty = tg[i]?.y ?? cy;
      return `${(cx + (tx - cx) * t).toFixed(2)},${(cy + (ty - cy) * t).toFixed(2)}`;
    };
    setPts(`${lerp(0, t0)} ${lerp(1, t1)} ${lerp(2, t2)} ${lerp(3, t3)} ${lerp(4, t4)} ${lerp(5, t5)}`);
  }, [cx, cy]);

  useAnimatedReaction(
    () => [p0.value, p1.value, p2.value, p3.value, p4.value, p5.value] as const,
    (curr) => {
      runOnJS(updatePts)(curr[0], curr[1], curr[2], curr[3], curr[4], curr[5]);
    },
    [p0, p1, p2, p3, p4, p5],
  );

  useEffect(() => {
    const progresses = [p0, p1, p2, p3, p4, p5];
    for (let i = 0; i < N_AXES; i++) {
      progresses[i].value = withDelay(
        i * STAGGER_MS,
        withTiming(1, { duration: SLIDE_DURATION, easing: Easing.out(Easing.quad) }),
      );
    }
  }, []);

  return (
    <Polygon
      points={pts}
      fill={color}
      fillOpacity={0.22}
      stroke={color}
      strokeWidth={1.8}
      strokeOpacity={0.7}
    />
  );
}

// ── Main component ──────────────────────────────────────────

interface MuscleRadarChartProps {
  heatmapData: HeatmapData[];
  /** Card width — defaults to screen width − 40 */
  width?: number;
  /** When true, use random values to showcase the animation */
  demo?: boolean;
  /** Time range — determines what "100%" means (optimal weekly sets × multiplier) */
  timeRange?: RadarTimeRange;
}

const SCREEN_W = Dimensions.get('window').width;
const DEFAULT_CARD_W = SCREEN_W - 40;

function RadarChartInner({
  normalizedValues,
  width,
  labelPositions,
  gridRings,
  axisLines,
  CX,
  CY,
  MAX_R,
  CHART_SIZE,
}: {
  normalizedValues: number[];
  width: number;
  labelPositions: { x: number; y: number; label: string; anchor: 'middle' | 'start' | 'end' }[];
  gridRings: string[];
  axisLines: { x1: number; y1: number; x2: number; y2: number }[];
  CX: number;
  CY: number;
  MAX_R: number;
  CHART_SIZE: number;
}) {
  return (
    <View style={[styles.chartWrap, { width: CHART_SIZE, height: CHART_SIZE }]}>
      <Svg width={CHART_SIZE} height={CHART_SIZE} overflow="visible">
        {gridRings.map((pts, i) => (
          <Polygon
            key={`ring-${i}`}
            points={pts}
            fill="none"
            stroke="rgba(198,198,198,0.10)"
            strokeWidth={1}
          />
        ))}
        {axisLines.map((line, i) => (
          <Line
            key={`axis-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="rgba(198,198,198,0.12)"
            strokeWidth={1}
          />
        ))}
        <Circle cx={CX} cy={CY} r={2} fill="rgba(198,198,198,0.25)" />
        <SmoothPolygon
          values={normalizedValues}
          cx={CX}
          cy={CY}
          maxRadius={MAX_R}
          color={Colors.primaryLight}
        />
        {RADAR_AXES.map((_, i) => {
          const v = normalizedValues[i];
          const pt = polarToCartesian(CX, CY, v * MAX_R, i, N_AXES);
          return v > 0 ? (
            <RadarPoint
              key={`dot-${i}`}
              index={i}
              centerX={CX}
              centerY={CY}
              targetX={pt.x}
              targetY={pt.y}
              r={3.5}
              fill={Colors.primaryLight}
              opacity={0.75}
            />
          ) : null;
        })}
      </Svg>
      {labelPositions.map((lp, i) => (
        <RadarAxisLabel
          key={`label-${i}`}
          index={i}
          x={lp.x}
          y={lp.y}
          anchor={lp.anchor}
          label={lp.label}
          fill={`rgba(198,198,198,${normalizedValues[i] > 0 ? 0.85 : 0.4})`}
        />
      ))}
    </View>
  );
}

export function MuscleRadarChart({ heatmapData, width = DEFAULT_CARD_W, demo = false, timeRange = 'week' }: MuscleRadarChartProps) {
  const CHART_SIZE = width;
  const CX = CHART_SIZE / 2;
  const CY = CHART_SIZE / 2;
  const MAX_R = CHART_SIZE / 2 - 68;

  const [demoKey, setDemoKey] = useState(0);
  const [showDemo, setShowDemo] = useState(false);
  const [demoValues, setDemoValues] = useState(() => RADAR_AXES.map(() => Math.random()));

  useEffect(() => {
    if (heatmapData.length > 0) setShowDemo(false);
  }, [heatmapData, timeRange]);

  const runDemo = useCallback(() => {
    Haptics.selectionAsync();
    setDemoValues(RADAR_AXES.map(() => Math.random()));
    setShowDemo(true);
    setDemoKey((k) => k + 1);
  }, []);

  // ── Compute normalized axis values from heatmapData ──────
  // Each axis is normalized against the optimal sets for that axis's muscle groups,
  // scaled by the time range (week=1×, month≈4.3×, year=52×).
  const normalizedValues = useMemo(() => {
    if (showDemo || demo || heatmapData.length === 0) return demoValues;

    const mult = timeRangeMultiplier(timeRange);

    return RADAR_AXES.map((axis, i) => {
      const totalSets = axis.groups.reduce((sum, grp) => {
        const found = heatmapData.find((d) => d.muscleGroup === grp);
        return sum + (found ? found.totalSets : 0);
      }, 0);
      const optimalSets = WEEKLY_OPTIMAL_PER_AXIS[i] * mult;
      return Math.min(1, totalSets / optimalSets);
    });
  }, [heatmapData, demo, demoValues, demoKey, timeRange, showDemo]);

  // ── Grid ring polygons ────────────────────────────────────
  const gridRings = useMemo(() => {
    return Array.from({ length: LEVELS }, (_, lvl) => {
      const r = ((lvl + 1) / LEVELS) * MAX_R;
      const pts = Array.from({ length: N_AXES }, (_, i) =>
        polarToCartesian(CX, CY, r, i, N_AXES),
      );
      return pointsString(pts);
    });
  }, [CX, CY, MAX_R]);

  // ── Axis lines ────────────────────────────────────────────
  const axisLines = useMemo(() => {
    return RADAR_AXES.map((_, i) => {
      const outer = polarToCartesian(CX, CY, MAX_R, i, N_AXES);
      return { x1: CX, y1: CY, x2: outer.x, y2: outer.y };
    });
  }, [CX, CY, MAX_R]);

  // ── Axis label positions ──────────────────────────────────
  const labelPositions = useMemo(() => {
    const LABEL_R = MAX_R + 14;
    return RADAR_AXES.map((axis, i) => {
      const pos = polarToCartesian(CX, CY, LABEL_R, i, N_AXES);
      const angle = (2 * Math.PI * i) / N_AXES - Math.PI / 2;
      const cosA = Math.cos(angle);
      const anchor: 'middle' | 'start' | 'end' =
        Math.abs(cosA) < 0.2 ? 'middle' : cosA > 0 ? 'start' : 'end';
      return { ...pos, label: axis.label, anchor };
    });
  }, [CX, CY, MAX_R]);

  const hasData = demo || (heatmapData.length > 0 && normalizedValues.some((v) => v > 0));

  return (
    <View style={[styles.cardShadow, { width }]}>
      <View style={[styles.cardGlass, { width, borderRadius: 28 }]}>
        <BlurView
          intensity={26}
          tint="dark"
          style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]}
        />
        <View style={[StyleSheet.absoluteFillObject, styles.cardFill, { borderRadius: 28 }]} />
        <LinearGradient
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 0.8 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]}
          pointerEvents="none"
        />
        <View style={[StyleSheet.absoluteFillObject, styles.cardBorder, { borderRadius: 28 }]} />

        <View style={styles.cardContent}>
          {hasData ? (
            <RadarChartInner
              key={demoKey}
              normalizedValues={normalizedValues}
              width={width}
              labelPositions={labelPositions}
              gridRings={gridRings}
              axisLines={axisLines}
              CX={CX}
              CY={CY}
              MAX_R={MAX_R}
              CHART_SIZE={CHART_SIZE}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>no data</Text>
              <Text style={styles.emptySubText}>log a workout to see muscle coverage</Text>
            </View>
          )}
          <Pressable
            onPress={runDemo}
            style={({ pressed }) => [styles.demoBtn, pressed && { opacity: 0.6, transform: [{ scale: 0.95 }] }]}
          >
            <Text style={styles.demoBtnText}>demo</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    borderRadius: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 12,
  },
  cardGlass: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  cardFill: {
    backgroundColor: 'rgba(47, 48, 49, 0.30)',
  },
  cardBorder: {
    position: 'absolute',
    inset: 0,
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.22)',
  },
  cardContent: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  chartWrap: {
    position: 'relative',
  },
  labelOverlay: {
    position: 'absolute',
  },
  labelText: {
    fontSize: 11,
    fontWeight: '500',
  },
  demoBtn: {
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(198,198,198,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(198,198,198,0.20)',
    alignSelf: 'center',
  },
  demoBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(198,198,198,0.70)',
    letterSpacing: -0.1,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(198,198,198,0.35)',
    letterSpacing: -0.3,
  },
  emptySubText: {
    fontSize: 12,
    color: 'rgba(198,198,198,0.22)',
    letterSpacing: -0.1,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
