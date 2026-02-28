// ============================================================
// TMLSN — "graph." full-page detail screen
// Layout: Header → Metric → Collapsing Range → Period picker
//         → 2×2 Stat tiles → Chart
// ============================================================

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Dimensions,
  PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  withDelay,
  withTiming,
  withSpring,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  runOnJS,
  Easing,
  FadeIn,
  FadeOut,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { format, startOfDay, getYear, getMonth, startOfMonth, endOfMonth } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { LiquidGlassSegmented, LiquidGlassPill } from '../components/ui/liquidGlass';
import { StickyGlassHeader } from '../components/ui/StickyGlassHeader';
import { InteractiveGlassWrapper } from '../components/ui/InteractiveGlassWrapper';
import { HomeGradientBackground } from '../components/HomeGradientBackground';
import { getWorkoutSessions, getUserSettings } from '../utils/storage';
import { KG_PER_LB } from '../utils/units';
import type { WorkoutSession } from '../types';

// ── Layout constants ───────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const OUTER_PAD   = 20;
const SECTION_PAD = 18;

// Stat tiles: 2-column grid of perfect squares
const TILE_GAP  = 12;
const TILE_SIZE = Math.floor((SW - OUTER_PAD * 2 - TILE_GAP) / 2);

// Chart — shorter (~26% of screen height)
const CHART_HEIGHT  = Math.max(160, Math.floor(SH * 0.26));
const Y_AXIS_W      = 54;
const BAR_GAP       = 4;
const WEEK_GAP      = 8;
const MIN_BAR_H     = 6;
const MAX_BAR_W_ALL = 32;
const AXIS_LINE_W   = 1;
const BAR_AREA_H    = CHART_HEIGHT - AXIS_LINE_W;
const BAR_TOP_R     = 5;
const SWIPE_THRESHOLD = 60;
const DEFAULT_DUR_MAX_H = 3;

// width available inside the chart glass section for bars
const CHART_AREA_W = SW - OUTER_PAD * 2 - SECTION_PAD * 2 - Y_AXIS_W;

// Controls layout
const BACK_BTN_W      = 38;
const TITLE_ROW_GAP   = 8;
const CONTROLS_AVAIL_W = SW - OUTER_PAD * 2;
const TOP_ROW_AVAIL_W = CONTROLS_AVAIL_W - BACK_BTN_W - TITLE_ROW_GAP;
const SCRUB_PILL_W    = 130;
const ROW_GAP         = 8;
const RANGE_PILL_W    = TOP_ROW_AVAIL_W - SCRUB_PILL_W - ROW_GAP;   // when month/year
const RANGE_PILL_W_ALL = TOP_ROW_AVAIL_W;                            // when All
const METRIC_PILL_W   = 216;


// ── Color tokens ───────────────────────────────────────────────
const C_TEXT       = Colors.primaryLight;          // '#C6C6C6'
const C_TEXT_DIM   = 'rgba(198,198,198,0.55)';
const C_BORDER     = 'rgba(198,198,198,0.14)';
const C_BORDER_SEL = 'rgba(198,198,198,0.22)';
const C_TRACK      = 'rgba(47,48,49,0.85)';
const C_BAR        = Colors.primaryLight;
const C_BAR_DIM    = 'rgba(198,198,198,0.25)';
const C_GRID       = 'rgba(198,198,198,0.09)';
const C_AXIS_LINE  = 'rgba(198,198,198,0.18)';
const C_AXIS_LBL   = 'rgba(198,198,198,0.80)';

// ── Types ──────────────────────────────────────────────────────
type TimeRange = 'month' | 'year' | 'all';
type Metric    = 'duration' | 'volume' | 'reps';
interface DayData   { date: Date; dateKey: string; durationMinutes: number; volumeKg: number; reps: number; data: number; }
interface MonthData { month: number; monthName: string; durationMinutes: number; volumeKg: number; reps: number; }
interface YearData  { year: number; durationMinutes: number; volumeKg: number; reps: number; }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

