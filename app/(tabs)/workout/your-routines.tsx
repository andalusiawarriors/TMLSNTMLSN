import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ExercisePickerModal } from '../../../components/ExercisePickerModal';
import { getSavedRoutines, saveSavedRoutine } from '../../../utils/storage';
import { Colors, Typography, Spacing, BorderRadius, Font, HeadingLetterSpacing } from '../../../constants/theme';
import { SavedRoutine } from '../../../types';
import { generateId, formatDuration } from '../../../utils/helpers';
import { useButtonSound } from '../../../hooks/useButtonSound';
import { Card } from '../../../components/Card';
import { BackButton } from '../../../components/BackButton';

const windowHeight = Dimensions.get('window').height;

type YourRoutinesScreenProps = {
  /** When provided (e.g. from FAB modal), use this instead of navigating within workout tab */
  onStartRoutine?: (routine: SavedRoutine) => void;
};

export default function YourRoutinesScreen({ onStartRoutine: onStartRoutineProp }: YourRoutinesScreenProps = {}) {
  const router = useRouter();
  const { playIn, playOut } = useButtonSound();
  const [savedRoutines, setSavedRoutines] = useState<SavedRoutine[]>([]);
  const [showRoutineBuilder, setShowRoutineBuilder] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<{
    name: string;
    exercises: { id: string; name: string; restTimer: number; exerciseDbId?: string }[];
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

  const addExerciseToRoutine = (exercise: {
    id: string;
    name: string;
    restTimer: number;
    exerciseDbId?: string;
  }) => {
    setEditingRoutine((prev) => ({
      ...prev,
      exercises: [...prev.exercises, { ...exercise, id: generateId() }],
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
      exercises: editingRoutine.exercises.map((e) => ({
        id: e.id,
        name: e.name,
        restTimer: e.restTimer,
        exerciseDbId: e.exerciseDbId,
      })),
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
    if (onStartRoutineProp) {
      onStartRoutineProp(routine);
      return;
    }
    router.replace({
      pathname: '/workout',
      params: { startRoutineId: routine.id },
    });
  };

  return (
    <>
      <View style={styles.container}>
        <BackButton />
        <View style={styles.titleRow} pointerEvents="box-none">
          <Text style={styles.screenTitle}>Your Routines</Text>
        </View>
        <Image
          source={require('../../../assets/home-background.png')}
          style={styles.homeBackgroundImage}
          resizeMode="cover"
        />
        <ScrollView
          style={styles.scrollLayer}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
        {/* New routine button */}
        <Pressable
          style={({ pressed }) => [styles.newRoutineButton, pressed && { opacity: 0.85 }]}
          onPressIn={playIn}
          onPressOut={playOut}
          onPress={openRoutineBuilder}
        >
          <Text style={styles.newRoutineButtonText}>+ New Routine</Text>
        </Pressable>

        {/* Routine list */}
        {savedRoutines.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>◇</Text>
            <Text style={styles.emptyText}>No routines yet</Text>
            <Text style={styles.emptySubtext}>Create your first routine above</Text>
          </View>
        ) : (
          <View style={styles.routineList}>
            {savedRoutines.map((routine) => (
              <Pressable
                key={routine.id}
                style={({ pressed }) => [styles.routineCardWrap, pressed && { opacity: 0.9 }]}
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={() => handleStartRoutine(routine)}
              >
                <Card gradientFill borderRadius={18} style={styles.routineCard}>
                <View style={styles.routineCardLeft}>
                  <View style={styles.routineCardIcon}>
                    <Text style={styles.routineCardIconText}>◆</Text>
                  </View>
                  <View style={styles.routineCardContent}>
                    <Text style={styles.routineCardName}>{routine.name}</Text>
                    <View style={styles.routineCardStatsRow}>
                      <Text style={styles.routineCardStat}>{routine.exercises.length} exercises</Text>
                    </View>
                    <Text style={styles.routineCardPreview} numberOfLines={1} ellipsizeMode="tail">
                      {routine.exercises.map((e) => e.name).join(' · ')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.routineCardChevron}>›</Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
        </ScrollView>
      </View>

      {/* ─── ROUTINE BUILDER OVERLAY (Hevy-style) ─── */}
      {showRoutineBuilder && (
        <View style={[styles.overlay, { height: windowHeight }]}>
          <ScrollView
            style={styles.overlayScroll}
            contentContainerStyle={styles.overlayContent}
          >
            {/* Top bar */}
            <View style={styles.builderTopBar}>
              <Pressable
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={() => {
                  setShowRoutineBuilder(false);
                  setEditingRoutine({ name: 'New Routine', exercises: [] });
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.builderBackWrap}
              >
                <Text style={styles.builderBackArrow}>▼</Text>
              </Pressable>
              <Pressable
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={() =>
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
                  )
                }
                style={styles.builderTitleWrap}
              >
                <Text style={styles.builderTitle}>{editingRoutine.name}</Text>
                <Text style={styles.builderTitleHint}>tap to rename</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.builderSaveButton, pressed && { opacity: 0.85 }]}
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={saveRoutine}
              >
                <Text style={styles.builderSaveButtonText}>Save</Text>
              </Pressable>
            </View>

            {/* Exercise count */}
            <View style={styles.builderSummary}>
              <Text style={styles.builderSummaryText}>
                {editingRoutine.exercises.length} exercise{editingRoutine.exercises.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Exercise blocks */}
            {editingRoutine.exercises.map((ex, i) => (
              <View key={ex.id} style={styles.builderExerciseBlock}>
                <View style={styles.builderExerciseRow}>
                  <View style={styles.builderExerciseDot}>
                    <Text style={styles.builderExerciseDotText}>{i + 1}</Text>
                  </View>
                  <View style={styles.builderExerciseContent}>
                    <Text style={styles.builderExerciseName}>{ex.name}</Text>
                    <Text style={styles.builderExerciseDetail}>
                      Rest: {formatDuration(ex.restTimer)}
                    </Text>
                  </View>
                  <Pressable
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={() => removeExerciseFromRoutine(ex.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.builderRemoveButton}
                  >
                    <Text style={styles.builderRemoveButtonText}>✕</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Add exercise button */}
            <Pressable
              style={({ pressed }) => [styles.builderAddButton, pressed && { opacity: 0.85 }]}
              onPressIn={playIn}
              onPressOut={playOut}
              onPress={() => setShowExercisePicker(true)}
            >
              <Text style={styles.builderAddButtonText}>+ Add Exercise</Text>
            </Pressable>

            <ExercisePickerModal
              visible={showExercisePicker}
              onClose={() => setShowExercisePicker(false)}
              onSelect={addExerciseToRoutine}
              defaultRestTimer={120}
            />
          </ScrollView>
        </View>
      )}
    </>
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
  homeBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  scrollLayer: {
    zIndex: 2,
  },
  content: {
    padding: Spacing.md,
    paddingTop: TITLE_ROW_TOP + TITLE_ROW_HEIGHT + Spacing.sm,
    paddingBottom: Spacing.xl * 2,
  },

  // ─── NEW ROUTINE BUTTON ───────────────────────────────────────────────────
  newRoutineButton: {
    backgroundColor: Colors.primaryLight + '15',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '20',
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  newRoutineButtonText: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    fontWeight: '600' as const,
    color: Colors.primaryLight + '80',
    letterSpacing: 0.3,
  },

  // ─── EMPTY STATE ──────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 32,
    color: Colors.primaryLight + '30',
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight + '60',
    marginBottom: 4,
  },
  emptySubtext: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    color: Colors.primaryLight + '40',
  },

  // ─── ROUTINE LIST ─────────────────────────────────────────────────────────
  routineList: {
    gap: 10,
  },
  routineCardWrap: {
    marginBottom: 10,
  },
  routineCard: {
    padding: 14,
    marginVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  routineCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineCardIconText: {
    fontSize: 16,
    color: Colors.primaryLight + '80',
  },
  routineCardContent: {
    flex: 1,
  },
  routineCardName: {
    fontFamily: Font.extraBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
    marginBottom: 2,
  },
  routineCardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  routineCardStat: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    color: Colors.primaryLight + '60',
    letterSpacing: 0.2,
  },
  routineCardPreview: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    color: Colors.primaryLight + '40',
    letterSpacing: -0.2,
  },
  routineCardChevron: {
    fontFamily: Font.monoMedium,
    fontSize: 22,
    color: Colors.primaryLight + '40',
    paddingLeft: 8,
  },

  // ─── OVERLAY ──────────────────────────────────────────────────────────────
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
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 3,
  },

  // ─── BUILDER TOP BAR ──────────────────────────────────────────────────────
  builderTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  builderBackWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderBackArrow: {
    fontFamily: Font.monoMedium,
    fontSize: 18,
    color: Colors.primaryLight,
  },
  builderTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  builderTitle: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.5,
  },
  builderTitleHint: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    color: Colors.primaryLight + '40',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  builderSaveButton: {
    backgroundColor: Colors.accentBlue,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
  },
  builderSaveButtonText: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    color: Colors.white,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },

  // ─── BUILDER SUMMARY ──────────────────────────────────────────────────────
  builderSummary: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  builderSummaryText: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    color: Colors.primaryLight + '50',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },

  // ─── BUILDER EXERCISE BLOCKS ──────────────────────────────────────────────
  builderExerciseBlock: {
    backgroundColor: Colors.primaryLight + '08',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '15',
    padding: 12,
    marginBottom: 8,
  },
  builderExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  builderExerciseDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.primaryLight + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderExerciseDotText: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    fontWeight: '700' as const,
    color: Colors.primaryLight + '60',
  },
  builderExerciseContent: {
    flex: 1,
  },
  builderExerciseName: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.3,
  },
  builderExerciseDetail: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    color: Colors.primaryLight + '50',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  builderRemoveButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.accentRed + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderRemoveButtonText: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    color: Colors.accentRed + 'CC',
    fontWeight: '700' as const,
  },

  // ─── BUILDER ADD BUTTON ───────────────────────────────────────────────────
  builderAddButton: {
    backgroundColor: Colors.primaryLight + '15',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  builderAddButtonText: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    fontWeight: '600' as const,
    color: Colors.primaryLight + '80',
    letterSpacing: 0.3,
  },
});
