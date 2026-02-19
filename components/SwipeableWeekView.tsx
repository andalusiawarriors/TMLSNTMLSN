import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// #region agent log
const _dbg = (msg: string, data?: object) => { fetch('http://127.0.0.1:7243/ingest/d7e803ab-9a90-4a93-8bc3-01772338bb68',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SwipeableWeekView',message:msg,data:data??{},timestamp:Date.now()})}).catch(()=>{}); };
// #endregion
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing } from '../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const VELOCITY_THRESHOLD = 500;
const DISTANCE_THRESHOLD_PCT = 0.3;
const SNAP_SPRING_CONFIG = { damping: 22, stiffness: 220, mass: 0.8, overshootClamping: false };
const CANCEL_SPRING_CONFIG = { damping: 26, stiffness: 250, mass: 0.7, overshootClamping: true };
const DAY_LABELS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;

const SELECTION_SPRING = { damping: 18, stiffness: 200 };
const SLIDING_HIGHLIGHT_SCALE = 0.82;
const LONG_PRESS_MS = 420;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function shiftWeek(monday: Date, weeks: number): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isPastDay(date: Date, today: Date): boolean {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const t = new Date(today); t.setHours(0, 0, 0, 0);
  return d.getTime() < t.getTime();
}

function isFutureDay(date: Date, today: Date): boolean {
  return !isSameDay(date, today) && !isPastDay(date, today);
}

function formatHeader(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const monthA = monday.toLocaleString('default', { month: 'short' });
  const monthB = sunday.toLocaleString('default', { month: 'short' });
  return monthA !== monthB ? `${monthA} – ${monthB} ${sunday.getFullYear()}` : `${monthA} ${sunday.getFullYear()}`;
}

const DAY_COLUMN_MARGIN = 4;
const PILL_WIDTH = 42;
const PILL_HEIGHT = 54;
const PILL_RADIUS = 12;
const DATE_CIRCLE_SIZE = 26;
const CARD_BORDER_GRADIENT: [string, string] = ['#525354', '#48494A'];
const CARD_FILL_GRADIENT: [string, string] = ['#363738', '#2E2F30'];
const CARD_BORDER_INSET = 1;
const UNSELECTED_BG = '#252627';

function dayIndexFromX(x: number, weekWidth: number): number {
  const padding = Spacing.sm;
  const margin = DAY_COLUMN_MARGIN;
  const columnPitch = (weekWidth - 2 * padding) / 7;
  const startOffset = padding + margin;
  return Math.min(6, Math.max(0, Math.floor((x - startOffset) / columnPitch)));
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type DayStatus = 'none' | 'miss' | 'hit';

// ─── DayCell (pure visual) ─────────────────────────────────────────────────────

interface DayCellProps {
  date: Date;
  index: number;
  isSelected: boolean;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  isSlidingHighlight: boolean;
  isHovered: boolean;
  dayStatus?: DayStatus;
  onPress?: () => void;
}

function DayCell({ date, index, isSelected, isToday, isPast, isFuture, isSlidingHighlight, isHovered, dayStatus = 'none', onPress }: DayCellProps) {
  const selectedOrHovered = isSelected || isHovered;
  const labelText = DAY_LABELS[index];
  const numText = date.getDate();

  const dateCircle = (numberStyle: object, circleStyle?: object) => (
    <View style={[styles.dateCircle, { width: DATE_CIRCLE_SIZE, height: DATE_CIRCLE_SIZE, borderRadius: DATE_CIRCLE_SIZE / 2 }, circleStyle]}>
      <Text style={numberStyle}>{numText}</Text>
    </View>
  );

  const wrap = (content: React.ReactNode) => (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
      {content}
    </Pressable>
  );

  const getCircleStyle = () => {
    if (isToday) return styles.dateCircleToday;
    if (dayStatus === 'none') return selectedOrHovered ? styles.dateCircleDashedSelected : styles.dateCircleDashedPlain;
    return selectedOrHovered ? styles.dateCircleSelected : styles.dateCirclePlain;
  };

  if (selectedOrHovered) {
    return (
      <View style={styles.dayColumn}>
        {wrap(
          <View style={[styles.dayCardSelectedWrap, { width: PILL_WIDTH, height: PILL_HEIGHT }]}>
            <LinearGradient
              colors={CARD_BORDER_GRADIENT}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_RADIUS }]}
            />
            <LinearGradient
              colors={CARD_FILL_GRADIENT}
              style={{
                position: 'absolute',
                top: CARD_BORDER_INSET,
                left: CARD_BORDER_INSET,
                right: CARD_BORDER_INSET,
                bottom: CARD_BORDER_INSET,
                borderRadius: PILL_RADIUS - CARD_BORDER_INSET,
              }}
            />
            <View style={styles.dayCardInner}>
              <Text style={styles.dayCardLabel}>{labelText}</Text>
              {dateCircle(styles.dayCardNumber, getCircleStyle())}
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.dayColumn, isPast && { opacity: 0.7 }]}>
      {wrap(
        <View style={styles.dayCardPlain}>
          <Text style={styles.dayCardPlainLabel}>{labelText}</Text>
          {dateCircle(styles.dayCardPlainNumber, getCircleStyle())}
        </View>
      )}
    </View>
  );
}

