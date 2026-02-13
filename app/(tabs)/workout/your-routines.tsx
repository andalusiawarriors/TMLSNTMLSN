import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Card } from '../../../components/Card';
import { getSavedRoutines, saveSavedRoutine } from '../../../utils/storage';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { SavedRoutine } from '../../../types';
import { generateId, formatDuration } from '../../../utils/helpers';

const Font = {
  bold: 'EBGaramond_700Bold',
  mono: 'DMMono_400Regular',
} as const;

const windowHeight = Dimensions.get('window').height;

export default function YourRoutinesScreen() {
  const router = useRouter();
  const [savedRoutines, setSavedRoutines] = useState<SavedRoutine[]>([]);
  const [showRoutineBuilder, setShowRoutineBuilder] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<{
    name: string;
    exercises: { id: string; name: string; restTimer: number }[];
  }>({ name: 'New Routine', exercises: [] });

  const loadRoutines = useCallback(async () => {
    const routines = await getSavedRoutines();
    setSavedRoutines(routines);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRoutines();
    }, [loadRoutines])
  );

  const openRoutineBuilder = () => {
    setEditingRoutine({ name: 'New Routine', exercises: [] });
    setShowRoutineBuilder(true);
  };

  const addExerciseToRoutine = (name: string, restTimer: number = 120) => {
    setEditingRoutine((prev) => ({
      ...prev,
      exercises: [...prev.exercises, { id: generateId(), name, restTimer }],
    }));
  };

  const removeExerciseFromRoutine = (id: string) => {
    setEditingRoutine((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((e) => e.id !== id),
    }));
  };

  const saveRoutine = async () => {
    if (editingRoutine.exercises.length === 0) {
      Alert.alert('No exercises', 'Add at least one exercise to save the routine.');
      return;
    }
    let name = editingRoutine.name.trim();
    if (!name || name === 'New Routine') {
      Alert.prompt(
        'Routine name',
        'Enter a name for this routine',
        (text) => {
          if (text?.trim()) {
            saveRoutineWithName(text.trim());
          }
        }
      );
      return;
    }
    saveRoutineWithName(name);
  };

  const saveRoutineWithName = async (name: string) => {
    const routine: SavedRoutine = {
      id: generateId(),
      name,
      exercises: editingRoutine.exercises.map((e) => ({ ...e })),
    };
    await saveSavedRoutine(routine);
    await loadRoutines();
    setShowRoutineBuilder(false);
    setEditingRoutine({ name: 'New Routine', exercises: [] });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved', `"${name}" saved to My Routines.`);
  };

  const handleStartRoutine = (routine: SavedRoutine) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace({
      pathname: '/workout',
      params: { startRoutineId: routine.id },
    });
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.list}>
          <TouchableOpacity
            style={styles.newRoutineButton}
            onPress={openRoutineBuilder}
            activeOpacity={0.8}
          >
            <Text style={styles.newRoutineButtonText}>+ new routine</Text>
          </TouchableOpacity>
          {savedRoutines.length === 0 ? (
            <Text style={styles.emptyText}>No routines yet. Create one above.</Text>
          ) : (
            savedRoutines.map((routine) => (
              <TouchableOpacity
                key={routine.id}
                style={styles.routineItem}
                onPress={() => handleStartRoutine(routine)}
                activeOpacity={0.7}
              >
                <Text style={styles.routineItemName}>{routine.name}</Text>
                <Text style={styles.routineItemDetail}>
                  {routine.exercises.length} exercises
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Routine builder overlay */}
      {showRoutineBuilder && (
        <View style={[styles.overlay, { height: windowHeight }]}>
          <ScrollView
            style={styles.overlayScroll}
            contentContainerStyle={styles.overlayContent}
          >
            <View style={styles.logTopBar}>
              <View style={styles.logTopLeft}>
                <TouchableOpacity
                  onPress={() => {
                    setShowRoutineBuilder(false);
                    setEditingRoutine({ name: 'New Routine', exercises: [] });
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.logBackArrowWrap}
                >
                  <Text style={styles.logBackArrow}>▼</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Alert.prompt(
                      'Routine name',
                      'Enter a name for this routine',
                      (text) => {
                        if (text?.trim()) {
                          setEditingRoutine((prev) => ({ ...prev, name: text.trim() }));
                        }
                      },
                      'plain-text',
                      editingRoutine.name === 'New Routine' ? '' : editingRoutine.name
                    );
                  }}
                >
                  <Text style={styles.logTitle}>{editingRoutine.name}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.finishButton}
                onPress={saveRoutine}
                activeOpacity={0.8}
              >
                <Text style={styles.finishButtonText}>Save</Text>
              </TouchableOpacity>
            </View>

            {editingRoutine.exercises.map((ex) => (
              <Card key={ex.id} style={styles.exerciseBlock}>
                <View style={styles.exerciseBlockHeader}>
                  <Text style={styles.exerciseBlockName}>{ex.name}</Text>
                  <TouchableOpacity
                    onPress={() => removeExerciseFromRoutine(ex.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.exerciseBlockMenu}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.restTimerRow}>
                  <Text style={styles.restTimerRowIcon}>🕐</Text>
                  <Text style={styles.restTimerRowText}>
                    Rest: {formatDuration(ex.restTimer)}
                  </Text>
                </View>
              </Card>
            ))}

            <TouchableOpacity
              style={styles.addExerciseButton}
              onPress={() => {
                Alert.prompt(
                  'Add Exercise',
                  'Enter exercise name',
                  (text) => {
                    if (text?.trim()) {
                      addExerciseToRoutine(text.trim(), 120);
                    }
                  }
                );
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.addExerciseText}>+ Add Exercise</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </>
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
  newRoutineButton: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    ...Shadows.card,
  },
  newRoutineButtonText: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
  },
  emptyText: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight + '99',
    fontStyle: 'italic',
  },
  routineItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight + '15',
  },
  routineItemName: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
    marginBottom: 2,
  },
  routineItemDetail: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primaryDark,
    zIndex: 100,
  },
  overlayScroll: {
    flex: 1,
  },
  overlayContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 3,
  },
  logTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  logTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logBackArrowWrap: {
    padding: Spacing.xs,
  },
  logBackArrow: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    lineHeight: Typography.dataValue,
    letterSpacing: -0.72,
  },
  logTitle: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
  },
  finishButton: {
    backgroundColor: Colors.accentBlue,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  finishButtonText: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.white,
    letterSpacing: -0.72,
  },
  exerciseBlock: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  exerciseBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  exerciseBlockName: {
    fontFamily: Font.mono,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
    flex: 1,
  },
  exerciseBlockMenu: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    padding: Spacing.xs,
  },
  restTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  restTimerRowIcon: {
    fontSize: 14,
  },
  restTimerRowText: {
    fontFamily: Font.mono,
    fontSize: 12,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
  },
  addExerciseButton: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    ...Shadows.card,
  },
  addExerciseText: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
  },
});
