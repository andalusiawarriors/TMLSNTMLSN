// ============================================================
// TMLSN — Muscle Body Heatmap — premium redesign
// Full-width body viewer with front / back slide toggle
// Technical Latin muscle name callouts · system font only
// ============================================================

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { HeatmapData } from '../utils/weeklyMuscleTracker';
import { getWeekStart, DAY_NAMES, MUSCLE_GROUP_DISPLAY_NAMES } from '../utils/weeklyMuscleTracker';
import type { MuscleGroup } from '../utils/exerciseDb/types';
import { Colors, Spacing, BorderRadius } from '../constants/theme';
import { BodyAnatomySvg } from './BodyAnatomySvg';
import { getUserSettings } from '../utils/storage';

const SCREEN_W = Dimensions.get('window').width;
const BODY_PANEL_W = SCREEN_W - Spacing.md * 2;
// Body aspect ratio ~1:1.83 (660:1206). Give enough height so labels show cleanly.
const BODY_H = Math.round(BODY_PANEL_W * 1.55);

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const UPPER_MUSCLES: MuscleGroup[] = [
  'chest', 'upper_back', 'lats', 'lower_back', 'traps',
  'front_delts', 'side_delts', 'rear_delts',
  'biceps', 'triceps', 'forearms',
  'abs', 'obliques',
];
const LOWER_MUSCLES: MuscleGroup[] = [
  'quads', 'hamstrings', 'glutes', 'adductors', 'calves', 'hip_flexors',
];

// Technical names shown in the muscle list (maps group key → Latin name)
const TECHNICAL_NAMES: Partial<Record<MuscleGroup, string>> = {
  chest:       'Pectoralis Major',
  upper_back:  'Rhomboids / Mid-Trap',
  lats:        'Latissimus Dorsi',
  lower_back:  'Erector Spinae',
  traps:       'Trapezius',
  front_delts: 'Anterior Deltoid',
  side_delts:  'Lateral Deltoid',
  rear_delts:  'Posterior Deltoid',
  biceps:      'Biceps Brachii',
  triceps:     'Triceps Brachii',
  forearms:    'Brachioradialis',
  abs:         'Rectus Abdominis',
  obliques:    'External Oblique',
  quads:       'Rectus Femoris',
  hamstrings:  'Biceps Femoris',
  glutes:      'Gluteus Maximus',
  adductors:   'Adductor Magnus',
  calves:      'Gastrocnemius',
  hip_flexors: 'Iliopsoas',
};

