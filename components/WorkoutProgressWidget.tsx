import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useButtonSound } from '../hooks/useButtonSound';
import { Card } from './Card';
import { AnimatedPressable } from './AnimatedPressable';
import { getRecentWorkouts, getUserSettings } from '../utils/storage';
import { Colors, Typography, Spacing } from '../constants/theme';
import type { WorkoutSession } from '../types';

const PROGRESS_CARD_WIDTH = Math.min(380, Dimensions.get('window').width - 40);
const PROGRESS_CARD_HEIGHT = 237;

export function WorkoutProgressWidget() {
  const { colors } = useTheme();
  const { playIn, playOut } = useButtonSound();
  const [showHistory, setShowHistory] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSession[]>([]);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');

  const loadWorkouts = async () => {
    const [workouts, settings] = await Promise.all([
      getRecentWorkouts(),
      getUserSettings(),
    ]);
    setRecentWorkouts(workouts);
    setWeightUnit(settings?.weightUnit ?? 'kg');
  };

  useEffect(() => {
    loadWorkouts();
  }, []);

  useEffect(() => {
    if (showHistory) loadWorkouts();
  }, [showHistory]);

  return (
    <>
      <AnimatedPressable
        onPressIn={playIn}
        onPressOut={playOut}
        onPress={() => setShowHistory(true)}
        style={styles.wrap}
      >
        <Card gradientFill borderRadius={38} style={styles.card}>
          <Text style={[styles.cardText, { color: colors.cardIconTint }]}>progress</Text>
        </Card>
      </AnimatedPressable>

      <Modal
        visible={showHistory}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistory(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPressIn={playIn}
          onPressOut={playOut}
          onPress={() => setShowHistory(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.primaryDark }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.primaryLight }]}>Progress</Text>
              <Pressable
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={() => setShowHistory(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[styles.modalCloseButton, { backgroundColor: colors.primaryLight + '15' }]}
              >
                <Text style={[styles.modalCloseText, { color: colors.primaryLight + '80' }]}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.historyStatsRow}>
              <View style={[styles.historyStatPill, { backgroundColor: colors.primaryLight + '0A', borderColor: colors.primaryLight + '15' }]}>
                <Text style={[styles.historyStatValue, { color: colors.primaryLight }]}>{recentWorkouts.length}</Text>
                <Text style={[styles.historyStatLabel, { color: colors.primaryLight + '50' }]}>Sessions</Text>
              </View>
              <View style={[styles.historyStatPill, { backgroundColor: colors.primaryLight + '0A', borderColor: colors.primaryLight + '15' }]}>
                <Text style={[styles.historyStatValue, { color: colors.primaryLight }]}>
                  {recentWorkouts.reduce((acc, w) => acc + (w.exercises ?? []).reduce((a, e) => a + (e.sets ?? []).length, 0), 0)}
                </Text>
                <Text style={[styles.historyStatLabel, { color: colors.primaryLight + '50' }]}>Total Sets</Text>
              </View>
            </View>

            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {recentWorkouts.length === 0 ? (
                <View style={styles.historyEmpty}>
                  <Text style={[styles.historyEmptyIcon, { color: colors.primaryLight + '30' }]}>◇</Text>
                  <Text style={[styles.historyEmptyText, { color: colors.primaryLight + '60' }]}>No workouts yet</Text>
                  <Text style={[styles.historyEmptySubtext, { color: colors.primaryLight + '40' }]}>Start one to see your progress</Text>
                </View>
              ) : (
                recentWorkouts.map((w) => {
                  const exs = w.exercises ?? [];
                  const wSets = exs.reduce((a, e) => a + (e.sets ?? []).length, 0);
                  const wVolume = exs.reduce(
                    (a, e) => a + (e.sets ?? []).reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0),
                    0
                  );
                  return (
                    <View key={w.id} style={[styles.historySessionCard, { backgroundColor: colors.primaryLight + '08', borderColor: colors.primaryLight + '12' }]}>
                      <View style={styles.historySessionHeader}>
                        <View style={[styles.historySessionIcon, { backgroundColor: colors.primaryLight + '15' }]}>
                          <Text style={[styles.historySessionIconText, { color: colors.primaryLight + '80' }]}>◆</Text>
                        </View>
                        <View style={styles.historySessionTitleCol}>
                          <Text style={[styles.historySessionName, { color: colors.primaryLight }]}>{w.name}</Text>
                          <Text style={[styles.historySessionDate, { color: colors.primaryLight + '50' }]}>
                            {(() => {
                              const d = new Date(w.date);
                              return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                            })()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.historySessionStats}>
                        <View style={[styles.historySessionStatItem, { backgroundColor: colors.primaryLight + '0A' }]}>
                          <Text style={[styles.historySessionStatIcon, { color: colors.primaryLight + '50' }]}>◎</Text>
                          <Text style={[styles.historySessionStatText, { color: colors.primaryLight + '70' }]}>{exs.length} exercises</Text>
                        </View>
                        <View style={[styles.historySessionStatItem, { backgroundColor: colors.primaryLight + '0A' }]}>
                          <Text style={[styles.historySessionStatIcon, { color: colors.primaryLight + '50' }]}>◉</Text>
                          <Text style={[styles.historySessionStatText, { color: colors.primaryLight + '70' }]}>{wSets} sets</Text>
                        </View>
                        <View style={[styles.historySessionStatItem, { backgroundColor: colors.primaryLight + '0A' }]}>
                          <Text style={[styles.historySessionStatIcon, { color: colors.primaryLight + '50' }]}>⏱</Text>
                          <Text style={[styles.historySessionStatText, { color: colors.primaryLight + '70' }]}>{Number(w.duration ?? 0)} min</Text>
                        </View>
                        {wVolume > 0 && (
                          <View style={[styles.historySessionStatItem, { backgroundColor: colors.primaryLight + '0A' }]}>
                            <Text style={[styles.historySessionStatIcon, { color: colors.primaryLight + '50' }]}>⚖</Text>
                            <Text style={[styles.historySessionStatText, { color: colors.primaryLight + '70' }]}>{wVolume.toLocaleString()} {weightUnit}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', marginBottom: 15 },
  card: {
    width: PROGRESS_CARD_WIDTH,
    height: PROGRESS_CARD_HEIGHT,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    marginVertical: 0,
  },
  cardText: {
    fontSize: Typography.promptText,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: -0.11,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.11,
  },
  historyStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.md,
  },
  historyStatPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  historyStatValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.11,
  },
  historyStatLabel: {
    fontSize: Typography.label,
    fontWeight: '500',
    letterSpacing: -0.11,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  historyList: { maxHeight: 500 },
  historyEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  historyEmptyIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  historyEmptyText: {
    fontSize: Typography.body,
    fontWeight: '500',
    letterSpacing: -0.11,
    marginBottom: 4,
  },
  historyEmptySubtext: {
    fontSize: Typography.label,
    fontWeight: '500',
    letterSpacing: -0.11,
  },
  historySessionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  historySessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  historySessionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySessionIconText: { fontSize: 14 },
  historySessionTitleCol: { flex: 1 },
  historySessionName: {
    fontSize: Typography.body,
    fontWeight: '500',
    letterSpacing: -0.11,
  },
  historySessionDate: {
    fontSize: Typography.label,
    fontWeight: '500',
    letterSpacing: -0.11,
    marginTop: 1,
  },
  historySessionStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historySessionStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  historySessionStatIcon: { fontSize: 12 },
  historySessionStatText: {
    fontSize: Typography.label,
    fontWeight: '500',
    letterSpacing: -0.11,
  },
});
