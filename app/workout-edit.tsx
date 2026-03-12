import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Colors, Typography, Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { getWorkoutSessions, getUserSettings, deleteWorkoutSession, updateWorkoutSession } from '../utils/storage';
import { getSessionDisplayName } from '../utils/workoutSessionDisplay';
import { WorkoutSession } from '../types';
import { fromDisplayWeight, toDisplayVolume } from '../utils/units';
import { generateId } from '../utils/helpers';
import { useButtonSound } from '../hooks/useButtonSound';
import { HomeGradientBackground } from '../components/HomeGradientBackground';
import { WorkoutSetTable } from '../components/WorkoutSetTable';
import { buildPrevSetsAndGhost } from '../utils/workoutSetTable';
import { EXERCISE_MAP, getLoadEntryModeForExercise } from '../utils/exerciseDb/exerciseDatabase';
import { supabaseFetchUserExercises } from '../utils/supabaseStorage';
import { useAuth } from '../context/AuthContext';
import type { Exercise as DbExercise } from '../utils/exerciseDb/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

const SET_TABLE_FLEX = {
  set: 0.85,
  previous: 0.8,
  weight: 0.95,
  reps: 0.95,
  rpe: 0.75,
  check: 0.65,
} as const;

export default function WorkoutEditScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { playIn, playOut } = useButtonSound();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');
  const [commitOutsideTrigger, setCommitOutsideTrigger] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [userSettings, setUserSettings] = useState<{ dumbbellWeightPreference?: 'per_hand' | 'total' } | null>(null);
  const [userExercises, setUserExercises] = useState<DbExercise[]>([]);
  const { user } = useAuth();

  const scrollRef = useRef<ScrollView>(null);
  const sessionRef = useRef<WorkoutSession | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const [sessions, settings] = await Promise.all([getWorkoutSessions(), getUserSettings()]);
        const found = sessions.find((s) => s.id === sessionId);
        if (found) setSession(JSON.parse(JSON.stringify(found)));
        setWeightUnit(settings?.weightUnit ?? 'lb');
        setUserSettings(settings);
        setRecentSessions(sessions.filter((s) => s.id !== sessionId).slice(0, 10));
        if (user?.id) {
          supabaseFetchUserExercises(user.id).then(setUserExercises);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, user?.id]);

  const updateSet = useCallback((
    exerciseIndex: number,
    setIndex: number,
    updates: { weight?: number; reps?: number; completed?: boolean; rpe?: number | null }
  ) => {
    setSession((prev) => {
      if (!prev) return prev;
      const ex = prev.exercises[exerciseIndex];
      if (!ex) return prev;
      const updatedSets = [...ex.sets];
      const cur = updatedSets[setIndex];
      if (!cur) return prev;
      updatedSets[setIndex] = {
        ...cur,
        ...(updates.weight !== undefined && { weight: fromDisplayWeight(updates.weight, weightUnit) }),
        ...(updates.reps !== undefined && { reps: updates.reps }),
        ...(updates.completed !== undefined && { completed: updates.completed }),
        ...(updates.rpe !== undefined && { rpe: updates.rpe }),
      };
      const updatedExercises = [...prev.exercises];
      updatedExercises[exerciseIndex] = { ...ex, sets: updatedSets };
      return { ...prev, exercises: updatedExercises };
    });
  }, [weightUnit]);

  const addSet = (exerciseIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const ex = prev.exercises[exerciseIndex];
      const lastSet = ex.sets[ex.sets.length - 1];
      const newSet = {
        id: generateId(),
        weight: lastSet?.weight ?? 0,
        reps: lastSet?.reps ?? 0,
        completed: false,
        rpe: null,
        notes: null,
      };
      const updatedExercises = [...prev.exercises];
      updatedExercises[exerciseIndex] = { ...ex, sets: [...ex.sets, newSet] };
      return { ...prev, exercises: updatedExercises };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const ex = prev.exercises[exerciseIndex];
      const updatedSets = ex.sets.filter((_, i) => i !== setIndex);
      const updatedExercises = [...prev.exercises];
      updatedExercises[exerciseIndex] = { ...ex, sets: updatedSets };
      return { ...prev, exercises: updatedExercises };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSave = async () => {
    const latest = sessionRef.current;
    if (!latest) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateWorkoutSession(latest);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!session) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Delete Workout?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWorkoutSession(session.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete workout.');
            }
          },
        },
      ]
    );
  };

  if (loading || !session) {
    return (
      <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
        <HomeGradientBackground />
      </View>
    );
  }

  const completedSetsCount = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0
  );
  const totalVolumeRaw = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).reduce((a, s) => a + s.weight * s.reps, 0), 0
  );
  const totalVolumeDisplay = toDisplayVolume(totalVolumeRaw, weightUnit);

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      <HomeGradientBackground />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 12,
              paddingBottom: Math.max(160, insets.bottom + 120),
              paddingLeft: Math.max(8, insets.left),
              paddingRight: Math.max(8, insets.right),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setCommitOutsideTrigger((t) => t + 1)}>

            {/* ─── TOP BAR ─── */}
            <View style={[styles.topBar, { paddingLeft: 4, paddingRight: insets.right + 4, paddingVertical: 8 }]}>
              <Pressable
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={() => router.back()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.backWrap}
              >
                <View style={styles.backCircle}>
                  <LinearGradient
                    colors={colors.tabBarBorder as [string, string]}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: 15 }]}
                  />
                  <LinearGradient
                    colors={colors.tabBarFill as [string, string]}
                    style={{ position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderRadius: 14 }}
                  />
                  <Ionicons name="chevron-back" size={18} color={colors.primaryLight} />
                </View>
              </Pressable>

              <View style={styles.topCenter} pointerEvents="box-none">
                <Text style={[styles.topTitle, { color: colors.primaryLight }]} numberOfLines={1}>
                  {getSessionDisplayName(session)}
                </Text>
                <Text style={[styles.topSubtitle, { color: colors.primaryLight + '80' }]}>
                  {format(new Date(session.date), 'MMM d, yyyy').toLowerCase()}
                </Text>
              </View>

              <View style={styles.topRight}>
                <Pressable
                  onPressIn={playIn}
                  onPressOut={playOut}
                  onPress={handleDelete}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.deleteIconBtn}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.primaryLight + '70'} />
                </Pressable>
                <Pressable
                  onPressIn={playIn}
                  onPressOut={playOut}
                  onPress={handleSave}
                  disabled={saving}
                  style={[styles.saveButton, { backgroundColor: colors.primaryLight }]}
                >
                  <Text style={[styles.saveButtonText, { color: colors.primaryDark }]}>
                    {saving ? 'Saving…' : 'Save'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* ─── SUMMARY STATS ─── */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryPill, { backgroundColor: colors.primaryLight + '12' }]}>
                <Text style={[styles.summaryIcon, { color: colors.primaryLight + '80' }]}>⚖</Text>
                <Text style={[styles.summaryValue, { color: colors.primaryLight }]}>{Math.round(totalVolumeDisplay).toLocaleString()}</Text>
                <Text style={[styles.summaryUnit, { color: colors.primaryLight + '80' }]}>{weightUnit}</Text>
              </View>
              <View style={[styles.summaryPill, { backgroundColor: colors.primaryLight + '12' }]}>
                <Text style={[styles.summaryIcon, { color: colors.primaryLight + '80' }]}>◉</Text>
                <Text style={[styles.summaryValue, { color: colors.primaryLight }]}>{completedSetsCount}</Text>
                <Text style={[styles.summaryUnit, { color: colors.primaryLight + '80' }]}>sets</Text>
              </View>
              <View style={[styles.summaryPill, { backgroundColor: colors.primaryLight + '12' }]}>
                <Text style={[styles.summaryIcon, { color: colors.primaryLight + '80' }]}>◎</Text>
                <Text style={[styles.summaryValue, { color: colors.primaryLight }]}>{session.exercises.length}</Text>
                <Text style={[styles.summaryUnit, { color: colors.primaryLight + '80' }]}>exercises</Text>
              </View>
            </View>

            {/* ─── EXERCISE BLOCKS ─── */}
            {session.exercises.map((exercise, exerciseIndex) => (
              <View
                key={exercise.id}
                style={[styles.exerciseBlock, { backgroundColor: colors.primaryLight + '08', borderColor: colors.primaryLight + '15' }]}
              >
                {/* Exercise header */}
                <View style={styles.exerciseBlockHeader}>
                  <View style={styles.exerciseBlockTitleRow}>
                    <View style={[styles.exerciseBlockIcon, { backgroundColor: colors.primaryLight + '15' }]}>
                      <Text style={[styles.exerciseBlockIconText, { color: colors.primaryLight + '80' }]}>◆</Text>
                    </View>
                    <Text style={[styles.exerciseBlockName, { color: colors.primaryLight }]}>{exercise.name}</Text>
                  </View>
                </View>

                {(() => {
                  const { prevSets, ghostWeight, ghostReps } = buildPrevSetsAndGhost(exercise, {}, recentSessions, weightUnit);
                  const dbEx = (exercise.exerciseDbId && EXERCISE_MAP.get(exercise.exerciseDbId))
                    ?? userExercises.find((ue) => ue.id === exercise.exerciseDbId || ue.name === exercise.name);
                  const loadEntryMode = dbEx ? getLoadEntryModeForExercise(dbEx, userSettings) : 'total';
                  return (
                    <WorkoutSetTable
                      exercise={exercise}
                      exerciseIndex={exerciseIndex}
                      prevSets={prevSets}
                      ghostWeight={ghostWeight}
                      ghostReps={ghostReps}
                      weightUnit={weightUnit}
                      colors={colors}
                      loadEntryMode={loadEntryMode}
                      updateSet={updateSet}
                      onRemoveSet={removeSet}
                      onAddSet={addSet}
                      keyboardHeight={keyboardHeight}
                      externalCommitTrigger={commitOutsideTrigger}
                      playIn={playIn}
                      playOut={playOut}
                    />
                  );
                })()}
              </View>
            ))}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 8 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  backWrap: {
    padding: Spacing.xs,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  topCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: Typography.body,
    fontWeight: '500',
    letterSpacing: -0.11,
    textAlign: 'center',
  },
  topSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.11,
    textAlign: 'center',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  deleteIconBtn: {
    padding: 8,
  },
  saveButton: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: Typography.label,
    fontWeight: '700',
    letterSpacing: -0.11,
  },

  // Summary stats
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    gap: 10,
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  summaryIcon: { fontSize: 12 },
  summaryValue: { fontSize: 14, fontWeight: '700', letterSpacing: -0.11 },
  summaryUnit: { fontSize: Typography.label, fontWeight: '500', letterSpacing: -0.11 },

  // Exercise block
  exerciseBlock: {
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.md,
    paddingBottom: 12,
  },
  exerciseBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseBlockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  exerciseBlockIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseBlockIconText: { fontSize: 14 },
  exerciseBlockName: {
    fontSize: Typography.body,
    fontWeight: '500',
    letterSpacing: -0.11,
    flex: 1,
  },

  // Set table header
  setTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
    width: '100%',
  },
  setHeaderLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  // Set rows
  setBlock: {},
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    width: '100%',
  },
  setCell: {
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  cellCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  setDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDotText: { fontSize: 12, fontWeight: '600' },
  setCellDim: { fontSize: 12, fontWeight: '400', textAlign: 'center' },

  // Inputs
  inputCellActive: {
    borderRadius: 10,
    borderWidth: 1,
    width: 52,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rpeInputOverride: { width: 44 },
  inputInner: { marginBottom: 0, width: '100%', height: '100%' },
  inputText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    width: 52,
    height: 40,
    paddingHorizontal: 4,
    paddingVertical: 0,
    marginBottom: 0,
    minHeight: 0,
    borderWidth: 0,
  },
  inputPlaceholder: {
    borderRadius: 10,
    width: 52,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputPlaceholderText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  rpePlaceholder: {
    borderRadius: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Check button
  checkWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Swipe delete
  swipeDeleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginBottom: 4,
  },
  swipeDeleteText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Add set button
  addSetBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addSetBtnText: { fontSize: 14, fontWeight: '600', letterSpacing: -0.11 },

  // Keyboard confirm bar
  keyboardBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 20,
    paddingLeft: 20,
  },
  confirmPillTouchable: { width: 52, height: 48 },
  confirmPill: { width: 52, height: 48, borderRadius: 24, overflow: 'hidden' },
  confirmPillShell: {
    position: 'absolute',
    top: 1, left: 1, right: 1, bottom: 1,
    borderRadius: 23,
    overflow: 'hidden',
  },
  confirmPillInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
