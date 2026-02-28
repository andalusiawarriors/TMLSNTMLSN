// ============================================================
// TMLSN — Fitness graph: Duration / Volume / Reps by time range
// Bar chart; summary strip; tap tooltip; swipe month; haptics
// ============================================================

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  Modal,
  PanResponder,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { AnimatedFadeInUp } from './AnimatedFadeInUp';
import { getWorkoutSessions, getUserSettings } from '../utils/storage';
import { KG_PER_LB } from '../utils/units';
import { Colors, Typography, Spacing } from '../constants/theme';
import type { WorkoutSession } from '../types';
import { format, startOfDay, getYear, getMonth, startOfMonth, endOfMonth } from 'date-fns';
import { useRouter } from 'expo-router';

function parseDate(dateKey: string): Date {
  return new Date(dateKey + 'T12:00:00');
}
function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}
function getSessionDateKey(s: WorkoutSession): string | null {
  const d = new Date(s.date);
  if (!isValidDate(d)) return null;
  return format(d, 'yyyy-MM-dd');
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

const CHART_HEIGHT = 210;
const BAR_GAP = 4;
const WEEK_GAP = 8;
const MIN_BAR_HEIGHT = 6;
const MAX_BAR_WIDTH_ALL_TIME = 32;
const VALUE_SECTION_HEIGHT = 52;
const BUBBLES_ROW_HEIGHT = 52;
const TIME_RANGE_PILL_WIDTH = 108;
const BUBBLE_PILL_WIDTH = 108;
const Y_AXIS_LABEL_WIDTH = 48;
const AXIS_LINE_WIDTH = 1;
const BAR_AREA_HEIGHT = CHART_HEIGHT - AXIS_LINE_WIDTH;
const BAR_TOP_RADIUS = 38;
const CHART_BG = 'transparent';
const BAR_COLOR = Colors.primaryLight;
const BAR_COLOR_DIM = 'rgba(198, 198, 198, 0.30)';
const BAR_COLOR_SELECTED = Colors.primaryLight;
const AXIS_LABEL_COLOR = 'rgba(198, 198, 198, 0.85)';
const GRIDLINE_COLOR = 'rgba(198, 198, 198, 0.10)';
const AXIS_LINE_COLOR = 'rgba(198, 198, 198, 0.18)';
const DEFAULT_DURATION_MAX_HOURS = 3;
const CHART_H_PADDING = Spacing.md;
const PILL_SELECTED_BG = Colors.primaryLight;
const PILL_SELECTED_TEXT = Colors.primaryDark;
const PILL_BORDER = 'rgba(198, 198, 198, 0.12)';
const SWIPE_THRESHOLD = 60;

type TimeRange = 'month' | 'year' | 'all';
type DropdownOpen = 'month' | 'year' | null;
type Metric = 'duration' | 'volume' | 'reps';

function barGrowUp(delayMs: number) {
  return (values: { targetHeight: number; targetOriginY: number }) => {
    'worklet';
    const { targetHeight, targetOriginY } = values;
    const duration = 220;
    const easing = Easing.out(Easing.exp);
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

function DropdownModal({
  children,
  onClose,
  style,
  triggerLayout,
}: {
  children: React.ReactNode;
  onClose: () => void;
  style: object;
  triggerLayout: { x: number; y: number; width: number; height: number } | null;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onClose} />
      {triggerLayout && (
        <View
          style={[
            dropdownModalStyles.anchor,
            {
              top: triggerLayout.y + triggerLayout.height + 4,
              left: triggerLayout.x,
              minWidth: triggerLayout.width,
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={[style, dropdownModalStyles.dropdownCard]}>
            {children}
          </View>
        </View>
      )}
    </Modal>
  );
}
const dropdownModalStyles = StyleSheet.create({
  anchor: { position: 'absolute' },
  dropdownCard: { alignSelf: 'stretch' },
});

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

function aggregateByDay(
  sessions: WorkoutSession[],
  weightUnit: 'kg' | 'lb',
  metricType: Metric
): DayData[] {
  const filtered = sessions.filter((s) => {
    const key = getSessionDateKey(s);
    if (key == null) return false;
    if (s.isComplete !== true) return false;
    return true;
  });

  const byDay = new Map<string, { durationMinutes: number; volumeRaw: number; reps: number }>();
  for (const s of filtered) {
    const d = getSessionDateKey(s)!;
    const durationMin = Number(s.duration ?? 0);
    const existing = byDay.get(d) ?? { durationMinutes: 0, volumeRaw: 0, reps: 0 };
    if (durationMin > 0) existing.durationMinutes += durationMin;
    for (const ex of s.exercises ?? []) {
      const sets = ex.sets ?? [];
      if (sets.length === 0) continue;
      for (const set of sets) {
        if (!set.completed) continue;
        existing.volumeRaw += (set.weight ?? 0) * (set.reps ?? 0);
        existing.reps += set.reps ?? 0;
      }
    }
    byDay.set(d, existing);
  }
  const result = Array.from(byDay.entries()).map(([dateKey, v]) => {
    const volumeKg = v.volumeRaw * KG_PER_LB;
    return {
      date: parseDate(dateKey),
      dateKey,
      durationMinutes: v.durationMinutes,
      volumeKg,
      reps: v.reps,
      volumeRawLb: v.volumeRaw,
    };
  });
  return result.map(({ volumeRawLb: _v, ...r }) => r);
}

function formatDurationMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatVolume(volumeKg: number, weightUnit: 'kg' | 'lb'): string {
  const displayValue = weightUnit === 'lb' ? volumeKg / KG_PER_LB : volumeKg;
  const unit = weightUnit === 'lb' ? 'lb' : 'kg';
  return `${Math.round(displayValue).toLocaleString()} ${unit}`;
}

function formatYAxisValue(value: number): string {
  if (value >= 1_000_000) return Math.round(value / 1_000_000) + 'M';
  if (value >= 1_000) return Math.round(value / 1_000) + 'k';
  return String(Math.round(value));
}

export function FitnessGraphWidget() {
  const { colors } = useTheme();
  const router = useRouter();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const now = new Date();
  const currentYear = getYear(now);
  const currentMonth = getMonth(now);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [dropdownOpen, setDropdownOpen] = useState<DropdownOpen>(null);
  const [dropdownTriggerLayout, setDropdownTriggerLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const monthButtonRef = useRef<View | null>(null);
  const yearButtonRef = useRef<View | null>(null);
  const [metric, setMetric] = useState<Metric>('duration');
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [selectedMonthData, setSelectedMonthData] = useState<MonthData | null>(null);
  const [selectedYearData, setSelectedYearData] = useState<YearData | null>(null);
  const [animTrigger, setAnimTrigger] = useState(0);

  // Refs for swipe pan handler (avoids stale closure)
  const selectedMonthRef = useRef(currentMonth);
  const selectedYearRef = useRef(currentYear);
  const timeRangeRef = useRef<TimeRange>('month');
  const swipeHandlerRef = useRef<{ advance: () => void; retreat: () => void }>({
    advance: () => {},
    retreat: () => {},
  });

  useEffect(() => { selectedMonthRef.current = selectedMonth; }, [selectedMonth]);
  useEffect(() => { selectedYearRef.current = selectedYear; }, [selectedYear]);
  useEffect(() => { timeRangeRef.current = timeRange; }, [timeRange]);

  // Stable PanResponder created once — uses refs for current state
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        timeRangeRef.current === 'month' &&
        Math.abs(gs.dx) > 10 &&
        Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dx) < SWIPE_THRESHOLD) return;
        if (gs.dx < 0) swipeHandlerRef.current.advance();
        else swipeHandlerRef.current.retreat();
      },
    })
  ).current;

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
      const validKeys = sessions.map((s) => getSessionDateKey(s)).filter((k): k is string => k != null);
      const firstKey = validKeys.length
        ? validKeys.reduce((min, k) => (k < min ? k : min), validKeys[0])
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
      return key != null && key >= rangeStartKey && key <= rangeEndKey;
    });
    const dayData = aggregateByDay(filtered, weightUnit, metric);
    const daysInRange = eachDay(rangeStart, rangeEnd);
    const byDateKey = new Map(dayData.map((d) => [d.dateKey, d]));

    const chartData = daysInRange.map((date) => {
      const key = format(date, 'yyyy-MM-dd');
      const bin = byDateKey.get(key);
      const durationMinutes = Number(bin?.durationMinutes ?? 0);
      const volumeKg = Number(bin?.volumeKg ?? 0);
      const reps = Number(bin?.reps ?? 0);
      const dataValue =
        metric === 'duration'
          ? durationMinutes / 60
          : metric === 'reps'
            ? reps
            : weightUnit === 'lb'
              ? volumeKg / KG_PER_LB
              : volumeKg;
      const data = Number(dataValue);
      return {
        date: bin?.date ?? new Date(date.getTime()),
        dateKey: key,
        durationMinutes,
        reps,
        volumeKg,
        data,
      };
    });

    let yMax = 0;
    if (metric === 'duration') {
      const maxMin = Math.max(...chartData.map((d) => d.durationMinutes ?? 0), 0);
      const maxHours = maxMin / 60;
      yMax = Math.max(DEFAULT_DURATION_MAX_HOURS, Math.ceil(maxHours * 2) / 2) || DEFAULT_DURATION_MAX_HOURS;
    } else if (metric === 'volume') {
      const maxKg = Math.max(...chartData.map((d) => d.volumeKg ?? 0), 0);
      const maxDisplay = weightUnit === 'lb' ? maxKg / KG_PER_LB : maxKg;
      yMax = Math.ceil(maxDisplay / 100) * 100 || 100;
    } else {
      const maxReps = Math.max(...chartData.map((d) => d.reps ?? 0), 0);
      yMax = Math.ceil(maxReps / 10) * 10 || 10;
    }

    return { rangeStart, rangeEnd, dayDataInRange: chartData, yMax };
  }, [sessions, timeRange, weightUnit, metric, selectedMonth, selectedYear]);

  const targetYearForMonths = useMemo(() => {
    if (timeRange === 'year') return selectedYear;
    if (timeRange === 'all' && sessions.length > 0) {
      const years = sessions
        .map((s) => getSessionDateKey(s))
        .filter((k): k is string => k != null)
        .map((k) => getYear(parseDate(k)));
      return years.length > 0 ? Math.max(...years) : getYear(now);
    }
    return getYear(new Date());
  }, [timeRange, sessions, selectedYear]);

  const availableYears = useMemo(() => {
    const endYear = currentYear;
    const validYears = sessions
      .map((s) => getSessionDateKey(s))
      .filter((k): k is string => k != null)
      .map((k) => getYear(parseDate(k)));
    const startYear = validYears.length > 0 ? Math.min(...validYears) : currentYear;
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
    dayDataInRange.forEach((point) => {
      if (point.date.getFullYear() !== targetYearForMonths) return;
      const m = point.date.getMonth();
      const existing = byMonth.get(m)!;
      existing.durationMinutes += point.durationMinutes;
      existing.volumeKg += point.volumeKg;
      existing.reps += point.reps;
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
      const key = getSessionDateKey(s);
      if (key == null) continue;
      const year = getYear(parseDate(key));
      const existing = byYear.get(year) ?? { durationMinutes: 0, volumeRaw: 0, reps: 0 };
      existing.durationMinutes += Number(s.duration ?? 0);
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
      const volumeKg = v.volumeRaw * KG_PER_LB;
      return { year, durationMinutes: v.durationMinutes, volumeKg, reps: v.reps };
    });
  }, [sessions, timeRange]);

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
      const maxDisplay = weightUnit === 'lb' ? maxKg / KG_PER_LB : maxKg;
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
      const maxDisplay = weightUnit === 'lb' ? maxKg / KG_PER_LB : maxKg;
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
  const effectiveChartWidth = isAllTimeView
    ? chartWidth
    : (isYearView ? effectiveN * effectiveBarWidth + (effectiveN - 1) * BAR_GAP : chartWidth);
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
    if (metric === 'volume') return weightUnit === 'lb' ? d.volumeKg / KG_PER_LB : d.volumeKg;
    return d.reps;
  };

  const formatValue = (d: DayData) => {
    if (metric === 'duration') return formatDurationMinutes(d.durationMinutes);
    if (metric === 'volume') return formatVolume(d.volumeKg, weightUnit);
    return `${d.reps} reps`;
  };

  const getValueMonth = (m: MonthData) => {
    if (metric === 'duration') return m.durationMinutes / 60;
    if (metric === 'volume') return weightUnit === 'lb' ? m.volumeKg / KG_PER_LB : m.volumeKg;
    return m.reps;
  };

  const formatValueMonth = (m: MonthData) => {
    if (metric === 'duration') return formatDurationMinutes(m.durationMinutes);
    if (metric === 'volume') return formatVolume(m.volumeKg, weightUnit);
    return `${m.reps} reps`;
  };

  const getValueYear = (y: YearData) => {
    if (metric === 'duration') return y.durationMinutes / 60;
    if (metric === 'volume') return weightUnit === 'lb' ? y.volumeKg / KG_PER_LB : y.volumeKg;
    return y.reps;
  };

  const formatValueYear = (y: YearData) => {
    if (metric === 'duration') return formatDurationMinutes(y.durationMinutes);
    if (metric === 'volume') return formatVolume(y.volumeKg, weightUnit);
    return `${y.reps} reps`;
  };

  // ── Derived data ───────────────────────────────────────────

  const hasData = useMemo(() => {
    if (isAllTimeView) return yearlyData.some((y) => getValueYear(y) > 0);
    if (isYearView) return monthlyData.some((m) => getValueMonth(m) > 0);
    return dayDataInRange.some((d) => d.data > 0);
  }, [dayDataInRange, monthlyData, yearlyData, isAllTimeView, isYearView, metric, weightUnit]);

  const summaryStats = useMemo(() => {
    let sessionCount = 0;
    let totalValue = 0;
    let bestValue = 0;
    let bestLabel = '—';

    if (isAllTimeView) {
      sessionCount = yearlyData.filter((y) => getValueYear(y) > 0).length;
      for (const y of yearlyData) {
        const v = getValueYear(y);
        totalValue += v;
        if (v > bestValue) { bestValue = v; bestLabel = String(y.year); }
      }
    } else if (isYearView) {
      sessionCount = monthlyData.filter((m) => getValueMonth(m) > 0).length;
      for (const m of monthlyData) {
        const v = getValueMonth(m);
        totalValue += v;
        if (v > bestValue) { bestValue = v; bestLabel = m.monthName; }
      }
    } else {
      const active = dayDataInRange.filter((d) => d.data > 0);
      sessionCount = active.length;
      for (const d of dayDataInRange) {
        totalValue += d.data;
        if (d.data > bestValue) {
          bestValue = d.data;
          bestLabel = format(d.date, 'd MMM');
        }
      }
    }

    const totalFormatted = (() => {
      if (metric === 'duration') return formatDurationMinutes(totalValue * 60);
      if (metric === 'volume') {
        const unit = weightUnit === 'lb' ? 'lb' : 'kg';
        return `${Math.round(totalValue).toLocaleString()} ${unit}`;
      }
      return `${Math.round(totalValue)} reps`;
    })();

    const bestFormatted = (() => {
      if (bestValue === 0) return '—';
      if (metric === 'duration') return formatDurationMinutes(bestValue * 60);
      if (metric === 'volume') {
        const unit = weightUnit === 'lb' ? 'lb' : 'kg';
        return `${Math.round(bestValue).toLocaleString()} ${unit}`;
      }
      return `${Math.round(bestValue)} reps`;
    })();

    return { sessionCount, totalFormatted, bestFormatted, bestLabel };
  }, [dayDataInRange, monthlyData, yearlyData, isAllTimeView, isYearView, metric, weightUnit]);

  // ── Swipe month navigation ──────────────────────────────────
  // Written into ref each render so panResponder handler sees current state
  swipeHandlerRef.current = {
    advance: () => {
      const m = selectedMonthRef.current;
      const y = selectedYearRef.current;
      const limitYear = currentYear;
      const limitMonth = currentMonth;
      if (y > limitYear || (y === limitYear && m >= limitMonth)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (m === 11) {
        setSelectedMonth(0);
        setSelectedYear(y + 1);
      } else {
        setSelectedMonth(m + 1);
      }
      setSelectedDay(null);
    },
    retreat: () => {
      const m = selectedMonthRef.current;
      const y = selectedYearRef.current;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (m === 0) {
        setSelectedMonth(11);
        setSelectedYear(y - 1);
      } else {
        setSelectedMonth(m - 1);
      }
      setSelectedDay(null);
    },
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <View style={[styles.wrap, { marginBottom: Spacing.lg }]}>

      {/* ── Summary strip ── */}
      <AnimatedFadeInUp delay={0} duration={320} trigger={animTrigger}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipValue}>{summaryStats.sessionCount}</Text>
            <Text style={styles.summaryChipLabel}>sessions</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipValue} numberOfLines={1}>{summaryStats.totalFormatted}</Text>
            <Text style={styles.summaryChipLabel}>total</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipValue} numberOfLines={1}>{summaryStats.bestFormatted}</Text>
            <Text style={styles.summaryChipLabel}>best · {summaryStats.bestLabel}</Text>
          </View>
        </View>
      </AnimatedFadeInUp>

      {/* ── Time range row ── */}
      <AnimatedFadeInUp delay={20} duration={320} trigger={animTrigger}>
        <View style={styles.rangeRow}>
          <View style={styles.rangeRowInner}>
            {/* Month pill with dropdown */}
            <View style={styles.timeRangeButtonWrap} ref={monthButtonRef} collapsable={false}>
              <Pressable
                onPress={() => {
                  if (timeRange !== 'month') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTimeRange('month');
                    setSelectedMonth(currentMonth);
                    setSelectedYear(currentYear);
                    setDropdownOpen(null);
                    setSelectedMonthData(null);
                    setSelectedYearData(null);
                  } else {
                    monthButtonRef.current?.measureInWindow((x, y, width, height) => {
                      setDropdownTriggerLayout({ x, y, width, height });
                      setDropdownOpen('month');
                    });
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
                <DropdownModal
                  onClose={() => { setDropdownOpen(null); setDropdownTriggerLayout(null); }}
                  style={styles.dropdown}
                  triggerLayout={dropdownTriggerLayout}
                >
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                    {MONTH_NAMES.map((name, i) => (
                      <Pressable
                        key={name}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                </DropdownModal>
              )}
            </View>

            {/* Year pill with dropdown */}
            <View style={styles.timeRangeButtonWrap} ref={yearButtonRef} collapsable={false}>
              <Pressable
                onPress={() => {
                  if (timeRange !== 'year') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTimeRange('year');
                    setSelectedYear(currentYear);
                    setDropdownOpen(null);
                    setSelectedDay(null);
                    setSelectedYearData(null);
                  } else {
                    yearButtonRef.current?.measureInWindow((x, y, width, height) => {
                      setDropdownTriggerLayout({ x, y, width, height });
                      setDropdownOpen('year');
                    });
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
                <DropdownModal
                  onClose={() => { setDropdownOpen(null); setDropdownTriggerLayout(null); }}
                  style={styles.dropdown}
                  triggerLayout={dropdownTriggerLayout}
                >
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                    {availableYears.map((y) => (
                      <Pressable
                        key={y}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                </DropdownModal>
              )}
            </View>

            {/* All time — no dropdown */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

      {/* ── Selected value tooltip (glass chip) ── */}
      <AnimatedFadeInUp delay={40} duration={320} trigger={animTrigger}>
        <View style={[styles.valueSection, { minHeight: VALUE_SECTION_HEIGHT }]}>
          {timeRange === 'month' && selectedDay ? (
            <View style={styles.tooltipChip}>
              <Text style={styles.tooltipValue}>{formatValue(selectedDay)}</Text>
              <Text style={styles.tooltipDate}>{format(selectedDay.date, 'EEE, d MMM yyyy')}</Text>
            </View>
          ) : timeRange === 'year' && selectedMonthData ? (
            <View style={styles.tooltipChip}>
              <Text style={styles.tooltipValue}>{formatValueMonth(selectedMonthData)}</Text>
              <Text style={styles.tooltipDate}>{selectedMonthData.monthName} {selectedYear}</Text>
            </View>
          ) : timeRange === 'all' && selectedYearData ? (
            <View style={styles.tooltipChip}>
              <Text style={styles.tooltipValue}>{formatValueYear(selectedYearData)}</Text>
              <Text style={styles.tooltipDate}>{selectedYearData.year}</Text>
            </View>
          ) : (
            // Empty placeholder — keeps height stable, no instruction text
            <View style={styles.tooltipPlaceholder} />
          )}
        </View>
      </AnimatedFadeInUp>

      {/* ── Chart area ── */}
      <AnimatedFadeInUp delay={80} duration={360} trigger={animTrigger}>
        {!hasData ? (
          /* Empty state */
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No workouts yet.</Text>
            <Text style={styles.emptySubtitle}>Finish one workout to populate this graph.</Text>
            <Pressable
              style={({ pressed }) => [styles.emptyBtn, pressed && styles.emptyBtnPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(tabs)/workout' as any);
              }}
            >
              <Text style={styles.emptyBtnText}>Start workout</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.chartOuter, { backgroundColor: CHART_BG }]} {...panResponder.panHandlers}>
            <View style={styles.chartInner}>
              {/* Y-axis */}
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

              {/* Bars + x-axis */}
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
                          const isSelected = selectedYearData?.year === yearData.year;
                          const hasSel = selectedYearData != null;
                          return (
                            <Pressable
                              key={`${yearData.year}-${metric}`}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setSelectedYearData(yearData);
                              }}
                              style={[styles.barSlot, styles.barSlotYearly, { width: effectiveBarWidth, marginRight }]}
                            >
                              <View style={styles.barColumn}>
                                <Animated.View
                                  entering={barGrowUp(i * 30)}
                                  style={[
                                    styles.bar,
                                    {
                                      height: barHeight,
                                      backgroundColor: hasSel && !isSelected ? BAR_COLOR_DIM : BAR_COLOR_SELECTED,
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
                          const isSelected = selectedMonthData?.month === monthData.month;
                          const hasSel = selectedMonthData != null;
                          return (
                            <Pressable
                              key={`${monthData.month}-${metric}`}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setSelectedMonthData(monthData);
                              }}
                              style={[styles.barSlot, styles.barSlotYearly, { width: effectiveBarWidth, marginRight }]}
                            >
                              <View style={styles.barColumn}>
                                <Animated.View
                                  entering={barGrowUp(i * 30)}
                                  style={[
                                    styles.bar,
                                    {
                                      height: barHeight,
                                      backgroundColor: hasSel && !isSelected ? BAR_COLOR_DIM : BAR_COLOR_SELECTED,
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
                        dayDataInRange.map((point, i) => {
                          const value = point.data;
                          const heightRatio = effectiveYMax > 0 ? value / effectiveYMax : 0;
                          let barHeight = effectiveYMax > 0 ? Math.floor(BAR_AREA_HEIGHT * heightRatio) : 0;
                          if (value > 0 && barHeight < MIN_BAR_HEIGHT) barHeight = MIN_BAR_HEIGHT;
                          const isSelected = selectedDay != null && isSameDay(point.date, selectedDay.date);
                          const hasSel = selectedDay != null;
                          const marginRight = i < dayDataInRange.length - 1
                            ? BAR_GAP + ((i + 1) % 7 === 0 ? WEEK_GAP : 0)
                            : 0;
                          return (
                            <Pressable
                              key={`${point.date.getTime()}-${metric}`}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setSelectedDay(point);
                              }}
                              style={[styles.barSlot, { width: effectiveBarWidth, marginRight }]}
                            >
                              <Animated.View
                                entering={barGrowUp(i * 20)}
                                style={[
                                  styles.bar,
                                  {
                                    height: barHeight,
                                    backgroundColor: hasSel && !isSelected ? BAR_COLOR_DIM : BAR_COLOR_SELECTED,
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
        )}
      </AnimatedFadeInUp>

      {/* ── Metric toggle (below chart) ── */}
      <AnimatedFadeInUp delay={120} duration={320} trigger={animTrigger}>
        <View style={[styles.bubblesRow, { minHeight: BUBBLES_ROW_HEIGHT }]}>
          <View style={styles.bubblesRowInner}>
            {(['duration', 'volume', 'reps'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMetric(m);
                  setSelectedDay(null);
                  setSelectedMonthData(null);
                  setSelectedYearData(null);
                }}
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

  // Summary strip
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    justifyContent: 'center',
  },
  summaryChip: {
    flex: 1,
    backgroundColor: 'rgba(198, 198, 198, 0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(198, 198, 198, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  summaryChipValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primaryLight,
    letterSpacing: -0.2,
  },
  summaryChipLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(198, 198, 198, 0.55)',
    marginTop: 2,
    textAlign: 'center',
  },

  // Value section / tooltip
  valueSection: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  tooltipChip: {
    backgroundColor: 'rgba(198, 198, 198, 0.10)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(198, 198, 198, 0.16)',
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  tooltipValue: {
    fontSize: Typography.body,
    fontWeight: '600',
    color: BAR_COLOR,
    letterSpacing: -0.2,
  },
  tooltipDate: {
    fontSize: Typography.label,
    fontWeight: '500',
    color: AXIS_LABEL_COLOR,
    marginTop: 2,
  },
  tooltipPlaceholder: {
    height: VALUE_SECTION_HEIGHT,
  },

  // Range pills
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
    borderRadius: 38,
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
    minWidth: 100,
    maxHeight: 220,
    backgroundColor: Colors.primaryDark,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PILL_BORDER,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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

  // Chart
  chartOuter: {
    width: '100%',
    marginBottom: Spacing.md,
    borderRadius: 12,
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

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(198, 198, 198, 0.85)',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(198, 198, 198, 0.50)',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(198, 198, 198, 0.10)',
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(198, 198, 198, 0.18)',
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  emptyBtnPressed: {
    opacity: 0.65,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primaryLight,
    letterSpacing: -0.2,
  },

  // Metric toggle bubbles
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
    borderRadius: 38,
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
