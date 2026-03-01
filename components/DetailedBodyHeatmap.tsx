// ============================================================
// TMLSN — Detailed Body Heatmap (react-native-body-highlighter)
// High-detail SVG muscle anatomy with 24+ regions, left/right
// sides, male/female, front/back. C6C6C6 / 2F3031 palette.
// Premium card backdrop with subtle glow.
// ============================================================

import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';
import type { HeatmapData } from '../utils/weeklyMuscleTracker';
import type { MuscleGroup } from '../utils/exerciseDb/types';
import { Colors, Spacing } from '../constants/theme';

const SCREEN_W = Dimensions.get('window').width;

const GROUP_TO_SLUGS: Record<MuscleGroup, Slug[]> = {
  chest:       ['chest'],
  upper_back:  ['upper-back'],
  lats:        ['upper-back'],
  lower_back:  ['lower-back'],
  traps:       ['trapezius'],
  front_delts: ['deltoids'],
  side_delts:  ['deltoids'],
  rear_delts:  ['deltoids'],
  biceps:      ['biceps'],
  triceps:     ['triceps'],
  forearms:    ['forearm'],
  abs:         ['abs'],
  obliques:    ['obliques'],
  quads:       ['quadriceps'],
  hamstrings:  ['hamstring'],
  glutes:      ['gluteal'],
  adductors:   ['adductors'],
  calves:      ['calves'],
  hip_flexors: ['quadriceps'],
};

const INTENSITY_COLORS = [
  Colors.primaryLight + '35',
  Colors.primaryLight + '5A',
  Colors.primaryLight + '85',
  Colors.primaryLight + 'C0',
  Colors.primaryLight,
] as const;

function setsToIntensity(sets: number, maxSets: number): number {
  if (sets <= 0) return 0;
  const ratio = Math.min(1, sets / Math.max(maxSets, 1));
  if (ratio <= 0.2) return 1;
  if (ratio <= 0.4) return 2;
  if (ratio <= 0.6) return 3;
  if (ratio <= 0.8) return 4;
  return 5;
}

export interface DetailedBodyHeatmapProps {
  heatmapData: HeatmapData[];
  selectedDay: number;
  maxVolume: number;
  variant: 'front' | 'back';
  gender?: 'male' | 'female';
  width?: number;
  pressedMuscleGroup?: MuscleGroup | null;
  onMusclePress?: (group: MuscleGroup | null) => void;
  showCard?: boolean;
}

const SLUG_TO_GROUP: Record<string, MuscleGroup> = {};
for (const [group, slugs] of Object.entries(GROUP_TO_SLUGS)) {
  for (const slug of slugs) {
    if (!SLUG_TO_GROUP[slug]) {
      SLUG_TO_GROUP[slug] = group as MuscleGroup;
    }
  }
}

export function DetailedBodyHeatmap({
  heatmapData,
  selectedDay,
  maxVolume,
  variant,
  gender = 'male',
  width,
  pressedMuscleGroup,
  onMusclePress,
  showCard = true,
}: DetailedBodyHeatmapProps) {
  const containerWidth = width ?? SCREEN_W - 32;
  const scale = containerWidth / 200;

  const heatmapByGroup = useMemo(() => {
    const m = new Map<MuscleGroup, number>();
    for (const h of heatmapData) {
      if (selectedDay < 0) {
        m.set(h.muscleGroup, h.totalSets);
      } else {
        m.set(h.muscleGroup, h.byDay[selectedDay] ?? 0);
      }
    }
    return m;
  }, [heatmapData, selectedDay]);

  const bodyData: ExtendedBodyPart[] = useMemo(() => {
    const slugMap = new Map<Slug, { sets: number; pressed: boolean }>();

    for (const [group, slugs] of Object.entries(GROUP_TO_SLUGS) as [MuscleGroup, Slug[]][]) {
      const sets = heatmapByGroup.get(group) ?? 0;
      const pressed = pressedMuscleGroup === group;
      for (const slug of slugs) {
        const existing = slugMap.get(slug);
        if (!existing || sets > existing.sets) {
          slugMap.set(slug, { sets, pressed: pressed || (existing?.pressed ?? false) });
        } else if (pressed) {
          slugMap.set(slug, { ...existing, pressed: true });
        }
      }
    }

    const parts: ExtendedBodyPart[] = [];
    for (const [slug, { sets, pressed }] of slugMap) {
      const intensity = setsToIntensity(sets, maxVolume);
      if (intensity > 0 || pressed) {
        const part: ExtendedBodyPart = {
          slug,
          intensity: pressed ? 5 : intensity,
        };
        if (pressed) {
          part.styles = {
            fill: Colors.white,
            stroke: Colors.white,
            strokeWidth: 2,
          };
        }
        parts.push(part);
      }
    }
    return parts;
  }, [heatmapByGroup, maxVolume, pressedMuscleGroup]);

  const handlePress = useCallback((bodyPart: ExtendedBodyPart) => {
    if (!onMusclePress || !bodyPart.slug) return;
    const group = SLUG_TO_GROUP[bodyPart.slug];
    if (group) {
      onMusclePress(pressedMuscleGroup === group ? null : group);
    }
  }, [onMusclePress, pressedMuscleGroup]);

  const bodyElement = (
    <Body
      data={bodyData}
      colors={[...INTENSITY_COLORS]}
      side={variant}
      gender={gender}
      scale={scale}
      onBodyPartPress={handlePress}
      border={Colors.primaryLight + '25'}
      defaultFill={Colors.primaryLight + '0C'}
      defaultStroke={Colors.primaryLight + '22'}
      defaultStrokeWidth={0.8}
    />
  );

  if (!showCard) {
    return (
      <View style={[styles.container, { width: containerWidth }]}>
        {bodyElement}
      </View>
    );
  }

  return (
    <View style={[styles.cardOuter, { width: containerWidth }]}>
      <View style={styles.card}>
        <LinearGradient
          colors={[Colors.primaryLight + '08', Colors.primaryLight + '03', 'transparent']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.bodyWrap}>
          {bodyElement}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardOuter: {
    alignItems: 'center',
    shadowColor: Colors.primaryLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '15',
    backgroundColor: Colors.primaryDark,
    overflow: 'hidden',
    paddingVertical: Spacing.md,
  },
  bodyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
