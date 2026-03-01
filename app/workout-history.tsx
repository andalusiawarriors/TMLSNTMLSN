import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, getYear, getMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subWeeks, addWeeks } from 'date-fns';
import { Clock, ChartBar, Barbell } from 'phosphor-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  FadeIn,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { getWorkoutSessions, getUserSettings } from '../utils/storage';
import { getSessionDisplayName } from '../utils/workoutSessionDisplay';
import { WorkoutSession } from '../types';
import { toDisplayVolume, formatWeightDisplay } from '../utils/units';
import { HomeGradientBackground } from '../components/HomeGradientBackground';
import { LiquidGlassSegmented, LiquidGlassPill } from '../components/ui/liquidGlass';
import { StickyGlassHeader } from '../components/ui/StickyGlassHeader';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

const { width: SW } = Dimensions.get('window');
const OUTER_PAD = 20;
const ROW_GAP = 8;
const BACK_BTN_W = 36;
const SEG_W_FULL = SW - OUTER_PAD * 2 - BACK_BTN_W - ROW_GAP;
const PICKER_PILL_RESERVE = 112;
const SEG_W_WITH_PILL = SEG_W_FULL - PICKER_PILL_RESERVE - ROW_GAP;

const C_TEXT = Colors.primaryLight;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

type TimeRange = 'week' | 'month' | 'year' | 'all';
type DropLayout = { x: number; y: number; width: number; height: number };

function getWeekLabel(weekStart: Date): string {
  const we = endOfWeek(weekStart, { weekStartsOn: 1 });
  const sm = format(weekStart, 'MMM d');
  const em = format(we, 'MMM d');
  return `${sm} – ${em}`;
}

function getWeekLabelShort(weekStart: Date): string {
  const we = endOfWeek(weekStart, { weekStartsOn: 1 });
  return `${format(weekStart, 'MMM d')} – ${format(we, 'd')}`;
}

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
  const top = triggerLayout.y + triggerLayout.height + 6;
  const minW = Math.max(triggerLayout.width, 160);
  const maxW = SW - OUTER_PAD * 2;
  const width = Math.min(minW, maxW);
  let left = triggerLayout.x;
  if (left + width > SW - OUTER_PAD) left = SW - OUTER_PAD - width;
  if (left < OUTER_PAD) left = OUTER_PAD;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.28)' }]} pointerEvents="none" />
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
  fill: { backgroundColor: 'rgba(47,48,49,0.72)' },
  border: { borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },
  inner: { maxHeight: 220, zIndex: 1 },
  item: { paddingVertical: 11, paddingHorizontal: 18 },
  itemSel: { backgroundColor: 'rgba(198,198,198,0.12)' },
  itemTxt: { fontSize: 14, fontWeight: '500' as const, color: 'rgba(198,198,198,0.9)' },
  itemTxtSel: { color: C_TEXT, fontWeight: '600' as const },
});

