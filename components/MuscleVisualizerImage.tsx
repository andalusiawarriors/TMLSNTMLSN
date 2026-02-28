// ============================================================
// TMLSN — Muscle Visualizer API image (ExerciseDB design)
// Uses https://muscle-visualizer.exercisedb.dev/docs when
// EXPO_PUBLIC_RAPIDAPI_KEY is set. Three modes: muscles (highlight),
// heatmap, workout (primary/secondary).
// ============================================================

import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';
import {
  fetchVisualizeMuscles,
  buildVisualizeMusclesUrl,
  isMuscleVisualizerConfigured,
  type MuscleVizSlug,
  type MuscleVizView,
  type MuscleVizGender,
  MUSCLE_VIZ_COLORS,
} from '../utils/muscleVisualizerApi';

export interface MuscleVisualizerImageProps {
  /** Muscle slugs to highlight (e.g. ['biceps', 'triceps']) */
  muscles: MuscleVizSlug[];
  /** Highlight color (default app primaryLight) */
  color?: string;
  view?: MuscleVizView;
  gender?: MuscleVizGender;
  width: number;
  height: number;
}

/**
 * Renders a muscle diagram image from the Muscle Visualizer API (ExerciseDB).
 * Design matches their "Muscle Group Highlighting" mode: specified groups in one color.
 * Requires EXPO_PUBLIC_RAPIDAPI_KEY in .env.local (RapidAPI subscription).
 */
export function MuscleVisualizerImage({
  muscles,
  color = MUSCLE_VIZ_COLORS.highlight,
  view = 'front',
  gender = 'male',
  width,
  height,
}: MuscleVisualizerImageProps) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isMuscleVisualizerConfigured() || muscles.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);
    fetchVisualizeMuscles({
      muscles,
      color,
      view,
      gender,
      background: MUSCLE_VIZ_COLORS.primaryDark,
      width: Math.round(width),
      height: Math.round(height),
      format: 'png',
    })
      .then((uri) => {
        if (!cancelled) {
          setDataUri(uri);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Failed to load muscle image');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [muscles.join(','), color, view, gender, width, height]);

  if (!isMuscleVisualizerConfigured()) {
    return null;
  }

  if (loading) {
    return (
      <View style={[styles.placeholder, { width, height }]}>
        <ActivityIndicator size="small" color={MUSCLE_VIZ_COLORS.primaryLight} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.placeholder, { width, height }]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!dataUri) return null;

  return (
    <Image
      source={{ uri: dataUri }}
      style={{ width, height }}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: MUSCLE_VIZ_COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 12,
    color: MUSCLE_VIZ_COLORS.primaryLight + '99',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});

/** Build URL for external use (e.g. open in browser or cache) */
export function getMuscleVisualizerMusclesUrl(
  muscles: MuscleVizSlug[],
  options?: { view?: MuscleVizView; gender?: MuscleVizGender; color?: string }
): string {
  return buildVisualizeMusclesUrl({
    muscles,
    view: options?.view ?? 'front',
    gender: options?.gender ?? 'male',
    color: options?.color ?? MUSCLE_VIZ_COLORS.highlight,
    background: MUSCLE_VIZ_COLORS.primaryDark,
  });
}
