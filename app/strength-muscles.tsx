// ============================================================
// TMLSN — "strength." full-page detail screen
// Layout mirrors progress-graph: Header → Controls → Stat tiles
//          → Body heatmap → Radar chart
// ============================================================

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  FadeIn,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { format, getYear, getMonth, startOfMonth, endOfMonth } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../constants/theme';
import { LiquidGlassSegmented, LiquidGlassPill } from '../components/ui/liquidGlass';
import { StickyGlassHeader } from '../components/ui/StickyGlassHeader';
import { InteractiveGlassWrapper } from '../components/ui/InteractiveGlassWrapper';
import { HomeGradientBackground } from '../components/HomeGradientBackground';
import { MuscleBodyHeatmap } from '../components/MuscleBodyHeatmap';
import { MuscleRadarChart } from '../components/MuscleRadarChart';

import { getWorkoutSessions } from '../utils/storage';
import { workoutsToSetRecordsForRange } from '../utils/workoutMuscles';
import {
  getWeekStart,
  calculateWeeklyMuscleVolume,
  calculateHeatmap,
  MUSCLE_GROUP_DISPLAY_NAMES,
} from '../utils/weeklyMuscleTracker';
import type { WorkoutSession } from '../types';
import type { HeatmapData } from '../utils/weeklyMuscleTracker';

// ── Layout constants ────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const OUTER_PAD   = 20;
const SECTION_PAD = 18;
const TILE_GAP    = 12;
const TILE_SIZE   = Math.floor((SW - OUTER_PAD * 2 - TILE_GAP) / 2);

const ROW_GAP        = 8;
// Segmented width inside the header content row (alongside the title text)
const SEG_W_IN_HEADER = Math.floor((SW - OUTER_PAD * 2) * 0.52);

// ── Color tokens ────────────────────────────────────────────────
const C_TEXT     = Colors.primaryLight;
const C_TEXT_DIM = 'rgba(198,198,198,0.55)';

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
] as const;

// ── Types ───────────────────────────────────────────────────────
type TimeRange  = 'week' | 'month' | 'year' | 'all';
type DropLayout = { x: number; y: number; width: number; height: number };

// ── Dropdown modal (same glass design as progress-graph) ─────────
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
  scrim:      { backgroundColor: 'rgba(0,0,0,0.28)' },
  fill:       { backgroundColor: 'rgba(47,48,49,0.72)' },
  border:     { borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },
  inner:      { maxHeight: 220, zIndex: 1 },
  item:       { paddingVertical: 11, paddingHorizontal: 18 },
  itemSel:    { backgroundColor: 'rgba(198,198,198,0.12)' },
  itemTxt:    { fontSize: 14, fontWeight: '500', color: 'rgba(198,198,198,0.9)' },
  itemTxtSel: { color: C_TEXT, fontWeight: '600' },
});

// ── Stat square tile (identical to progress-graph) ───────────────
function StatSquareTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={tile.shadow}>
      <View style={tile.wrap}>
        <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]} />
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
  shadow: {
    width: TILE_SIZE, height: TILE_SIZE, borderRadius: 38,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30, shadowRadius: 18, elevation: 10,
  },
  wrap: {
    width: TILE_SIZE, height: TILE_SIZE, borderRadius: 38,
    overflow: 'hidden', backgroundColor: 'transparent',
  },
  fillOverlay: { backgroundColor: 'rgba(47,48,49,0.28)' },
  inner: { flex: 1, padding: 18, justifyContent: 'flex-end', zIndex: 1 },
  value: {
    fontSize: 28, fontWeight: '600', color: C_TEXT,
    letterSpacing: -0.8, lineHeight: 32, marginBottom: 6,
  },
  label: { fontSize: 12, fontWeight: '500', color: C_TEXT_DIM, lineHeight: 16 },
});

// ── Glass section (identical to progress-graph) ──────────────────
function GlassSection({ children }: { children: React.ReactNode }) {
  return (
    <View style={gs.shadow}>
      <View style={gs.section}>
        <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]} />
        <View style={[StyleSheet.absoluteFillObject, gs.fillOverlay, { borderRadius: 38 }]} />
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)', 'transparent']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.14 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.18)']}
          start={{ x: 0.5, y: 0.6 }} end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        <View
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38, borderWidth: 1, borderColor: 'rgba(198,198,198,0.20)' }]}
          pointerEvents="none"
        />
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
    shadowColor: '#000000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 18, elevation: 10,
  },
  section: { borderRadius: 38, overflow: 'hidden', backgroundColor: 'transparent' },
  fillOverlay: { backgroundColor: 'rgba(47,48,49,0.26)' },
  content: { zIndex: 1 },
});

