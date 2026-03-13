import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { TMLSN_SPLITS } from '../../constants/workoutSplits';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import type { WorkoutSplit } from '../../types';
import { useButtonSound } from '../../hooks/useButtonSound';
import { BackButton } from '../../components/BackButton';
import { FlatFitnessBackground } from '../../components/FlatFitnessBackground';

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
  const { playIn, playOut } = useButtonSound();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleStartRoutine = (split: WorkoutSplit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onStartRoutineProp) {
      onStartRoutineProp(split);
      return;
    }
    router.replace({
      pathname: '/(tabs)/workout',
      params: { startSplitId: split.id },
    } as any);
  };

  const toggleExpand = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <View style={styles.container}>
      <BackButton />
      <View style={styles.titleRow} pointerEvents="box-none">
        <Text style={styles.screenTitle}>TMLSN Routines</Text>
      </View>
      <FlatFitnessBackground />
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
              <LinearGradient
                colors={['#B8BABC', '#D6D8DA', '#A0A4A8', '#6B6F74']}
                locations={[0, 0.37, 0.69, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startButtonGradient}
              >
                <Text style={styles.startButtonText}>Start Routine</Text>
              </LinearGradient>
            </Pressable>
          </View>
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
    backgroundColor: 'transparent',
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

  // ─── ROUTINE CARD ─────────────────────────────────────────────────────────
  routineCard: {
    backgroundColor: 'rgba(47, 48, 49, 0.55)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2,
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
    borderRadius: 38,
    height: 44,
    marginTop: 4,
    overflow: 'hidden',
  },
  startButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: -0.11,
    color: '#FFFFFF',
  },
});
