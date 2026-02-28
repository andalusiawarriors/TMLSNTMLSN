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
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { HeatmapData } from '../utils/weeklyMuscleTracker';
import { DAY_NAMES, MUSCLE_GROUP_DISPLAY_NAMES } from '../utils/weeklyMuscleTracker';
import type { MuscleGroup } from '../utils/exerciseDb/types';
import { Colors, Spacing, BorderRadius } from '../constants/theme';
import { DetailedBodyHeatmap } from './DetailedBodyHeatmap';
import { getUserSettings } from '../utils/storage';

const SCREEN_W = Dimensions.get('window').width;
const BODY_PANEL_W = SCREEN_W - Spacing.md * 2;

const DAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const UPPER_MUSCLES: MuscleGroup[] = [
  'chest', 'upper_back', 'lats', 'lower_back', 'traps',
  'front_delts', 'side_delts', 'rear_delts',
  'biceps', 'triceps', 'forearms',
  'abs', 'obliques',
];
const LOWER_MUSCLES: MuscleGroup[] = [
  'quads', 'hamstrings', 'glutes', 'adductors', 'calves', 'hip_flexors',
];

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
  const halfW = (BODY_PANEL_W - 8) / 2;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(x.value, [0, 1], [0, halfW], Extrapolation.CLAMP) }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 2,
          left: 2,
          width: halfW,
          height: 32,
          borderRadius: 14,
          backgroundColor: Colors.primaryLight + '18',
        },
        style,
      ]}
    />
  );
}

interface MuscleBodyHeatmapProps {
  heatmapData: HeatmapData[];
  period?: 'week' | 'month' | 'year' | 'all';
  externalGender?: 'male' | 'female';
}

function getWeekStartForOffset(offsetWeeks: number): Date {
  const d = new Date();
  const day = d.getDay();
  const monOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + monOffset);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + offsetWeeks * 7);
  return monday;
}

