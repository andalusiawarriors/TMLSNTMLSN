// ============================================================
// TMLSN — GitHub-style Calendar Heatmap
// Supports horizontal (7 rows × N weeks) and vertical (7 cols × N weeks rows).
// 5-level intensity ramp using the C6C6C6 palette.
// Wave entrance animation on render / period change.
// ============================================================

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { WorkoutSession } from '../../types';
import {
  buildCalendarBins,
  aggregateSessionsByDay,
  bucketize,
  getLevel,
  getMonthLabels,
  type HeatmapPeriod,
  type CalendarMetric,
  type CalendarBin,
} from '../../utils/dateBins';
import { Colors, Spacing, Glass } from '../../constants/theme';
import { GlassCard } from '../ui/GlassCard';

const SCREEN_W = Dimensions.get('window').width;

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_LETTERS_SHORT = ['M', '', 'W', '', 'F', '', 'S'];

const LEVEL_COLORS = [
  Colors.primaryLight + '0A',
  Colors.primaryLight + '30',
  Colors.primaryLight + '5A',
  Colors.primaryLight + '85',
  Colors.primaryLight,
];

interface CalendarHeatmapProps {
  sessions: WorkoutSession[];
  period: HeatmapPeriod;
  metric: CalendarMetric;
  orientation?: 'horizontal' | 'vertical';
  maxHeight?: number;
  animateIn?: boolean;
}

interface TooltipData {
  dateKey: string;
  date: Date;
  value: number;
  x: number;
  y: number;
}

// Wave animation: rows stagger in with scale + opacity
const WAVE_DURATION = 180;
const WAVE_STAGGER = 30;
const MAX_ANIMATED_ROWS = 20;

