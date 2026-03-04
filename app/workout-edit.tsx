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
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Colors, Typography, Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { getWorkoutSessions, getUserSettings, deleteWorkoutSession, updateWorkoutSession } from '../utils/storage';
import { getSessionDisplayName } from '../utils/workoutSessionDisplay';
import { WorkoutSession } from '../types';
import { toDisplayWeight, fromDisplayWeight, toDisplayVolume, formatWeightDisplay, parseNumericInput } from '../utils/units';
import { generateId } from '../utils/helpers';
import { Input } from '../components/Input';
import { useButtonSound } from '../hooks/useButtonSound';
import { HomeGradientBackground } from '../components/HomeGradientBackground';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');

  const [editingCell, setEditingCell] = useState<{
    exerciseIndex: number;
    setIndex: number;
    field: 'weight' | 'reps' | 'rpe';
  } | null>(null);
  const [editingCellValue, setEditingCellValue] = useState('');
  const [pressedCheckRowKey, setPressedCheckRowKey] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const commitInProgressRef = useRef(false);
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
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

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

  const commitActiveField = useCallback((source: 'done' | 'outside' | 'blur') => {
    if (!editingCell) return;
    if (commitInProgressRef.current) return;
    commitInProgressRef.current = true;
    const { exerciseIndex, setIndex, field } = editingCell;
    if (field === 'weight') {
      const n = parseNumericInput(editingCellValue, 'float');
      if (n !== null) updateSet(exerciseIndex, setIndex, { weight: n });
    } else if (field === 'rpe') {
      const n = parseNumericInput(editingCellValue, 'float');
      if (n !== null) updateSet(exerciseIndex, setIndex, { rpe: Math.min(10, Math.max(1, n)) });
    } else {
      const n = parseNumericInput(editingCellValue, 'int');
      if (n !== null) updateSet(exerciseIndex, setIndex, { reps: n });
    }
    setEditingCell(null);
    setEditingCellValue('');
    Keyboard.dismiss();
    commitInProgressRef.current = false;
  }, [editingCell, editingCellValue, updateSet]);

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
          <Pressable style={{ flex: 1 }} onPress={() => commitActiveField('outside')}>

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

                {/* Set table header */}
                <View style={styles.setTableHeader}>
                  <View style={[styles.setCell, { flex: SET_TABLE_FLEX.set }]}>
                    <Text style={[styles.setHeaderLabel, { color: colors.primaryLight + '50' }]}>SET</Text>
                  </View>
                  <View style={[styles.setCell, { flex: SET_TABLE_FLEX.previous }]}>
                    <Text style={[styles.setHeaderLabel, { color: colors.primaryLight + '50' }]}>PREVIOUS</Text>
                  </View>
                  <View style={[styles.setCell, { flex: SET_TABLE_FLEX.weight }]}>
                    <Text style={[styles.setHeaderLabel, { color: colors.primaryLight + '50' }]}>{weightUnit.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.setCell, { flex: SET_TABLE_FLEX.reps }]}>
                    <Text style={[styles.setHeaderLabel, { color: colors.primaryLight + '50' }]}>REPS</Text>
                  </View>
                  <View style={[styles.setCell, { flex: SET_TABLE_FLEX.rpe }]}>
                    <Text style={[styles.setHeaderLabel, { color: colors.primaryLight + '50' }]}>RPE</Text>
                  </View>
                  <View style={[styles.setCell, { flex: SET_TABLE_FLEX.check }]}>
                    <Text style={[styles.setHeaderLabel, { color: colors.primaryLight + '50' }]}>✓</Text>
                  </View>
                </View>

                {/* Set rows */}
                {exercise.sets.map((set, setIndex) => {
                  const isCompleted = set.completed;
                  const rowKey = `${exerciseIndex}-${setIndex}`;
                  const prevSet = setIndex > 0 ? exercise.sets[setIndex - 1] : null;

                  return (
                    <View key={set.id} style={styles.setBlock}>
                      <Swipeable
                        renderRightActions={() => (
                          <Pressable
                            style={({ pressed }) => [styles.swipeDeleteAction, pressed && { opacity: 0.8 }]}
                            onPressIn={playIn}
                            onPressOut={playOut}
                            onPress={() => removeSet(exerciseIndex, setIndex)}
                          >
                            <Text style={styles.swipeDeleteText}>Delete</Text>
                          </Pressable>
                        )}
                        friction={2}
                        rightThreshold={40}
                      >
                        <View
                          style={[
                            styles.setRow,
                            isCompleted && pressedCheckRowKey !== rowKey && { backgroundColor: colors.primaryLight + '0A', borderColor: colors.primaryLight + '20' },
                            pressedCheckRowKey === rowKey && { backgroundColor: colors.primaryLight + '18', borderColor: colors.primaryLight + '25' },
                          ]}
                        >
                          {/* SET number */}
                          <View style={[styles.setCell, { flex: SET_TABLE_FLEX.set }]}>
                            <View style={[styles.setDot, { borderColor: colors.primaryLight + '30' }, isCompleted && { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight }]}>
                              <Text style={[styles.setDotText, { color: colors.primaryLight + '80' }, isCompleted && { color: colors.primaryDark }]}>
                                {setIndex + 1}
                              </Text>
                            </View>
                          </View>

                          {/* PREVIOUS */}
                          <View style={[styles.setCell, { flex: SET_TABLE_FLEX.previous }]}>
                            <Text style={[styles.setCellDim, { color: colors.primaryLight + '50' }]} numberOfLines={1} ellipsizeMode="tail">
                              {prevSet && prevSet.weight > 0
                                ? `${formatWeightDisplay(toDisplayWeight(prevSet.weight, weightUnit), weightUnit)}×${prevSet.reps}`
                                : '—'}
                            </Text>
                          </View>

                          {/* WEIGHT */}
                          <View style={[styles.setCell, { flex: SET_TABLE_FLEX.weight }]}>
                            <View style={styles.cellCenter}>
                              {editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'weight' ? (
                                <View style={[styles.inputCellActive, { borderColor: colors.primaryLight + '45', backgroundColor: colors.primaryLight + '12' }]}>
                                  <Input
                                    value={editingCellValue}
                                    onChangeText={setEditingCellValue}
                                    onBlur={() => commitActiveField('blur')}
                                    autoFocus
                                    keyboardType="decimal-pad"
                                    placeholder="—"
                                    multiline={false}
                                    maxLength={5}
                                    containerStyle={styles.inputInner}
                                    style={[styles.inputText, { color: colors.primaryLight, backgroundColor: 'transparent' }]}
                                    placeholderTextColor={colors.primaryLight + '50'}
                                    selectionColor={colors.primaryLight + '60'}
                                    textAlignVertical="center"
                                  />
                                </View>
                              ) : (
                                <Pressable
                                  onPressIn={playIn}
                                  onPressOut={playOut}
                                  onPress={() => {
                                    const v = set.weight > 0 ? formatWeightDisplay(toDisplayWeight(set.weight, weightUnit), weightUnit) : '';
                                    setEditingCell({ exerciseIndex, setIndex, field: 'weight' });
                                    setEditingCellValue(v);
                                  }}
                                  style={[styles.inputPlaceholder, { backgroundColor: colors.primaryLight + '0A' }]}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text style={[styles.inputPlaceholderText, set.weight > 0 ? { color: colors.primaryLight } : { color: colors.primaryLight + '40' }]}>
                                    {set.weight > 0 ? formatWeightDisplay(toDisplayWeight(set.weight, weightUnit), weightUnit) : '—'}
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                          </View>

                          {/* REPS */}
                          <View style={[styles.setCell, { flex: SET_TABLE_FLEX.reps }]}>
                            <View style={styles.cellCenter}>
                              {editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'reps' ? (
                                <View style={[styles.inputCellActive, { borderColor: colors.primaryLight + '45', backgroundColor: colors.primaryLight + '12' }]}>
                                  <Input
                                    value={editingCellValue}
                                    onChangeText={setEditingCellValue}
                                    onBlur={() => commitActiveField('blur')}
                                    autoFocus
                                    keyboardType="number-pad"
                                    placeholder="—"
                                    multiline={false}
                                    maxLength={4}
                                    containerStyle={styles.inputInner}
                                    style={[styles.inputText, { color: colors.primaryLight, backgroundColor: 'transparent' }]}
                                    placeholderTextColor={colors.primaryLight + '50'}
                                    selectionColor={colors.primaryLight + '60'}
                                    textAlignVertical="center"
                                  />
                                </View>
                              ) : (
                                <Pressable
                                  onPressIn={playIn}
                                  onPressOut={playOut}
                                  onPress={() => {
                                    const v = set.reps > 0 ? String(set.reps) : '';
                                    setEditingCell({ exerciseIndex, setIndex, field: 'reps' });
                                    setEditingCellValue(v);
                                  }}
                                  style={[styles.inputPlaceholder, { backgroundColor: colors.primaryLight + '0A' }]}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text style={[styles.inputPlaceholderText, set.reps > 0 ? { color: colors.primaryLight } : { color: colors.primaryLight + '40' }]}>
                                    {set.reps > 0 ? String(set.reps) : '—'}
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                          </View>

                          {/* RPE */}
                          <View style={[styles.setCell, { flex: SET_TABLE_FLEX.rpe }]}>
                            <View style={styles.cellCenter}>
                              {editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'rpe' ? (
                                <View style={[styles.inputCellActive, styles.rpeInputOverride, { borderColor: colors.primaryLight + '45', backgroundColor: colors.primaryLight + '12' }]}>
                                  <Input
                                    value={editingCellValue}
                                    onChangeText={setEditingCellValue}
                                    onBlur={() => commitActiveField('blur')}
                                    autoFocus
                                    keyboardType="decimal-pad"
                                    placeholder="—"
                                    multiline={false}
                                    maxLength={4}
                                    containerStyle={[styles.inputInner, styles.rpeInputOverride]}
                                    style={[styles.inputText, { color: colors.primaryLight, backgroundColor: 'transparent' }]}
                                    placeholderTextColor={colors.primaryLight + '50'}
                                    selectionColor={colors.primaryLight + '60'}
                                    textAlignVertical="center"
                                  />
                                </View>
                              ) : (
                                <Pressable
                                  onPressIn={playIn}
                                  onPressOut={playOut}
                                  onPress={() => {
                                    const v = set.rpe != null ? String(set.rpe) : '';
                                    setEditingCell({ exerciseIndex, setIndex, field: 'rpe' });
                                    setEditingCellValue(v);
                                  }}
                                  style={styles.rpePlaceholder}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text style={[styles.inputPlaceholderText, set.rpe != null ? { color: colors.primaryLight } : { color: colors.primaryLight + '30' }]}>
                                    {set.rpe != null ? String(set.rpe) : '—'}
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                          </View>

                          {/* CHECK */}
                          <View style={[styles.setCell, { flex: SET_TABLE_FLEX.check }]}>
                            <View style={styles.cellCenter}>
                              <Pressable
                                style={[
                                  styles.checkWrap,
                                  { borderColor: colors.primaryLight + '30' },
                                  isCompleted && { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
                                ]}
                                onPressIn={() => { playIn(); setPressedCheckRowKey(rowKey); }}
                                onPressOut={() => { playOut(); setPressedCheckRowKey(null); }}
                                onPress={() => {
                                  const nextCompleted = !set.completed;
                                  const isEditingThisSet = editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex;
                                  if (isEditingThisSet && editingCell) {
                                    const { field } = editingCell;
                                    if (field === 'weight') {
                                      const n = parseNumericInput(editingCellValue, 'float');
                                      if (n !== null) updateSet(exerciseIndex, setIndex, { weight: n, completed: nextCompleted });
                                      else updateSet(exerciseIndex, setIndex, { completed: nextCompleted });
                                    } else if (field === 'rpe') {
                                      const n = parseNumericInput(editingCellValue, 'float');
                                      if (n !== null) updateSet(exerciseIndex, setIndex, { rpe: Math.min(10, Math.max(1, n)), completed: nextCompleted });
                                      else updateSet(exerciseIndex, setIndex, { completed: nextCompleted });
                                    } else {
                                      const n = parseNumericInput(editingCellValue, 'int');
                                      if (n !== null) updateSet(exerciseIndex, setIndex, { reps: n, completed: nextCompleted });
                                      else updateSet(exerciseIndex, setIndex, { completed: nextCompleted });
                                    }
                                    setEditingCell(null);
                                    setEditingCellValue('');
                                    Keyboard.dismiss();
                                  } else {
                                    updateSet(exerciseIndex, setIndex, { completed: nextCompleted });
                                  }
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons
                                  name="checkmark"
                                  size={24}
                                  color={isCompleted ? colors.primaryDark : colors.primaryLight + '40'}
                                />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      </Swipeable>
                    </View>
                  );
                })}

                {/* Add Set */}
                <Pressable
                  style={({ pressed }) => [styles.addSetBtn, { backgroundColor: colors.primaryLight + '15' }, pressed && { opacity: 0.85 }]}
                  onPressIn={playIn}
                  onPressOut={playOut}
                  onPress={() => addSet(exerciseIndex)}
                >
                  <Text style={[styles.addSetBtnText, { color: colors.primaryLight + '90' }]}>+ Add Set</Text>
                </Pressable>
              </View>
            ))}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Keyboard confirm pill */}
      {editingCell && (
        <View style={[styles.keyboardBar, { bottom: keyboardHeight }]}>
          <Pressable
            onPressIn={playIn}
            onPressOut={playOut}
            onPress={() => commitActiveField('done')}
            style={styles.confirmPillTouchable}
            hitSlop={8}
          >
            <View style={styles.confirmPill}>
              <LinearGradient
                colors={colors.tabBarBorder as [string, string]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius: 24 }]}
              />
              <View style={[styles.confirmPillShell, { backgroundColor: (colors.tabBarFill as [string, string])[1] }]}>
                <View style={styles.confirmPillInner}>
                  <Ionicons name="checkmark" size={24} color={colors.primaryLight} />
                </View>
              </View>
            </View>
          </Pressable>
        </View>
      )}
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