// ── Utility functions ──────────────────────────────────────────
function parseDate(k: string): Date { return new Date(k + 'T12:00:00'); }
function getSessionDateKey(s: WorkoutSession): string | null {
  const d = new Date(s.date);
  return isNaN(d.getTime()) ? null : format(d, 'yyyy-MM-dd');
}
function eachDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(start.getTime());
  while (d <= end) { out.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return out;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtDur(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function fmtVol(displayValue: number, unit: 'kg' | 'lb'): string {
  return `${Math.round(displayValue).toLocaleString()} ${unit}`;
}
function fmtYAxis(v: number): string {
  if (v >= 1_000_000) return Math.round(v / 1_000_000) + 'M';
  if (v >= 1_000)     return Math.round(v / 1_000) + 'k';
  return String(Math.round(v));
}
function aggregateByDay(sessions: WorkoutSession[]): DayData[] {
  const filtered = sessions.filter(s => getSessionDateKey(s) != null && s.isComplete === true);
  const byDay = new Map<string, { durationMinutes: number; volumeRaw: number; reps: number }>();
  for (const s of filtered) {
    const dk = getSessionDateKey(s)!;
    const ex = byDay.get(dk) ?? { durationMinutes: 0, volumeRaw: 0, reps: 0 };
    ex.durationMinutes += Number(s.duration ?? 0);
    for (const e of s.exercises ?? [])
      for (const set of e.sets ?? []) {
        if (!set.completed) continue;
        ex.volumeRaw += (set.weight ?? 0) * (set.reps ?? 0);
        ex.reps += set.reps ?? 0;
      }
    byDay.set(dk, ex);
  }
  return Array.from(byDay.entries()).map(([dateKey, v]) => ({
    date: parseDate(dateKey), dateKey,
    durationMinutes: v.durationMinutes,
    volumeKg: v.volumeRaw * KG_PER_LB,
    reps: v.reps,
    data: 0,
  }));
}

// ── Bar grow-up animation — gentle spring, minimal overshoot ────
function barGrowUp(delayMs: number) {
  return (values: { targetHeight: number; targetOriginY: number }) => {
    'worklet';
    const { targetHeight, targetOriginY } = values;
    const springCfg = { damping: 22, stiffness: 220, mass: 0.7 };
    return {
      initialValues: { height: 0, originY: targetOriginY + targetHeight },
      animations: {
        height:  withDelay(delayMs, withSpring(targetHeight, springCfg)),
        originY: withDelay(delayMs, withSpring(targetOriginY, springCfg)),
      },
    };
  };
}

// ── Dropdown modal (glass-styled, floats below the trigger pill) ──
type DropLayout = { x: number; y: number; width: number; height: number };

function DropdownModal({
  children,
  onClose,
  triggerLayout,
}: {
  children: React.ReactNode;
  onClose: () => void;
  triggerLayout: DropLayout | null;
}) {
  if (!triggerLayout) return null;
  const top   = triggerLayout.y + triggerLayout.height + 6;
  const minW  = Math.max(triggerLayout.width, 160);
  const maxW  = SW - OUTER_PAD * 2;
  const width = Math.min(minW, maxW);
  let left    = triggerLayout.x;
  if (left + width > SW - OUTER_PAD) left = SW - OUTER_PAD - width;
  if (left < OUTER_PAD) left = OUTER_PAD;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* Full-screen blur scrim — dims & blurs the page behind the dropdown */}
      <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, dd.scrim]} pointerEvents="none" />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        entering={FadeInDown.duration(300).springify().damping(24).stiffness(240)}
        style={[dd.card, { top, left, width }]}
      >
        <BlurView intensity={28} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]} />
        <View style={[StyleSheet.absoluteFillObject, dd.fill, { borderRadius: 20 }]} />
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 0.8 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'transparent']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.2 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
          pointerEvents="none"
        />
        <View style={[StyleSheet.absoluteFillObject, dd.border, { borderRadius: 20 }]} pointerEvents="none" />
        <View style={dd.inner}>{children}</View>
      </Animated.View>
    </Modal>
  );
}
const dd = StyleSheet.create({
  card: {
    position: 'absolute',
    overflow: 'hidden',
    maxHeight: 220,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.36,
    shadowRadius: 16,
    elevation: 12,
  },
  scrim:  { backgroundColor: 'rgba(0,0,0,0.28)' },
  fill:   { backgroundColor: 'rgba(47,48,49,0.72)' },
  border: { borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },
  inner:  { maxHeight: 220, zIndex: 1 },
  item:   { paddingVertical: 11, paddingHorizontal: 18 },
  itemSel:{ backgroundColor: 'rgba(198,198,198,0.12)' },
  itemTxt:{ fontSize: 14, fontWeight: '500', color: 'rgba(198,198,198,0.9)' },
  itemTxtSel: { color: C_TEXT, fontWeight: '600' },
});


// ── Stat square tile ───────────────────────────────────────────
function StatSquareTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={tile.shadow}>
      <View style={tile.wrap}>
        <BlurView
          intensity={26}
          tint="dark"
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
        />
        <View style={[StyleSheet.absoluteFillObject, tile.fillOverlay, { borderRadius: 38 }]} />
        <LinearGradient
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.06)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.05)', 'transparent']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.16 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.20)']}
          start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        <View
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38, borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' }]}
          pointerEvents="none"
        />
        <View style={tile.inner}>
          <Animated.Text
            key={`v-${value}`}
            entering={FadeIn.duration(220)}
            style={tile.value}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {value}
          </Animated.Text>
          <Animated.Text
            key={`l-${label}`}
            entering={FadeIn.duration(220)}
            style={tile.label}
            numberOfLines={2}
          >
            {label}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}
const tile = StyleSheet.create({
  // Outer shadow — no overflow:hidden so shadow bleeds outward
  shadow: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 38,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 18,
    elevation: 10,
  },
  // Inner clip — contains all visual layers
  wrap: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  fillOverlay: {
    backgroundColor: 'rgba(47,48,49,0.28)',
  },
  inner: {
    flex: 1,
    padding: 18,
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  value: {
    fontSize: 28,
    fontWeight: '600',
    color: C_TEXT,
    letterSpacing: -0.8,
    lineHeight: 32,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: C_TEXT_DIM,
    lineHeight: 16,
  },
});