function AnimatedRow({
  children,
  index,
  animateIn,
}: {
  children: React.ReactNode;
  index: number;
  animateIn: boolean;
}) {
  const opacity = useSharedValue(animateIn ? 0 : 1);
  const scale = useSharedValue(animateIn ? 0.92 : 1);

  useEffect(() => {
    if (!animateIn) {
      opacity.value = 1;
      scale.value = 1;
      return;
    }
    const delay = Math.min(index, MAX_ANIMATED_ROWS) * WAVE_STAGGER;
    opacity.value = withDelay(delay, withTiming(1, { duration: WAVE_DURATION, easing: Easing.out(Easing.quad) }));
    scale.value = withDelay(delay, withSpring(1, { damping: 18, stiffness: 300, mass: 0.3 }));
  }, [animateIn, index, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scaleX: scale.value }, { scaleY: scale.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export function CalendarHeatmap({
  sessions,
  period,
  metric,
  orientation = 'horizontal',
  maxHeight,
  animateIn = true,
}: CalendarHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [animKey, setAnimKey] = useState(0);

  // Re-trigger wave on period/metric change
  const prevPeriod = useRef(period);
  const prevMetric = useRef(metric);
  useEffect(() => {
    if (prevPeriod.current !== period || prevMetric.current !== metric) {
      prevPeriod.current = period;
      prevMetric.current = metric;
      setAnimKey((k) => k + 1);
    }
  }, [period, metric]);

  const bins = useMemo(() => buildCalendarBins(period, sessions), [period, sessions]);
  const dayMap = useMemo(() => aggregateSessionsByDay(sessions, metric), [sessions, metric]);

  const values = useMemo(() => bins.map((b) => dayMap.get(b.dateKey) ?? 0), [bins, dayMap]);
  const thresholds = useMemo(() => bucketize(values, 5), [values]);

  const monthLabels = useMemo(() => getMonthLabels(bins), [bins]);
  const totalWeeks = useMemo(() => {
    if (bins.length === 0) return 1;
    return bins[bins.length - 1].weekIndex + 1;
  }, [bins]);

  const totalValue = useMemo(() => {
    let sum = 0;
    dayMap.forEach((v) => { sum += v; });
    return sum;
  }, [dayMap]);

  const activeDays = useMemo(() => {
    let count = 0;
    dayMap.forEach((v) => { if (v > 0) count++; });
    return count;
  }, [dayMap]);

  const formatDate = (d: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const formatValue = (v: number) => {
    if (metric === 'workouts') return `${v} workout${v !== 1 ? 's' : ''}`;
    if (v >= 1000) return `${Math.round(v / 1000)}k vol`;
    return `${Math.round(v)} vol`;
  };

  const handleCellPressWithHaptic = useCallback(
    (bin: CalendarBin, val: number, cx: number, cy: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTooltip((prev) =>
        prev?.dateKey === bin.dateKey ? null : { dateKey: bin.dateKey, date: bin.date, value: val, x: cx, y: cy },
      );
    },
    [],
  );

  if (orientation === 'vertical') {
    return (
      <VerticalCalendar
        key={animKey}
        bins={bins}
        dayMap={dayMap}
        thresholds={thresholds}
        monthLabels={monthLabels}
        totalWeeks={totalWeeks}
        totalValue={totalValue}
        activeDays={activeDays}
        metric={metric}
        tooltip={tooltip}
        onCellPress={handleCellPressWithHaptic}
        onTooltipDismiss={() => setTooltip(null)}
        formatDate={formatDate}
        formatValue={formatValue}
        maxHeight={maxHeight}
        animateIn={animateIn}
      />
    );
  }

  // ---- Horizontal (original) ----
  const CELL = 14;
  const GAP = 3;
  const STEP = CELL + GAP;
  const DAY_LABEL_W = 22;
  const MONTH_LABEL_H = 16;
  const containerW = SCREEN_W - Spacing.md * 2;
  const gridW = DAY_LABEL_W + totalWeeks * STEP;

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryNum}>{activeDays}</Text>
          <Text style={styles.summaryLabel}>active days</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryNum}>
            {metric === 'workouts'
              ? Math.round(totalValue)
              : totalValue >= 1000
                ? `${Math.round(totalValue / 1000)}k`
                : Math.round(totalValue)}
          </Text>
          <Text style={styles.summaryLabel}>
            {metric === 'workouts' ? 'workouts' : 'total vol'}
          </Text>
        </View>
      </View>

      <View style={styles.gridWrap}>
        <View style={{ width: Math.max(containerW, gridW) }}>
          <View style={[styles.monthRow, { paddingLeft: DAY_LABEL_W }]}>
            {monthLabels.map((ml, i) => (
              <Text
                key={`${ml.label}-${i}`}
                style={[
                  styles.monthLabel,
                  { position: 'absolute', left: DAY_LABEL_W + ml.weekIndex * STEP },
                ]}
              >
                {ml.label}
              </Text>
            ))}
          </View>

          <View style={styles.gridRow}>
            <View style={[styles.dayLabels, { width: DAY_LABEL_W }]}>
              {DAY_LETTERS_SHORT.map((letter, i) => (
                <View key={i} style={{ height: STEP, justifyContent: 'center' }}>
                  <Text style={styles.dayLabel}>{letter}</Text>
                </View>
              ))}
            </View>

            <Svg
              width={totalWeeks * STEP}
              height={7 * STEP}
              viewBox={`0 0 ${totalWeeks * STEP} ${7 * STEP}`}
            >
              {bins.map((bin) => {
                const val = dayMap.get(bin.dateKey) ?? 0;
                const level = getLevel(val, thresholds);
                const isSelected = tooltip?.dateKey === bin.dateKey;
                return (
                  <Rect
                    key={bin.dateKey}
                    x={bin.weekIndex * STEP}
                    y={bin.dayIndex * STEP}
                    width={CELL}
                    height={CELL}
                    rx={4}
                    ry={4}
                    fill={LEVEL_COLORS[level]}
                    stroke={isSelected ? Glass.borderSelected : Glass.border}
                    strokeWidth={isSelected ? 1.5 : 0.5}
                    onPress={() => handleCellPressWithHaptic(
                      bin, val,
                      DAY_LABEL_W + bin.weekIndex * STEP + CELL / 2,
                      MONTH_LABEL_H + bin.dayIndex * STEP + CELL / 2,
                    )}
                  />
                );
              })}
            </Svg>
          </View>
        </View>
      </View>

      <View style={styles.legendRow}>
        <Text style={styles.legendLabel}>Less</Text>
        {LEVEL_COLORS.map((color, i) => (
          <View key={i} style={[styles.legendCell, { backgroundColor: color }]} />
        ))}
        <Text style={styles.legendLabel}>More</Text>
      </View>

      {tooltip && (
        <Pressable style={styles.tooltipOverlay} onPress={() => setTooltip(null)}>
          <GlassCard radius={Glass.radius.secondary} noPadding style={styles.tooltipCard}>
            <Text style={styles.tooltipDate}>{formatDate(tooltip.date)}</Text>
            <Text style={styles.tooltipValue}>{formatValue(tooltip.value)}</Text>
          </GlassCard>
        </Pressable>
      )}

      {bins.length > 0 && activeDays === 0 && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyText}>No workouts in this period</Text>
          <Text style={styles.emptySubText}>Complete a workout to light up the grid</Text>
        </View>
      )}
    </View>
  );
}

