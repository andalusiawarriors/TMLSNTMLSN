import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { TMLSN_SPLITS } from '../../../constants/workoutSplits';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import type { WorkoutSplit } from '../../../types';

const Font = {
  bold: 'EBGaramond_700Bold',
  mono: 'DMMono_400Regular',
} as const;

const HeadingLetterSpacing = -1;

const formatRoutineTitle = (name: string) => {
  const lower = name.toLowerCase();
  const words = lower.split(' ');
  const lastWord = words[words.length - 1];
  if (lastWord.length === 1 && /[a-z]/.test(lastWord)) {
    words[words.length - 1] = lastWord.toUpperCase();
  }
  return words.join(' ');
};

export default function TmlsnRoutinesScreen() {
  const router = useRouter();

  const handleStartRoutine = (split: WorkoutSplit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace({
      pathname: '/workout',
      params: { startSplitId: split.id },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.list}>
        {TMLSN_SPLITS.map((split) => (
          <View key={split.id} style={styles.routineCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{formatRoutineTitle(split.name)}</Text>
            </View>
            <Text
              style={styles.exerciseList}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {split.exercises.map((ex) => ex.name).join(', ')}
            </Text>
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => handleStartRoutine(split)}
              activeOpacity={0.8}
            >
              <Text style={styles.startButtonText}>start routine</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  list: {
    paddingLeft: Spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: Colors.primaryLight + '30',
  },
  routineCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontFamily: Font.bold,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
    flex: 1,
  },
  exerciseList: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    letterSpacing: -0.72,
    color: Colors.primaryLight + 'cc',
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  startButton: {
    backgroundColor: '#c6c6c6',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    letterSpacing: -0.72,
    color: '#2f3031',
  },
});
