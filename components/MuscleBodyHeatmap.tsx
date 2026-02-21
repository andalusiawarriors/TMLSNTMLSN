// ============================================================
// TMLSN — Body distribution (reference: Statistics/Body distribution UI)
// ============================================================

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import type { HeatmapData } from '../utils/weeklyMuscleTracker';
import { getWeekStart, DAY_NAMES, MUSCLE_GROUP_DISPLAY_NAMES } from '../utils/weeklyMuscleTracker';
import type { MuscleGroup } from '../utils/exerciseDb/types';
import { Spacing, BorderRadius, Typography, Font } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { BodyAnatomySvg } from './BodyAnatomySvg';

const BODY_WIDTH = Math.min(160, Dimensions.get('window').width / 2 - Spacing.lg);
const BODY_HEIGHT = BODY_WIDTH * 1.5;
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Display order for muscle list — organized into upper / lower
const UPPER_MUSCLES: MuscleGroup[] = [
  'chest', 'upper_back', 'lats', 'lower_back', 'traps',
  'front_delts', 'side_delts', 'rear_delts',
  'biceps', 'triceps', 'forearms',
  'abs', 'obliques',
];
const LOWER_MUSCLES: MuscleGroup[] = [
  'quads', 'hamstrings', 'glutes', 'adductors', 'calves', 'hip_flexors',
];

interface MuscleBodyHeatmapProps {
  heatmapData: HeatmapData[];
}