// ============================================================
// Vertical Calendar — 7 columns (Mon–Sun), N rows (weeks)
// Each week row animates in with staggered wave.
// ============================================================

const V_CELL = 16;
const V_GAP = 3;
const V_STEP = V_CELL + V_GAP;
const V_DAY_LABEL_H = 20;
const V_MONTH_LABEL_W = 32;

function VerticalCalendar({
  bins,
  dayMap,
  thresholds,
  monthLabels,
  totalWeeks,
  totalValue,
  activeDays,
  metric,
  tooltip,
  onCellPress,
  onTooltipDismiss,
  formatDate,
  formatValue,
  maxHeight,
  animateIn,
}: {
  bins: CalendarBin[];
  dayMap: Map<string, number>;
  thresholds: number[];
  monthLabels: { label: string; weekIndex: number }[];
  totalWeeks: number;
  totalValue: number;
  activeDays: number;
  metric: CalendarMetric;
  tooltip: TooltipData | null;
  onCellPress: (bin: CalendarBin, val: number, cx: number, cy: number) => void;
  onTooltipDismiss: () => void;
  formatDate: (d: Date) => string;
  formatValue: (v: number) => string;
  maxHeight?: number;
  animateIn: boolean;
}) {
  const weekMonthMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const ml of monthLabels) {
      map.set(ml.weekIndex, ml.label);
    }
    return map;
  }, [monthLabels]);

  // Group bins by weekIndex for row-based rendering
  const weekRows = useMemo(() => {
    const rows: CalendarBin[][] = Array.from({ length: totalWeeks }, () => []);
    for (const bin of bins) {
      rows[bin.weekIndex]?.push(bin);
    }
    return rows;
  }, [bins, totalWeeks]);

  return (
    <View style={vStyles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryNum}>{activeDays}</Text>
          <Text style={styles.summaryLabel}>active days</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryNum}>
            {metric === 'workouts'
              ? Math.round(totalValue)
              : totalValue >= 1000
                ? `${Math.round(totalValue / 1000)}k`
                : Math.round(totalValue)}
          </Text>
          <Text style={styles.summaryLabel}>
            {metric === 'workouts' ? 'workouts' : 'total vol'}
          </Text>
        </View>
      </View>

      {/* Day labels row (M T W T F S S) */}
      <View style={[vStyles.dayLabelRow, { paddingLeft: V_MONTH_LABEL_W }]}>
        {DAY_LETTERS.map((letter, i) => (
          <View key={i} style={[vStyles.dayLabelCell, { width: V_STEP }]}>
            <Text style={vStyles.dayLabel}>{letter}</Text>
          </View>
        ))}
      </View>

      {/* Grid area — each week row animates in */}
      <View style={[vStyles.gridArea, maxHeight ? { maxHeight } : undefined]}>
        {weekRows.map((rowBins, weekIdx) => (
          <AnimatedRow key={weekIdx} index={weekIdx} animateIn={animateIn}>
            <View style={vStyles.weekRow}>
              {/* Month label */}
              <View style={[vStyles.monthCell, { width: V_MONTH_LABEL_W }]}>
                {weekMonthMap.has(weekIdx) && (
                  <Text style={vStyles.monthLabel}>{weekMonthMap.get(weekIdx)}</Text>
                )}
              </View>
              {/* 7 cells via SVG */}
              <Svg
                width={7 * V_STEP}
                height={V_STEP}
                viewBox={`0 0 ${7 * V_STEP} ${V_STEP}`}
              >
                {rowBins.map((bin) => {
                  const val = dayMap.get(bin.dateKey) ?? 0;
                  const level = getLevel(val, thresholds);
                  const isSelected = tooltip?.dateKey === bin.dateKey;
                  return (
                    <Rect
                      key={bin.dateKey}
                      x={bin.dayIndex * V_STEP}
                      y={0}
                      width={V_CELL}
                      height={V_CELL}
                      rx={4}
                      ry={4}
                      fill={LEVEL_COLORS[level]}
                      stroke={isSelected ? Glass.borderSelected : Glass.border}
                      strokeWidth={isSelected ? 1.5 : 0.5}
                      onPress={() => onCellPress(
                        bin, val,
                        V_MONTH_LABEL_W + bin.dayIndex * V_STEP + V_CELL / 2,
                        V_DAY_LABEL_H + bin.weekIndex * V_STEP + V_CELL / 2,
                      )}
                    />
                  );
                })}
              </Svg>
            </View>
          </AnimatedRow>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <Text style={styles.legendLabel}>Less</Text>
        {LEVEL_COLORS.map((color, i) => (
          <View key={i} style={[styles.legendCell, { backgroundColor: color }]} />
        ))}
        <Text style={styles.legendLabel}>More</Text>
      </View>

      {/* Tooltip */}
      {tooltip && (
        <Pressable style={styles.tooltipOverlay} onPress={onTooltipDismiss}>
          <GlassCard radius={Glass.radius.secondary} noPadding style={styles.tooltipCard}>
            <Text style={styles.tooltipDate}>{formatDate(tooltip.date)}</Text>
            <Text style={styles.tooltipValue}>{formatValue(tooltip.value)}</Text>
          </GlassCard>
        </Pressable>
      )}

      {bins.length > 0 && activeDays === 0 && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyText}>No workouts in this period</Text>
          <Text style={styles.emptySubText}>Complete a workout to light up the grid</Text>
        </View>
      )}
    </View>
  );
}

