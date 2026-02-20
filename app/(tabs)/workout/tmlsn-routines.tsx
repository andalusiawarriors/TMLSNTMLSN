import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { TMLSN_SPLITS } from '../../../constants/workoutSplits';
import { Colors, Typography, Spacing, BorderRadius } from '../../../constants/theme';
import type { WorkoutSplit } from '../../../types';
import { useButtonSound } from '../../../hooks/useButtonSound';
import { useTheme } from '../../../context/ThemeContext';
import { Card } from '../../../components/Card';
import { BackButton } from '../../../components/BackButton';
import { HomeGradientBackground } from '../../../components/HomeGradientBackground';

const formatRoutineTitle = (name: string) => {
  const lower = name.toLowerCase();
  const words = lower.split(' ');
  const lastWord = words[words.length - 1];
  if (lastWord.length === 1 && /[a-z]/.test(lastWord)) {
    words[words.length - 1] = lastWord.toUpperCase();
  }
  return words.join(' ');
};

type TmlsnRoutinesScreenProps = {
  /** When provided (e.g. from FAB modal), use this instead of navigating within workout tab */
  onStartRoutine?: (split: WorkoutSplit) => void;
};

export default function TmlsnRoutinesScreen({ onStartRoutine: onStartRoutineProp }: TmlsnRoutinesScreenProps = {}) {
  const router = useRouter();
  const { colors } = useTheme();
  const { playIn, playOut } = useButtonSound();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleStartRoutine = (split: WorkoutSplit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onStartRoutineProp) {
      onStartRoutineProp(split);
      return;
    }
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
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      <BackButton />
      <View style={styles.titleRow} pointerEvents="box-none">
        <Text style={[styles.screenTitle, { color: colors.primaryLight }]}>TMLSN Routines</Text>
      </View>
      <HomeGradientBackground />
      <ScrollView
        style={styles.scrollLayer}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      {TMLSN_SPLITS.map((split) => {
        const isExpanded = expandedId === split.id;
        const exerciseCount = split.exercises.length;
        const totalSets = split.exercises.reduce((acc, ex) => acc + ex.targetSets, 0);

        return (
          <Card key={split.id} gradientFill borderRadius={20} style={styles.routineCard}>
            {/* Header – tappable to expand/collapse */}
            <Pressable
              style={styles.cardHeader}
              onPressIn={playIn}
              onPressOut={playOut}
              onPress={() => toggleExpand(split.id)}
            >
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight + '15' }]}>
                  <Text style={[styles.cardIconText, { color: colors.primaryLight + '80' }]}>◆</Text>
                </View>
                <View style={styles.cardTitleCol}>
                  <Text style={[styles.cardTitle, { color: colors.cardIconTint }]}>{formatRoutineTitle(split.name)}</Text>
                  <View style={styles.cardStatsRow}>
                    <Text style={[styles.cardStat, { color: colors.primaryLight + '60' }]}>{exerciseCount} exercises</Text>
                    <Text style={[styles.cardStatDot, { color: colors.primaryLight + '30' }]}>·</Text>
                    <Text style={[styles.cardStat, { color: colors.primaryLight + '60' }]}>{totalSets} sets</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.chevron, isExpanded && styles.chevronExpanded, { color: colors.primaryLight + '50' }]}>›</Text>
            </Pressable>

            {/* Expanded exercise list */}
            {isExpanded && (
              <View style={styles.exerciseListExpanded}>
                {split.exercises.map((ex, i) => (
                  <View key={i} style={styles.exerciseRow}>
                    <View style={[styles.exerciseRowDot, { borderColor: colors.primaryLight + '25' }]}>
                      <Text style={[styles.exerciseRowDotText, { color: colors.primaryLight + '60' }]}>{i + 1}</Text>
                    </View>
                    <View style={styles.exerciseRowContent}>
                      <Text style={[styles.exerciseRowName, { color: colors.cardIconTint }]}>{ex.name}</Text>
                      <Text style={[styles.exerciseRowDetail, { color: colors.primaryLight + '50' }]}>
                        {ex.targetSets}×{ex.targetReps} · Rest {Math.floor(ex.restTimer / 60)}:{String(ex.restTimer % 60).padStart(2, '0')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Collapsed preview */}
            {!isExpanded && (
              <Text style={[styles.exercisePreview, { color: colors.primaryLight + '50' }]} numberOfLines={2} ellipsizeMode="tail">
                {split.exercises.map((ex) => ex.name).join(' · ')}
              </Text>
            )}

            {/* Start button */}
            <Pressable
              style={({ pressed }) => [styles.startButton, { backgroundColor: colors.primaryLight }, pressed && { opacity: 0.85 }]}
              onPressIn={playIn}
              onPressOut={playOut}
              onPress={() => handleStartRoutine(split)}
            >
              <Text style={[styles.startButtonText, { color: colors.primaryDark }]}>Start Routine</Text>
            </Pressable>
          </Card>
        );
      })}
      </ScrollView>
    </View>
  );
}

const TITLE_ROW_TOP = 54;
const TITLE_ROW_HEIGHT = 40;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  titleRow: {
    position: 'absolute',
    top: TITLE_ROW_TOP,
    left: 0,
    right: 0,
    height: TITLE_ROW_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9,
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  scrollLayer: {
    zIndex: 2,
  },
  content: {
    padding: Spacing.md,
    paddingTop: TITLE_ROW_TOP + TITLE_ROW_HEIGHT + Spacing.sm,
    paddingBottom: Spacing.xl * 2,
    gap: 12,
  },

  // ─── ROUTINE CARD (Hevy-style) ────────────────────────────────────────────
  routineCard: {
    padding: Spacing.md,
    marginVertical: 0,
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
    fontSize: Typography.body,
    fontWeight: '600',
    color: Colors.primaryLight,
    letterSpacing: -0.11,
    marginBottom: 2,
  },
  cardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardStat: {
    fontSize: Typography.label,
    fontWeight: '500',
    color: Colors.primaryLight + '60',
    letterSpacing: -0.11,
  },
  cardStatDot: {
    fontSize: Typography.label,
    fontWeight: '500',
    color: Colors.primaryLight + '30',
    letterSpacing: -0.11,
  },
  chevron: {
    fontSize: 24,
    fontWeight: '500',
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
    fontSize: Typography.label,
    fontWeight: '700' as const,
    color: Colors.primaryLight + '60',
    letterSpacing: -0.11,
  },
  exerciseRowContent: {
    flex: 1,
  },
  exerciseRowName: {
    fontSize: Typography.label,
    fontWeight: '500',
    color: Colors.primaryLight,
    letterSpacing: -0.11,
  },
  exerciseRowDetail: {
    fontSize: Typography.label,
    fontWeight: '500',
    color: Colors.primaryLight + '50',
    letterSpacing: -0.11,
    marginTop: 1,
  },

  // ─── COLLAPSED PREVIEW ────────────────────────────────────────────────────
  exercisePreview: {
    fontSize: Typography.label,
    fontWeight: '500',
    color: Colors.primaryLight + '50',
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 12,
    letterSpacing: -0.11,
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
    fontSize: Typography.label,
    fontWeight: '700' as const,
    letterSpacing: -0.11,
    color: Colors.primaryDark,
  },
});
