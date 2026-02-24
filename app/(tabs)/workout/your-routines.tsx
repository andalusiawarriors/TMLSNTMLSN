import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExercisePickerModal } from '../../../components/ExercisePickerModal';
import { Input } from '../../../components/Input';
import { Swipeable } from 'react-native-gesture-handler';
import { getSavedRoutines, saveSavedRoutine, deleteSavedRoutine } from '../../../utils/storage';
import { Colors, Typography, Spacing, BorderRadius, Font, HeadingLetterSpacing } from '../../../constants/theme';
import { SavedRoutine, SavedRoutineExercise } from '../../../types';
import { generateId, formatDuration } from '../../../utils/helpers';
import { useButtonSound } from '../../../hooks/useButtonSound';
import { useTheme } from '../../../context/ThemeContext';
import { Card } from '../../../components/Card';
import { BackButton } from '../../../components/BackButton';
import { HomeGradientBackground } from '../../../components/HomeGradientBackground';

const windowHeight = Dimensions.get('window').height;

type YourRoutinesScreenProps = {
  /** When provided (e.g. from FAB modal), use this instead of navigating within workout tab */
  onStartRoutine?: (routine: SavedRoutine) => void;
};

export default function YourRoutinesScreen({ onStartRoutine: onStartRoutineProp }: YourRoutinesScreenProps = {}) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { playIn, playOut } = useButtonSound();
  const [savedRoutines, setSavedRoutines] = useState<SavedRoutine[]>([]);
  const [isSavingRoutine, setIsSavingRoutine] = useState(false);
  const [showRoutineBuilder, setShowRoutineBuilder] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<{
    name: string;
    exercises: SavedRoutineExercise[];
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
      exercises: [
        ...prev.exercises,
        {
          id: generateId(),
          name: exercise.name,
          restTimer: exercise.restTimer,
          exerciseDbId: exercise.exerciseDbId,
          targetSets: 3,
          targetReps: 8,
          suggestedWeight: undefined,
        },
      ],
    }));
  };

  const updateExerciseInRoutine = (
    id: string,
    updates: Partial<Pick<SavedRoutineExercise, 'targetSets' | 'targetReps' | 'suggestedWeight' | 'restTimer'>>
  ) => {
    setEditingRoutine((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  };

  const removeExerciseFromRoutine = (id: string) => {
    setEditingRoutine((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((e) => e.id !== id),
    }));
  };

  const saveRoutine = async () => {
    if (isSavingRoutine) return;
    if (editingRoutine.exercises.length === 0) {
      Alert.alert('No exercises', 'Add at least one exercise to save the routine.');
      return;
    }
    const name = editingRoutine.name.trim();
    if (!name || name === 'New Routine') {
      Alert.alert('Routine name', 'Enter a name for this routine.');
      return;
    }
    for (const ex of editingRoutine.exercises) {
      if (ex.targetSets < 1) {
        Alert.alert('Invalid sets', `"${ex.name}": Sets must be at least 1.`);
        return;
      }
      if (ex.restTimer < 0) {
        Alert.alert('Invalid rest', `"${ex.name}": Rest timer must be 0 or more.`);
        return;
      }
    }
    saveRoutineWithName(name);
  };

  const saveRoutineWithName = async (name: string) => {
    if (isSavingRoutine) return;
    setIsSavingRoutine(true);
    try {
      const routine: SavedRoutine = {
        id: generateId(),
        name,
        exercises: editingRoutine.exercises.map((e) => ({
          id: e.id,
          name: e.name,
          restTimer: e.restTimer,
          exerciseDbId: e.exerciseDbId,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          suggestedWeight: e.suggestedWeight != null && e.suggestedWeight >= 0 ? e.suggestedWeight : undefined,
        })),
      };
      await saveSavedRoutine(routine);
      await loadRoutines();
      setShowRoutineBuilder(false);
      setEditingRoutine({ name: 'New Routine', exercises: [] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', `"${name}" saved to My Routines.`);
    } catch (e) {
      if (__DEV__) console.warn('[YourRoutines] save routine failed:', e);
      Alert.alert('Save failed', 'Could not save routine. Try again.', [{ text: 'OK' }]);
    } finally {
      setIsSavingRoutine(false);
    }
  };

  const handleDeleteRoutine = (routine: SavedRoutine) => {
    Alert.alert(
      'Delete routine',
      `Delete "${routine.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSavedRoutine(routine.id);
              await loadRoutines();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              if (__DEV__) console.warn('[YourRoutines] delete routine failed:', e);
              Alert.alert('Delete failed', 'Could not delete routine. Try again.', [{ text: 'OK' }]);
            }
          },
        },
      ]
    );
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
        <HomeGradientBackground />
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
              <Swipeable
                key={routine.id}
                renderRightActions={() => (
                  <Pressable
                    style={({ pressed }) => [styles.routineDeleteAction, pressed && { opacity: 0.8 }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={() => handleDeleteRoutine(routine)}
                  >
                    <Text style={styles.routineDeleteText}>Delete</Text>
                  </Pressable>
                )}
                friction={2}
                rightThreshold={40}
              >
                <Pressable
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
              </Swipeable>
            ))}
          </View>
        )}
        </ScrollView>
      </View>

      {/* ─── ROUTINE BUILDER OVERLAY (matches workout log design) ─── */}
      {showRoutineBuilder && (
        <View style={[styles.overlay, { height: windowHeight, backgroundColor: colors.primaryDark }]}>
          <KeyboardAvoidingView
            style={styles.overlayKeyboardWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              style={styles.overlayScroll}
              contentContainerStyle={[
                styles.overlayContent,
                { paddingTop: TITLE_ROW_TOP, paddingBottom: Math.max(Spacing.xl * 2, insets.bottom + 80) },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Top bar (matches workout log logTopBar) */}
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
                  <View style={styles.minimizeIconButton}>
                    <LinearGradient
                      colors={colors.tabBarBorder as [string, string]}
                      style={[StyleSheet.absoluteFillObject, { borderRadius: 15 }]}
                    />
                    <LinearGradient
                      colors={colors.tabBarFill as [string, string]}
                      style={{ position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderRadius: 14 }}
                    />
                    <Ionicons name="chevron-down" size={18} color={colors.primaryLight} />
                  </View>
                </Pressable>
                <View style={styles.builderTitleCenter}>
                  <Text style={[styles.builderTitle, { color: colors.primaryLight }]}>New Routine</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.builderSaveButton,
                    { backgroundColor: colors.primaryLight },
                    pressed && { opacity: 0.85 },
                    isSavingRoutine && { opacity: 0.6 },
                  ]}
                  onPressIn={playIn}
                  onPressOut={playOut}
                  onPress={saveRoutine}
                  disabled={isSavingRoutine}
                >
                  <Text style={[styles.builderSaveButtonText, { color: colors.primaryDark }]}>Save</Text>
                </Pressable>
              </View>

              {/* Routine name input (matches Input component styling) */}
              <Input
                label="Routine name"
                placeholder="e.g. Push Day, Leg Day"
                value={editingRoutine.name === 'New Routine' ? '' : editingRoutine.name}
                onChangeText={(text) =>
                  setEditingRoutine((prev) => ({ ...prev, name: text.trim() || 'New Routine' }))
                }
                containerStyle={styles.builderInputWrap}
              />

              {/* Exercise list card (matches tmlsn-routines Card + exerciseRow) */}
              <Card gradientFill borderRadius={20} style={styles.builderCard}>
                <View style={styles.builderSummary}>
                  <Text style={[styles.builderSummaryText, { color: colors.primaryLight + '80' }]}>
                    {editingRoutine.exercises.length} exercise{editingRoutine.exercises.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={[styles.builderHelperText, { color: colors.primaryLight + '60' }]}>
                  These values will pre-fill your workout when you load this routine.
                </Text>
                {editingRoutine.exercises.map((ex, i) => (
                  <View key={ex.id} style={styles.builderExerciseBlock}>
                    <View style={styles.builderExerciseRow}>
                      <View style={[styles.builderExerciseDot, { borderColor: colors.primaryLight + '25' }]}>
                        <Text style={[styles.builderExerciseDotText, { color: colors.primaryLight + '60' }]}>{i + 1}</Text>
                      </View>
                      <View style={styles.builderExerciseContent}>
                        <Text style={[styles.builderExerciseName, { color: colors.primaryLight }]}>{ex.name}</Text>
                      </View>
                      <Pressable
                        onPressIn={playIn}
                        onPressOut={playOut}
                        onPress={() => removeExerciseFromRoutine(ex.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[styles.builderRemoveButton, { backgroundColor: Colors.accentRed + '15' }]}
                      >
                        <Text style={[styles.builderRemoveButtonText, { color: Colors.accentRed + 'CC' }]}>✕</Text>
                      </Pressable>
                    </View>
                    <View style={styles.builderInputsRow}>
                      <View style={styles.builderNumericInputWrap}>
                        <Text style={[styles.builderInputLabel, { color: colors.primaryLight + '80' }]}>Sets</Text>
                        <TextInput
                          style={[styles.builderNumericInput, { color: colors.primaryLight, borderColor: colors.primaryLight + '40' }]}
                          value={String(ex.targetSets)}
                          onChangeText={(t) => {
                            const v = parseInt(t.replace(/\D/g, ''), 10);
                            updateExerciseInRoutine(ex.id, { targetSets: isNaN(v) ? 0 : Math.min(99, v) });
                          }}
                          keyboardType="number-pad"
                          placeholder="3"
                          placeholderTextColor={colors.primaryLight + '50'}
                        />
                      </View>
                      <View style={styles.builderNumericInputWrap}>
                        <Text style={[styles.builderInputLabel, { color: colors.primaryLight + '80' }]}>Rest (sec)</Text>
                        <TextInput
                          style={[styles.builderNumericInput, { color: colors.primaryLight, borderColor: colors.primaryLight + '40' }]}
                          value={String(ex.restTimer)}
                          onChangeText={(t) => {
                            const v = parseInt(t.replace(/\D/g, ''), 10);
                            updateExerciseInRoutine(ex.id, { restTimer: isNaN(v) ? 0 : Math.max(0, Math.min(9999, v)) });
                          }}
                          keyboardType="number-pad"
                          placeholder="120"
                          placeholderTextColor={colors.primaryLight + '50'}
                        />
                      </View>
                    </View>
                  </View>
                ))}
                <Pressable
                  style={({ pressed }) => [
                    styles.builderAddButton,
                    { backgroundColor: colors.primaryLight + '15' },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPressIn={playIn}
                  onPressOut={playOut}
                  onPress={() => setShowExercisePicker(true)}
                >
                  <Text style={[styles.builderAddButtonText, { color: colors.primaryLight + '90' }]}>+ Add exercise</Text>
                </Pressable>
              </Card>
            </ScrollView>
          </KeyboardAvoidingView>

          <ExercisePickerModal
            visible={showExercisePicker}
            onClose={() => setShowExercisePicker(false)}
            onSelect={addExerciseToRoutine}
            defaultRestTimer={120}
          />
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
  routineDeleteAction: {
    backgroundColor: Colors.accentRed,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
  },
  routineDeleteText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.white,
    letterSpacing: -0.11,
  },

  // ─── OVERLAY (matches workout log) ─────────────────────────────────────────
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  overlayKeyboardWrap: {
    flex: 1,
  },
  overlayScroll: {
    flex: 1,
  },
  overlayContent: {
    paddingHorizontal: Spacing.md,
  },

  // ─── BUILDER TOP BAR (matches logTopBar) ───────────────────────────────────
  builderTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  builderBackWrap: {
    padding: Spacing.xs,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimizeIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  builderTitleCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderTitle: {
    fontSize: Typography.body,
    fontWeight: '500',
    letterSpacing: -0.11,
    textAlign: 'center',
  },
  builderSaveButton: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
  },
  builderSaveButtonText: {
    fontSize: Typography.label,
    fontWeight: '700' as const,
    letterSpacing: -0.11,
  },

  // ─── BUILDER INPUT ────────────────────────────────────────────────────────
  builderInputWrap: {
    marginBottom: Spacing.md,
  },

  // ─── BUILDER CARD (matches tmlsn-routines Card) ────────────────────────────
  builderCard: {
    padding: Spacing.md,
    marginVertical: 0,
  },
  builderSummary: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  builderSummaryText: {
    fontSize: Typography.label,
    fontWeight: '500',
    letterSpacing: -0.11,
  },
  builderHelperText: {
    fontSize: Typography.label,
    fontWeight: '500',
    letterSpacing: -0.11,
    marginBottom: 12,
    lineHeight: 18,
  },

  // ─── BUILDER EXERCISE BLOCKS ──────────────────────────────────────────────
  builderExerciseBlock: {
    marginBottom: 12,
  },
  builderExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  builderExerciseDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderExerciseDotText: {
    fontSize: Typography.label,
    fontWeight: '700' as const,
    letterSpacing: -0.11,
  },
  builderExerciseContent: {
    flex: 1,
  },
  builderExerciseName: {
    fontSize: Typography.label,
    fontWeight: '500',
    letterSpacing: -0.11,
  },
  builderInputsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingLeft: 34,
  },
  builderNumericInputWrap: {
    flex: 1,
    minWidth: 0,
  },
  builderInputLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    letterSpacing: -0.11,
  },
  builderNumericInput: {
    fontSize: Typography.label,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 36,
  },
  builderRemoveButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderRemoveButtonText: {
    fontSize: Typography.label,
    fontWeight: '700' as const,
  },

  // ─── BUILDER ADD BUTTON (matches addSetButtonBlock) ────────────────────────
  builderAddButton: {
    alignSelf: 'stretch',
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  builderAddButtonText: {
    fontSize: Typography.label,
    fontWeight: '600' as const,
    letterSpacing: -0.11,
  },
});