// ---- Vertical styles ----
const vStyles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  dayLabelRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayLabelCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Glass.textSecondary,
    letterSpacing: 0.3,
  },
  gridArea: {
    overflow: 'hidden',
  },
  weekRow: {
    flexDirection: 'row',
    height: V_STEP,
    alignItems: 'center',
  },
  monthCell: {
    height: V_STEP,
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Glass.textSecondary,
    letterSpacing: 0.3,
  },
});

// ---- Shared / horizontal styles ----
const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    backgroundColor: Glass.fill,
    borderRadius: Glass.radius.secondary,
    borderWidth: Glass.borderWidth,
    borderColor: Glass.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  summaryNum: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.primaryLight,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Glass.textSecondary,
  },
  gridWrap: {
    overflow: 'hidden',
  },
  monthRow: {
    height: 16,
    position: 'relative',
  },
  monthLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Glass.textSecondary,
    letterSpacing: 0.3,
  },
  gridRow: {
    flexDirection: 'row',
  },
  dayLabels: {
    justifyContent: 'flex-start',
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Glass.textSecondary,
    textAlign: 'right',
    paddingRight: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Glass.textSecondary,
    marginHorizontal: 4,
  },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  tooltipOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  tooltipCard: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
    minWidth: 140,
  },
  tooltipDate: {
    fontSize: 13,
    fontWeight: '500',
    color: Glass.textSecondary,
  },
  tooltipValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Glass.textPrimary,
    letterSpacing: -0.3,
  },
  emptyOverlay: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: Glass.textSecondary,
  },
  emptySubText: {
    fontSize: 12,
    color: Colors.primaryLight + '40',
  },
});
