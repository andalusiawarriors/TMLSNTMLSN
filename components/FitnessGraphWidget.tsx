// ============================================================
// TMLSN — Fitness graph: Duration / Volume / Reps by time range
// Bar chart; top-left shows selected day date + value; bubbles: Duration, Volume, Reps
// ============================================================

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { AnimatedFadeInUp } from './AnimatedFadeInUp';
import { getWorkoutSessions, getUserSettings } from '../utils/storage';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import type { WorkoutSession } from '../types';
import { format, startOfDay, getYear, getMonth, startOfMonth, endOfMonth } from 'date-fns';

function parseDate(dateKey: string): Date {
  return new Date(dateKey + 'T12:00:00');
}
/** Session date in local YYYY-MM-DD (so workouts show on the day they were done, not UTC). */
function getSessionDateKey(s: WorkoutSession): string {
  return format(new Date(s.date), 'yyyy-MM-dd');
}
function eachDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(start.getTime());
  while (d <= end) {
    out.push(new Date(d.getTime()));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isWithinInterval(date: Date, interval: { start: Date; end: Date }): boolean {
  return date >= interval.start && date <= interval.end;
}

const LB_TO_KG = 0.453592;
const CHART_HEIGHT = 210;
const BAR_GAP = 4;
const WEEK_GAP = 8;
const MIN_BAR_WIDTH = 8;
const MIN_BAR_HEIGHT = 6; // minimum visible height when value > 0
const MAX_BAR_WIDTH_ALL_TIME = 32;
const VALUE_SECTION_HEIGHT = 48;
const BUBBLES_ROW_HEIGHT = 52;
const TIME_RANGE_PILL_WIDTH = 108;
const BUBBLE_PILL_WIDTH = 108;
const Y_AXIS_LABEL_WIDTH = 48;
const AXIS_LINE_WIDTH = 1;
const BAR_AREA_HEIGHT = CHART_HEIGHT - AXIS_LINE_WIDTH;
const BAR_TOP_RADIUS = 38;
const CHART_BG = 'transparent';
const BAR_COLOR = '#c6c6c6';
const AXIS_LABEL_COLOR = 'rgba(198, 198, 198, 0.85)';
const GRIDLINE_COLOR = 'rgba(255, 255, 255, 0.1)';
const AXIS_LINE_COLOR = 'rgba(255, 255, 255, 0.2)';
const DEFAULT_DURATION_MAX_HOURS = 3;
const CHART_H_PADDING = Spacing.md;
const PILL_SELECTED_BG = '#c6c6c6';
const PILL_SELECTED_TEXT = '#2f3031';
const PILL_BORDER = 'rgba(255, 255, 255, 0.2)';

type TimeRange = 'month' | 'year' | 'all';
type DropdownOpen = 'month' | 'year' | null;
type Metric = 'duration' | 'volume' | 'reps';

/** Bar slides from x-axis (bottom) up to its y-value — bottom fixed, top grows up */
function barGrowUp(delayMs: number) {
  return (values: { targetHeight: number; targetOriginY: number }) => {
    'worklet';
    const { targetHeight, targetOriginY } = values;
    const duration = 400;
    const easing = Easing.out(Easing.cubic);
    return {
      initialValues: {
        height: 0,
        originY: targetOriginY + targetHeight,
      },
      animations: {
        height: withDelay(delayMs, withTiming(targetHeight, { duration, easing })),
        originY: withDelay(delayMs, withTiming(targetOriginY, { duration, easing })),
      },
    };
  };
}

interface DayData {
  date: Date;
  dateKey: string;
  durationMinutes: number;
  volumeKg: number;
  reps: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

interface MonthData {
  month: number;
  monthName: string;
  durationMinutes: number;
  volumeKg: number;
  reps: number;
}

interface YearData {
  year: number;
  durationMinutes: number;
  volumeKg: number;
  reps: number;
}

function aggregateByDay(sessions: WorkoutSession[], weightUnit: 'kg' | 'lb'): DayData[] {
  const byDay = new Map<string, { durationMinutes: number; volumeRaw: number; reps: number }>();
  for (const s of sessions) {
    const d = getSessionDateKey(s);
    const existing = byDay.get(d) ?? { durationMinutes: 0, volumeRaw: 0, reps: 0 };
    existing.durationMinutes += s.duration ?? 0;
    for (const ex of s.exercises ?? []) {
      for (const set of ex.sets ?? []) {
        existing.volumeRaw += set.weight * set.reps;
        existing.reps += set.reps;
      }
    }
    byDay.set(d, existing);
  }
  return Array.from(byDay.entries()).map(([dateKey, v]) => {
    const volumeKg = weightUnit === 'lb' ? v.volumeRaw * LB_TO_KG : v.volumeRaw;
    return {
      date: parseDate(dateKey),
      dateKey,
      durationMinutes: v.durationMinutes,
      volumeKg,
      reps: v.reps,
    };
  });
}

function formatDurationMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatVolume(kg: number, weightUnit: 'kg' | 'lb'): string {
  const value = weightUnit === 'lb' ? kg / LB_TO_KG : kg;
  const unit = weightUnit === 'lb' ? 'lb' : 'kg';
  return `${Math.round(value).toLocaleString()} ${unit}`;
}

function formatYAxisValue(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return (m % 1 === 0 ? m : m.toFixed(1)) + 'M';
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return (k % 1 === 0 ? k : k.toFixed(1)) + 'k';
  }
  return String(Math.round(value));
}

export function FitnessGraphWidget() {
  const { colors } = useTheme();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const now = new Date();
  const currentYear = getYear(now);
  const currentMonth = getMonth(now);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [dropdownOpen, setDropdownOpen] = useState<DropdownOpen>(null);
  const [metric, setMetric] = useState<Metric>('duration');
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [selectedMonthData, setSelectedMonthData] = useState<MonthData | null>(null);
  const [selectedYearData, setSelectedYearData] = useState<YearData | null>(null);
  const [animTrigger, setAnimTrigger] = useState(0);

  const loadSessions = useCallback(async () => {
    const [s, settings] = await Promise.all([getWorkoutSessions(), getUserSettings()]);
    setSessions(s);
    setWeightUnit(settings?.weightUnit ?? 'kg');
  }, []);

  useFocusEffect(useCallback(() => {
    loadSessions();
    setAnimTrigger((t) => t + 1);
  }, [loadSessions]));

  const { rangeStart, rangeEnd, dayDataInRange, yMax } = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    let start: Date;
    let end: Date;
    if (timeRange === 'month') {
      start = startOfMonth(new Date(selectedYear, selectedMonth, 1));
      const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth, 1));
      end = today < monthEnd ? today : startOfDay(monthEnd);
    } else if (timeRange === 'year') {
      start = startOfDay(new Date(selectedYear, 0, 1));
      const yearEnd = new Date(selectedYear, 11, 31);
      end = today < yearEnd ? today : startOfDay(yearEnd);
    } else {
      const firstKey = sessions.length
        ? sessions.reduce((min, s) => {
            const k = getSessionDateKey(s);
            return k < min ? k : min;
          }, getSessionDateKey(sessions[0]))
        : format(now, 'yyyy-MM-dd');
      start = startOfDay(parseDate(firstKey));
      end = today;
    }
    const rangeStart = start;
    const rangeEnd = end;
    const rangeStartKey = format(rangeStart, 'yyyy-MM-dd');
    const rangeEndKey = format(rangeEnd, 'yyyy-MM-dd');
    const filtered = sessions.filter((s) => {
      const key = getSessionDateKey(s);
      return key >= rangeStartKey && key <= rangeEndKey;
    });
    const dayData = aggregateByDay(filtered, weightUnit);
    const daysInRange = eachDay(rangeStart, rangeEnd);
    const byDateKey = new Map(dayData.map((d) => [d.dateKey, d]));
    const dayDataInRange = daysInRange.map((date) => {
      const key = format(date, 'yyyy-MM-dd');
      const data = byDateKey.get(key);
      return { date, dateKey: key, data };
    });

    let yMax = 0;
    if (metric === 'duration') {
      const maxMin = Math.max(...dayDataInRange.map((d) => d.data?.durationMinutes ?? 0), 0);
      const maxHours = maxMin / 60;
      yMax = Math.max(DEFAULT_DURATION_MAX_HOURS, Math.ceil(maxHours * 2) / 2) || DEFAULT_DURATION_MAX_HOURS;
    } else if (metric === 'volume') {
      const maxKg = Math.max(...dayDataInRange.map((d) => d.data?.volumeKg ?? 0), 0);
      const maxDisplay = weightUnit === 'lb' ? maxKg / LB_TO_KG : maxKg;
      yMax = Math.ceil(maxDisplay / 100) * 100 || 100;
    } else {
      const maxReps = Math.max(...dayDataInRange.map((d) => d.data?.reps ?? 0), 0);
      yMax = Math.ceil(maxReps / 10) * 10 || 10;
    }

    return { rangeStart, rangeEnd, dayDataInRange, yMax };
  }, [sessions, timeRange, weightUnit, metric, selectedMonth, selectedYear]);

  const targetYearForMonths = useMemo(() => {
    if (timeRange === 'year') return selectedYear;
    if (timeRange === 'all' && sessions.length > 0) {
      const years = sessions.map((s) => getYear(parseDate(getSessionDateKey(s))));
      return Math.max(...years);
    }
    return getYear(new Date());
  }, [timeRange, sessions, selectedYear]);

  const availableYears = useMemo(() => {
    const endYear = currentYear;
    const startYear = sessions.length
      ? Math.min(...sessions.map((s) => getYear(parseDate(getSessionDateKey(s)))))
      : currentYear;
    const years: number[] = [];
    for (let y = endYear; y >= Math.max(startYear, currentYear - 20); y--) {
      years.push(y);
    }
    return years;
  }, [sessions, currentYear]);

  const monthlyData = useMemo((): MonthData[] => {
    if (timeRange !== 'year' && timeRange !== 'all') return [];
    const byMonth = new Map<number, { durationMinutes: number; volumeKg: number; reps: number }>();
    for (let m = 0; m < 12; m++) byMonth.set(m, { durationMinutes: 0, volumeKg: 0, reps: 0 });
    dayDataInRange.forEach(({ data }) => {
      if (!data) return;
      if (data.date.getFullYear() !== targetYearForMonths) return;
      const m = data.date.getMonth();
      const existing = byMonth.get(m)!;
      existing.durationMinutes += data.durationMinutes;
      existing.volumeKg += data.volumeKg;
      existing.reps += data.reps;
      byMonth.set(m, existing);
    });
    return MONTH_NAMES.map((monthName, i) => {
      const v = byMonth.get(i)!;
      return { month: i, monthName, ...v };
    });
  }, [dayDataInRange, timeRange, targetYearForMonths]);

  const yearlyData = useMemo((): YearData[] => {
    if (timeRange !== 'all' || sessions.length === 0) return [];
    const byYear = new Map<number, { durationMinutes: number; volumeRaw: number; reps: number }>();
    for (const s of sessions) {
      const year = getYear(parseDate(getSessionDateKey(s)));
      const existing = byYear.get(year) ?? { durationMinutes: 0, volumeRaw: 0, reps: 0 };
      existing.durationMinutes += s.duration ?? 0;
      for (const ex of s.exercises ?? []) {
        for (const set of ex.sets ?? []) {
          existing.volumeRaw += set.weight * set.reps;
          existing.reps += set.reps;
        }
      }
      byYear.set(year, existing);
    }
    const years = Array.from(byYear.keys()).sort((a, b) => a - b);
    return years.map((year) => {
      const v = byYear.get(year)!;
      const volumeKg = weightUnit === 'lb' ? v.volumeRaw * LB_TO_KG : v.volumeRaw;
      return { year, durationMinutes: v.durationMinutes, volumeKg, reps: v.reps };
    });
  }, [sessions, timeRange, weightUnit]);

  const isYearView = timeRange === 'year';
  const isAllTimeView = timeRange === 'all';
  const isYearlyView = timeRange === 'year' || timeRange === 'all';
  const chartBarsCount = isAllTimeView ? yearlyData.length : isYearView ? 12 : dayDataInRange.length;
  const yMaxYearly = useMemo(() => {
    if (!isYearView || monthlyData.length === 0) return 0;
    if (metric === 'duration') {
      const maxMin = Math.max(...monthlyData.map((m) => m.durationMinutes), 0);
      return Math.max(DEFAULT_DURATION_MAX_HOURS, Math.ceil((maxMin / 60) * 2) / 2) || DEFAULT_DURATION_MAX_HOURS;
    }
    if (metric === 'volume') {
      const maxKg = Math.max(...monthlyData.map((m) => m.volumeKg), 0);
      const maxDisplay = weightUnit === 'lb' ? maxKg / LB_TO_KG : maxKg;
      return Math.ceil(maxDisplay / 100) * 100 || 100;
    }
    const maxReps = Math.max(...monthlyData.map((m) => m.reps), 0);
    return Math.ceil(maxReps / 10) * 10 || 10;
  }, [monthlyData, metric, isYearView, weightUnit]);

  const yMaxAllTime = useMemo(() => {
    if (!isAllTimeView || yearlyData.length === 0) return 0;
    if (metric === 'duration') {
      const maxMin = Math.max(...yearlyData.map((y) => y.durationMinutes), 0);
      return Math.max(DEFAULT_DURATION_MAX_HOURS, Math.ceil((maxMin / 60) * 2) / 2) || DEFAULT_DURATION_MAX_HOURS;
    }
    if (metric === 'volume') {
      const maxKg = Math.max(...yearlyData.map((y) => y.volumeKg), 0);
      const maxDisplay = weightUnit === 'lb' ? maxKg / LB_TO_KG : maxKg;
      return Math.ceil(maxDisplay / 100) * 100 || 100;
    }
    const maxReps = Math.max(...yearlyData.map((y) => y.reps), 0);
    return Math.ceil(maxReps / 10) * 10 || 10;
  }, [yearlyData, metric, isAllTimeView, weightUnit]);

  const xAxisSegments = useMemo(() => {
    if (timeRange === 'all') {
      return yearlyData.map((y, i) => ({ label: String(y.year), startIndex: i }));
    }
    if (timeRange === 'year') {
      return MONTH_NAMES.map((label, i) => ({ label, startIndex: i }));
    }
    const months: { label: string; startIndex: number }[] = [];
    let lastKey = '';
    dayDataInRange.forEach(({ date }, i) => {
      const key = format(date, 'yyyy-MM');
      if (key !== lastKey) {
        months.push({ label: MONTH_NAMES[date.getMonth()], startIndex: i });
        lastKey = key;
      }
    });
    return months;
  }, [dayDataInRange, timeRange, yearlyData]);

  const screenWidth = Dimensions.get('window').width;
  const chartAreaWidth = screenWidth - CHART_H_PADDING * 2 - Y_AXIS_LABEL_WIDTH;
  const n = dayDataInRange.length || 1;
  const weekGapCount = n > 0 ? Math.floor((n - 1) / 7) : 0;
  const totalGapWidth = (n - 1) * BAR_GAP + weekGapCount * WEEK_GAP;
  const chartWidth = chartAreaWidth;
  const barWidth = (chartWidth - totalGapWidth) / n;

  const nYearly = isAllTimeView ? yearlyData.length : isYearView ? 12 : n;
  const yearlyGapWidth = (nYearly - 1) * BAR_GAP;
  const barWidthYearly = (isAllTimeView || isYearView) ? (chartWidth - yearlyGapWidth) / nYearly : barWidth;
  const effectiveBarWidth = (isAllTimeView || isYearView)
    ? (isAllTimeView ? Math.min(barWidthYearly, MAX_BAR_WIDTH_ALL_TIME) : barWidthYearly)
    : barWidth;
  const effectiveN = nYearly;
  const effectiveYMax = isAllTimeView ? yMaxAllTime : isYearView ? yMaxYearly : yMax;
  const allTimeBarsWidth = isAllTimeView ? effectiveN * effectiveBarWidth + (effectiveN - 1) * BAR_GAP : 0;
  const effectiveChartWidth = isAllTimeView
    ? chartWidth
    : (isYearView ? effectiveN * effectiveBarWidth + (effectiveN - 1) * BAR_GAP : chartWidth);
  const totalDailyBarsWidth = n * effectiveBarWidth + totalGapWidth;
  const barsBlockWidth = isAllTimeView
    ? chartWidth
    : (isYearView ? effectiveChartWidth : chartWidth);

  const yAxisUnit = metric === 'duration' ? 'h' : metric === 'volume' ? weightUnit : 'rps';
  const yTicks = [effectiveYMax, effectiveYMax * (2 / 3), effectiveYMax * (1 / 3), 0];

  const xAxisSegmentWidths = useMemo(() => {
    if (isAllTimeView || isYearView) {
      return Array.from({ length: effectiveN }, (_, i) => effectiveBarWidth + (i < effectiveN - 1 ? BAR_GAP : 0));
    }
    if (xAxisSegments.length === 0) return [];
    return xAxisSegments.map((seg, i) => {
      const start = seg.startIndex;
      const end = i < xAxisSegments.length - 1 ? xAxisSegments[i + 1].startIndex : n;
      let w = 0;
      for (let j = start; j < end; j++) {
        w += barWidth + BAR_GAP + ((j + 1) % 7 === 0 && j < n - 1 ? WEEK_GAP : 0);
      }
      return w;
    });
  }, [xAxisSegments, n, barWidth, isYearView, isAllTimeView, effectiveBarWidth, effectiveN]);

  const getValue = (d: DayData | undefined) => {
    if (!d) return 0;
    if (metric === 'duration') return d.durationMinutes / 60;
    if (metric === 'volume') return weightUnit === 'lb' ? d.volumeKg / LB_TO_KG : d.volumeKg;
    return d.reps;
  };

  const formatValue = (d: DayData) => {
    if (metric === 'duration') return formatDurationMinutes(d.durationMinutes);
    if (metric === 'volume') return formatVolume(d.volumeKg, weightUnit);
    return `${d.reps} reps`;
  };

  const getValueMonth = (m: MonthData) => {
    if (metric === 'duration') return m.durationMinutes / 60;
    if (metric === 'volume') return weightUnit === 'lb' ? m.volumeKg / LB_TO_KG : m.volumeKg;
    return m.reps;
  };

  const formatValueMonth = (m: MonthData) => {
    if (metric === 'duration') return formatDurationMinutes(m.durationMinutes);
    if (metric === 'volume') return formatVolume(m.volumeKg, weightUnit);
    return `${m.reps} reps`;
  };

  const getValueYear = (y: YearData) => {
    if (metric === 'duration') return y.durationMinutes / 60;
    if (metric === 'volume') return weightUnit === 'lb' ? y.volumeKg / LB_TO_KG : y.volumeKg;
    return y.reps;
  };

  const formatValueYear = (y: YearData) => {
    if (metric === 'duration') return formatDurationMinutes(y.durationMinutes);
    if (metric === 'volume') return formatVolume(y.volumeKg, weightUnit);
    return `${y.reps} reps`;
  };

  return (
    <View style={[styles.wrap, { marginBottom: Spacing.lg }]}>
      {/* Time range: Month, Year, All time — above the info */}
      <AnimatedFadeInUp delay={0} duration={320} trigger={animTrigger}>
      <View style={styles.rangeRow}>
        <View style={styles.rangeRowInner}>
          {/* Month */}
          <View style={styles.timeRangeButtonWrap}>
            <Pressable
              onPress={() => {
                if (timeRange !== 'month') {
                  setTimeRange('month');
                  setSelectedMonth(currentMonth);
                  setSelectedYear(currentYear);
                  setDropdownOpen(null);
                  setSelectedMonthData(null);
                  setSelectedYearData(null);
                } else {
                  setDropdownOpen((prev) => (prev === 'month' ? null : 'month'));
                }
              }}
              style={[
                styles.timeRangePill,
                {
                  backgroundColor: timeRange === 'month' ? PILL_SELECTED_BG : 'transparent',
                  borderColor: timeRange === 'month' ? PILL_SELECTED_BG : PILL_BORDER,
                },
              ]}
            >
              <View style={styles.timeRangePillContent}>
                <Text
                  style={[
                    styles.timeRangePillText,
                    { color: timeRange === 'month' ? PILL_SELECTED_TEXT : 'rgba(255,255,255,0.9)' },
                  ]}
                >
                  {MONTH_NAMES[selectedMonth]} {selectedYear}
                </Text>
                <Text style={[styles.timeRangeArrow, { color: timeRange === 'month' ? PILL_SELECTED_TEXT : 'rgba(255,255,255,0.9)' }]}>▼</Text>
              </View>
            </Pressable>
            {dropdownOpen === 'month' && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                exiting={FadeOutUp.duration(150)}
                style={styles.dropdown}
              >
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                  {MONTH_NAMES.map((name, i) => (
                    <Pressable
                      key={name}
                      onPress={() => {
                        setSelectedMonth(i);
                        setDropdownOpen(null);
                      }}
                      style={[styles.dropdownItem, i === selectedMonth && styles.dropdownItemSelected]}
                    >
                      <Text style={[styles.dropdownItemText, i === selectedMonth && styles.dropdownItemTextSelected]}>
                        {name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
          </View>
          {/* Year */}
          <View style={styles.timeRangeButtonWrap}>
            <Pressable
              onPress={() => {
                if (timeRange !== 'year') {
                  setTimeRange('year');
                  setSelectedYear(currentYear);
                  setDropdownOpen(null);
                  setSelectedDay(null);
                  setSelectedYearData(null);
                } else {
                  setDropdownOpen((prev) => (prev === 'year' ? null : 'year'));
                }
              }}
              style={[
                styles.timeRangePill,
                {
                  backgroundColor: timeRange === 'year' ? PILL_SELECTED_BG : 'transparent',
                  borderColor: timeRange === 'year' ? PILL_SELECTED_BG : PILL_BORDER,
                },
              ]}
            >
              <View style={styles.timeRangePillContent}>
                <Text
                  style={[
                    styles.timeRangePillText,
                    { color: timeRange === 'year' ? PILL_SELECTED_TEXT : 'rgba(255,255,255,0.9)' },
                  ]}
                >
                  {selectedYear}
                </Text>
                <Text style={[styles.timeRangeArrow, { color: timeRange === 'year' ? PILL_SELECTED_TEXT : 'rgba(255,255,255,0.9)' }]}>▼</Text>
              </View>
            </Pressable>
            {dropdownOpen === 'year' && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                exiting={FadeOutUp.duration(150)}
                style={styles.dropdown}
              >
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                  {availableYears.map((y) => (
                    <Pressable
                      key={y}
                      onPress={() => {
                        setSelectedYear(y);
                        setDropdownOpen(null);
                      }}
                      style={[styles.dropdownItem, y === selectedYear && styles.dropdownItemSelected]}
                    >
                      <Text style={[styles.dropdownItemText, y === selectedYear && styles.dropdownItemTextSelected]}>
                        {y}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
          </View>
          {/* All time — no dropdown */}
          <Pressable
            onPress={() => {
              setTimeRange('all');
              setDropdownOpen(null);
              setSelectedDay(null);
              setSelectedMonthData(null);
            }}
            style={[
              styles.timeRangePill,
              {
                backgroundColor: timeRange === 'all' ? PILL_SELECTED_BG : 'transparent',
                borderColor: timeRange === 'all' ? PILL_SELECTED_BG : PILL_BORDER,
              },
            ]}
          >
            <Text
              style={[
                styles.timeRangePillText,
                { color: timeRange === 'all' ? PILL_SELECTED_TEXT : 'rgba(255,255,255,0.9)' },
              ]}
            >
              All time
            </Text>
          </Pressable>
        </View>
      </View>
      </AnimatedFadeInUp>

      {/* Fixed-height slot for value/instruction so chart doesn't shift when tapping a bar */}
      <AnimatedFadeInUp delay={50} duration={320} trigger={animTrigger}>
      <View style={[styles.valueSection, { minHeight: VALUE_SECTION_HEIGHT }]}>
        {timeRange === 'month' && selectedDay ? (
          <View style={styles.valueRow}>
            <Text style={styles.valueText}>{formatValue(selectedDay)}</Text>
            <Text style={styles.valueDate}>{format(selectedDay.date, 'd MMM yyyy')}</Text>
          </View>
        ) : timeRange === 'year' && selectedMonthData ? (
          <View style={styles.valueRow}>
            <Text style={styles.valueText}>{formatValueMonth(selectedMonthData)}</Text>
            <Text style={styles.valueDate}>{selectedMonthData.monthName} {selectedYear}</Text>
          </View>
        ) : timeRange === 'all' && selectedYearData ? (
          <View style={styles.valueRow}>
            <Text style={styles.valueText}>{formatValueYear(selectedYearData)}</Text>
            <Text style={styles.valueDate}>{selectedYearData.year}</Text>
          </View>
        ) : (
          <Text style={styles.instructionText}>Tap a bar for details.</Text>
        )}
      </View>
      </AnimatedFadeInUp>

      {/* Chart area: Y and bars same height, then X-axis row below so corner meets */}
      <AnimatedFadeInUp delay={100} duration={360} trigger={animTrigger}>
      <View style={[styles.chartOuter, { backgroundColor: CHART_BG }]}>
        <View style={styles.chartInner}>
          {/* Left: Y-axis (bar area height only) + 1px spacer under it */}
          <View style={styles.chartLeftColumn}>
            <View style={[styles.yAxisWrap, { width: Y_AXIS_LABEL_WIDTH, height: BAR_AREA_HEIGHT }]}>
              <View style={[styles.yAxis, { flex: 1 }]}>
                {yTicks.map((v, i) => (
                  <Text key={i} style={styles.yAxisLabel}>
                    {metric === 'duration'
                      ? `${v.toFixed(1)}${yAxisUnit}`
                      : `${formatYAxisValue(v)} ${yAxisUnit}`}
                  </Text>
                ))}
              </View>
              <View style={[styles.yAxisLine, { width: AXIS_LINE_WIDTH, backgroundColor: AXIS_LINE_COLOR }]} />
            </View>
            <View style={[styles.xAxisSpacer, { width: Y_AXIS_LABEL_WIDTH, height: AXIS_LINE_WIDTH }]} />
          </View>
          {/* Right: bars then X-axis line then month labels */}
          <View style={styles.chartRightColumn}>
            <View style={[styles.barsContainer, { width: effectiveChartWidth, height: BAR_AREA_HEIGHT }, isAllTimeView && styles.barsContainerAlignStart]}>
              <View style={[styles.barsBlockWrap, { width: barsBlockWidth, height: BAR_AREA_HEIGHT }, isAllTimeView && { alignSelf: 'flex-start' }]}>
                {yTicks.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.gridline,
                      {
                        top: (BAR_AREA_HEIGHT * (i / (yTicks.length - 1))),
                        left: 0,
                        width: barsBlockWidth,
                        height: 1,
                        backgroundColor: GRIDLINE_COLOR,
                      },
                    ]}
                  />
                ))}
                <View style={[styles.barsWrap, { width: barsBlockWidth, height: BAR_AREA_HEIGHT }]}>
                {isAllTimeView && yearlyData.length > 0 ? (
                  yearlyData.map((yearData, i) => {
                    const value = getValueYear(yearData);
                    const heightRatio = effectiveYMax > 0 ? value / effectiveYMax : 0;
                    let barHeight = effectiveYMax > 0 ? Math.floor(BAR_AREA_HEIGHT * heightRatio) : 0;
                    if (value > 0 && barHeight < MIN_BAR_HEIGHT) barHeight = MIN_BAR_HEIGHT;
                    const marginRight = i < yearlyData.length - 1 ? BAR_GAP : 0;
                    return (
                      <Pressable
                        key={`${yearData.year}-${metric}`}
                        onPress={() => setSelectedYearData(yearData)}
                        style={[styles.barSlot, styles.barSlotYearly, { width: effectiveBarWidth, marginRight }]}
                      >
                        <View style={styles.barColumn}>
                          <Animated.View
                            entering={barGrowUp(i * 40)}
                            style={[
                              styles.bar,
                              {
                                height: barHeight,
                                backgroundColor: BAR_COLOR,
                                width: effectiveBarWidth,
                                borderTopLeftRadius: BAR_TOP_RADIUS,
                                borderTopRightRadius: BAR_TOP_RADIUS,
                              },
                            ]}
                          />
                        </View>
                      </Pressable>
                    );
                  })
                ) : isYearView && monthlyData.length === 12 ? (
                  monthlyData.map((monthData, i) => {
                    const value = getValueMonth(monthData);
                    const heightRatio = effectiveYMax > 0 ? value / effectiveYMax : 0;
                    let barHeight = effectiveYMax > 0 ? Math.floor(BAR_AREA_HEIGHT * heightRatio) : 0;
                    if (value > 0 && barHeight < MIN_BAR_HEIGHT) barHeight = MIN_BAR_HEIGHT;
                    const marginRight = i < 11 ? BAR_GAP : 0;
                    return (
                      <Pressable
                        key={`${monthData.month}-${metric}`}
                        onPress={() => setSelectedMonthData(monthData)}
                        style={[styles.barSlot, styles.barSlotYearly, { width: effectiveBarWidth, marginRight }]}
                      >
                        <View style={styles.barColumn}>
                          <Animated.View
                            entering={barGrowUp(i * 40)}
                            style={[
                              styles.bar,
                              {
                                height: barHeight,
                                backgroundColor: BAR_COLOR,
                                width: effectiveBarWidth,
                                borderTopLeftRadius: BAR_TOP_RADIUS,
                                borderTopRightRadius: BAR_TOP_RADIUS,
                              },
                            ]}
                          />
                        </View>
                      </Pressable>
                    );
                  })
                ) : (
                  dayDataInRange.map(({ date, data }, i) => {
                    const value = getValue(data);
                    const heightRatio = effectiveYMax > 0 ? value / effectiveYMax : 0;
                    let barHeight = effectiveYMax > 0 ? Math.floor(BAR_AREA_HEIGHT * heightRatio) : 0;
                    if (value > 0 && barHeight < MIN_BAR_HEIGHT) barHeight = MIN_BAR_HEIGHT;
                    const isSelected = selectedDay && data && isSameDay(data.date, selectedDay.date);
                    const marginRight = i < dayDataInRange.length - 1
                      ? BAR_GAP + ((i + 1) % 7 === 0 ? WEEK_GAP : 0)
                      : 0;
                    return (
                      <Pressable
                        key={`${date.getTime()}-${metric}`}
                        onPress={() => setSelectedDay(data ?? null)}
                        style={[styles.barSlot, { width: effectiveBarWidth, marginRight }]}
                      >
                        <Animated.View
                          entering={barGrowUp(i * 40)}
                          style={[
                            styles.bar,
                            {
                              height: barHeight,
                              backgroundColor: BAR_COLOR,
                              width: effectiveBarWidth,
                              borderTopLeftRadius: BAR_TOP_RADIUS,
                              borderTopRightRadius: BAR_TOP_RADIUS,
                            },
                          ]}
                        />
                      </Pressable>
                    );
                  })
                )}
                </View>
              </View>
            </View>
            <View style={[styles.xAxisLineRow, { width: barsBlockWidth, height: AXIS_LINE_WIDTH, backgroundColor: AXIS_LINE_COLOR }]} />
            <View style={[styles.xAxisRow, { width: barsBlockWidth }]}>
              {xAxisSegments.map((seg, i) => (
                <View key={`${seg.label}-${seg.startIndex}`} style={[styles.xAxisSegment, { width: xAxisSegmentWidths[i] ?? 0 }]}>
                  <Text style={styles.xAxisMonth}>{seg.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
      </AnimatedFadeInUp>

      {/* Toggle buttons BELOW chart: fixed height so chart doesn't shift */}
      <AnimatedFadeInUp delay={150} duration={320} trigger={animTrigger}>
      <View style={[styles.bubblesRow, { minHeight: BUBBLES_ROW_HEIGHT }]}>
        <View style={styles.bubblesRowInner}>
          {(['duration', 'volume', 'reps'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMetric(m)}
              style={[
                styles.bubble,
                {
                  backgroundColor: metric === m ? PILL_SELECTED_BG : 'transparent',
                  borderColor: metric === m ? PILL_SELECTED_BG : PILL_BORDER,
                },
              ]}
            >
              <Text
                style={[styles.bubbleText, { color: metric === m ? PILL_SELECTED_TEXT : 'rgba(255,255,255,0.9)' }]}
              >
                {m === 'duration' ? 'Duration' : m === 'volume' ? 'Volume' : 'Reps'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      </AnimatedFadeInUp>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    paddingHorizontal: CHART_H_PADDING,
    backgroundColor: 'transparent',
    padding: CHART_H_PADDING,
  },
  valueSection: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 12,
    fontWeight: '500',
    color: AXIS_LABEL_COLOR,
  },
  valueRow: {
    alignItems: 'center',
  },
  valueText: {
    fontSize: Typography.body,
    fontWeight: '600',
    color: BAR_COLOR,
  },
  valueDate: {
    fontSize: Typography.label,
    fontWeight: '500',
    color: AXIS_LABEL_COLOR,
    marginTop: 2,
  },
  rangeRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  rangeRowInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  timeRangeButtonWrap: {
    position: 'relative',
  },
  timeRangePill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: TIME_RANGE_PILL_WIDTH,
    minWidth: TIME_RANGE_PILL_WIDTH,
  },
  timeRangePillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeRangePillText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeRangeArrow: {
    fontSize: 10,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    minWidth: 100,
    maxHeight: 220,
    backgroundColor: '#2F3031',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: PILL_BORDER,
    overflow: 'hidden',
    zIndex: 10,
  },
  dropdownScroll: {
    maxHeight: 212,
    paddingVertical: 4,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(198, 198, 198, 0.2)',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  dropdownItemTextSelected: {
    color: PILL_SELECTED_BG,
  },
  chartOuter: {
    width: '100%',
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    paddingVertical: Spacing.sm,
    paddingLeft: 0,
    paddingRight: Spacing.xs,
    alignItems: 'center',
  },
  chartInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  chartLeftColumn: {
    flexDirection: 'column',
  },
  chartRightColumn: {
    flexDirection: 'column',
  },
  yAxisWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  yAxis: {
    flex: 1,
    justifyContent: 'space-between',
    paddingRight: Spacing.xs,
    alignItems: 'flex-end',
  },
  yAxisLine: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
  xAxisSpacer: {
    backgroundColor: 'transparent',
  },
  xAxisLineRow: {
    alignSelf: 'center',
  },
  yAxisLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: AXIS_LABEL_COLOR,
  },
  barsContainer: {
    position: 'relative',
  },
  barsBlockWrap: {
    position: 'relative',
  },
  barsContainerAlignStart: {
    alignItems: 'flex-start',
  },
  gridline: {
    position: 'absolute',
    left: 0,
  },
  barsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_AREA_HEIGHT,
  },
  barSlot: {
    height: BAR_AREA_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  barSlotYearly: {
    justifyContent: 'flex-end',
  },
  barColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barValueLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: AXIS_LABEL_COLOR,
    marginBottom: 4,
  },
  bar: {
    alignSelf: 'center',
  },
  xAxisRow: {
    flexDirection: 'row',
    paddingLeft: 0,
    marginTop: Spacing.sm,
    marginBottom: 0,
    alignItems: 'center',
    alignSelf: 'center',
  },
  xAxisSegment: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  xAxisMonth: {
    fontSize: 11,
    fontWeight: '500',
    color: AXIS_LABEL_COLOR,
    textAlign: 'center',
  },
  bubblesRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  bubblesRowInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: BUBBLE_PILL_WIDTH,
    minWidth: BUBBLE_PILL_WIDTH,
  },
  bubbleText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
