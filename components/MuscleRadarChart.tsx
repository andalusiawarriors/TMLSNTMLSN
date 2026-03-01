// ============================================================
// TMLSN — Muscle Radar Chart
// Spider/radar chart showing major muscle group coverage.
// Built with react-native-svg. Liquid glass card wrapper.
// ============================================================

import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';
import type { HeatmapData } from '../utils/weeklyMuscleTracker';

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

// ── Animated polygon wrapper ─────────────────────────────────

function AnimatedPolygon({
  values,     // 0..1 per axis (length = N_AXES)
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
  // Compute points from normalized values
  const pts = values.map((v, i) => polarToCartesian(cx, cy, v * maxRadius, i, N_AXES));
  const ps = pointsString(pts);

  return (
    <Polygon
      points={ps}
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
}

const SCREEN_W = Dimensions.get('window').width;
const DEFAULT_CARD_W = SCREEN_W - 40;

export function MuscleRadarChart({ heatmapData, width = DEFAULT_CARD_W }: MuscleRadarChartProps) {
  const CHART_SIZE = width;
  const CX = CHART_SIZE / 2;
  const CY = CHART_SIZE / 2;
  const MAX_R = CHART_SIZE / 2 - 68;

  // ── Compute normalized axis values from heatmapData ──────
  const normalizedValues = useMemo(() => {
    if (heatmapData.length === 0) return RADAR_AXES.map(() => 0);

    // Sum intensity per axis
    const axisIntensities = RADAR_AXES.map((axis) => {
      const total = axis.groups.reduce((sum, grp) => {
        const found = heatmapData.find((d) => d.muscleGroup === grp);
        return sum + (found ? found.intensity : 0);
      }, 0);
      // Average across the groups in the axis
      return total / axis.groups.length;
    });

    const max = Math.max(...axisIntensities, 0.001);
    return axisIntensities.map((v) => Math.min(1, v / max));
  }, [heatmapData]);

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

  const hasData = heatmapData.length > 0 && normalizedValues.some((v) => v > 0);

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
              <AnimatedPolygon
                values={normalizedValues}
                cx={CX}
                cy={CY}
                maxRadius={MAX_R}
                color={Colors.primaryLight}
              />
              {RADAR_AXES.map((_, i) => {
                const v = normalizedValues[i];
                const pt = polarToCartesian(CX, CY, v * MAX_R, i, N_AXES);
                return (
                  <Circle
                    key={`dot-${i}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={v > 0 ? 3.5 : 0}
                    fill={Colors.primaryLight}
                    opacity={0.75}
                  />
                );
              })}
              {labelPositions.map((lp, i) => (
                <SvgText
                  key={`label-${i}`}
                  x={lp.x}
                  y={lp.y}
                  textAnchor={lp.anchor}
                  fontSize={11}
                  fontWeight="500"
                  fill={`rgba(198,198,198,${normalizedValues[i] > 0 ? 0.85 : 0.4})`}
                  dy={4}
                >
                  {lp.label}
                </SvgText>
              ))}
            </Svg>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>no data</Text>
              <Text style={styles.emptySubText}>log a workout to see muscle coverage</Text>
            </View>
          )}
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