// ─── WeekStrip (pure visual — no gestures) ─────────────────────────────────────

interface WeekStripProps {
  monday: Date;
  today: Date;
  selectedDate: Date;
  weekWidth: number;
  slidingDateMode: boolean;
  hoveredDayIndex: number | null;
  dayStatusByDate?: Record<string, DayStatus>;
  onDayPress?: (date: Date) => void;
}

const WeekStrip = React.memo(({ monday, today, selectedDate, weekWidth, slidingDateMode, hoveredDayIndex, dayStatusByDate, onDayPress }: WeekStripProps) => {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  }), [monday.getTime()]);

  const selectedInThisWeek = getMonday(selectedDate).getTime() === monday.getTime();

  return (
    <View style={[styles.weekStrip, { width: weekWidth }]} collapsable={false}>
      {days.map((date, i) => {
        const isSelected = isSameDay(date, selectedDate);
        const dateKey = toDateString(date);
        const dayStatus = dayStatusByDate?.[dateKey] ?? 'none';
        return (
          <DayCell
            key={i}
            date={date}
            index={i}
            isSelected={isSelected}
            isToday={isSameDay(date, today)}
            isPast={isPastDay(date, today)}
            isFuture={isFutureDay(date, today)}
            isSlidingHighlight={isSelected && slidingDateMode}
            isHovered={slidingDateMode && selectedInThisWeek && hoveredDayIndex === i && !isSelected}
            dayStatus={dayStatus}
            onPress={onDayPress ? () => onDayPress(date) : undefined}
          />
        );
      })}
    </View>
  );
});

// ─── Main component ────────────────────────────────────────────────────────────

export interface SwipeableWeekViewProps {
  weekWidth?: number;
  selectedDate?: Date;
  onDaySelect?: (date: Date) => void;
  onWeekChange?: (monday: Date) => void;
  initialDate?: Date;
  showHeader?: boolean;
  dayStatusByDate?: Record<string, DayStatus>;
}

