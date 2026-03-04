import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Spacing, Typography, Colors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { getWorkoutSessions, getUserSettings, deleteWorkoutSession, updateWorkoutSession } from '../utils/storage';
import { getSessionDisplayName } from '../utils/workoutSessionDisplay';
import { WorkoutSession, Set } from '../types';
import { formatWeightDisplay, toDisplayWeight, fromDisplayWeight, toDisplayVolume, parseNumericInput } from '../utils/units';
import { HomeGradientBackground } from '../components/HomeGradientBackground';
import { StickyGlassHeader } from '../components/ui/StickyGlassHeader';
import { LiquidGlassPill } from '../components/ui/liquidGlass';
import { generateId } from '../utils/helpers';

const C_TEXT = Colors.primaryLight;

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { sessionId, edit } = useLocalSearchParams<{ sessionId: string; edit: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [editedSession, setEditedSession] = useState<WorkoutSession | null>(null);
  const [isEditing, setIsEditing] = useState(edit === 'true');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');
  const [headerHeight, setHeaderHeight] = useState(0);
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  useEffect(() => {
    async function load() {
      if (!sessionId) return;
      try {
        const [loadedSessions, settings] = await Promise.all([
          getWorkoutSessions(),
          getUserSettings(),
        ]);
        const found = loadedSessions.find((s) => s.id === sessionId);
        if (found) {
          setSession(found);
          setEditedSession(JSON.parse(JSON.stringify(found)));
        }
        setWeightUnit(settings?.weightUnit ?? 'lb');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  const handleEnterEdit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (session) setEditedSession(JSON.parse(JSON.stringify(session)));
    setIsEditing(true);
  }, [session]);

  const handleCancelEdit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (session) setEditedSession(JSON.parse(JSON.stringify(session)));
    setIsEditing(false);
  }, [session]);

  const handleSave = useCallback(async () => {
    if (!editedSession) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateWorkoutSession(editedSession);
      setSession(editedSession);
      setIsEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }, [editedSession]);

  const handleDelete = useCallback(() => {
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
  }, [session, router]);

  const updateSetField = useCallback((
    exIdx: number,
    setIdx: number,
    field: 'weight' | 'reps',
    rawValue: string
  ) => {
    if (!editedSession) return;
    const updated: WorkoutSession = JSON.parse(JSON.stringify(editedSession));
    const s = updated.exercises[exIdx].sets[setIdx];
    if (field === 'weight') {
      const n = parseNumericInput(rawValue, 'float');
      if (n !== null) s.weight = fromDisplayWeight(n, weightUnit);
    } else {
      const n = parseNumericInput(rawValue, 'int');
      if (n !== null) s.reps = n;
    }
    setEditedSession(updated);
  }, [editedSession, weightUnit]);

  const addSet = useCallback((exIdx: number) => {
    if (!editedSession) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated: WorkoutSession = JSON.parse(JSON.stringify(editedSession));
    const ex = updated.exercises[exIdx];
    const lastSet = ex.sets[ex.sets.length - 1];
    ex.sets.push({
      id: generateId(),
      weight: lastSet?.weight ?? 0,
      reps: lastSet?.reps ?? 0,
      completed: true,
      rpe: null,
      notes: null,
    });
    setEditedSession(updated);
  }, [editedSession]);

  const removeSet = useCallback((exIdx: number, setIdx: number) => {
    if (!editedSession) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated: WorkoutSession = JSON.parse(JSON.stringify(editedSession));
    updated.exercises[exIdx].sets.splice(setIdx, 1);
    setEditedSession(updated);
  }, [editedSession]);

  const backButton = (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isEditing) {
          handleCancelEdit();
        } else {
          router.back();
        }
      }}
      style={({ pressed }) => [styles.backChip, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <View style={styles.backChipInner}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(47,48,49,0.40)' }]} />
        <LinearGradient
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.03)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <Ionicons name="chevron-back" size={20} color={C_TEXT} style={{ zIndex: 2 }} />
      </View>
    </Pressable>
  );

  const displaySession = isEditing ? editedSession : session;

  if (loading || !displaySession) {
    return (
      <View style={styles.container}>
        <HomeGradientBackground />
        <View style={[styles.loadingHeader, { paddingTop: insets.top + 8 }]}>
          {backButton}
        </View>
        <ActivityIndicator style={{ marginTop: insets.top + Spacing.xxl }} color={colors.primaryLight} />
      </View>
    );
  }

  const rawVolume = displaySession.exercises.reduce(
    (acc, ex) =>
      acc + ex.sets.filter((s) => s.completed).reduce((sacc, set) => sacc + set.weight * set.reps, 0),
    0
  );
  const volumeDisplay = toDisplayVolume(rawVolume, weightUnit);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <HomeGradientBackground />

      <StickyGlassHeader
        title=""
        leftSlot={null}
        topPadding={8}
        topSlotMarginBottom={10}
        topSlot={
          <View style={styles.headerTopRow}>
            {backButton}
            <View style={styles.headerInfoBlock}>
              <Text style={[styles.headerTitle, { color: colors.primaryLight }]} numberOfLines={1}>
                {getSessionDisplayName(displaySession).toLowerCase()}.
              </Text>
              <Text style={[styles.headerDate, { color: colors.primaryLight + '60' }]}>
                {format(new Date(displaySession.date), 'MMM d, yyyy • h:mm a').toLowerCase()}
              </Text>
            </View>
            <View style={styles.headerPillsRow}>
              {isEditing ? (
                <>
                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    style={({ pressed }) => [styles.headerActionBtn, styles.saveBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDelete}
                    style={({ pressed }) => [styles.headerActionBtn, styles.deleteBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                  </Pressable>
                </>
              ) : (
                <>
                  <LiquidGlassPill
                    label={`${displaySession.duration}m`}
                    scrubEnabled={false}
                  />
                  <LiquidGlassPill
                    label={`${formatWeightDisplay(volumeDisplay, weightUnit)} ${weightUnit}`}
                    scrubEnabled={false}
                  />
                  <Pressable
                    onPress={handleEnterEdit}
                    style={({ pressed }) => [styles.headerActionBtn, styles.editBtn, pressed && { opacity: 0.7 }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="pencil" size={15} color={colors.primaryLight + 'CC'} />
                  </Pressable>
                </>
              )}
            </View>
          </View>
        }
        scrollY={scrollY}
        onLayout={setHeaderHeight}
      >
        {null}
      </StickyGlassHeader>

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + 8, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {displaySession.exercises.map((ex, i) => (
          <View key={ex.id} style={styles.exerciseCardWrap}>
            <View style={styles.glassCard}>
              <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFillObject, styles.glassRadius]} />
              <View style={[StyleSheet.absoluteFillObject, styles.glassFill, styles.glassRadius]} />
              <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }} style={[StyleSheet.absoluteFillObject, styles.glassRadius]} pointerEvents="none" />
              <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.18 }} style={[StyleSheet.absoluteFillObject, styles.glassRadius]} pointerEvents="none" />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.22)']} start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, styles.glassRadius]} pointerEvents="none" />
              <View style={[StyleSheet.absoluteFillObject, styles.glassBorder, styles.glassRadius]} pointerEvents="none" />
              <View style={styles.exerciseCardContent}>
                <Text style={[styles.exerciseTitle, { color: colors.primaryLight }]}>
                  {i + 1}. {ex.name}
                </Text>
                {ex.notes ? (
                  <Text style={[styles.exerciseNotes, { color: colors.primaryLight + 'A0' }]}>{ex.notes}</Text>
                ) : null}

                <View style={[styles.setRowHeader, { borderBottomColor: colors.primaryLight + '30' }]}>
                  <Text style={[styles.setColText, { flex: 0.5, color: colors.primaryLight + '80' }]}>Set</Text>
                  <Text style={[styles.setColText, { flex: 1, color: colors.primaryLight + '80' }]}>Weight</Text>
                  <Text style={[styles.setColText, { flex: 1, color: colors.primaryLight + '80' }]}>Reps</Text>
                  {isEditing && <View style={{ width: 28 }} />}
                </View>

                {ex.sets.map((set, sIdx) => {
                  const displayWt = toDisplayWeight(set.weight, weightUnit);
                  const isCompleted = set.completed;
                  if (isEditing) {
                    return (
                      <View key={set.id} style={styles.setRow}>
                        <Text style={[styles.setValText, { flex: 0.5, color: colors.primaryLight }]}>{sIdx + 1}</Text>
                        <TextInput
                          style={[styles.setInput, { flex: 1, color: colors.primaryLight }]}
                          defaultValue={displayWt > 0 ? String(Math.round(displayWt * 100) / 100) : '0'}
                          keyboardType="decimal-pad"
                          returnKeyType="done"
                          onEndEditing={(e) => updateSetField(i, sIdx, 'weight', e.nativeEvent.text)}
                          selectTextOnFocus
                          placeholderTextColor={colors.primaryLight + '40'}
                        />
                        <TextInput
                          style={[styles.setInput, { flex: 1, color: colors.primaryLight }]}
                          defaultValue={set.reps > 0 ? String(set.reps) : '0'}
                          keyboardType="number-pad"
                          returnKeyType="done"
                          onEndEditing={(e) => updateSetField(i, sIdx, 'reps', e.nativeEvent.text)}
                          selectTextOnFocus
                          placeholderTextColor={colors.primaryLight + '40'}
                        />
                        <Pressable
                          onPress={() => removeSet(i, sIdx)}
                          disabled={ex.sets.length <= 1}
                          hitSlop={8}
                          style={{ width: 28, alignItems: 'center' }}
                        >
                          <Ionicons
                            name="remove-circle-outline"
                            size={18}
                            color={ex.sets.length <= 1 ? colors.primaryLight + '25' : '#FF6B6B'}
                          />
                        </Pressable>
                      </View>
                    );
                  }
                  return (
                    <View key={set.id}>
                      <View style={[styles.setRow, !isCompleted && { opacity: 0.5 }]}>
                        <Text style={[styles.setValText, { flex: 0.5, color: colors.primaryLight }]}>{sIdx + 1}</Text>
                        <Text style={[styles.setValText, { flex: 1, color: colors.primaryLight }]}>
                          {displayWt > 0 ? displayWt : '-'} {weightUnit}
                        </Text>
                        <Text style={[styles.setValText, { flex: 1, color: colors.primaryLight }]}>
                          {set.reps > 0 ? set.reps : '-'}
                        </Text>
                      </View>
                      {(set as Set & { notes?: string }).notes ? (
                        <View style={styles.setNotesRow}>
                          <Text style={[styles.setNotesText, { color: colors.primaryLight + '80' }]}>Note: {(set as Set & { notes?: string }).notes}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                {isEditing && (
                  <Pressable
                    onPress={() => addSet(i)}
                    style={({ pressed }) => [styles.addSetBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={colors.primaryLight + 'AA'} />
                    <Text style={[styles.addSetText, { color: colors.primaryLight + 'AA' }]}>Add Set</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        ))}
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

const GLASS_RADIUS = 16;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2F3031' },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg },
  loadingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backChip: { borderRadius: 20, overflow: 'hidden' },
  backChipInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(198,198,198,0.18)',
    overflow: 'hidden',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerInfoBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'left',
  },
  headerDate: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'left',
  },
  headerPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  headerActionBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    backgroundColor: 'rgba(100,200,100,0.18)',
    borderColor: 'rgba(100,200,100,0.35)',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7EE8A2',
  },
  deleteBtn: {
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderColor: 'rgba(255,107,107,0.30)',
  },
  editBtn: {
    paddingHorizontal: 10,
    backgroundColor: 'rgba(198,198,198,0.10)',
    borderColor: 'rgba(198,198,198,0.22)',
  },
  exerciseCardWrap: {
    borderRadius: GLASS_RADIUS,
    marginBottom: Spacing.md,
    overflow: 'visible' as const,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  glassCard: {
    borderRadius: GLASS_RADIUS,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  glassRadius: { borderRadius: GLASS_RADIUS },
  glassFill: { backgroundColor: 'rgba(47, 48, 49, 0.30)' },
  glassBorder: { borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },
  exerciseCardContent: { padding: Spacing.lg, zIndex: 1 },
  exerciseTitle: { fontSize: Typography.body, fontWeight: '600', marginBottom: Spacing.xs },
  exerciseNotes: { fontSize: Typography.label, fontStyle: 'italic', marginBottom: Spacing.sm },
  setRowHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.xs,
  },
  setColText: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  setRow: { flexDirection: 'row', paddingVertical: Spacing.sm, alignItems: 'center' },
  setValText: { fontSize: Typography.body, textAlign: 'center' },
  setInput: {
    fontSize: Typography.body,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(198,198,198,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(198,198,198,0.22)',
    marginHorizontal: 2,
  },
  setNotesRow: { paddingLeft: 40, paddingBottom: Spacing.sm },
  setNotesText: { fontSize: Typography.label, fontStyle: 'italic' },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
  },
  addSetText: { fontSize: 14, fontWeight: '500' },
});
