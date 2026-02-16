import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { TMLSN_SPLITS } from '../../../constants/workoutSplits';
import { Colors, Typography, Spacing, BorderRadius } from '../../../constants/theme';
import type { WorkoutSplit } from '../../../types';
import { useButtonSound } from '../../../hooks/useButtonSound';

const Font = {
  bold: 'EBGaramond_700Bold',
  mono: 'DMMono_400Regular',
} as const;

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
  const { playIn, playOut } = useButtonSound();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleStartRoutine = (split: WorkoutSplit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace({
      pathname: '/workout',
      params: { startSplitId: split.id },
    });
  };

  const toggleExpand = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {TMLSN_SPLITS.map((split) => {
        const isExpanded = expandedId === split.id;
        const exerciseCount = split.exercises.length;
        const totalSets = split.exercises.reduce((acc, ex) => acc + ex.targetSets, 0);

        return (
          <View key={split.id} style={styles.routineCard}>
            {/* Header – tappable to expand/collapse */}
            <Pressable
              style={styles.cardHeader}
              onPressIn={playIn}
              onPressOut={playOut}
              onPress={() => toggleExpand(split.id)}
            >
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIcon}>
                  <Text style={styles.cardIconText}>◆</Text>
                </View>
                <View style={styles.cardTitleCol}>
                  <Text style={styles.cardTitle}>{formatRoutineTitle(split.name)}</Text>
                  <View style={styles.cardStatsRow}>
                    <Text style={styles.cardStat}>{exerciseCount} exercises</Text>
                    <Text style={styles.cardStatDot}>·</Text>
                    <Text style={styles.cardStat}>{totalSets} sets</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.chevron, isExpanded && styles.chevronExpanded]}>›</Text>
            </Pressable>

            {/* Expanded exercise list */}
            {isExpanded && (
              <View style={styles.exerciseListExpanded}>
                {split.exercises.map((ex, i) => (
                  <View key={i} style={styles.exerciseRow}>
                    <View style={styles.exerciseRowDot}>
                      <Text style={styles.exerciseRowDotText}>{i + 1}</Text>
                    </View>
                    <View style={styles.exerciseRowContent}>
                      <Text style={styles.exerciseRowName}>{ex.name}</Text>
                      <Text style={styles.exerciseRowDetail}>
                        {ex.targetSets}×{ex.targetReps} · Rest {Math.floor(ex.restTimer / 60)}:{String(ex.restTimer % 60).padStart(2, '0')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Collapsed preview */}
            {!isExpanded && (
              <Text style={styles.exercisePreview} numberOfLines={2} ellipsizeMode="tail">
                {split.exercises.map((ex) => ex.name).join(' · ')}
              </Text>
            )}

            {/* Start button */}
            <Pressable
              style={({ pressed }) => [styles.startButton, pressed && { opacity: 0.85 }]}
              onPressIn={playIn}
              onPressOut={playOut}
              onPress={() => handleStartRoutine(split)}
            >
              <Text style={styles.startButtonText}>Start Routine</Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 2,
    gap: 12,
  },

  // ─── ROUTINE CARD (Hevy-style) ────────────────────────────────────────────
  routineCard: {
    backgroundColor: Colors.primaryLight + '08',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '15',
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconText: {
    fontSize: 16,
    color: Colors.primaryLight + '80',
  },
  cardTitleCol: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: Font.bold,
    fontSize: 17,
    color: Colors.primaryLight,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  cardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardStat: {
    fontFamily: Font.mono,
    fontSize: 12,
    color: Colors.primaryLight + '60',
    letterSpacing: 0.2,
  },
  cardStatDot: {
    fontFamily: Font.mono,
    fontSize: 12,
    color: Colors.primaryLight + '30',
  },
  chevron: {
    fontFamily: Font.mono,
    fontSize: 24,
    color: Colors.primaryLight + '50',
    paddingHorizontal: 4,
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },

  // ─── EXERCISE LIST (expanded) ─────────────────────────────────────────────
  exerciseListExpanded: {
    marginTop: 12,
    marginBottom: 12,
    gap: 6,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  exerciseRowDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primaryLight + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseRowDotText: {
    fontFamily: Font.mono,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.primaryLight + '60',
  },
  exerciseRowContent: {
    flex: 1,
  },
  exerciseRowName: {
    fontFamily: Font.mono,
    fontSize: 14,
    color: Colors.primaryLight,
    letterSpacing: -0.3,
  },
  exerciseRowDetail: {
    fontFamily: Font.mono,
    fontSize: 11,
    color: Colors.primaryLight + '50',
    letterSpacing: 0.2,
    marginTop: 1,
  },

  // ─── COLLAPSED PREVIEW ────────────────────────────────────────────────────
  exercisePreview: {
    fontFamily: Font.mono,
    fontSize: 12,
    color: Colors.primaryLight + '50',
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 12,
    letterSpacing: -0.2,
  },

  // ─── START BUTTON ─────────────────────────────────────────────────────────
  startButton: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  startButtonText: {
    fontFamily: Font.mono,
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
    color: Colors.primaryDark,
  },
});