// ── Main screen ─────────────────────────────────────────────────
export default function StrengthMusclesScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const now      = new Date();
  const currentYear  = getYear(now);
  const currentMonth = getMonth(now);

  const [sessions,     setSessions]     = useState<WorkoutSession[]>([]);
  const [timeRange,    setTimeRange]    = useState<TimeRange>('week');
  const [selMonth,     setSelMonth]     = useState(currentMonth);
  const [selYear,      setSelYear]      = useState(currentYear);
  const [dropOpen,     setDropOpen]     = useState<'month' | 'year' | null>(null);
  const [dropLayout,   setDropLayout]   = useState<DropLayout | null>(null);
  const [headerHeight, setHeaderHeight] = useState(180);

  const monthPillRef = useRef<View | null>(null);
  const yearPillRef  = useRef<View | null>(null);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  const load = useCallback(async () => {
    const s = await getWorkoutSessions();
    setSessions(s);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Date range for selected period ──────────────────────────
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (timeRange === 'week') {
      const ws  = getWeekStart();
      const we  = new Date(ws);
      we.setDate(we.getDate() + 7);
      return { rangeStart: ws, rangeEnd: we };
    }
    if (timeRange === 'month') {
      const start = startOfMonth(new Date(selYear, selMonth, 1));
      const end   = new Date(endOfMonth(new Date(selYear, selMonth, 1)));
      end.setDate(end.getDate() + 1);
      return { rangeStart: start, rangeEnd: end };
    }
    if (timeRange === 'year') {
      const start = new Date(selYear, 0, 1);
      const end   = new Date(selYear + 1, 0, 1);
      return { rangeStart: start, rangeEnd: end };
    }
    // 'all'
    const end = new Date();
    end.setDate(end.getDate() + 1);
    return { rangeStart: new Date(0), rangeEnd: end };
  }, [timeRange, selMonth, selYear]);

  // ── Muscle data ──────────────────────────────────────────────
  const { heatmapData, totalSets } = useMemo((): { heatmapData: HeatmapData[]; totalSets: number } => {
    if (sessions.length === 0) return { heatmapData: [], totalSets: 0 };
    const setRecords = workoutsToSetRecordsForRange(sessions, rangeStart, rangeEnd);
    const volumes    = calculateWeeklyMuscleVolume(setRecords);
    return { heatmapData: calculateHeatmap(volumes), totalSets: setRecords.length };
  }, [sessions, rangeStart, rangeEnd]);

  // ── Summary stats ────────────────────────────────────────────
  const stats = useMemo(() => {
    const rsk = format(rangeStart, 'yyyy-MM-dd');
    const rek = format(rangeEnd,   'yyyy-MM-dd');
    const sessionCount = sessions.filter((s) => {
      if (!s.isComplete) return false;
      const d = new Date(s.date);
      if (isNaN(d.getTime())) return false;
      const k = format(d, 'yyyy-MM-dd');
      return k >= rsk && k < rek;
    }).length;

    const activeGroups = heatmapData.filter((d) => d.intensity > 0);
    const muscleCount  = activeGroups.length;
    const topMuscle    = activeGroups.length > 0
      ? activeGroups.reduce((max, d) => d.intensity > max.intensity ? d : max)
      : null;
    const topName = topMuscle
      ? (MUSCLE_GROUP_DISPLAY_NAMES[topMuscle.muscleGroup] ?? topMuscle.muscleGroup)
      : '—';

    return { sessionCount, muscleCount, topName, totalSets };
  }, [sessions, heatmapData, rangeStart, rangeEnd, totalSets]);

  // ── Available years for year picker ────────────────────────
  const availableYears = useMemo(() => {
    const ys = sessions
      .map((s) => { const d = new Date(s.date); return isNaN(d.getTime()) ? null : getYear(d); })
      .filter((y): y is number => y !== null);
    const start = ys.length ? Math.min(...ys) : currentYear;
    const out: number[] = [];
    for (let y = currentYear; y >= Math.max(start, currentYear - 20); y--) out.push(y);
    return out;
  }, [sessions, currentYear]);

  // ── Header subtitle ─────────────────────────────────────────
  const headerSubtitle = useMemo(() => {
    if (timeRange === 'week')  return 'this week';
    if (timeRange === 'month') return `${MONTH_NAMES[selMonth].toLowerCase()} ${selYear}`;
    if (timeRange === 'year')  return String(selYear);
    return 'all time';
  }, [timeRange, selMonth, selYear]);

  const heatmapPeriod  = timeRange === 'week' ? 'week' : timeRange === 'month' ? 'month' : timeRange === 'year' ? 'year' : 'all';

  // ── Back button chip ─────────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────
  return (
    <View style={p.root}>
      <HomeGradientBackground />

      <StickyGlassHeader
        title=""
        leftSlot={backButton}
        scrollY={scrollY}
        onLayout={setHeaderHeight}
      >
        {/* Header content: title left, segmented + period pill right */}
        <View style={p.headerContent}>
          <View>
            <Text style={p.sectionTitle}>strength.</Text>
            <Text style={p.sectionSub}>{headerSubtitle}</Text>
          </View>

          <View style={p.headerRight}>
            <LiquidGlassSegmented
              options={[
                { key: 'week',  label: 'Week' },
                { key: 'month', label: 'Month' },
                { key: 'year',  label: 'Year' },
                { key: 'all',   label: 'All' },
              ]}
              value={timeRange}
              width={SEG_W_IN_HEADER}
              onChange={(k) => {
                setTimeRange(k as TimeRange);
                setDropOpen(null);
                setDropLayout(null);
              }}
            />

            {timeRange === 'month' && (
              <View ref={monthPillRef} collapsable={false} style={{ alignSelf: 'flex-end' }}>
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
              <View ref={yearPillRef} collapsable={false} style={{ alignSelf: 'flex-end' }}>
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
        {/* Month picker dropdown */}
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

        {/* Year picker dropdown */}
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

        {/* ── 2×2 Stat tiles ── */}
        <Animated.View layout={Layout.springify().damping(26).stiffness(200)} style={p.tileGrid}>
          <Animated.View entering={FadeInDown.delay(0).duration(360).springify().damping(24)} layout={Layout.springify()}>
            <View style={p.tileShadow}>
              <InteractiveGlassWrapper width={TILE_SIZE} height={TILE_SIZE}>
                <StatSquareTile label="sessions" value={String(stats.sessionCount)} />
              </InteractiveGlassWrapper>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(40).duration(360).springify().damping(24)} layout={Layout.springify()}>
            <View style={p.tileShadow}>
              <InteractiveGlassWrapper width={TILE_SIZE} height={TILE_SIZE}>
                <StatSquareTile label="muscle groups" value={String(stats.muscleCount)} />
              </InteractiveGlassWrapper>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(360).springify().damping(24)} layout={Layout.springify()}>
            <View style={p.tileShadow}>
              <InteractiveGlassWrapper width={TILE_SIZE} height={TILE_SIZE}>
                <StatSquareTile label="top muscle" value={stats.topName} />
              </InteractiveGlassWrapper>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(360).springify().damping(24)} layout={Layout.springify()}>
            <View style={p.tileShadow}>
              <InteractiveGlassWrapper width={TILE_SIZE} height={TILE_SIZE}>
                <StatSquareTile label="total sets" value={String(stats.totalSets)} />
              </InteractiveGlassWrapper>
            </View>
          </Animated.View>
        </Animated.View>

        {/* ── Body heatmap ── */}
        <Animated.View
          entering={FadeInDown.delay(160).duration(400).springify().damping(24)}
          layout={Layout.springify().damping(26).stiffness(200)}
        >
          <View style={p.sectionShadow}>
            <InteractiveGlassWrapper fitContent borderRadius={38}>
              <GlassSection>
                {/* Negate MuscleBodyHeatmap's built-in bottom margin inside the card */}
                <View style={{ marginBottom: -24 }}>
                  <MuscleBodyHeatmap
                    heatmapData={heatmapData}
                    period={heatmapPeriod as any}
                  />
                </View>
              </GlassSection>
            </InteractiveGlassWrapper>
          </View>
        </Animated.View>

        {/* ── Radar chart (has its own glass card) ── */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400).springify().damping(24)}
          layout={Layout.springify().damping(26).stiffness(200)}
        >
          <MuscleRadarChart heatmapData={heatmapData} />
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const p = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primaryDark },

  backChip: { borderRadius: 20, overflow: 'hidden' },
  backChipInner: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(198,198,198,0.18)',
    overflow: 'hidden',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: OUTER_PAD, paddingTop: 8, gap: 16 },

  // Header content row: title left + segmented right
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: 6,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: ROW_GAP,
  },

  sectionTitle: {
    fontSize: 28, fontWeight: '700', letterSpacing: -0.4,
    color: 'rgba(198,198,198,0.92)',
  },
  sectionSub: {
    fontSize: 13, fontWeight: '500',
    color: 'rgba(198,198,198,0.50)', marginTop: 2,
  },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },
  tileShadow: {
    width: TILE_SIZE, height: TILE_SIZE, borderRadius: 38,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34, shadowRadius: 22, elevation: 12,
  },

  sectionShadow: {
    borderRadius: 38,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34, shadowRadius: 22, elevation: 12,
  },
});
