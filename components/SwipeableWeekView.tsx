import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, View, Pressable } from 'react-native';
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

// #region agent log
const _dbg = (location: string, message: string, data: Record<string, unknown>) => {
  fetch('http://127.0.0.1:7242/ingest/24d86888-ef82-444e-aad8-90b62a37b0c8', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location, message, data, timestamp: Date.now() }) }).catch(() => {});
};
// #endregion

const SCREEN_WIDTH = Dimensions.get('window').width;
const VELOCITY_THRESHOLD = 500;
const DISTANCE_THRESHOLD_PCT = 0.3;
const SNAP_SPRING_CONFIG = { damping: 22, stiffness: 220, mass: 0.8, overshootClamping: false };
const CANCEL_SPRING_CONFIG = { damping: 26, stiffness: 250, mass: 0.7, overshootClamping: true };
const DAY_LABELS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;

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

function formatHeader(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const monthA = monday.toLocaleString('default', { month: 'short' });
  const monthB = sunday.toLocaleString('default', { month: 'short' });
  return monthA !== monthB ? `${monthA} – ${monthB} ${sunday.getFullYear()}` : `${monthA} ${sunday.getFullYear()}`;
}

interface WeekStripProps {
  monday: Date;
  today: Date;
  selectedDate: Date;
  onDayPress: (date: Date) => void;
  weekWidth: number;
}

