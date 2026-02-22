import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  Dimensions,
  ListRenderItem,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import {
  addMonths,
  startOfMonth,
  getDaysInMonth,
  getDay,
  format,
  isToday,
  setDate,
} from 'date-fns';
import { Colors } from '../constants/theme';
import { toDateString } from '../utils/helpers';
import { PillSegmentedControl } from './PillSegmentedControl';
import * as Haptics from 'expo-haptics';

const CONTENT_PADDING = 19;
const CARD_BORDER_GRADIENT: [string, string] = ['#5E5F60', '#434445'];
const CARD_BORDER_GRADIENT_GOLD: [string, string] = [Colors.accentChampagne, Colors.accentChampagneDark];
const CARD_BORDER_GRADIENT_GOLD_THREE: [string, string, string] = [
  Colors.accentChampagne,
  '#BE9E77',
  Colors.accentChampagneDark,
];
const CARD_FILL_GRADIENT: [string, string] = ['#3A3B3C', '#2C2D2E'];
const CLOSE_BUTTON_GRADIENT: [string, string] = ['#4E4F50', '#4A4B4C'];
const CLOSE_BUTTON_FILL: [string, string] = ['#363738', '#2E2F30'];
const CARD_FILL_OPACITY = 1;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Cover same range as year view (±3 years) = 84 months; use 60 each way for 10 years total
const INITIAL_MONTH_OFFSET = 60;
const INITIAL_YEAR_OFFSET = 3;

// Year view date grid (7 columns, percentage-based)
const COLS = 7;
const MINI_DATE_ROW_HEIGHT = 18;

// Year view mini card
const MAX_ROWS = 6;
const MINI_TITLE_HEIGHT = 24;
const MINI_CARD_PADDING = 6;
const QUARTER_ROW_GAP = 16;
const MINI_CARD_HORIZONTAL_GAP = 8;
const YEAR_CARD_PADDING = 16;
const YEAR_CARD_PADDING_H = 12;
const MINI_CARD_WIDTH_YEAR = (SCREEN_WIDTH - CONTENT_PADDING * 2 - YEAR_CARD_PADDING_H * 2 - MINI_CARD_HORIZONTAL_GAP * 2) / 3;
const COL_WIDTH_PCT = '14.2857%';

export type CalendarOverlayProps = {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
};

// Week starts Monday (0 = Monday, 6 = Sunday)
function getMondayBasedWeekday(d: Date): number {
  const jsDay = getDay(d);
  return jsDay === 0 ? 6 : jsDay - 1;
}

function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const first = startOfMonth(new Date(year, month, 1));
  const daysInMonth = getDaysInMonth(first);
  const startOffset = getMondayBasedWeekday(first);

  const rows: (number | null)[][] = [];
  let row: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) row.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null);
    rows.push(row);
  }
  return rows;
}

type MonthItem = { type: 'month'; date: Date; index: number };
type YearItem = { type: 'year'; year: number; index: number };

const TOGGLE_HEIGHT = 30;
const MONTH_GAP = 12;