export function MuscleBodyHeatmap({ heatmapData }: MuscleBodyHeatmapProps) {
  const { colors } = useTheme();
  const weekStart = useMemo(() => getWeekStart(), []);
  const weekDates = useMemo(() => {
    return DAY_NAMES.map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const todayDayOfWeek = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    return day === 0 ? 6 : day - 1;
  }, []);

  const [selectedDay, setSelectedDay] = useState(todayDayOfWeek);
  const [pressedMuscleGroup, setPressedMuscleGroup] = useState<MuscleGroup | null>(null);
  const [upperExpanded, setUpperExpanded] = useState(true);
  const [lowerExpanded, setLowerExpanded] = useState(true);

  // Clear selection when switching days
  React.useEffect(() => {
    setPressedMuscleGroup(null);
  }, [selectedDay]);

  const maxVolumeForDay = useMemo(() => {
    return Math.max(
      1,
      ...heatmapData.map((h) => h.byDay[selectedDay] ?? 0)
    );
  }, [heatmapData, selectedDay]);

  const weekRangeText = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    return `${start.getDate()}-${end.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][start.getMonth()]} ${start.getFullYear()}`;
  }, [weekDates]);

  const heatmapByGroup = useMemo(() => {
    const m = new Map<MuscleGroup, HeatmapData>();
    for (const h of heatmapData) m.set(h.muscleGroup, h);
    return m;
  }, [heatmapData]);

  const muscleListForDay = useMemo(() => {
    const upper = UPPER_MUSCLES.map((group) => {
      const data = heatmapByGroup.get(group);
      const sets = data?.byDay[selectedDay] ?? 0;
      return { group, displayName: MUSCLE_GROUP_DISPLAY_NAMES[group], sets };
    });
    const lower = LOWER_MUSCLES.map((group) => {
      const data = heatmapByGroup.get(group);
      const sets = data?.byDay[selectedDay] ?? 0;
      return { group, displayName: MUSCLE_GROUP_DISPLAY_NAMES[group], sets };
    });
    return { upper, lower };
  }, [heatmapByGroup, selectedDay]);

  const totalSetsForDay =
    muscleListForDay.upper.reduce((sum, m) => sum + m.sets, 0) +
    muscleListForDay.lower.reduce((sum, m) => sum + m.sets, 0);

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.primaryLight }]}>last 7 days body graph</Text>

      {/* Week range */}
      <Text style={[styles.weekRange, { color: colors.primaryLight + '99' }]}>{weekRangeText}</Text>

      {/* Day selector */}
      <View style={styles.dayRow}>
        {DAY_LETTERS.map((letter, i) => {
          const d = weekDates[i];
          const setsForDay = heatmapData.reduce((sum, h) => sum + (h.byDay[i] || 0), 0);
          const isSelected = selectedDay === i;
          return (
            <Pressable
              key={i}
              style={styles.dayCell}
              onPress={() => setSelectedDay(i)}
            >
              <View
                style={[
                  styles.dayButton,
                  { backgroundColor: colors.primaryDarkLighter },
                  isSelected && { backgroundColor: colors.primaryLight },
                ]}
              >
                <Text style={[styles.dayLetter, { color: colors.primaryLight }, isSelected && { color: colors.primaryDark }]}>
                  {letter}
                </Text>
                <Text style={[styles.dayDate, { color: colors.primaryLight }, isSelected && { color: colors.primaryDark }]}>
                  {d.getDate()}
                </Text>
              </View>
              {setsForDay > 0 && !isSelected && <View style={[styles.activityDot, { backgroundColor: colors.primaryLight }]} />}
            </Pressable>
          );
        })}
      </View>

      {/* Body anatomy (front + back) — volume gradient + tap-to-select */}
      <View style={styles.bodyRow}>
        <View style={styles.bodyHalf}>
          <BodyAnatomySvg
            variant="front"
            heatmapData={heatmapData}
            selectedDay={selectedDay}
            maxVolume={maxVolumeForDay}
            pressedMuscleGroup={pressedMuscleGroup}
            width={BODY_WIDTH}
            height={BODY_HEIGHT}
          />
        </View>
        <View style={styles.bodyHalf}>
          <BodyAnatomySvg
            variant="back"
            heatmapData={heatmapData}
            selectedDay={selectedDay}
            maxVolume={maxVolumeForDay}
            pressedMuscleGroup={pressedMuscleGroup}
            width={BODY_WIDTH}
            height={BODY_HEIGHT}
          />
        </View>
      </View>

      {/* Muscle list */}
      <View style={[styles.muscleList, { borderTopColor: colors.primaryLight + '30' }]}>
        <View style={styles.muscleListHeader}>
          <Text style={[styles.muscleListHeaderText, { color: colors.primaryLight + '99' }]}>Muscle</Text>
          <Text style={[styles.muscleListHeaderText, { color: colors.primaryLight + '99' }]}>Sets</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.muscleListRow,
            { borderBottomColor: colors.primaryLight + '15' },
            pressed && { backgroundColor: colors.primaryLight + '20' },
          ]}
          onPress={() => setPressedMuscleGroup(null)}
        >
          <Text style={[styles.muscleListName, { color: colors.primaryLight }]}>Total</Text>
          <Text style={[styles.muscleListSets, { color: colors.primaryLight }]}>{totalSetsForDay}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.dropdownHeader,
            { backgroundColor: colors.primaryLight + '0A', borderColor: colors.primaryLight + '15' },
            pressed && { backgroundColor: colors.primaryLight + '15' },
          ]}
          onPress={() => setUpperExpanded((e) => !e)}
        >
          <Text style={[styles.dropdownChevron, { color: colors.primaryLight + '99' }]}>{upperExpanded ? '▼' : '▶'}</Text>
          <Text style={[styles.dropdownLabel, { color: colors.primaryLight + 'CC' }]}>Upper</Text>
          <Text style={[styles.dropdownSets, { color: colors.primaryLight + '99' }]}>
            {muscleListForDay.upper.reduce((s, m) => s + m.sets, 0)}
          </Text>
        </Pressable>
        {upperExpanded &&
          muscleListForDay.upper.map((m) => (
            <Pressable
              key={m.group}
              style={({ pressed }) => [
                styles.muscleListRow,
                { borderBottomColor: colors.primaryLight + '15' },
                (pressed || pressedMuscleGroup === m.group) && { backgroundColor: colors.primaryLight + '20' },
              ]}
              onPress={() => setPressedMuscleGroup(pressedMuscleGroup === m.group ? null : m.group)}
            >
              <Text style={[
                styles.muscleListName,
                { color: colors.primaryLight },
                pressedMuscleGroup === m.group && { color: colors.cardIconTint, fontWeight: '600' },
              ]}>
                {m.displayName}
              </Text>
              <Text style={[
                styles.muscleListSets,
                { color: colors.primaryLight },
                pressedMuscleGroup === m.group && { color: colors.cardIconTint },
              ]}>
                {m.sets}
              </Text>
            </Pressable>
          ))}
        <Pressable
          style={({ pressed }) => [
            styles.dropdownHeader,
            { backgroundColor: colors.primaryLight + '0A', borderColor: colors.primaryLight + '15' },
            pressed && { backgroundColor: colors.primaryLight + '15' },
          ]}
          onPress={() => setLowerExpanded((e) => !e)}
        >
          <Text style={[styles.dropdownChevron, { color: colors.primaryLight + '99' }]}>{lowerExpanded ? '▼' : '▶'}</Text>
          <Text style={[styles.dropdownLabel, { color: colors.primaryLight + 'CC' }]}>Lower</Text>
          <Text style={[styles.dropdownSets, { color: colors.primaryLight + '99' }]}>
            {muscleListForDay.lower.reduce((s, m) => s + m.sets, 0)}
          </Text>
        </Pressable>
        {lowerExpanded &&
          muscleListForDay.lower.map((m) => (
          <Pressable
            key={m.group}
            style={({ pressed }) => [
              styles.muscleListRow,
              { borderBottomColor: colors.primaryLight + '15' },
              (pressed || pressedMuscleGroup === m.group) && { backgroundColor: colors.primaryLight + '20' },
            ]}
            onPress={() => setPressedMuscleGroup(pressedMuscleGroup === m.group ? null : m.group)}
          >
            <Text style={[
              styles.muscleListName,
              { color: colors.primaryLight },
              pressedMuscleGroup === m.group && { color: colors.cardIconTint, fontWeight: '600' },
            ]}>
              {m.displayName}
            </Text>
            <Text style={[
              styles.muscleListSets,
              { color: colors.primaryLight },
              pressedMuscleGroup === m.group && { color: colors.cardIconTint },
            ]}>
              {m.sets}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.label,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
  },
  weekRange: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    marginBottom: Spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayButton: {
    width: 36,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLetter: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
  },
  dayDate: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    marginTop: 2,
  },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  bodyHalf: {
    alignItems: 'center',
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  muscleList: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  muscleListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  muscleListHeaderText: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  dropdownChevron: {
    fontFamily: Font.mono,
    fontSize: 10,
    marginRight: Spacing.xs,
    width: 14,
  },
  dropdownLabel: {
    flex: 1,
    fontFamily: Font.extraBold,
    fontSize: Typography.label,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  dropdownSets: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    fontWeight: '600',
  },
  muscleListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
  },
  muscleListName: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    letterSpacing: -0.5,
  },
  muscleListSets: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    fontWeight: '600',
  },
});