export default function SwipeableWeekView({
  weekWidth = SCREEN_WIDTH,
  selectedDate: controlledSelectedDate,
  onDaySelect,
  onWeekChange,
  initialDate,
  showHeader = false,
  dayStatusByDate,
}: SwipeableWeekViewProps) {
  const today = useMemo(() => new Date(), []);
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(initialDate ?? today));
  const [internalSelectedDate, setInternalSelectedDate] = useState(initialDate ?? today);
  const selectedDate = controlledSelectedDate ?? internalSelectedDate;
  const distThreshold = weekWidth * DISTANCE_THRESHOLD_PCT;

  const translateX = useSharedValue(0);
  const isAnimating = useSharedValue(false);
  const pendingConveyorReset = useRef(false);

  const [slidingDateMode, setSlidingDateMode] = useState(false);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const slidingActive = useSharedValue(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentMondayRef = useRef(currentMonday);
  currentMondayRef.current = currentMonday;

  const prevMonday = useMemo(() => shiftWeek(currentMonday, -1), [currentMonday]);
  const nextMonday = useMemo(() => shiftWeek(currentMonday, 1), [currentMonday]);

  // Sync currentMonday from parent
  const controlledWeekTime = controlledSelectedDate != null ? getMonday(controlledSelectedDate).getTime() : null;
  useEffect(() => {
    if (controlledWeekTime == null) return;
    setCurrentMonday((prev) => (prev.getTime() === controlledWeekTime ? prev : new Date(controlledWeekTime)));
  }, [controlledWeekTime]);

  const resetConveyorPosition = useCallback(() => {
    translateX.value = 0;
    isAnimating.value = false;
    // #region agent log
    _dbg('resetConveyorPosition', { hypothesisId: 'H2' });
    // #endregion
  }, []);

  useLayoutEffect(() => {
    if (pendingConveyorReset.current) {
      pendingConveyorReset.current = false;
      resetConveyorPosition();
    }
  }, [currentMonday, resetConveyorPosition]);

  // ── Week change ──────────────────────────────────────────────────────────────

  const commitWeekChange = useCallback((direction: -1 | 1) => {
    // #region agent log
    _dbg('commitWeekChange', { direction, hypothesisId: 'H5' });
    // #endregion
    const newMonday = shiftWeek(currentMonday, direction);
    pendingConveyorReset.current = true;
    setCurrentMonday(newMonday);
    const dayOffset = Math.round((selectedDate.getTime() - currentMonday.getTime()) / (1000 * 60 * 60 * 24));
    const newSelected = new Date(newMonday);
    newSelected.setDate(newMonday.getDate() + Math.max(0, Math.min(6, dayOffset)));
    if (controlledSelectedDate == null) {
      setInternalSelectedDate(newSelected);
    }
    if (onDaySelect) onDaySelect(newSelected);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onWeekChange?.(newMonday);
  }, [currentMonday, selectedDate, controlledSelectedDate, onWeekChange, onDaySelect]);

  // ── Day press (tap or slide-to-week) ─────────────────────────────────────────

  const handleDayPress = useCallback((date: Date) => {
    const tappedMonday = getMonday(date);
    if (tappedMonday.getTime() === nextMonday.getTime()) {
      // #region agent log
      _dbg('handleDayPress: isAnimating=true tapNext', { hypothesisId: 'H1' });
      // #endregion
      isAnimating.value = true;
      translateX.value = withSpring(-weekWidth, SNAP_SPRING_CONFIG, (finished) => {
        'worklet';
        runOnJS(_dbg)('springCallback tap', { finished, hypothesisId: 'H1' });
        if (finished) runOnJS(commitWeekChange)(1);
      });
    } else if (tappedMonday.getTime() === prevMonday.getTime()) {
      // #region agent log
      _dbg('handleDayPress: isAnimating=true tapPrev', { hypothesisId: 'H1' });
      // #endregion
      isAnimating.value = true;
      translateX.value = withSpring(weekWidth, SNAP_SPRING_CONFIG, (finished) => {
        'worklet';
        runOnJS(_dbg)('springCallback tap', { finished, hypothesisId: 'H1' });
        if (finished) runOnJS(commitWeekChange)(-1);
      });
    }
    if (controlledSelectedDate == null) setInternalSelectedDate(date);
    Haptics.selectionAsync();
    onDaySelect?.(date);
  }, [currentMonday, prevMonday, nextMonday, weekWidth, controlledSelectedDate, onDaySelect, translateX, isAnimating, commitWeekChange]);

  // ── Sliding (long-press) helpers ─────────────────────────────────────────────

  const selectedDayIndex = useMemo(() => {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.min(6, Math.max(0, Math.round((selectedDate.getTime() - currentMonday.getTime()) / msPerDay)));
  }, [currentMonday.getTime(), selectedDate.getTime()]);

  const activateSliding = useCallback(() => {
    slidingActive.value = true;
    setSlidingDateMode(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, [slidingActive]);

  const updateHover = useCallback((x: number) => {
    const idx = dayIndexFromX(x, weekWidth);
    setHoveredDayIndex((prev) => (prev === idx ? prev : idx));
  }, [weekWidth]);

  const commitSliding = useCallback((x: number) => {
    slidingActive.value = false;
    setSlidingDateMode(false);
    const idx = dayIndexFromX(x, weekWidth);
    setHoveredDayIndex(null);
    const mon = currentMondayRef.current;
    const date = new Date(mon);
    date.setDate(mon.getDate() + idx);
    if (controlledSelectedDate == null) setInternalSelectedDate(date);
    Haptics.selectionAsync();
    onDaySelect?.(date);
  }, [weekWidth, controlledSelectedDate, onDaySelect, slidingActive]);

  const cancelSliding = useCallback(() => {
    slidingActive.value = false;
    setSlidingDateMode(false);
    setHoveredDayIndex(null);
  }, [slidingActive]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // ── Tap gesture (day selection) ──────────────────────────────────────────────

  const handleTap = useCallback((x: number) => {
    clearLongPressTimer();
    if (slidingActive.value) return;
    const idx = dayIndexFromX(x, weekWidth);
    const mon = currentMondayRef.current;
    const date = new Date(mon);
    date.setDate(mon.getDate() + idx);
    handleDayPress(date);
  }, [weekWidth, handleDayPress, clearLongPressTimer]);

  const tapGesture = useMemo(() =>
    Gesture.Tap()
      .onEnd((e) => {
        'worklet';
        runOnJS(handleTap)(e.x);
      }),
    [handleTap]
  );

  // ── Pan gesture (week swipe + long-press-to-slide) ───────────────────────────

  const startLongPressTimer = useCallback((startX: number) => {
    clearLongPressTimer();
    const idx = dayIndexFromX(startX, weekWidth);
    if (idx !== selectedDayIndex) return;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      activateSliding();
    }, LONG_PRESS_MS);
  }, [weekWidth, selectedDayIndex, activateSliding, clearLongPressTimer]);

  const logPanBegin = useCallback((x: number) => {
    _dbg('pan onBegin', { x, hypothesisId: 'H4' });
  }, []);
  const logPanEnd = useCallback((dx: number, vx: number, anim: boolean) => {
    _dbg('pan onEnd', { translationX: dx, velocityX: vx, isAnimating: anim, hypothesisId: 'H1' });
  }, []);
  const logSpringPan = useCallback((finished: boolean) => {
    _dbg('springCallback pan', { finished, hypothesisId: 'H1' });
  }, []);

  const panGesture = useMemo(() =>
    Gesture.Pan()
      .minDistance(0)
      .activeOffsetX([-15, 15])
      .failOffsetY([-25, 25])
      .onBegin((e) => {
        'worklet';
        runOnJS(logPanBegin)(e.x);
        runOnJS(startLongPressTimer)(e.x);
      })
      .onUpdate((e) => {
        'worklet';
        if (isAnimating.value) return;
        if (slidingActive.value) {
          runOnJS(clearLongPressTimer)();
          runOnJS(updateHover)(e.x);
        } else {
          // Only start conveyor movement after enough horizontal drag
          if (Math.abs(e.translationX) > 10) {
            runOnJS(clearLongPressTimer)();
            translateX.value = e.translationX;
          }
        }
      })
      .onEnd((e) => {
        'worklet';
        runOnJS(clearLongPressTimer)();
        runOnJS(logPanEnd)(e.translationX, e.velocityX, isAnimating.value);
        if (slidingActive.value) {
          runOnJS(commitSliding)(e.x);
          return;
        }
        if (isAnimating.value) return;
        const { translationX: dx, velocityX: vx } = e;
        const commit = Math.abs(vx) > VELOCITY_THRESHOLD || Math.abs(dx) > distThreshold;
        if (commit) {
          const direction = Math.abs(vx) > VELOCITY_THRESHOLD ? (vx > 0 ? -1 : 1) : dx > 0 ? -1 : 1;
          isAnimating.value = true;
          translateX.value = withSpring(
            -direction * weekWidth,
            { ...SNAP_SPRING_CONFIG, velocity: vx },
            (finished) => {
              'worklet';
              runOnJS(logSpringPan)(finished);
              if (finished) {
                translateX.value = -direction * weekWidth;
                runOnJS(commitWeekChange)(direction);
              }
            }
          );
        } else {
          translateX.value = withSpring(0, { ...CANCEL_SPRING_CONFIG, velocity: vx });
        }
      })
      .onFinalize(() => {
        'worklet';
        runOnJS(clearLongPressTimer)();
      }),
    [weekWidth, distThreshold, commitWeekChange, startLongPressTimer, clearLongPressTimer,
     updateHover, commitSliding, cancelSliding, isAnimating, slidingActive, logPanBegin, logPanEnd, logSpringPan]
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(tapGesture, panGesture),
    [tapGesture, panGesture]
  );

  // ── Animated styles ──────────────────────────────────────────────────────────

  const conveyorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value - weekWidth }] }));
  const currentWeekOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(translateX.value), [0, weekWidth * 0.5, weekWidth], [1, 0.7, 0.4]),
  }));
  const prevWeekOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, weekWidth * 0.3, weekWidth], [0.4, 0.7, 1]),
  }));
  const nextWeekOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-weekWidth, -weekWidth * 0.3, 0], [1, 0.7, 0.4]),
  }));

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.rootContainer}>
      {showHeader && <Text style={styles.headerText}>{formatHeader(currentMonday)}</Text>}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.swipeContainer, { width: weekWidth }]}>
          <Animated.View style={[styles.conveyor, { width: weekWidth * 3 }, conveyorStyle]}>
            <Animated.View style={[styles.weekSlot, { width: weekWidth }, prevWeekOpacity]}>
              <WeekStrip monday={prevMonday} today={today} selectedDate={selectedDate} weekWidth={weekWidth} slidingDateMode={slidingDateMode} hoveredDayIndex={hoveredDayIndex} dayStatusByDate={dayStatusByDate} onDayPress={handleDayPress} />
            </Animated.View>
            <Animated.View style={[styles.weekSlot, { width: weekWidth }, currentWeekOpacity]}>
              <WeekStrip monday={currentMonday} today={today} selectedDate={selectedDate} weekWidth={weekWidth} slidingDateMode={slidingDateMode} hoveredDayIndex={hoveredDayIndex} dayStatusByDate={dayStatusByDate} onDayPress={handleDayPress} />
            </Animated.View>
            <Animated.View style={[styles.weekSlot, { width: weekWidth }, nextWeekOpacity]}>
              <WeekStrip monday={nextMonday} today={today} selectedDate={selectedDate} weekWidth={weekWidth} slidingDateMode={slidingDateMode} hoveredDayIndex={hoveredDayIndex} dayStatusByDate={dayStatusByDate} onDayPress={handleDayPress} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  rootContainer: { width: '100%' },
  headerText: { color: Colors.primaryLight, fontSize: Typography.label, fontWeight: '600', textAlign: 'center', marginBottom: Spacing.sm, opacity: 0.7 },
  swipeContainer: {
    overflow: 'hidden',
    marginBottom: Spacing.md,
    minHeight: PILL_HEIGHT + Spacing.sm * 2,
  },
  conveyor: { flexDirection: 'row', alignItems: 'stretch' },
  weekSlot: { alignSelf: 'stretch', alignItems: 'flex-start' },
  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    height: PILL_HEIGHT + Spacing.sm * 2,
  },
  dayColumn: { alignItems: 'center', justifyContent: 'center', flex: 1, overflow: 'visible', marginHorizontal: DAY_COLUMN_MARGIN },
  dayCardSelectedWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  dayCardInner: {
    position: 'absolute',
    top: CARD_BORDER_INSET,
    left: CARD_BORDER_INSET,
    right: CARD_BORDER_INSET,
    bottom: CARD_BORDER_INSET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  dayCardLabel: {
    fontSize: 11, fontWeight: '500', textTransform: 'lowercase',
    letterSpacing: -0.5, color: Colors.white, paddingHorizontal: 1,
  },
  dayCardNumber: {
    fontSize: 14, fontWeight: '600', letterSpacing: -0.3,
    color: Colors.white, marginTop: 2,
  },
  dayCardPlain: {
    alignItems: 'center', justifyContent: 'center', overflow: 'visible',
    paddingHorizontal: 4, paddingVertical: 4,
  },
  dayCardPlainLabel: {
    fontSize: 11, fontWeight: '500', textTransform: 'lowercase',
    letterSpacing: -0.5, color: Colors.primaryLight, opacity: 0.7, paddingHorizontal: 1,
  },
  dayCardPlainNumber: {
    fontSize: 14, fontWeight: '600', letterSpacing: -0.3,
    color: Colors.primaryLight, opacity: 0.7, marginTop: 2,
  },
  dateCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1,
  },
  dateCircleToday: { borderColor: '#D4B896', borderWidth: 1.5 },
  dateCircleSelected: { borderColor: 'rgba(255,255,255,0.25)' },
  dateCirclePlain: { borderColor: 'rgba(198,198,198,0.25)' },
  dateCircleDashedSelected: { borderColor: 'rgba(255,255,255,0.35)', borderStyle: 'dashed' },
  dateCircleDashedPlain: { borderColor: 'rgba(198,198,198,0.4)', borderStyle: 'dashed' },
});
