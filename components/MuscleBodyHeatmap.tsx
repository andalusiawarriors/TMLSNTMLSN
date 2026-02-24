// ============================================================
// TMLSN — Body distribution (reference: Statistics/Body distribution UI)
// ============================================================

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import type { HeatmapData } from '../utils/weeklyMuscleTracker';
import { getWeekStart, DAY_NAMES, MUSCLE_GROUP_DISPLAY_NAMES } from '../utils/weeklyMuscleTracker';
import type { MuscleGroup } from '../utils/exerciseDb/types';
import { Colors, Spacing, BorderRadius, Shadows, Typography, Font } from '../constants/theme';
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
      <Text style={styles.sectionTitle}>last 7 days body graph</Text>

      {/* Week range */}
      <Text style={styles.weekRange}>{weekRangeText}</Text>

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
                  isSelected && styles.dayButtonSelected,
                ]}
              >
                <Text style={[styles.dayLetter, isSelected && styles.dayLetterSelected]}>
                  {letter}
                </Text>
                <Text style={[styles.dayDate, isSelected && styles.dayLetterSelected]}>
                  {d.getDate()}
                </Text>
              </View>
              {setsForDay > 0 && !isSelected && <View style={styles.activityDot} />}
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
      <View style={styles.muscleList}>
        <View style={styles.muscleListHeader}>
          <Text style={styles.muscleListHeaderText}>Muscle</Text>
          <Text style={styles.muscleListHeaderText}>Sets</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.muscleListRow,
            pressed && styles.muscleListRowPressed,
          ]}
          onPress={() => setPressedMuscleGroup(null)}
        >
          <Text style={styles.muscleListName}>Total</Text>
          <Text style={styles.muscleListSets}>{totalSetsForDay}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.dropdownHeader, pressed && styles.dropdownHeaderPressed]}
          onPress={() => setUpperExpanded((e) => !e)}
        >
          <Text style={styles.dropdownChevron}>{upperExpanded ? '▼' : '▶'}</Text>
          <Text style={styles.dropdownLabel}>Upper</Text>
          <Text style={styles.dropdownSets}>
            {muscleListForDay.upper.reduce((s, m) => s + m.sets, 0)}
          </Text>
        </Pressable>
        {upperExpanded &&
          muscleListForDay.upper.map((m) => (
            <Pressable
              key={m.group}
              style={({ pressed }) => [
                styles.muscleListRow,
                (pressed || pressedMuscleGroup === m.group) && styles.muscleListRowPressed,
              ]}
              onPress={() => setPressedMuscleGroup(pressedMuscleGroup === m.group ? null : m.group)}
            >
              <Text style={[
                styles.muscleListName,
                pressedMuscleGroup === m.group && styles.muscleListNameSelected,
              ]}>
                {m.displayName}
              </Text>
              <Text style={[
                styles.muscleListSets,
                pressedMuscleGroup === m.group && styles.muscleListSetsSelected,
              ]}>
                {m.sets}
              </Text>
            </Pressable>
          ))}
        <Pressable
          style={({ pressed }) => [styles.dropdownHeader, pressed && styles.dropdownHeaderPressed]}
          onPress={() => setLowerExpanded((e) => !e)}
        >
          <Text style={styles.dropdownChevron}>{lowerExpanded ? '▼' : '▶'}</Text>
          <Text style={styles.dropdownLabel}>Lower</Text>
          <Text style={styles.dropdownSets}>
            {muscleListForDay.lower.reduce((s, m) => s + m.sets, 0)}
          </Text>
        </Pressable>
        {lowerExpanded &&
          muscleListForDay.lower.map((m) => (
          <Pressable
            key={m.group}
            style={({ pressed }) => [
              styles.muscleListRow,
              (pressed || pressedMuscleGroup === m.group) && styles.muscleListRowPressed,
            ]}
            onPress={() => setPressedMuscleGroup(pressedMuscleGroup === m.group ? null : m.group)}
          >
            <Text style={[
              styles.muscleListName,
              pressedMuscleGroup === m.group && styles.muscleListNameSelected,
            ]}>
              {m.displayName}
            </Text>
            <Text style={[
              styles.muscleListSets,
              pressedMuscleGroup === m.group && styles.muscleListSetsSelected,
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
    color: Colors.primaryLight,
    marginBottom: Spacing.sm,
  },
  weekRange: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    color: Colors.primaryLight + '99',
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
    backgroundColor: Colors.primaryDarkLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: Colors.primaryLight,
  },
  dayLetter: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    color: Colors.primaryLight,
  },
  dayLetterSelected: {
    color: Colors.primaryDark,
  },
  dayDate: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    color: Colors.primaryLight,
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
    backgroundColor: Colors.primaryLight,
    marginTop: 4,
  },
  muscleList: {
    borderTopWidth: 1,
    borderTopColor: Colors.primaryLight + '30',
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
    color: Colors.primaryLight + '99',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
    backgroundColor: Colors.primaryLight + '0A',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '15',
  },
  dropdownHeaderPressed: {
    backgroundColor: Colors.primaryLight + '15',
  },
  dropdownChevron: {
    fontFamily: Font.mono,
    fontSize: 10,
    color: Colors.primaryLight + '99',
    marginRight: Spacing.xs,
    width: 14,
  },
  dropdownLabel: {
    flex: 1,
    fontFamily: Font.extraBold,
    fontSize: Typography.label,
    color: Colors.primaryLight + 'CC',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  dropdownSets: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    color: Colors.primaryLight + '99',
    fontWeight: '600',
  },
  muscleListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight + '15',
  },
  muscleListRowPressed: {
    backgroundColor: Colors.primaryLight + '20',
  },
  muscleListName: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    color: Colors.primaryLight,
    letterSpacing: -0.5,
  },
  muscleListSets: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    color: Colors.primaryLight,
    fontWeight: '600',
  },
  muscleListNameSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  muscleListSetsSelected: {
    color: Colors.white,
  },
});