const WeekStrip = React.memo(({ monday, today, selectedDate, onDayPress, weekWidth }: WeekStripProps) => {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  }), [monday.getTime()]);
  // #region agent log
  const weekStart = monday.getTime();
  const selTime = selectedDate.getTime();
  const selectedWeekStart = getMonday(selectedDate).getTime();
  const hasSelectedInWeek = weekStart <= selTime && selTime < weekStart + 7 * 24 * 60 * 60 * 1000;
  useEffect(() => {
    _dbg('SwipeableWeekView.tsx:WeekStrip', 'WeekStrip render', { hypothesisId: 'H3', weekStart, selTime, hasSelectedInWeek, selectedWeekStart });
  }, [weekStart, selTime, hasSelectedInWeek, selectedWeekStart]);
  // #endregion

  return (
    <View style={[styles.weekStrip, { width: weekWidth }]}>
      {days.map((date, i) => {
        const isSelected = isSameDay(date, selectedDate);
        return (
          <Pressable key={i} style={styles.dayColumn} onPress={() => onDayPress(date)}>
            {isSelected ? (
              <View style={styles.dayCardSelected}>
                <Text style={styles.dayCardLabel}>{DAY_LABELS[i]}</Text>
                <Text style={styles.dayCardNumber}>{date.getDate()}</Text>
              </View>
            ) : (
              <View style={styles.dayUnselectedWrap}>
                <Text style={[styles.dayLabel, styles.dayLabelGrey]}>{DAY_LABELS[i]}</Text>
                <Text style={[styles.dayNumber, styles.dayNumberGrey]}>{date.getDate()}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

export interface SwipeableWeekViewProps {
  weekWidth?: number;
  selectedDate?: Date;
  onDaySelect?: (date: Date) => void;
  onWeekChange?: (monday: Date) => void;
  initialDate?: Date;
  showHeader?: boolean;
}

export default function SwipeableWeekView({
  weekWidth = SCREEN_WIDTH,
  selectedDate: controlledSelectedDate,
  onDaySelect,
  onWeekChange,
  initialDate,
  showHeader = false,
}: SwipeableWeekViewProps) {
  const today = useMemo(() => new Date(), []);
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(initialDate ?? today));
  const [internalSelectedDate, setInternalSelectedDate] = useState(initialDate ?? today);
  const selectedDate = controlledSelectedDate ?? internalSelectedDate;
  const distThreshold = weekWidth * DISTANCE_THRESHOLD_PCT;

  const translateX = useSharedValue(0);
  const isAnimating = useSharedValue(false);
  const pendingConveyorReset = useRef(false);
  const prevMonday = useMemo(() => shiftWeek(currentMonday, -1), [currentMonday]);
  const nextMonday = useMemo(() => shiftWeek(currentMonday, 1), [currentMonday]);

  // Sync currentMonday from parent when controlled selected date's week changes (e.g. user tapped day in another week)
  const controlledWeekTime = controlledSelectedDate != null ? getMonday(controlledSelectedDate).getTime() : null;
  useEffect(() => {
    if (controlledWeekTime == null) return;
    setCurrentMonday((prev) => {
      if (prev.getTime() === controlledWeekTime) return prev;
      return new Date(controlledWeekTime);
    });
  }, [controlledWeekTime]);

  // #region agent log
  const selectedDateWeekMonday = getMonday(selectedDate).getTime();
  const currentMondayTime = currentMonday.getTime();
  const desync = selectedDateWeekMonday !== currentMondayTime;
  useEffect(() => {
    _dbg('SwipeableWeekView.tsx:sync', 'currentMonday vs selectedDate week', { hypothesisId: 'H1', currentMondayTime, selectedDateWeekMonday, desync, controlled: controlledSelectedDate != null });
  }, [currentMondayTime, selectedDateWeekMonday, desync, controlledSelectedDate != null]);
  // #endregion

  const resetConveyorPosition = useCallback(() => {
    translateX.value = 0;
    isAnimating.value = false;
  }, []);

  useLayoutEffect(() => {
    // #region agent log
    if (pendingConveyorReset.current) {
      _dbg('SwipeableWeekView.tsx:resetEffect', 'reset conveyor running', { hypothesisId: 'H5', currentMondayTime: currentMonday.getTime() });
    }
    // #endregion
    if (pendingConveyorReset.current) {
      pendingConveyorReset.current = false;
      resetConveyorPosition();
    }
  }, [currentMonday, resetConveyorPosition]);

  const commitWeekChange = useCallback((direction: -1 | 1) => {
    const newMonday = shiftWeek(currentMonday, direction);
    // #region agent log
    _dbg('SwipeableWeekView.tsx:commitWeekChange', 'commit week change', { hypothesisId: 'H1', direction, newMondayTime: newMonday.getTime(), prevCurrent: currentMonday.getTime() });
    // #endregion
    pendingConveyorReset.current = true;
    setCurrentMonday(newMonday);
    const dayOffset = Math.round((selectedDate.getTime() - currentMonday.getTime()) / (1000 * 60 * 60 * 24));
    const newSelected = new Date(newMonday);
    newSelected.setDate(newMonday.getDate() + Math.max(0, Math.min(6, dayOffset)));
    if (controlledSelectedDate == null) setInternalSelectedDate(newSelected);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onWeekChange?.(newMonday);
  }, [currentMonday, selectedDate, controlledSelectedDate, onWeekChange]);

  const handleDayPress = useCallback((date: Date) => {
    if (controlledSelectedDate == null) setInternalSelectedDate(date);
    Haptics.selectionAsync();
    onDaySelect?.(date);
  }, [controlledSelectedDate, onDaySelect]);

  const panGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-15, 15])
      .onUpdate((e) => {
        if (isAnimating.value) return;
        translateX.value = e.translationX;
      })
      .onEnd((e) => {
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
              if (finished) {
                translateX.value = -direction * weekWidth;
                runOnJS(commitWeekChange)(direction);
              }
            }
          );
        } else {
          translateX.value = withSpring(0, { ...CANCEL_SPRING_CONFIG, velocity: vx });
        }
      }),
    [weekWidth, distThreshold, commitWeekChange]
  );

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

  return (
    <View style={styles.rootContainer}>
      {showHeader && <Text style={styles.headerText}>{formatHeader(currentMonday)}</Text>}
      <View style={[styles.swipeContainer, { width: weekWidth }]}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.conveyor, { width: weekWidth * 3 }, conveyorStyle]}>
            <Animated.View style={[styles.weekSlot, { width: weekWidth }, prevWeekOpacity]}>
              <WeekStrip monday={prevMonday} today={today} selectedDate={selectedDate} onDayPress={handleDayPress} weekWidth={weekWidth} />
            </Animated.View>
            <Animated.View style={[styles.weekSlot, { width: weekWidth }, currentWeekOpacity]}>
              <WeekStrip monday={currentMonday} today={today} selectedDate={selectedDate} onDayPress={handleDayPress} weekWidth={weekWidth} />
            </Animated.View>
            <Animated.View style={[styles.weekSlot, { width: weekWidth }, nextWeekOpacity]}>
              <WeekStrip monday={nextMonday} today={today} selectedDate={selectedDate} onDayPress={handleDayPress} weekWidth={weekWidth} />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: { width: '100%' },
  headerText: { color: Colors.primaryLight, fontSize: Typography.label, fontWeight: '600', textAlign: 'center', marginBottom: Spacing.sm, opacity: 0.7 },
  swipeContainer: {
    overflow: 'hidden',
    marginBottom: Spacing.md,
    minHeight: 53 + Spacing.sm * 2, // fixed height region so strip never jolts vertically when content height varies
  },
  conveyor: { flexDirection: 'row', alignItems: 'stretch' },
  weekSlot: { alignSelf: 'stretch', alignItems: 'flex-start' }, // strip top-aligned in slot so prev/next (shorter) don't jump vertically when peeking
  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    height: 53 + Spacing.sm * 2, // fixed so prev/current/next same height → no vertical misalignment when peeking
  },
  dayColumn: { alignItems: 'center', justifyContent: 'center', flex: 1, overflow: 'visible' },
  dayUnselectedWrap: { height: 53, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, overflow: 'visible' }, // padding so label glyphs (o, a, e) don't clip
  dayLabel: { fontSize: Typography.label, fontWeight: '500', textTransform: 'lowercase', letterSpacing: Typography.label * -0.12, paddingHorizontal: 2 },
  dayLabelGrey: { color: Colors.primaryLight },
  dayNumber: { fontSize: Typography.body, fontWeight: '500', letterSpacing: Typography.body * -0.03, marginTop: Spacing.xs },
  dayNumberGrey: { color: Colors.primaryLight },
  dayCardSelected: {
    width: 50,
    height: 53,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#C6C6C6',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8, // so label glyphs (o, a, e) don't clip at edges
    overflow: 'visible',
  },
  dayCardLabel: {
    fontSize: Typography.label,
    fontWeight: '500',
    textTransform: 'lowercase',
    letterSpacing: Typography.label * -0.12,
    color: Colors.white,
    paddingHorizontal: 2,
  },
  dayCardNumber: {
    fontSize: Typography.body,
    fontWeight: '500',
    letterSpacing: Typography.body * -0.03,
    color: Colors.white,
    marginTop: 2,
  },
});