export function MuscleBodyHeatmap({ heatmapData, period = 'week', externalGender }: MuscleBodyHeatmapProps) {
  const showWeekNav = period === 'week';

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => getWeekStartForOffset(weekOffset), [weekOffset]);
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
    if (externalGender) {
      setGender(externalGender);
    } else {
      getUserSettings().then((s) => {
        if (s.bodyMapGender) setGender(s.bodyMapGender);
      });
    }
  }, [externalGender]);

  useEffect(() => {
    setPressedMuscleGroup(null);
  }, [selectedDay]);

  const maxVolumeForDay = useMemo(() => {
    if (showWeekNav) {
      return Math.max(1, ...heatmapData.map((h) => h.byDay[selectedDay] ?? 0));
    }
    return Math.max(1, ...heatmapData.map((h) => h.totalSets));
  }, [heatmapData, selectedDay, showWeekNav]);

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return 'This week';
    if (weekOffset === -1) return 'Last week';
    if (weekOffset < -1) return `${Math.abs(weekOffset)} weeks ago`;
    return `In ${weekOffset} week${weekOffset === 1 ? '' : 's'}`;
  }, [weekOffset]);

  const weekRangeText = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${months[start.getMonth()]}`;
    }
    return `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}`;
  }, [weekDates]);

  const isToday = useCallback((dayIndex: number) => {
    if (weekOffset !== 0) return false;
    return dayIndex === todayDayOfWeek;
  }, [weekOffset, todayDayOfWeek]);

  const heatmapByGroup = useMemo(() => {
    const m = new Map<MuscleGroup, HeatmapData>();
    for (const h of heatmapData) m.set(h.muscleGroup, h);
    return m;
  }, [heatmapData]);

  const muscleListForDay = useMemo(() => {
    const getSets = (group: MuscleGroup) => {
      const data = heatmapByGroup.get(group);
      if (!data) return 0;
      return showWeekNav ? (data.byDay[selectedDay] ?? 0) : data.totalSets;
    };
    const upper = UPPER_MUSCLES.map((group) => ({
      group,
      displayName: MUSCLE_GROUP_DISPLAY_NAMES[group],
      technicalName: TECHNICAL_NAMES[group] ?? '',
      sets: getSets(group),
    }));
    const lower = LOWER_MUSCLES.map((group) => ({
      group,
      displayName: MUSCLE_GROUP_DISPLAY_NAMES[group],
      technicalName: TECHNICAL_NAMES[group] ?? '',
      sets: getSets(group),
    }));
    return { upper, lower };
  }, [heatmapByGroup, selectedDay, showWeekNav]);

  const totalSetsForDay =
    muscleListForDay.upper.reduce((sum, m) => sum + m.sets, 0) +
    muscleListForDay.lower.reduce((sum, m) => sum + m.sets, 0);

  const musclesHit = [...muscleListForDay.upper, ...muscleListForDay.lower].filter(m => m.sets > 0).length;

  const effectiveSelectedDay = showWeekNav ? selectedDay : -1;

  return (
    <View style={styles.container}>
      {showWeekNav && (
        <>
          {/* Week nav */}
          <View style={styles.weekNav}>
            <Pressable onPress={() => setWeekOffset((o) => o - 1)} hitSlop={12} style={styles.chevronBtn}>
              <Text style={styles.chevron}>‹</Text>
            </Pressable>
            <View style={styles.weekCenter}>
              <Text style={styles.weekLabel}>{weekLabel}</Text>
              <Text style={styles.weekRange}>{weekRangeText}</Text>
            </View>
            <Pressable
              onPress={() => setWeekOffset((o) => Math.min(0, o + 1))}
              hitSlop={12}
              style={styles.chevronBtn}
              disabled={weekOffset === 0}
            >
              <Text style={[styles.chevron, weekOffset === 0 && styles.chevronDisabled]}>›</Text>
            </Pressable>
          </View>

          {/* Day strip */}
          <View style={styles.dayRow}>
            {DAY_SHORT.map((letter, i) => {
              const d = weekDates[i];
              const setsForDay = heatmapData.reduce((sum, h) => sum + (h.byDay[i] || 0), 0);
              const isSelected = selectedDay === i;
              const today = isToday(i);
              return (
                <Pressable key={i} style={styles.dayCell} onPress={() => setSelectedDay(i)}>
                  <Text style={[styles.dayLetter, isSelected && styles.dayLetterActive]}>{letter}</Text>
                  <View style={[
                    styles.dayCircle,
                    isSelected && styles.dayCircleSelected,
                    today && !isSelected && styles.dayCircleToday,
                  ]}>
                    <Text style={[
                      styles.dayNum,
                      isSelected && styles.dayNumSelected,
                    ]}>
                      {d.getDate()}
                    </Text>
                  </View>
                  {setsForDay > 0 && !isSelected && <View style={styles.activityDot} />}
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* Front / Back toggle */}
      <View style={styles.toggleBar}>
        <AnimatedTabIndicator activeIndex={activeView === 'front' ? 0 : 1} />
        <Pressable style={styles.toggleBtn} onPress={() => setActiveView('front')}>
          <Text style={[styles.toggleLabel, activeView === 'front' && styles.toggleLabelActive]}>Front</Text>
        </Pressable>
        <Pressable style={styles.toggleBtn} onPress={() => setActiveView('back')}>
          <Text style={[styles.toggleLabel, activeView === 'back' && styles.toggleLabelActive]}>Back</Text>
        </Pressable>
      </View>

      {/* Body anatomy */}
      <View style={styles.bodySection}>
        <DetailedBodyHeatmap
          heatmapData={heatmapData}
          selectedDay={effectiveSelectedDay}
          maxVolume={maxVolumeForDay}
          variant={activeView}
          gender={gender}
          width={BODY_PANEL_W - 16}
          pressedMuscleGroup={pressedMuscleGroup}
          onMusclePress={setPressedMuscleGroup}
          showCard={true}
        />
      </View>

      {/* Stats pills */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statNum}>{totalSetsForDay}</Text>
          <Text style={styles.statText}>sets</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statNum}>{musclesHit}</Text>
          <Text style={styles.statText}>muscles</Text>
        </View>
      </View>

      {/* Muscle breakdown */}
      <View style={styles.muscleSection}>
        {/* Upper */}
        <Pressable
          style={({ pressed }) => [styles.sectionHeader, pressed && styles.sectionHeaderPressed]}
          onPress={() => setUpperExpanded(e => !e)}
        >
          <Text style={styles.sectionChevron}>{upperExpanded ? '▾' : '▸'}</Text>
          <Text style={styles.sectionTitle}>Upper Body</Text>
          <Text style={styles.sectionCount}>
            {muscleListForDay.upper.reduce((s, m) => s + m.sets, 0)} sets
          </Text>
        </Pressable>
        {upperExpanded && muscleListForDay.upper.map((m) => (
          <MuscleRow
            key={m.group}
            displayName={m.displayName}
            technicalName={m.technicalName}
            sets={m.sets}
            maxSets={maxVolumeForDay}
            isSelected={pressedMuscleGroup === m.group}
            onPress={() => setPressedMuscleGroup(pressedMuscleGroup === m.group ? null : m.group)}
          />
        ))}

        {/* Lower */}
        <Pressable
          style={({ pressed }) => [styles.sectionHeader, pressed && styles.sectionHeaderPressed, { marginTop: 8 }]}
          onPress={() => setLowerExpanded(e => !e)}
        >
          <Text style={styles.sectionChevron}>{lowerExpanded ? '▾' : '▸'}</Text>
          <Text style={styles.sectionTitle}>Lower Body</Text>
          <Text style={styles.sectionCount}>
            {muscleListForDay.lower.reduce((s, m) => s + m.sets, 0)} sets
          </Text>
        </Pressable>
        {lowerExpanded && muscleListForDay.lower.map((m) => (
          <MuscleRow
            key={m.group}
            displayName={m.displayName}
            technicalName={m.technicalName}
            sets={m.sets}
            maxSets={maxVolumeForDay}
            isSelected={pressedMuscleGroup === m.group}
            onPress={() => setPressedMuscleGroup(pressedMuscleGroup === m.group ? null : m.group)}
          />
        ))}
      </View>
    </View>
  );
}

interface MuscleRowProps {
  displayName: string;
  technicalName: string;
  sets: number;
  maxSets: number;
  isSelected: boolean;
  onPress: () => void;
}

function MuscleRow({ displayName, technicalName, sets, maxSets, isSelected, onPress }: MuscleRowProps) {
  const barWidth = sets > 0 ? Math.max(8, (sets / Math.max(maxSets, 1)) * 100) : 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.muscleRow,
        (pressed || isSelected) && styles.muscleRowActive,
      ]}
      onPress={onPress}
    >
      <View style={styles.muscleInfo}>
        <Text style={[styles.muscleName, isSelected && styles.muscleNameSelected]}>
          {displayName}
        </Text>
        {technicalName ? (
          <Text style={styles.muscleTech}>{technicalName}</Text>
        ) : null}
      </View>
      <View style={styles.muscleRight}>
        {sets > 0 && (
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${barWidth}%` }]} />
          </View>
        )}
        <Text style={[styles.muscleSets, isSelected && styles.muscleSetsSelected]}>
          {sets}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
    paddingTop: Spacing.xs,
  },

  // Week nav
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chevronBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.primaryLight + '0A',
  },
  chevron: {
    fontSize: 22,
    fontWeight: '500',
    color: Colors.primaryLight,
    marginTop: -2,
  },
  chevronDisabled: {
    color: Colors.primaryLight + '30',
  },
  weekCenter: {
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primaryLight,
    letterSpacing: -0.3,
  },
  weekRange: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.primaryLight + '70',
    marginTop: 1,
  },

  // Day strip
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dayLetter: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.primaryLight + '50',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dayLetterActive: {
    color: Colors.primaryLight,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayCircleSelected: {
    backgroundColor: Colors.primaryLight,
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: Colors.primaryLight + '40',
  },
  dayNum: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryLight + '90',
  },
  dayNumSelected: {
    color: Colors.primaryDark,
  },
  activityDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primaryLight + '60',
  },

  // Toggle
  toggleBar: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryLight + '0A',
    borderRadius: 16,
    height: 36,
    marginBottom: 16,
    position: 'relative',
    padding: 2,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryLight + '50',
    letterSpacing: 0.3,
  },
  toggleLabelActive: {
    color: Colors.primaryLight,
  },

  // Body
  bodySection: {
    alignItems: 'center',
    marginBottom: 16,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    backgroundColor: Colors.primaryLight + '08',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '12',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primaryLight,
    letterSpacing: -0.5,
  },
  statText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primaryLight + '60',
  },

  // Muscle section
  muscleSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.primaryLight + '12',
    paddingTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.primaryLight + '06',
    borderRadius: 10,
  },
  sectionHeaderPressed: {
    backgroundColor: Colors.primaryLight + '12',
  },
  sectionChevron: {
    fontSize: 12,
    color: Colors.primaryLight + '60',
    marginRight: 8,
    width: 14,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryLight + 'B0',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primaryLight + '60',
  },

  // Muscle rows
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.primaryLight + '0C',
  },
  muscleRowActive: {
    backgroundColor: Colors.primaryLight + '12',
    borderRadius: 10,
    borderBottomColor: 'transparent',
  },
  muscleInfo: {
    flex: 1,
    gap: 1,
  },
  muscleName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primaryLight,
    letterSpacing: -0.2,
  },
  muscleNameSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  muscleTech: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.primaryLight + '55',
    fontStyle: 'italic',
  },
  muscleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barTrack: {
    width: 48,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.primaryLight + '12',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 1.5,
    backgroundColor: Colors.primaryLight + '80',
  },
  muscleSets: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryLight + '90',
    minWidth: 24,
    textAlign: 'right',
  },
  muscleSetsSelected: {
    color: Colors.white,
  },
});