export default function WorkoutHistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const currentYear = getYear(now);
  const currentMonth = getMonth(now);

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [selWeekStart, setSelWeekStart] = useState(() => startOfWeek(now, { weekStartsOn: 1 }));
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [selYear, setSelYear] = useState(currentYear);
  const [dropOpen, setDropOpen] = useState<'week' | 'month' | 'year' | null>(null);
  const [dropLayout, setDropLayout] = useState<DropLayout | null>(null);
  const [headerHeight, setHeaderHeight] = useState(180);

  const weekPillRef = useRef<View | null>(null);
  const monthPillRef = useRef<View | null>(null);
  const yearPillRef = useRef<View | null>(null);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  const load = useCallback(async () => {
    try {
      const [loadedSessions, settings] = await Promise.all([
        getWorkoutSessions(),
        getUserSettings(),
      ]);
      setSessions(loadedSessions);
      setWeightUnit(settings.weightUnit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (timeRange === 'week') {
      const ws = selWeekStart;
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);
      return { rangeStart: ws, rangeEnd: we };
    }
    if (timeRange === 'month') {
      const start = startOfMonth(new Date(selYear, selMonth, 1));
      const end = new Date(endOfMonth(new Date(selYear, selMonth, 1)));
      end.setDate(end.getDate() + 1);
      return { rangeStart: start, rangeEnd: end };
    }
    if (timeRange === 'year') {
      const start = new Date(selYear, 0, 1);
      const end = new Date(selYear + 1, 0, 1);
      return { rangeStart: start, rangeEnd: end };
    }
    const end = new Date();
    end.setDate(end.getDate() + 1);
    return { rangeStart: new Date(0), rangeEnd: end };
  }, [timeRange, selWeekStart, selMonth, selYear]);

  const filteredSessions = useMemo(() => {
    const rsk = format(rangeStart, 'yyyy-MM-dd');
    const rek = format(rangeEnd, 'yyyy-MM-dd');
    return sessions
      .filter((s) => {
        if (!s.isComplete) return false;
        const d = new Date(s.date);
        if (isNaN(d.getTime())) return false;
        const k = format(d, 'yyyy-MM-dd');
        return k >= rsk && k < rek;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, rangeStart, rangeEnd]);

  const availableWeeks = useMemo(() => {
    const weeks: Date[] = [];
    const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
    for (let i = 12; i >= -4; i--) {
      weeks.push(i >= 0 ? subWeeks(thisWeek, i) : addWeeks(thisWeek, -i));
    }
    return weeks;
  }, []);

  const availableYears = useMemo(() => {
    const ys = sessions
      .map((s) => {
        const d = new Date(s.date);
        return isNaN(d.getTime()) ? null : getYear(d);
      })
      .filter((y): y is number => y !== null);
    const start = ys.length ? Math.min(...ys) : currentYear;
    const out: number[] = [];
    for (let y = currentYear; y >= Math.max(start, currentYear - 20); y--) out.push(y);
    return out;
  }, [sessions, currentYear]);

  const headerSubtitle = useMemo(() => {
    if (timeRange === 'week') return getWeekLabelShort(selWeekStart).toLowerCase();
    if (timeRange === 'month') return `${MONTH_NAMES[selMonth].toLowerCase()} ${selYear}`;
    if (timeRange === 'year') return String(selYear);
    return 'all time';
  }, [timeRange, selWeekStart, selMonth, selYear]);

  const backButton = (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
      }}
      style={({ pressed }) => [styles.backChip, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <View style={styles.backChipInner}>
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

  const renderSessionCard = (item: WorkoutSession) => {
    const rawVolume = item.exercises.reduce((acc, ex) =>
      acc + ex.sets.filter((s) => s.completed).reduce((sacc, set) => sacc + set.weight * set.reps, 0), 0);
    const volumeDisplay = toDisplayVolume(rawVolume, weightUnit);
    const volumeStr = formatWeightDisplay(volumeDisplay, weightUnit);
    const exerciseCount = item.exercises.length;

    return (
      <Pressable
        key={item.id}
        onPress={() => router.push({ pathname: '/workout-detail', params: { sessionId: item.id } })}
        style={({ pressed }) => [styles.cardWrap, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.cardGlass}>
          <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFillObject, styles.cardGlassRadius]} />
          <View style={[StyleSheet.absoluteFillObject, styles.cardFill, styles.cardGlassRadius]} />
          <LinearGradient
            colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.07)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
            style={[StyleSheet.absoluteFillObject, styles.cardGlassRadius]} pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.18 }}
            style={[StyleSheet.absoluteFillObject, styles.cardGlassRadius]} pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.22)']}
            start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }}
            style={[StyleSheet.absoluteFillObject, styles.cardGlassRadius]} pointerEvents="none"
          />
          <View style={[StyleSheet.absoluteFillObject, styles.cardBorder, styles.cardGlassRadius]} pointerEvents="none" />
          <View style={styles.cardContent}>
            <View style={styles.cardTop}>
              <Text style={[styles.cardName, { color: colors.primaryLight }]} numberOfLines={1}>
                {getSessionDisplayName(item)}
              </Text>
              <Text style={[styles.cardDate, { color: colors.primaryLight + '50' }]}>
                {format(new Date(item.date), 'MMM d, yyyy')}
              </Text>
            </View>
            <View style={styles.cardStats}>
              <View style={[styles.statPill, { backgroundColor: colors.primaryLight + '10' }]}>
                <Clock size={13} color={colors.primaryLight + '70'} />
                <Text style={[styles.statText, { color: colors.primaryLight + 'CC' }]}>{item.duration}m</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: colors.primaryLight + '10' }]}>
                <ChartBar size={13} color={colors.primaryLight + '70'} />
                <Text style={[styles.statText, { color: colors.primaryLight + 'CC' }]}>
                  {volumeStr} {weightUnit}
                </Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: colors.primaryLight + '10' }]}>
                <Barbell size={13} color={colors.primaryLight + '70'} />
                <Text style={[styles.statText, { color: colors.primaryLight + 'CC' }]}>
                  {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      <HomeGradientBackground />

      <StickyGlassHeader
        title=""
        leftSlot={null}
        topPadding={8}
        topSlotMarginBottom={2}
        topSlot={
          <Animated.View style={styles.pillRow} layout={Layout.springify().damping(32).stiffness(260)}>
            {backButton}
            <Animated.View style={styles.pillsRight} layout={Layout.springify().damping(32).stiffness(260)}>
              <View style={{ flexShrink: 0 }}>
                <LiquidGlassSegmented
                  options={[
                    { key: 'week', label: 'Week' },
                    { key: 'month', label: 'Month' },
                    { key: 'year', label: 'Year' },
                    { key: 'all', label: 'All' },
                  ]}
                  value={timeRange}
                  width={timeRange === 'all' ? SEG_W_FULL : SEG_W_WITH_PILL}
                  onChange={(k) => {
                    setTimeRange(k as TimeRange);
                    setDropOpen(null);
                    setDropLayout(null);
                  }}
                />
              </View>
              {timeRange === 'week' && (
                <Animated.View ref={weekPillRef} collapsable={false} entering={FadeIn.duration(240)}>
                  <LiquidGlassPill
                    label={getWeekLabelShort(selWeekStart)}
                    scrubEnabled={false}
                    chevron
                    onPress={() => {
                      weekPillRef.current?.measureInWindow((x, y, w, h) => {
                        setDropLayout({ x, y, width: w, height: h });
                        setDropOpen('week');
                      });
                    }}
                  />
                </Animated.View>
              )}
              {timeRange === 'month' && (
                <Animated.View ref={monthPillRef} collapsable={false} entering={FadeIn.duration(240)}>
                  <LiquidGlassPill
                    label={`${MONTH_NAMES[selMonth]} ${selYear}`}
                    scrubEnabled={false}
                    chevron
                    onPress={() => {
                      monthPillRef.current?.measureInWindow((x, y, w, h) => {
                        setDropLayout({ x, y, width: w, height: h });
                        setDropOpen('month');
                      });
                    }}
                  />
                </Animated.View>
              )}
              {timeRange === 'year' && (
                <Animated.View ref={yearPillRef} collapsable={false} entering={FadeIn.duration(240)}>
                  <LiquidGlassPill
                    label={String(selYear)}
                    scrubEnabled={false}
                    chevron
                    onPress={() => {
                      yearPillRef.current?.measureInWindow((x, y, w, h) => {
                        setDropLayout({ x, y, width: w, height: h });
                        setDropOpen('year');
                      });
                    }}
                  />
                </Animated.View>
              )}
            </Animated.View>
          </Animated.View>
        }
        scrollY={scrollY}
        onLayout={setHeaderHeight}
      />

      {loading ? (
        <ActivityIndicator
          style={[styles.loader, { paddingTop: headerHeight + 40, zIndex: 2 }]}
          color={colors.primaryLight + '80'}
        />
      ) : (
        <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight + 8, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          <View style={styles.titleRowScroll}>
            <View>
              <Text style={styles.sectionTitle}>history.</Text>
              <Text style={styles.sectionSub}>{headerSubtitle}</Text>
            </View>
          </View>

          {dropOpen === 'week' && (
            <DropdownModal
              onClose={() => { setDropOpen(null); setDropLayout(null); }}
              triggerLayout={dropLayout}
            >
              <ScrollView style={{ maxHeight: 210 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {availableWeeks.map((ws) => {
                  const key = format(ws, 'yyyy-MM-dd');
                  const isSel = format(selWeekStart, 'yyyy-MM-dd') === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelWeekStart(ws);
                        setDropOpen(null);
                        setDropLayout(null);
                      }}
                      style={[dd.item, isSel && dd.itemSel]}
                    >
                      <Text style={[dd.itemTxt, isSel && dd.itemTxtSel]}>{getWeekLabel(ws)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </DropdownModal>
          )}

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

          {filteredSessions.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyPrimary, { color: colors.primaryLight + '30' }]}>
                No workouts in this period.
              </Text>
              <Text style={[styles.emptySecondary, { color: colors.primaryLight + '25' }]}>
                Complete a workout in the selected time frame to see it here.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filteredSessions.map((s) => renderSessionCard(s))}
            </View>
          )}
        </Animated.ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: OUTER_PAD, paddingTop: 8 },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  pillsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
  },
  backChip: { borderRadius: 20, overflow: 'hidden' },
  backChipInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(198,198,198,0.18)',
    overflow: 'hidden',
  },
  titleRowScroll: { alignSelf: 'flex-start', marginBottom: 12 },
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
  list: { gap: 10 },
  loader: { alignSelf: 'center' },
  cardWrap: {
    borderRadius: 16,
    overflow: 'visible' as const,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  cardGlass: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  cardGlassRadius: { borderRadius: 16 },
  cardFill: { backgroundColor: 'rgba(47, 48, 49, 0.30)' },
  cardBorder: { borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },
  cardContent: {
    padding: 18,
    zIndex: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardName: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    flex: 1,
  },
  cardDate: { fontSize: 13, marginTop: 2 },
  cardStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statText: { fontSize: 13, fontWeight: '500' },
  emptyWrap: { alignItems: 'center', marginTop: 40 },
  emptyPrimary: { fontSize: 16, fontWeight: '500', textAlign: 'center' },
  emptySecondary: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 40,
  },
});