// ── Glass section (chart + controls wrapper) ───────────────────
function GlassSection({ children, style }: { children: React.ReactNode; style?: object }) {
  // Shadow shell sits outside overflow:hidden so drop shadow bleeds outward
  return (
    <View style={[gs.shadow, style]}>
      <View style={gs.section}>
        {/* Layer 1: Backdrop blur */}
        <BlurView
          intensity={26}
          tint="dark"
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
        />
        {/* Layer 2: Dark fill — lighter for more blur visibility */}
        <View style={[StyleSheet.absoluteFillObject, gs.fillOverlay, { borderRadius: 38 }]} />
        {/* Layer 3: Diagonal specular — ambient light from top-left */}
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        {/* Layer 4: Top-rim lensing band */}
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)', 'transparent']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.14 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        {/* Layer 5: Bottom depth shadow */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.18)']}
          start={{ x: 0.5, y: 0.6 }} end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        {/* Layer 6: Border rim */}
        <View
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38, borderWidth: 1, borderColor: 'rgba(198,198,198,0.20)' }]}
          pointerEvents="none"
        />
        {/* Content */}
        <View style={[gs.content, { padding: SECTION_PAD }]}>
          {children}
        </View>
      </View>
    </View>
  );
}
const gs = StyleSheet.create({
  shadow: {
    borderRadius: 38,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  section: {
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  fillOverlay: {
    backgroundColor: 'rgba(47,48,49,0.26)',
  },
  content: {
    zIndex: 1,
  },
});

// ── Main screen ────────────────────────────────────────────────
export default function ProgressGraphScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [sessions,    setSessions]    = useState<WorkoutSession[]>([]);
  const [weightUnit,  setWeightUnit]  = useState<'kg' | 'lb'>('kg');
  const now          = new Date();
  const currentYear  = getYear(now);
  const currentMonth = getMonth(now);

  const [timeRange,    setTimeRange]    = useState<TimeRange>('month');
  const [selMonth,     setSelMonth]     = useState(currentMonth);
  const [selYear,      setSelYear]      = useState(currentYear);
  const [metric,       setMetric]       = useState<Metric>('duration');
  const [dropOpen,     setDropOpen]     = useState<'month' | 'year' | null>(null);
  const [dropLayout,   setDropLayout]   = useState<DropLayout | null>(null);
  const monthPillRef = useRef<View | null>(null);
  const yearPillRef  = useRef<View | null>(null);
  const [selDay,       setSelDay]       = useState<DayData | null>(null);
  const [selMonthData, setSelMonthData] = useState<MonthData | null>(null);
  const [selYearData,  setSelYearData]  = useState<YearData | null>(null);
  const [headerHeight, setHeaderHeight] = useState(180);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  // Refs to avoid stale closures in chart PanResponder
  const selMonthRef = useRef(currentMonth);
  const selYearRef  = useRef(currentYear);
  const trRef       = useRef<TimeRange>('month');
  const swipeRef    = useRef<{ adv: () => void; ret: () => void }>({ adv: () => {}, ret: () => {} });

  useEffect(() => { selMonthRef.current = selMonth; },  [selMonth]);
  useEffect(() => { selYearRef.current  = selYear; },   [selYear]);
  useEffect(() => { trRef.current       = timeRange; }, [timeRange]);

  // Month/year sub-selector scrub handlers (used by ScrubPill)
  const advanceMonth = useCallback((delta: number) => {
    let m = selMonthRef.current + delta;
    let y = selYearRef.current;
    while (m > 11) { m -= 12; y++; }
    while (m < 0)  { m += 12; y--; }
    // Clamp to current month/year
    if (y > currentYear || (y === currentYear && m > currentMonth)) {
      m = currentMonth; y = currentYear;
    }
    setSelMonth(m); setSelYear(y); setSelDay(null);
  }, [currentYear, currentMonth]);

  const advanceYear = useCallback((delta: number) => {
    const y = Math.max(Math.min(selYearRef.current + delta, currentYear), currentYear - 20);
    setSelYear(y); setSelDay(null);
  }, [currentYear]);

  // Chart horizontal swipe (navigates months when in month view)
  const chartPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        trRef.current === 'month' && Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dx) < SWIPE_THRESHOLD) return;
        if (gs.dx < 0) swipeRef.current.adv();
        else           swipeRef.current.ret();
      },
    })
  ).current;

  const load = useCallback(async () => {
    const [s, settings] = await Promise.all([getWorkoutSessions(), getUserSettings()]);
    setSessions(s);
    setWeightUnit(settings?.weightUnit ?? 'kg');
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  // ── Data: dayDataInRange ───────────────────────────────────
  const { dayDataInRange, yMax } = useMemo(() => {
    const today = startOfDay(new Date());
    let start: Date, end: Date;
    if (timeRange === 'month') {
      start = startOfMonth(new Date(selYear, selMonth, 1));
      const me = endOfMonth(new Date(selYear, selMonth, 1));
      end = today < me ? today : startOfDay(me);
    } else if (timeRange === 'year') {
      start = startOfDay(new Date(selYear, 0, 1));
      const ye = new Date(selYear, 11, 31);
      end = today < ye ? today : startOfDay(ye);
    } else {
      const keys = sessions.map(s => getSessionDateKey(s)).filter((k): k is string => k != null);
      const fk = keys.length ? keys.reduce((a, b) => a < b ? a : b) : format(today, 'yyyy-MM-dd');
      start = startOfDay(parseDate(fk));
      end   = today;
    }
    const rsk = format(start, 'yyyy-MM-dd');
    const rek = format(end,   'yyyy-MM-dd');
    const filt = sessions.filter(s => { const k = getSessionDateKey(s); return k != null && k >= rsk && k <= rek; });
    const raw  = aggregateByDay(filt);
    const byK  = new Map(raw.map(d => [d.dateKey, d]));
    const days = eachDay(start, end);
    const chartData: DayData[] = days.map(date => {
      const key = format(date, 'yyyy-MM-dd');
      const bin = byK.get(key);
      const dm  = Number(bin?.durationMinutes ?? 0);
      const vkg = Number(bin?.volumeKg ?? 0);
      const rps = Number(bin?.reps ?? 0);
      const data = metric === 'duration' ? dm / 60
        : metric === 'reps' ? rps
        : weightUnit === 'lb' ? vkg / KG_PER_LB : vkg;
      return { date: bin?.date ?? new Date(date), dateKey: key, durationMinutes: dm, volumeKg: vkg, reps: rps, data: Number(data) };
    });
    let ym = 0;
    if (metric === 'duration') {
      const mx = Math.max(...chartData.map(d => d.durationMinutes), 0);
      ym = Math.max(DEFAULT_DUR_MAX_H, Math.ceil((mx / 60) * 2) / 2) || DEFAULT_DUR_MAX_H;
    } else if (metric === 'volume') {
      const mx = Math.max(...chartData.map(d => d.volumeKg), 0);
      ym = Math.ceil((weightUnit === 'lb' ? mx / KG_PER_LB : mx) / 100) * 100 || 100;
    } else {
      ym = Math.ceil(Math.max(...chartData.map(d => d.reps), 0) / 10) * 10 || 10;
    }
    return { dayDataInRange: chartData, yMax: ym };
  }, [sessions, timeRange, weightUnit, metric, selMonth, selYear]);

  // ── Monthly + yearly aggregations ─────────────────────────
  const monthlyData = useMemo((): MonthData[] => {
    if (timeRange !== 'year') return [];
    const bm = new Map<number, { durationMinutes: number; volumeKg: number; reps: number }>();
    for (let m = 0; m < 12; m++) bm.set(m, { durationMinutes: 0, volumeKg: 0, reps: 0 });
    dayDataInRange.forEach(p => {
      if (p.date.getFullYear() !== selYear) return;
      const m = p.date.getMonth(); const ex = bm.get(m)!;
      ex.durationMinutes += p.durationMinutes; ex.volumeKg += p.volumeKg; ex.reps += p.reps;
      bm.set(m, ex);
    });
    return MONTH_NAMES.map((n, i) => { const v = bm.get(i)!; return { month: i, monthName: n, ...v }; });
  }, [dayDataInRange, timeRange, selYear]);

  const yearlyData = useMemo((): YearData[] => {
    if (timeRange !== 'all' || !sessions.length) return [];
    const by = new Map<number, { durationMinutes: number; volumeRaw: number; reps: number }>();
    for (const s of sessions) {
      const k = getSessionDateKey(s); if (!k) continue;
      const y = getYear(parseDate(k));
      const ex = by.get(y) ?? { durationMinutes: 0, volumeRaw: 0, reps: 0 };
      ex.durationMinutes += Number(s.duration ?? 0);
      for (const e of s.exercises ?? [])
        for (const set of e.sets ?? []) { ex.volumeRaw += set.weight * set.reps; ex.reps += set.reps; }
      by.set(y, ex);
    }
    return Array.from(by.keys()).sort((a,b)=>a-b).map(y => {
      const v = by.get(y)!;
      return { year: y, durationMinutes: v.durationMinutes, volumeKg: v.volumeRaw * KG_PER_LB, reps: v.reps };
    });
  }, [sessions, timeRange]);

  const availableYears = useMemo(() => {
    const ys = sessions.map(s => getSessionDateKey(s)).filter((k): k is string => k != null).map(k => getYear(parseDate(k)));
    const start = ys.length ? Math.min(...ys) : currentYear;
    const out: number[] = [];
    for (let y = currentYear; y >= Math.max(start, currentYear - 20); y--) out.push(y);
    return out;
  }, [sessions, currentYear]);

  const isYearView = timeRange === 'year';
  const isAllView  = timeRange === 'all';

  // ── yMax for year/all views ────────────────────────────────
  const effYMax = useMemo(() => {
    if (isYearView && monthlyData.length) {
      if (metric === 'duration') return Math.max(DEFAULT_DUR_MAX_H, Math.ceil((Math.max(...monthlyData.map(m => m.durationMinutes), 0) / 60) * 2) / 2) || DEFAULT_DUR_MAX_H;
      if (metric === 'volume')   return Math.ceil((weightUnit === 'lb' ? Math.max(...monthlyData.map(m => m.volumeKg), 0) / KG_PER_LB : Math.max(...monthlyData.map(m => m.volumeKg), 0)) / 100) * 100 || 100;
      return Math.ceil(Math.max(...monthlyData.map(m => m.reps), 0) / 10) * 10 || 10;
    }
    if (isAllView && yearlyData.length) {
      if (metric === 'duration') return Math.max(DEFAULT_DUR_MAX_H, Math.ceil((Math.max(...yearlyData.map(y => y.durationMinutes), 0) / 60) * 2) / 2) || DEFAULT_DUR_MAX_H;
      if (metric === 'volume')   return Math.ceil((weightUnit === 'lb' ? Math.max(...yearlyData.map(y => y.volumeKg), 0) / KG_PER_LB : Math.max(...yearlyData.map(y => y.volumeKg), 0)) / 100) * 100 || 100;
      return Math.ceil(Math.max(...yearlyData.map(y => y.reps), 0) / 10) * 10 || 10;
    }
    return yMax;
  }, [isYearView, isAllView, monthlyData, yearlyData, metric, weightUnit, yMax]);

  // ── Chart sizing ───────────────────────────────────────────
  const n        = dayDataInRange.length || 1;
  const weekGaps = Math.floor((n - 1) / 7);
  const totalGap = (n - 1) * BAR_GAP + weekGaps * WEEK_GAP;
  const barW     = (CHART_AREA_W - totalGap) / n;

  const nY      = isAllView ? yearlyData.length || 1 : isYearView ? 12 : n;
  const barWY   = nY > 1 ? (CHART_AREA_W - (nY - 1) * BAR_GAP) / nY : CHART_AREA_W;
  const effBarW = isAllView || isYearView
    ? (isAllView ? Math.min(barWY, MAX_BAR_W_ALL) : barWY)
    : barW;
  const barsBlockW = isAllView || isYearView
    ? nY * effBarW + (nY - 1) * BAR_GAP
    : CHART_AREA_W;

  const yUnit  = metric === 'duration' ? 'h' : metric === 'volume' ? weightUnit : 'rps';
  const yTicks = [effYMax, effYMax * (2/3), effYMax * (1/3), 0];

  // ── X-axis segments ────────────────────────────────────────
  const xSegs = useMemo(() => {
    if (isAllView)  return yearlyData.map((y, i) => ({ label: String(y.year), startIndex: i }));
    if (isYearView) return MONTH_NAMES.map((l, i) => ({ label: l, startIndex: i }));
    const segs: { label: string; startIndex: number }[] = []; let last = '';
    dayDataInRange.forEach(({ date }, i) => {
      const k = format(date, 'yyyy-MM');
      if (k !== last) { segs.push({ label: MONTH_NAMES[date.getMonth()], startIndex: i }); last = k; }
    });
    return segs;
  }, [dayDataInRange, isYearView, isAllView, yearlyData]);

  const xSegW = useMemo(() => {
    if (isAllView || isYearView) return Array.from({ length: nY }, (_, i) => effBarW + (i < nY - 1 ? BAR_GAP : 0));
    return xSegs.map((seg, i) => {
      const s = seg.startIndex, e = i < xSegs.length - 1 ? xSegs[i+1].startIndex : n;
      let w = 0;
      for (let j = s; j < e; j++) w += barW + BAR_GAP + ((j+1) % 7 === 0 && j < n-1 ? WEEK_GAP : 0);
      return w;
    });
  }, [xSegs, n, barW, isYearView, isAllView, effBarW, nY]);

  // ── Value formatters ───────────────────────────────────────
  const fmtD = useCallback((d: { durationMinutes: number; volumeKg: number; reps: number }) => {
    if (metric === 'duration') return fmtDur(d.durationMinutes);
    if (metric === 'volume')   return fmtVol(d.volumeKg, weightUnit);
    return `${d.reps} reps`;
  }, [metric, weightUnit]);

  const getValY = useCallback((y: YearData) =>
    metric === 'duration' ? y.durationMinutes / 60
    : metric === 'volume'  ? (weightUnit === 'lb' ? y.volumeKg / KG_PER_LB : y.volumeKg)
    : y.reps,
  [metric, weightUnit]);

  const getValM = useCallback((m: MonthData) =>
    metric === 'duration' ? m.durationMinutes / 60
    : metric === 'volume'  ? (weightUnit === 'lb' ? m.volumeKg / KG_PER_LB : m.volumeKg)
    : m.reps,
  [metric, weightUnit]);

  // ── Session count for current range (actual workout sessions) ──
  const sessionCount = useMemo(() => {
    const complete = sessions.filter(s => getSessionDateKey(s) != null && s.isComplete === true);
    if (isAllView) {
      if (selYearData) {
        return complete.filter(s => getYear(parseDate(getSessionDateKey(s)!)) === selYearData.year).length;
      }
      return complete.length;
    }
    if (isYearView) {
      return complete.filter(s => getYear(parseDate(getSessionDateKey(s)!)) === selYear).length;
    }
    const rsk = format(startOfMonth(new Date(selYear, selMonth, 1)), 'yyyy-MM-dd');
    const rek = format(endOfMonth(new Date(selYear, selMonth, 1)), 'yyyy-MM-dd');
    return complete.filter(s => { const k = getSessionDateKey(s)!; return k >= rsk && k <= rek; }).length;
  }, [sessions, isAllView, isYearView, selYear, selMonth, selYearData]);

  // ── Summary stats ──────────────────────────────────────────
  const summary = useMemo(() => {
    let total = 0, best = 0, bestLbl = '—';
    if (isAllView) {
      yearlyData.forEach(y => { const v = getValY(y); total += v; if (v > best) { best = v; bestLbl = String(y.year); } });
    } else if (isYearView) {
      monthlyData.forEach(m => { const v = getValM(m); total += v; if (v > best) { best = v; bestLbl = m.monthName; } });
    } else {
      dayDataInRange.forEach(d => { total += d.data; if (d.data > best) { best = d.data; bestLbl = format(d.date, 'd MMM'); } });
    }
    const fTotal = metric === 'duration' ? fmtDur(total * 60) : metric === 'volume' ? fmtVol(total, weightUnit) : `${Math.round(total)}`;
    const fBest  = best > 0 ? (metric === 'duration' ? fmtDur(best * 60) : metric === 'volume' ? fmtVol(best, weightUnit) : `${Math.round(best)}`) : '—';
    const avg    = sessionCount > 0 ? total / sessionCount : 0;
    const fAvg   = avg > 0 ? (metric === 'duration' ? fmtDur(avg * 60) : metric === 'volume' ? fmtVol(avg, weightUnit) : `${Math.round(avg)}`) : '—';
    return { count: String(sessionCount), fTotal, fBest, bestLbl, fAvg };
  }, [dayDataInRange, monthlyData, yearlyData, sessionCount, isAllView, isYearView, metric, weightUnit, getValY, getValM]);

  const hasData = useMemo(() => {
    if (isAllView)  return yearlyData.some(y => getValY(y) > 0);
    if (isYearView) return monthlyData.some(m => getValM(m) > 0);
    return dayDataInRange.some(d => d.data > 0);
  }, [dayDataInRange, monthlyData, yearlyData, isAllView, isYearView, getValY, getValM]);

  // ── Selected bar display ───────────────────────────────────
  const selDisplay = useMemo(() => {
    if (timeRange === 'month' && selDay)
      return { val: fmtD(selDay), lbl: format(selDay.date, 'EEE, d MMM') };
    if (timeRange === 'year' && selMonthData)
      return { val: fmtD(selMonthData), lbl: `${selMonthData.monthName} ${selYear}` };
    if (timeRange === 'all' && selYearData)
      return { val: fmtD(selYearData), lbl: String(selYearData.year) };
    return null;
  }, [timeRange, selDay, selMonthData, selYearData, selYear, fmtD]);

  // ── Range pill label (for period picker) ──────────────────
  const rangePillLabel = timeRange === 'month'
    ? `${MONTH_NAMES[selMonth]} ${selYear}`
    : timeRange === 'year' ? String(selYear) : null;

  // ── Header subtitle ────────────────────────────────────────
  const headerSubtitle = (() => {
    const r = timeRange === 'month'
      ? `${MONTH_NAMES[selMonth].toLowerCase()} ${selYear}`
      : timeRange === 'year' ? String(selYear)
      : 'all time';
    return `${metric} · ${r}`;
  })();

  // ── Chart month swipe handlers ─────────────────────────────
  swipeRef.current = {
    adv: () => {
      const m = selMonthRef.current, y = selYearRef.current;
      if (y > currentYear || (y === currentYear && m >= currentMonth)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (m === 11) { setSelMonth(0); setSelYear(y + 1); } else setSelMonth(m + 1);
      setSelDay(null);
    },
    ret: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const m = selMonthRef.current, y = selYearRef.current;
      if (m === 0) { setSelMonth(11); setSelYear(y - 1); } else setSelMonth(m - 1);
      setSelDay(null);
    },
  };

  const backButton = (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
      style={({ pressed }) => [p.backChip, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <View style={p.backChipInner}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(47,48,49,0.40)' }]} />
        <LinearGradient
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.03)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <Ionicons name="chevron-back" size={20} color={C_TEXT} style={{ zIndex: 2 }} />
      </View>
    </Pressable>
  );

  // ── Render ─────────────────────────────────────────────────
  return (
    <View style={p.root}>
      <HomeGradientBackground />

      <StickyGlassHeader
        title=""
        leftSlot={backButton}
        rightSlot={
          <View style={p.controlsRow}>
            <View>
              <LiquidGlassSegmented
                options={[
                  { key: 'month', label: 'Month' },
                  { key: 'year',  label: 'Year' },
                  { key: 'all',   label: 'All' },
                ]}
                value={timeRange}
                width={timeRange === 'all' ? RANGE_PILL_W_ALL : RANGE_PILL_W}
                onChange={(k) => {
                  setTimeRange(k as TimeRange);
                  setSelDay(null); setSelMonthData(null); setSelYearData(null);
                }}
              />
            </View>
            {timeRange === 'month' && (
              <View ref={monthPillRef} collapsable={false}>
                <LiquidGlassPill
                  label={`${MONTH_NAMES[selMonth]} ${selYear}`}
                  scrubEnabled={false}
                  chevron
                  onPress={() => {
                    monthPillRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
                      setDropLayout({ x, y, width: w, height: h });
                      setDropOpen('month');
                    });
                  }}
                />
              </View>
            )}
            {timeRange === 'year' && (
              <View ref={yearPillRef} collapsable={false}>
                <LiquidGlassPill
                  label={String(selYear)}
                  scrubEnabled={false}
                  chevron
                  onPress={() => {
                    yearPillRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
                      setDropLayout({ x, y, width: w, height: h });
                      setDropOpen('year');
                    });
                  }}
                />
              </View>
            )}
          </View>
        }
        scrollY={scrollY}
        onLayout={setHeaderHeight}
      >
        <View style={p.titleMetricRow}>
          <View>
            <Text style={p.sectionTitle}>progress.</Text>
            <Text style={p.sectionSub}>{headerSubtitle}</Text>
          </View>
          <View>
            <LiquidGlassSegmented
              options={[
                { key: 'duration', label: 'Duration' },
                { key: 'volume',   label: 'Volume' },
                { key: 'reps',     label: 'Reps' },
              ]}
              value={metric}
              width={METRIC_PILL_W}
              onChange={(k) => {
                setMetric(k as Metric);
                setSelDay(null); setSelMonthData(null); setSelYearData(null);
              }}
            />
          </View>
        </View>
      </StickyGlassHeader>

      <Animated.ScrollView
        style={p.scroll}
        contentContainerStyle={[
          p.scrollContent,
          { paddingTop: headerHeight + 8, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* ── Dropdowns ── */}
        {dropOpen === 'month' && (
          <DropdownModal
            onClose={() => { setDropOpen(null); setDropLayout(null); }}
            triggerLayout={dropLayout}
          >
            <ScrollView style={{ maxHeight: 210 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {MONTH_NAMES.map((name, i) => (
                <Pressable
                  key={name}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelMonth(i);
                    setDropOpen(null);
                    setDropLayout(null);
                  }}
                  style={[dd.item, i === selMonth && dd.itemSel]}
                >
                  <Text style={[dd.itemTxt, i === selMonth && dd.itemTxtSel]}>{name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </DropdownModal>
        )}
        {dropOpen === 'year' && (
          <DropdownModal
            onClose={() => { setDropOpen(null); setDropLayout(null); }}
            triggerLayout={dropLayout}
          >
            <ScrollView style={{ maxHeight: 210 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {availableYears.map((y) => (
                <Pressable
                  key={y}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelYear(y);
                    setDropOpen(null);
                    setDropLayout(null);
                  }}
                  style={[dd.item, y === selYear && dd.itemSel]}
                >
                  <Text style={[dd.itemTxt, y === selYear && dd.itemTxtSel]}>{y}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </DropdownModal>
        )}

        {/* ── 4. Stat tiles (2×2 grid, no outer card) ── */}
        <Animated.View layout={Layout.springify().damping(26).stiffness(200)} style={p.tileGrid}>
          <Animated.View entering={FadeInDown.delay(0).duration(360).springify().damping(24)} layout={Layout.springify()}>
            <View style={p.tileShadow}>
              <InteractiveGlassWrapper width={TILE_SIZE} height={TILE_SIZE}>
                <StatSquareTile label="sessions" value={summary.count} />
              </InteractiveGlassWrapper>
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(40).duration(360).springify().damping(24)} layout={Layout.springify()}>
            <View style={p.tileShadow}>
              <InteractiveGlassWrapper width={TILE_SIZE} height={TILE_SIZE}>
                <StatSquareTile
                  label={metric === 'duration' ? 'total time' : metric === 'volume' ? 'total vol.' : 'total reps'}
                  value={summary.fTotal}
                />
              </InteractiveGlassWrapper>
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(80).duration(360).springify().damping(24)} layout={Layout.springify()}>
            <View style={p.tileShadow}>
              <InteractiveGlassWrapper width={TILE_SIZE} height={TILE_SIZE}>
                <StatSquareTile label={`best · ${summary.bestLbl}`} value={summary.fBest} />
              </InteractiveGlassWrapper>
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(120).duration(360).springify().damping(24)} layout={Layout.springify()}>
            <View style={p.tileShadow}>
              <InteractiveGlassWrapper width={TILE_SIZE} height={TILE_SIZE}>
                <StatSquareTile label="avg / session" value={summary.fAvg} />
              </InteractiveGlassWrapper>
            </View>
          </Animated.View>
        </Animated.View>

        {/* ── 5. Chart (glass card) — spotlight fits widget via fitContent ── */}
        <Animated.View entering={FadeInDown.delay(160).duration(400).springify().damping(24)} layout={Layout.springify().damping(26).stiffness(200)}>
        <View style={p.chartShadow}>
        <InteractiveGlassWrapper fitContent borderRadius={38}>
        <GlassSection>
          {/* Tooltip row */}
          <View style={p.tooltipRow}>
            {selDisplay != null ? (
              <Animated.View
                key={`tip-${selDisplay.lbl}-${selDisplay.val}`}
                entering={FadeInDown.duration(260).springify().damping(22).stiffness(260)}
                exiting={FadeOut.duration(120)}
                style={p.tooltipChip}
              >
                <Text style={p.tooltipVal}>{String(selDisplay.val ?? '')}</Text>
                <Text style={p.tooltipLbl}>{String(selDisplay.lbl ?? '')}</Text>
              </Animated.View>
            ) : (
              <View style={{ height: 36 }} />
            )}
          </View>

          {!hasData ? (
            <View style={[p.emptyState, { minHeight: CHART_HEIGHT + 32 }]}>
              <Text style={p.emptyTitle}>No workouts yet.</Text>
              <Text style={p.emptySub}>Finish one workout to populate this graph.</Text>
              {/* Glass-prominent CTA — bright fill, dark text, specular rim */}
              <Pressable
                style={({ pressed }) => [p.emptyBtn, pressed && { transform: [{ scale: 0.97 }], opacity: 0.88 }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(tabs)/workout' as any); }}
              >
                {/* Bright base fill */}
                <LinearGradient
                  colors={['rgba(220,220,220,0.96)', 'rgba(198,198,198,0.90)']}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                {/* Diagonal specular — top-left bright hit */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.12)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                {/* Top-rim lensing */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.60)', 'transparent']}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.22 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                {/* Bottom depth */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.10)']}
                  start={{ x: 0.5, y: 0.6 }} end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <Text style={p.emptyBtnText}>Start workout</Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={[p.chartCentered, isAllView && p.chartLeft]}
              {...(!isAllView ? chartPan.panHandlers : {})}
            >
              {isAllView ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: SECTION_PAD }}
                >
                  <View style={[p.chartInner, { width: Y_AXIS_W + barsBlockW }]}>
                {/* Y axis */}
                <View>
                  <View style={{ width: Y_AXIS_W, height: BAR_AREA_H, flexDirection: 'row', alignItems: 'stretch' }}>
                    <View style={{ flex: 1, justifyContent: 'space-between', paddingRight: 6, alignItems: 'flex-end' }}>
                      {yTicks.map((v, i) => (
                        <Text key={i} style={p.yLbl}>
                          {metric === 'duration' ? `${v.toFixed(1)}${yUnit}` : `${fmtYAxis(v)} ${yUnit}`}
                        </Text>
                      ))}
                    </View>
                    <View style={{ width: AXIS_LINE_W, backgroundColor: C_AXIS_LINE }} />
                  </View>
                  <View style={{ width: Y_AXIS_W, height: AXIS_LINE_W }} />
                </View>

                {/* Bars + x-axis — centered when narrower than chart area */}
                <View style={p.chartBarsColumn}>
                  <View style={{ width: barsBlockW, height: BAR_AREA_H, position: 'relative' }}>
                    {yTicks.map((_, i) => (
                      <View key={i} style={{
                        position: 'absolute', top: BAR_AREA_H * i / (yTicks.length - 1),
                        left: 0, width: barsBlockW, height: 1, backgroundColor: C_GRID,
                      }} />
                    ))}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', position: 'absolute', left: 0, right: 0, bottom: 0, height: BAR_AREA_H }}>
                      {isAllView && yearlyData.length > 0 ? (
                        yearlyData.map((yd, i) => {
                          const v  = getValY(yd);
                          let bh   = effYMax > 0 ? Math.floor(BAR_AREA_H * v / effYMax) : 0;
                          if (v > 0 && bh < MIN_BAR_H) bh = MIN_BAR_H;
                          const sel = selYearData?.year === yd.year;
                          const has = selYearData != null;
                          return (
                            <Pressable key={`${yd.year}-${metric}`}
                              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelYearData(yd); }}
                              style={{ width: effBarW, marginRight: i < yearlyData.length - 1 ? BAR_GAP : 0, height: BAR_AREA_H, alignItems: 'center', justifyContent: 'flex-end' }}
                            >
                              <Animated.View entering={barGrowUp(i * 30)} style={{
                                height: bh, width: effBarW, overflow: 'hidden',
                                backgroundColor: sel ? '#FFFFFF' : has ? C_BAR_DIM : C_BAR,
                                borderTopLeftRadius: BAR_TOP_R, borderTopRightRadius: BAR_TOP_R,
                              }}>
                                {sel && <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.08)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.45 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />}
                              </Animated.View>
                            </Pressable>
                          );
                        })
                      ) : isYearView && monthlyData.length === 12 ? (
                        monthlyData.map((md, i) => {
                          const v  = getValM(md);
                          let bh   = effYMax > 0 ? Math.floor(BAR_AREA_H * v / effYMax) : 0;
                          if (v > 0 && bh < MIN_BAR_H) bh = MIN_BAR_H;
                          const sel = selMonthData?.month === md.month;
                          const has = selMonthData != null;
                          return (
                            <Pressable key={`${md.month}-${metric}`}
                              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelMonthData(md); }}
                              style={{ width: effBarW, marginRight: i < 11 ? BAR_GAP : 0, height: BAR_AREA_H, alignItems: 'center', justifyContent: 'flex-end' }}
                            >
                              <Animated.View entering={barGrowUp(i * 30)} style={{
                                height: bh, width: effBarW, overflow: 'hidden',
                                backgroundColor: sel ? '#FFFFFF' : has ? C_BAR_DIM : C_BAR,
                                borderTopLeftRadius: BAR_TOP_R, borderTopRightRadius: BAR_TOP_R,
                              }}>
                                {sel && <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.08)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.45 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />}
                              </Animated.View>
                            </Pressable>
                          );
                        })
                      ) : (
                        dayDataInRange.map((pt, i) => {
                          const v  = pt.data;
                          let bh   = effYMax > 0 ? Math.floor(BAR_AREA_H * v / effYMax) : 0;
                          if (v > 0 && bh < MIN_BAR_H) bh = MIN_BAR_H;
                          const sel = selDay != null && isSameDay(pt.date, selDay.date);
                          const has = selDay != null;
                          const mr  = i < dayDataInRange.length - 1 ? BAR_GAP + ((i+1) % 7 === 0 ? WEEK_GAP : 0) : 0;
                          return (
                            <Pressable key={`${pt.date.getTime()}-${metric}`}
                              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelDay(pt); }}
                              style={{ width: effBarW, marginRight: mr, height: BAR_AREA_H, alignItems: 'center', justifyContent: 'flex-end' }}
                            >
                              <Animated.View entering={barGrowUp(i * 20)} style={{
                                height: bh, width: effBarW, overflow: 'hidden',
                                backgroundColor: sel ? '#FFFFFF' : has ? C_BAR_DIM : C_BAR,
                                borderTopLeftRadius: BAR_TOP_R, borderTopRightRadius: BAR_TOP_R,
                              }}>
                                {sel && <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.08)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.45 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />}
                              </Animated.View>
                            </Pressable>
                          );
                        })
                      )}
                    </View>
                  </View>

                  <View style={{ width: barsBlockW, height: AXIS_LINE_W, backgroundColor: C_AXIS_LINE }} />
                  <View style={{ flexDirection: 'row', marginTop: 7, width: barsBlockW }}>
                    {xSegs.map((seg, i) => (
                      <View key={`${seg.label}-${seg.startIndex}`} style={{ width: xSegW[i] ?? 0, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={[p.xLbl, { width: '100%', textAlign: 'center' }]}>{seg.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
                </ScrollView>
              ) : (
                <View style={[p.chartInner, { width: Y_AXIS_W + barsBlockW, marginLeft: -20 }]}>
                {/* Y axis */}
                <View>
                  <View style={{ width: Y_AXIS_W, height: BAR_AREA_H, flexDirection: 'row', alignItems: 'stretch' }}>
                    <View style={{ flex: 1, justifyContent: 'space-between', paddingRight: 6, alignItems: 'flex-end' }}>
                      {yTicks.map((v, i) => (
                        <Text key={i} style={p.yLbl}>
                          {metric === 'duration' ? `${v.toFixed(1)}${yUnit}` : `${fmtYAxis(v)} ${yUnit}`}
                        </Text>
                      ))}
                    </View>
                    <View style={{ width: AXIS_LINE_W, backgroundColor: C_AXIS_LINE }} />
                  </View>
                  <View style={{ width: Y_AXIS_W, height: AXIS_LINE_W }} />
                </View>

                {/* Bars + x-axis */}
                <View style={p.chartBarsColumn}>
                  <View style={{ width: barsBlockW, height: BAR_AREA_H, position: 'relative' }}>
                    {yTicks.map((_, i) => (
                      <View key={i} style={{
                        position: 'absolute', top: BAR_AREA_H * i / (yTicks.length - 1),
                        left: 0, width: barsBlockW, height: 1, backgroundColor: C_GRID,
                      }} />
                    ))}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', position: 'absolute', left: 0, right: 0, bottom: 0, height: BAR_AREA_H }}>
                      {isYearView && monthlyData.length === 12 ? (
                        monthlyData.map((md, i) => {
                          const v  = getValM(md);
                          let bh   = effYMax > 0 ? Math.floor(BAR_AREA_H * v / effYMax) : 0;
                          if (v > 0 && bh < MIN_BAR_H) bh = MIN_BAR_H;
                          const sel = selMonthData?.month === md.month;
                          const has = selMonthData != null;
                          return (
                            <Pressable key={`${md.month}-${metric}`}
                              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelMonthData(md); }}
                              style={{ width: effBarW, marginRight: i < 11 ? BAR_GAP : 0, height: BAR_AREA_H, alignItems: 'center', justifyContent: 'flex-end' }}
                            >
                              <Animated.View entering={barGrowUp(i * 30)} style={{
                                height: bh, width: effBarW, overflow: 'hidden',
                                backgroundColor: sel ? '#FFFFFF' : has ? C_BAR_DIM : C_BAR,
                                borderTopLeftRadius: BAR_TOP_R, borderTopRightRadius: BAR_TOP_R,
                              }}>
                                {sel && <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.08)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.45 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />}
                              </Animated.View>
                            </Pressable>
                          );
                        })
                      ) : (
                        dayDataInRange.map((pt, i) => {
                          const v  = pt.data;
                          let bh   = effYMax > 0 ? Math.floor(BAR_AREA_H * v / effYMax) : 0;
                          if (v > 0 && bh < MIN_BAR_H) bh = MIN_BAR_H;
                          const sel = selDay != null && isSameDay(pt.date, selDay.date);
                          const has = selDay != null;
                          const mr  = i < dayDataInRange.length - 1 ? BAR_GAP + ((i+1) % 7 === 0 ? WEEK_GAP : 0) : 0;
                          return (
                            <Pressable key={`${pt.date.getTime()}-${metric}`}
                              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelDay(pt); }}
                              style={{ width: effBarW, marginRight: mr, height: BAR_AREA_H, alignItems: 'center', justifyContent: 'flex-end' }}
                            >
                              <Animated.View entering={barGrowUp(i * 20)} style={{
                                height: bh, width: effBarW, overflow: 'hidden',
                                backgroundColor: sel ? '#FFFFFF' : has ? C_BAR_DIM : C_BAR,
                                borderTopLeftRadius: BAR_TOP_R, borderTopRightRadius: BAR_TOP_R,
                              }}>
                                {sel && <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.08)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.45 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />}
                              </Animated.View>
                            </Pressable>
                          );
                        })
                      )}
                    </View>
                  </View>

                  <View style={{ width: barsBlockW, height: AXIS_LINE_W, backgroundColor: C_AXIS_LINE }} />
                  <View style={{ flexDirection: 'row', marginTop: 7, width: barsBlockW }}>
                    {xSegs.map((seg, i) => (
                      <View key={`${seg.label}-${seg.startIndex}`} style={{ width: xSegW[i] ?? 0, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={[p.xLbl, { width: '100%', textAlign: 'center' }]}>{seg.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              )}
            </View>
          )}
        </GlassSection>
        </InteractiveGlassWrapper>
        </View>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const p = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.primaryDark },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: OUTER_PAD, paddingBottom: 12, zIndex: 2 },

  backChip:      { borderRadius: 20, overflow: 'hidden' },
  backChipInner: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(198,198,198,0.18)', overflow: 'hidden' },

  titleBlock: { flex: 1, alignItems: 'center' },
  title:      { fontSize: 18, fontWeight: '600', letterSpacing: -0.2, color: 'rgba(198,198,198,0.92)' },
  headerSub:  { fontSize: 12, fontWeight: '500', color: C_TEXT_DIM, letterSpacing: 0, marginTop: 2 },
  hSpacer:    { width: 38, height: 38 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: OUTER_PAD, paddingTop: 8, gap: 16 },

  // Controls group: metric + range + sub-selector — centred rows
  controlsGroup: { gap: 10, alignItems: 'center', paddingHorizontal: OUTER_PAD, paddingBottom: 10, zIndex: 1 },
  controlsRow:   { flexDirection: 'row', alignItems: 'center', gap: ROW_GAP, alignSelf: 'flex-end' },

  titleMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: 'rgba(198,198,198,0.92)',
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(198,198,198,0.50)',
    marginTop: 2,
  },

  // 2×2 stat tile grid
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
  },

  tileShadow: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 38,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 12,
  },

  chartShadow: {
    borderRadius: 38,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 12,
  },

  tooltipRow:  { minHeight: 42, justifyContent: 'center', marginBottom: 6 },
  tooltipChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(47,48,49,0.55)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(198,198,198,0.28)', paddingVertical: 7, paddingHorizontal: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 5 },
  tooltipVal:  { fontSize: 16, fontWeight: '600', color: C_TEXT, letterSpacing: -0.2 },
  tooltipLbl:  { fontSize: 13, fontWeight: '500', color: C_TEXT_DIM },

  chartCentered: { alignItems: 'center', overflow: 'hidden', paddingLeft: 8 },
  chartLeft: { alignItems: 'flex-start', overflow: 'visible' },
  chartInner: { flexDirection: 'row', alignItems: 'flex-start' },
  chartBarsColumn: { flexDirection: 'column' },

  yLbl: { fontSize: 10, fontWeight: '500', color: C_AXIS_LBL },
  xLbl: { fontSize: 10, fontWeight: '500', color: C_AXIS_LBL, textAlign: 'center' },

  emptyState:   { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 32 },
  emptyTitle:   { fontSize: 17, fontWeight: '600', color: 'rgba(198,198,198,0.85)', letterSpacing: -0.2 },
  emptySub:     { fontSize: 14, fontWeight: '500', color: C_TEXT_DIM, textAlign: 'center', lineHeight: 20 },
  emptyBtn:     { marginTop: 12, borderRadius: 38, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', paddingVertical: 13, paddingHorizontal: 32, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12 },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#2F3031', letterSpacing: -0.2, zIndex: 1 },
});