export function CalendarOverlay({ visible, onClose, selectedDate, onSelectDate }: CalendarOverlayProps) {
  const [calendarMode, setCalendarMode] = useState<'Month' | 'Year'>('Month');
  const monthListRef = useRef<FlatList<MonthItem>>(null);
  const yearListRef = useRef<FlatList<YearItem>>(null);

  const today = useMemo(() => new Date(), []);
  const selectedDateStr = toDateString(selectedDate);

  const headerTop = 54; // Match home screen profile pic distance from top
  const HEADER_ROW_HEIGHT = 40;
  const headerHeight = headerTop + HEADER_ROW_HEIGHT;
  const monthScrollHeight = SCREEN_HEIGHT - headerHeight;
  const MONTH_CARD_HEIGHT = Math.floor((monthScrollHeight - MONTH_GAP) / 2) - Math.floor(MONTH_GAP / 2);

  // Year view: size content to fill one screen
  const yearAvailableHeight = SCREEN_HEIGHT - headerHeight - 10;
  const yearContentFixed = yearAvailableHeight - YEAR_CARD_PADDING * 2 - 28 - 12 - 3 * QUARTER_ROW_GAP;
  const FIXED_MINI_CARD_HEIGHT = Math.floor(yearContentFixed / 4);
  // MINI_DATE_ROW_HEIGHT is fixed; grid uses percentage-based cells
  const YEAR_CARD_HEIGHT = YEAR_CARD_PADDING * 2 + 28 + 12 + 4 * FIXED_MINI_CARD_HEIGHT + 3 * QUARTER_ROW_GAP + 10;

  const monthData = useMemo(() => {
    const items: MonthItem[] = [];
    for (let i = -INITIAL_MONTH_OFFSET; i <= INITIAL_MONTH_OFFSET; i++) {
      const d = addMonths(today, i);
      items.push({ type: 'month', date: d, index: i + INITIAL_MONTH_OFFSET });
    }
    return items;
  }, [today]);

  const yearData = useMemo(() => {
    const items: YearItem[] = [];
    const currentYear = today.getFullYear();
    for (let i = -INITIAL_YEAR_OFFSET; i <= INITIAL_YEAR_OFFSET; i++) {
      items.push({ type: 'year', year: currentYear + i, index: i + INITIAL_YEAR_OFFSET });
    }
    return items;
  }, [today]);

  const closeScale = useSharedValue(1);
  const overlayScale = useSharedValue(0.92);
  const overlayOpacity = useSharedValue(0);
  const monthViewOpacity = useSharedValue(1);
  const monthViewScale = useSharedValue(1);
  const yearViewOpacity = useSharedValue(0);
  const yearViewScale = useSharedValue(0.85);

  // Pop-in when calendar opens (date click): overlay + month view both fade in and zoom in
  // useLayoutEffect runs before paint so animation starts immediately, reducing perceived delay
  useLayoutEffect(() => {
    if (visible) {
      setCalendarMode('Month');
      overlayScale.value = 0.92;
      overlayOpacity.value = 0;
      monthViewScale.value = 0.9;
      monthViewOpacity.value = 0;
      overlayScale.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
      overlayOpacity.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
      monthViewScale.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
      monthViewOpacity.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    }
  }, [visible]);

  // Year toggle: zoom out (Month→Year) / zoom in (Year→Month)
  useEffect(() => {
    if (calendarMode === 'Month') {
      monthViewOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
      monthViewScale.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
      yearViewOpacity.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
      yearViewScale.value = withTiming(0.85, { duration: 320, easing: Easing.out(Easing.cubic) });
    } else {
      // Zoom out to year view
      monthViewOpacity.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
      monthViewScale.value = withTiming(0.78, { duration: 320, easing: Easing.out(Easing.cubic) });
      yearViewOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
      yearViewScale.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    }
  }, [calendarMode]);

  const closeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: closeScale.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [{ scale: overlayScale.value }],
  }));

  const monthViewStyle = useAnimatedStyle(() => ({
    opacity: monthViewOpacity.value,
    transform: [{ scale: monthViewScale.value }],
  }));

  const yearViewStyle = useAnimatedStyle(() => ({
    opacity: yearViewOpacity.value,
    transform: [{ scale: yearViewScale.value }],
  }));

  const handleCloseAfterZoomOut = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleCloseWithAnimation = useCallback(() => {
    overlayScale.value = withTiming(0.92, { duration: 240, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(handleCloseAfterZoomOut)();
    });
    overlayOpacity.value = withTiming(0, { duration: 240, easing: Easing.in(Easing.cubic) });
  }, [handleCloseAfterZoomOut, overlayScale, overlayOpacity]);

  const handleDatePress = useCallback(
    (date: Date) => {
      onSelectDate(date);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      handleCloseWithAnimation();
    },
    [onSelectDate, handleCloseWithAnimation]
  );

  const handleMonthPressInYearView = useCallback(
    (year: number, month: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Zoom in from year view: start small, animate to full
      monthViewScale.value = 0.65;
      setCalendarMode('Month');
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const monthOffset = (year - todayYear) * 12 + (month - todayMonth);
      const idx = monthOffset + INITIAL_MONTH_OFFSET;
      if (idx >= 0 && idx < monthData.length && monthListRef.current) {
        setTimeout(() => {
          monthListRef.current?.scrollToIndex({
            index: idx,
            animated: true,
            viewPosition: 0,
          });
        }, 320);
      }
    },
    [monthData.length, today, monthViewScale]
  );

  const renderMonthCard: ListRenderItem<MonthItem> = useCallback(
    ({ item }) => {
      const { date } = item;
      const year = date.getFullYear();
      const month = date.getMonth();
      const grid = buildMonthGrid(year, month);
      const monthName = format(date, 'MMMM');
      const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
      return (
        <View style={[styles.monthCardWrap, { height: MONTH_CARD_HEIGHT }]}>
          <LinearGradient
            colors={isCurrentMonth ? CARD_BORDER_GRADIENT_GOLD : CARD_BORDER_GRADIENT}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.monthCardBorder, { borderRadius: 16 }]}
          />
          <LinearGradient
            colors={CARD_FILL_GRADIENT}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.monthCardFill, { borderRadius: 15, opacity: CARD_FILL_OPACITY }]}
          />
          <View style={[styles.monthCardContent, { flex: 1 }]} pointerEvents="box-none">
            {isCurrentMonth ? (
              <MaskedView
                maskElement={<Text style={[styles.monthTitle, { backgroundColor: 'transparent' }]}>{monthName}</Text>}
              >
                <LinearGradient
                  colors={CARD_BORDER_GRADIENT_GOLD}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={[styles.monthTitle, { opacity: 0 }]}>{monthName}</Text>
                </LinearGradient>
              </MaskedView>
            ) : (
              <Text style={styles.monthTitle}>{monthName}</Text>
            )}
            <View style={styles.monthDowRow}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <Text key={i} style={styles.monthDowCell}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.monthDateGridWrap}>
            {grid.map((row, ri) => (
              <View key={ri} style={styles.monthDateRow}>
                {row.map((day, di) => {
                  if (day === null) return <View key={di} style={styles.monthDateCell} />;
                  const cellDate = setDate(date, day);
                  const isSelected = toDateString(cellDate) === selectedDateStr;
                  const isTodayDate = isToday(cellDate);

                  return (
                    <Pressable
                      key={di}
                      style={[styles.monthDateCell, styles.monthDateCellPressable]}
                      onPress={() => handleDatePress(cellDate)}
                    >
                      {isTodayDate ? (
                        <View style={styles.monthDateCellTodayWrapper}>
                          <Text style={styles.todayLabel}>TODAY</Text>
                          <LinearGradient
                            colors={CARD_BORDER_GRADIENT_GOLD}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={styles.monthDateCellTodayGradient}
                          >
                            <Text style={styles.monthDateCellTextTodayGold}>{day}</Text>
                          </LinearGradient>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.monthDateCellInner,
                            isSelected && styles.monthDateCellSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.monthDateCellText,
                              isSelected && styles.monthDateCellTextSelected,
                            ]}
                          >
                            {day}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            </View>
          </View>
        </View>
      );
    },
    [selectedDateStr, handleDatePress, today, MONTH_CARD_HEIGHT]
  );

  const renderYearCard: ListRenderItem<YearItem> = useCallback(
    ({ item }) => {
      const { year } = item;
      const months = Array.from({ length: 12 }, (_, m) => ({ year, month: m }));
      const isCurrentYear = year === today.getFullYear();

      return (
        <View style={[styles.yearCardOuter, { marginBottom: 10 }]}>
          <LinearGradient
            colors={isCurrentYear ? CARD_BORDER_GRADIENT_GOLD : CARD_BORDER_GRADIENT}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.yearCardBorder, { borderRadius: 16 }]}
          />
          <LinearGradient
            colors={CARD_FILL_GRADIENT}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.yearCardFill, { borderRadius: 15, opacity: 1 }]}
          />
          <View style={styles.yearCardContent}>
            {isCurrentYear ? (
              <MaskedView
                maskElement={<Text style={[styles.yearTitle, { backgroundColor: 'transparent' }]}>{year}</Text>}
                style={styles.yearTitleGradientWrap}
              >
                <LinearGradient
                  colors={CARD_BORDER_GRADIENT_GOLD_THREE}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Text style={[styles.yearTitle, { opacity: 0 }]}>{year}</Text>
              </MaskedView>
            ) : (
              <Text style={styles.yearTitle}>{year}</Text>
            )}
            <View style={[styles.yearGrid]}>
            {months.map(({ year: y, month: m }) => (
              <MiniMonthCard
                key={`${y}-${m}`}
                year={y}
                month={m}
                selectedDateStr={selectedDateStr}
                onMonthPress={handleMonthPressInYearView}
                fixedHeight={FIXED_MINI_CARD_HEIGHT}
              />
            ))}
            </View>
          </View>
        </View>
      );
    },
    [selectedDateStr, handleMonthPressInYearView, today, FIXED_MINI_CARD_HEIGHT]
  );

  const getMonthItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: MONTH_CARD_HEIGHT + MONTH_GAP,
      offset: (MONTH_CARD_HEIGHT + MONTH_GAP) * index,
      index,
    }),
    [MONTH_CARD_HEIGHT]
  );

  const getYearItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: YEAR_CARD_HEIGHT,
      offset: YEAR_CARD_HEIGHT * index,
      index,
    }),
    [YEAR_CARD_HEIGHT]
  );

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={handleCloseWithAnimation} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, overlayAnimatedStyle]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.tintOverlay]} />
          <View style={[StyleSheet.absoluteFill, styles.content]}>
          {/* Header row: close button + toggle, 10px from notch */}
          <View style={[styles.headerRow, { top: headerTop }]}>
            <Pressable
              style={styles.closeButton}
              onPress={handleCloseWithAnimation}
              onPressIn={() => {
                closeScale.value = withTiming(0.99, { duration: 100, easing: Easing.out(Easing.cubic) });
              }}
              onPressOut={() => {
                closeScale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) });
              }}
            >
              <Animated.View style={[styles.closeButtonInner, closeAnimatedStyle]}>
                <LinearGradient
                  colors={CLOSE_BUTTON_GRADIENT}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
                />
                <LinearGradient
                  colors={CLOSE_BUTTON_FILL}
                  style={[StyleSheet.absoluteFillObject, styles.closeButtonFill]}
                />
                <Ionicons name="close" size={18} color="#C6C6C6" />
              </Animated.View>
            </Pressable>

            <View style={styles.calendarToggle}>
              <PillSegmentedControl
                value={calendarMode}
                onValueChange={(v) => setCalendarMode(v as 'Month' | 'Year')}
                segments={['Month', 'Year']}
                width={160}
              />
            </View>

            <View style={{ width: 40 }} />
          </View>

          {/* Month view — full height, content flows beyond top/bottom edges */}
          <Animated.View style={[styles.listWrap, { top: 0, bottom: 0 }, monthViewStyle]} pointerEvents={calendarMode === 'Month' ? 'auto' : 'none'}>
            <FlatList
              ref={monthListRef}
              data={monthData}
              renderItem={renderMonthCard}
              keyExtractor={(item) => `${item.date.getFullYear()}-${item.date.getMonth()}`}
              getItemLayout={getMonthItemLayout}
              initialScrollIndex={INITIAL_MONTH_OFFSET}
              ItemSeparatorComponent={() => <View style={{ height: MONTH_GAP }} />}
              showsVerticalScrollIndicator
              bounces
              contentContainerStyle={[styles.monthListContent, { paddingTop: headerHeight + 10 }]}
            />
          </Animated.View>

          {/* Year view — full height, content flows beyond top/bottom edges */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.yearViewWrap, { top: 0, bottom: 0 }, yearViewStyle]} pointerEvents={calendarMode === 'Year' ? 'auto' : 'none'}>
            <FlatList
              ref={yearListRef}
              data={yearData}
              renderItem={renderYearCard}
              keyExtractor={(item) => String(item.year)}
              getItemLayout={getYearItemLayout}
              initialScrollIndex={INITIAL_YEAR_OFFSET}
              showsVerticalScrollIndicator
              bounces
              contentContainerStyle={[styles.yearListContent, { paddingTop: headerHeight + 10 }]}
            />
          </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MiniMonthCard({
  year,
  month,
  selectedDateStr,
  onMonthPress,
  fixedHeight,
}: {
  year: number;
  month: number;
  selectedDateStr: string;
  onMonthPress: (year: number, month: number) => void;
  fixedHeight: number;
}) {
  const date = new Date(year, month, 1);
  const rawGrid = buildMonthGrid(year, month);
  const todayDate = new Date();
  const todayYear = todayDate.getFullYear();
  const todayMonth = todayDate.getMonth();
  const todayDay = todayDate.getDate();
  const isCurrentMonth = year === todayYear && month === todayMonth;

  // Pad to exactly MAX_ROWS for consistent card height
  const grid: (number | null)[][] = [];
  for (let r = 0; r < MAX_ROWS; r++) {
    grid.push(rawGrid[r] ?? Array(COLS).fill(null));
  }

  const isToday = (d: number | null) =>
    d !== null && year === todayYear && month === todayMonth && d === todayDay;

  return (
    <Pressable style={[styles.miniMonthBlock, { height: fixedHeight }]} onPress={() => onMonthPress(year, month)}>
      <View style={styles.miniMonthBlockContent}>
        <Text style={[styles.miniMonthName, isCurrentMonth && styles.miniMonthNameCurrent]}>{format(date, 'MMM')}</Text>
        <View style={styles.miniGrid}>
          {grid.map((row, ri) => (
            <View key={ri} style={[styles.miniDateRow, { height: MINI_DATE_ROW_HEIGHT }]}>
              {row.map((day, di) => {
                const cellDate = day !== null ? setDate(date, day) : null;
                const isSelected = cellDate !== null && toDateString(cellDate) === selectedDateStr;
                const isTodayCell = isToday(day);
                return (
                  <View
                    key={di}
                    style={[
                      styles.miniDateCell,
                      { height: MINI_DATE_ROW_HEIGHT },
                      isTodayCell && !isSelected && styles.miniDateCellTodayGold,
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.miniDateText,
                        isSelected && styles.miniDateTextSelected,
                        isTodayCell && !isSelected && styles.miniDateTextTodayGold,
                      ]}
                    >
                      {day ?? '\u00A0'}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tintOverlay: {
    backgroundColor: 'rgba(47, 48, 49, 0.5)',
  },
  content: {
    flex: 1,
  },
  headerRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CONTENT_PADDING,
    height: 40,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonFill: {
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 19,
  },
  calendarToggle: {
    width: 160,
    height: 30,
  },
  listWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  monthListContent: {
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: 80,
    width: SCREEN_WIDTH,
  },
  monthCardWrap: {
    marginHorizontal: 0,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  monthCardBorder: {
    ...StyleSheet.absoluteFillObject,
  },
  monthCardFill: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
  },
  monthCardContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    position: 'relative',
    zIndex: 1,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  monthDowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  monthDowCell: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primaryLight,
    textAlign: 'center',
  },
  monthDateGridWrap: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
  monthDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  monthDateCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  monthDateCellPressable: {
    position: 'relative',
    justifyContent: 'center',
  },
  monthDateCellInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDateCellSelected: {
    backgroundColor: Colors.primaryLight,
  },
  monthDateCellText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
  },
  monthDateCellTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  monthDateCellTodayWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDateCellTodayGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDateCellTextTodayGold: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  todayLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.accentChampagne,
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 2,
  },
  yearViewWrap: {
    left: 0,
    right: 0,
    bottom: 0,
  },
  yearListContent: {
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: 80,
  },
  yearCardOuter: {
    marginHorizontal: 0,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  yearCardBorder: {
    ...StyleSheet.absoluteFillObject,
  },
  yearCardFill: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
  },
  yearCardContent: {
    paddingVertical: YEAR_CARD_PADDING,
    paddingHorizontal: YEAR_CARD_PADDING_H,
    position: 'relative',
    zIndex: 1,
  },
  yearTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  yearTitleGradientWrap: {
    alignSelf: 'center',
    minWidth: 80,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: MINI_CARD_HORIZONTAL_GAP,
    rowGap: QUARTER_ROW_GAP,
  },
  miniMonthBlock: {
    width: MINI_CARD_WIDTH_YEAR,
    overflow: 'visible',
  },
  miniMonthBlockContent: {
    padding: MINI_CARD_PADDING,
    position: 'relative',
    zIndex: 1,
    flex: 1,
    overflow: 'visible',
  },
  miniMonthName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  miniMonthNameCurrent: {
    color: Colors.accentChampagne,
  },
  miniGrid: {
    overflow: 'visible',
  },
  miniDateRow: {
    flexDirection: 'row',
    width: '100%',
  },
  miniDateCell: {
    width: COL_WIDTH_PCT,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  miniDateText: {
    fontSize: 9,
    lineHeight: 11,
    textAlign: 'center',
    color: Colors.white,
    opacity: 0.7,
  },
  miniDateTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  miniDateCellTodayGold: {
    backgroundColor: Colors.accentChampagne,
    borderRadius: 6,
  },
  miniDateTextTodayCircle: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.primaryDark,
    opacity: 1,
  },
  miniDateTextTodayOverlay: {
    zIndex: 1,
  },
  miniDateTextTodayGold: {
    fontWeight: '700',
    color: Colors.primaryDark,
  },
});