function AnimatedTabIndicator({ activeIndex }: { activeIndex: number }) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(activeIndex, { damping: 18, stiffness: 200 });
  }, [activeIndex]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(x.value, [0, 1], [0, BODY_PANEL_W / 2], Extrapolation.CLAMP) }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: BODY_PANEL_W / 2,
          height: 2,
          borderRadius: 1,
          backgroundColor: Colors.primaryLight,
        },
        style,
      ]}
    />
  );
}

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
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [pressedMuscleGroup, setPressedMuscleGroup] = useState<MuscleGroup | null>(null);
  const [upperExpanded, setUpperExpanded] = useState(true);
  const [lowerExpanded, setLowerExpanded] = useState(true);
  const [gender, setGender] = useState<'male' | 'female'>('male');

  useEffect(() => {
    getUserSettings().then((s) => {
      if (s.bodyMapGender) setGender(s.bodyMapGender);
    });
  }, []);

  useEffect(() => {
    setPressedMuscleGroup(null);
  }, [selectedDay]);

  const maxVolumeForDay = useMemo(() => {
    return Math.max(1, ...heatmapData.map((h) => h.byDay[selectedDay] ?? 0));
  }, [heatmapData, selectedDay]);

  const weekRangeText = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${start.getDate()} – ${end.getDate()} ${months[start.getMonth()]} ${start.getFullYear()}`;
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
      return { group, displayName: MUSCLE_GROUP_DISPLAY_NAMES[group], technicalName: TECHNICAL_NAMES[group] ?? '', sets };
    });
    const lower = LOWER_MUSCLES.map((group) => {
      const data = heatmapByGroup.get(group);
      const sets = data?.byDay[selectedDay] ?? 0;
      return { group, displayName: MUSCLE_GROUP_DISPLAY_NAMES[group], technicalName: TECHNICAL_NAMES[group] ?? '', sets };
    });
    return { upper, lower };
  }, [heatmapByGroup, selectedDay]);

  const totalSetsForDay =
    muscleListForDay.upper.reduce((sum, m) => sum + m.sets, 0) +
    muscleListForDay.lower.reduce((sum, m) => sum + m.sets, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>muscle map</Text>
        <Text style={styles.weekRange}>{weekRangeText}</Text>
      </View>

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
              <View style={[styles.dayButton, isSelected && styles.dayButtonSelected]}>
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

      {/* Front / Back toggle tabs */}
      <View style={styles.tabBar}>
        <Pressable style={styles.tabButton} onPress={() => setActiveView('front')}>
          <Text style={[styles.tabLabel, activeView === 'front' && styles.tabLabelActive]}>
            FRONT
          </Text>
        </Pressable>
        <Pressable style={styles.tabButton} onPress={() => setActiveView('back')}>
          <Text style={[styles.tabLabel, activeView === 'back' && styles.tabLabelActive]}>
            BACK
          </Text>
        </Pressable>
        <AnimatedTabIndicator activeIndex={activeView === 'front' ? 0 : 1} />
      </View>

      {/* Body anatomy — full width with labels */}
      <View style={styles.bodyContainer}>
        <BodyAnatomySvg
          variant={activeView}
          heatmapData={heatmapData}
          selectedDay={selectedDay}
          maxVolume={maxVolumeForDay}
          pressedMuscleGroup={pressedMuscleGroup}
          width={BODY_PANEL_W}
          height={BODY_H}
          showLabels
          gender={gender}
        />
      </View>

      {/* Stats summary */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{totalSetsForDay}</Text>
          <Text style={styles.statLabel}>total sets</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>
            {[...muscleListForDay.upper, ...muscleListForDay.lower].filter(m => m.sets > 0).length}
          </Text>
          <Text style={styles.statLabel}>muscles hit</Text>
        </View>
      </View>

      {/* Muscle list */}
      <View style={styles.muscleList}>
        <View style={styles.muscleListHeader}>
          <Text style={styles.muscleListHeaderText}>Muscle</Text>
          <Text style={styles.muscleListHeaderText}>Sets</Text>
        </View>

        {/* Total row */}
        <Pressable
          style={({ pressed }) => [styles.muscleListRow, pressed && styles.muscleListRowPressed]}
          onPress={() => setPressedMuscleGroup(null)}
        >
          <Text style={styles.muscleListName}>All Muscles</Text>
          <Text style={styles.muscleListSets}>{totalSetsForDay}</Text>
        </Pressable>

        {/* Upper section */}
        <Pressable
          style={({ pressed }) => [styles.dropdownHeader, pressed && styles.dropdownHeaderPressed]}
          onPress={() => setUpperExpanded(e => !e)}
        >
          <Text style={styles.dropdownChevron}>{upperExpanded ? '▼' : '▶'}</Text>
          <Text style={styles.dropdownLabel}>Upper Body</Text>
          <Text style={styles.dropdownSets}>
            {muscleListForDay.upper.reduce((s, m) => s + m.sets, 0)}
          </Text>
        </Pressable>
        {upperExpanded && muscleListForDay.upper.map((m) => (
          <Pressable
            key={m.group}
            style={({ pressed }) => [
              styles.muscleListRow,
              (pressed || pressedMuscleGroup === m.group) && styles.muscleListRowPressed,
            ]}
            onPress={() => setPressedMuscleGroup(pressedMuscleGroup === m.group ? null : m.group)}
          >
            <View style={styles.muscleNameColumn}>
              <Text style={[styles.muscleListName, pressedMuscleGroup === m.group && styles.muscleListNameSelected]}>
                {m.displayName}
              </Text>
              {m.technicalName ? (
                <Text style={styles.muscleTechName}>{m.technicalName}</Text>
              ) : null}
            </View>
            <Text style={[styles.muscleListSets, pressedMuscleGroup === m.group && styles.muscleListSetsSelected]}>
              {m.sets}
            </Text>
          </Pressable>
        ))}

        {/* Lower section */}
        <Pressable
          style={({ pressed }) => [styles.dropdownHeader, pressed && styles.dropdownHeaderPressed]}
          onPress={() => setLowerExpanded(e => !e)}
        >
          <Text style={styles.dropdownChevron}>{lowerExpanded ? '▼' : '▶'}</Text>
          <Text style={styles.dropdownLabel}>Lower Body</Text>
          <Text style={styles.dropdownSets}>
            {muscleListForDay.lower.reduce((s, m) => s + m.sets, 0)}
          </Text>
        </Pressable>
        {lowerExpanded && muscleListForDay.lower.map((m) => (
          <Pressable
            key={m.group}
            style={({ pressed }) => [
              styles.muscleListRow,
              (pressed || pressedMuscleGroup === m.group) && styles.muscleListRowPressed,
            ]}
            onPress={() => setPressedMuscleGroup(pressedMuscleGroup === m.group ? null : m.group)}
          >
            <View style={styles.muscleNameColumn}>
              <Text style={[styles.muscleListName, pressedMuscleGroup === m.group && styles.muscleListNameSelected]}>
                {m.displayName}
              </Text>
              {m.technicalName ? (
                <Text style={styles.muscleTechName}>{m.technicalName}</Text>
              ) : null}
            </View>
            <Text style={[styles.muscleListSets, pressedMuscleGroup === m.group && styles.muscleListSetsSelected]}>
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
    paddingTop: Spacing.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Colors.primaryLight,
  },
  weekRange: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.primaryLight + '80',
    letterSpacing: 0.2,
  },

  // Day selector
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
    backgroundColor: Colors.primaryLight + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: Colors.primaryLight,
  },
  dayLetter: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primaryLight,
    letterSpacing: 0.3,
  },
  dayLetterSelected: {
    color: Colors.primaryDark,
  },
  dayDate: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.primaryLight,
    marginTop: 2,
  },
  activityDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primaryLight,
    marginTop: 4,
  },

  // Front / Back toggle
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight + '20',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: Colors.primaryLight + '55',
  },
  tabLabelActive: {
    color: Colors.primaryLight,
  },

  // Body
  bodyContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight + '0A',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '18',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primaryLight,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.primaryLight + '80',
    letterSpacing: 0.2,
  },

  // Muscle list
  muscleList: {
    borderTopWidth: 1,
    borderTopColor: Colors.primaryLight + '20',
    paddingTop: Spacing.sm,
  },
  muscleListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    marginBottom: 4,
  },
  muscleListHeaderText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.primaryLight + '60',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginTop: 6,
    backgroundColor: Colors.primaryLight + '08',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '15',
  },
  dropdownHeaderPressed: {
    backgroundColor: Colors.primaryLight + '15',
  },
  dropdownChevron: {
    fontSize: 9,
    color: Colors.primaryLight + '80',
    marginRight: 8,
    width: 12,
  },
  dropdownLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryLight + 'CC',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dropdownSets: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryLight + '80',
  },
  muscleListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight + '10',
  },
  muscleListRowPressed: {
    backgroundColor: Colors.primaryLight + '18',
    borderRadius: 8,
  },
  muscleNameColumn: {
    flex: 1,
    gap: 1,
  },
  muscleListName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primaryLight,
    letterSpacing: -0.2,
  },
  muscleTechName: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.primaryLight + '55',
    letterSpacing: 0.1,
  },
  muscleListSets: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryLight,
    minWidth: 28,
    textAlign: 'right',
  },
  muscleListNameSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  muscleListSetsSelected: {
    color: Colors.white,
  },
});
