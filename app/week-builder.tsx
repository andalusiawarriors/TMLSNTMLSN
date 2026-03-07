// ============================================================
// TMLSN — Week Builder
// Builder mode: plan the 7-day week by assigning sessions or rest.
// Data stored in training.weekPlan (index 0=Mon … 6=Sun).
// UI matches FitnessHub style: card rows, no monospace, #ABABAB labels.
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUserSettings, saveUserSettings, getSavedRoutines, getStorageUserId } from '../utils/storage';
import { DEFAULT_TRAINING_SETTINGS } from '../constants/storageDefaults';
import { TMLSN_SPLITS } from '../constants/workoutSplits';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { workoutTypeToProtocolDay, getDefaultTmlsnExercises, toExerciseUuid } from '../lib/getTmlsnTemplate';
import type { TrainingSettings, WeekDayEntry, SavedRoutine } from '../types';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const S1     = '#1c1d1e';
const S2     = '#222324';
const TEXT   = '#edf0f2';
const SUB    = '#7a8690';
const MUTED  = '#404a52';
const GOLD   = '#D4B896';
const QS     = '#ABABAB';
const BORDER = 'rgba(255,255,255,0.05)';
const GREEN  = '#56a86a';
const PAD    = 16;

// ─── Day labels ───────────────────────────────────────────────────────────────
const DAYS     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

// Get current Monday's dates for the week
function getCurrentWeekDates(): Date[] {
  const today = new Date();
  const day   = today.getDay();
  const diff  = day === 0 ? -6 : 1 - day;
  const mon   = new Date(today);
  mon.setDate(today.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function isTodayIdx(dates: Date[]): number {
  const today = new Date().toDateString();
  return dates.findIndex((d) => d.toDateString() === today);
}

// ─── Session picker modal ─────────────────────────────────────────────────────

type PickerItem =
  | { type: 'split';   id: string; name: string }
  | { type: 'routine'; id: string; name: string }
  | { type: 'rest' }
  | { type: 'clear' };

function SessionPickerModal({
  visible,
  dayLabel,
  splits,
  routines,
  onPick,
  onClose,
}: {
  visible: boolean;
  dayLabel: string;
  splits: { id: string; name: string }[];
  routines: SavedRoutine[];
  onPick: (item: PickerItem) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={P.overlay} onPress={onClose}>
        <View style={P.sheet} onStartShouldSetResponder={() => true}>

          {/* Handle */}
          <View style={P.handle} />

          {/* Header */}
          <View style={P.header}>
            <Text style={P.headerTitle}>{dayLabel}</Text>
            <Text style={P.headerSub}>Pick a session or mark as rest</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>

            {/* TMLSN Splits */}
            {splits.length > 0 && (
              <>
                <Text style={P.sectionLabel}>TMLSN Routines</Text>
                {splits.map((s, i) => (
                  <Pressable
                    key={s.id}
                    style={({ pressed }) => [P.row, i < splits.length - 1 && P.rowBorder, pressed && { opacity: 0.7 }]}
                    onPress={() => onPick({ type: 'split', id: s.id, name: s.name })}
                  >
                    <Text style={P.rowName} numberOfLines={1}>{s.name}</Text>
                    <Text style={P.chevron}>›</Text>
                  </Pressable>
                ))}
              </>
            )}

            {/* User routines */}
            {routines.length > 0 && (
              <>
                <Text style={P.sectionLabel}>Your Routines</Text>
                {routines.map((r, i) => (
                  <Pressable
                    key={r.id}
                    style={({ pressed }) => [P.row, i < routines.length - 1 && P.rowBorder, pressed && { opacity: 0.7 }]}
                    onPress={() => onPick({ type: 'routine', id: r.id, name: r.name })}
                  >
                    <Text style={P.rowName} numberOfLines={1}>{r.name}</Text>
                    <Text style={P.chevron}>›</Text>
                  </Pressable>
                ))}
              </>
            )}

            {/* Rest / Clear */}
            <Text style={P.sectionLabel}>Options</Text>
            <Pressable
              style={({ pressed }) => [P.row, P.rowBorder, pressed && { opacity: 0.7 }]}
              onPress={() => onPick({ type: 'rest' })}
            >
              <Text style={P.rowName}>Rest Day</Text>
              <Text style={P.chevron}>›</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [P.row, pressed && { opacity: 0.7 }]}
              onPress={() => onPick({ type: 'clear' })}
            >
              <Text style={[P.rowName, { color: QS }]}>Clear</Text>
              <Text style={P.chevron}>›</Text>
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const P = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: S1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 22,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: MUTED,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 12,
    color: QS,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: QS,
    marginBottom: 8,
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '500',
    color: QS,
    flex: 1,
    letterSpacing: -0.2,
  },
  chevron: {
    fontSize: 20,
    color: QS,
    fontWeight: '300',
    lineHeight: 24,
  },
});

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayRow({
  dayLabel,
  date,
  entry,
  isToday,
  onPress,
}: {
  dayLabel: string;
  date: Date;
  entry: WeekDayEntry | undefined;
  isToday: boolean;
  onPress: () => void;
}) {
  const isRest = entry?.isRest;

  let sessionDisplay = '—';
  let sessionColor   = MUTED;
  if (isRest) {
    sessionDisplay = 'Rest';
    sessionColor   = SUB;
  } else if (entry?.sessionName) {
    sessionDisplay = entry.sessionName;
    sessionColor   = QS;
  }

  return (
    <Pressable
      style={({ pressed }) => [D.card, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <View style={D.dayInfo}>
        <Text style={[D.dayLabel, isToday && D.dayLabelToday]}>{dayLabel}</Text>
        <Text style={D.dateText}>{formatShortDate(date)}</Text>
      </View>
      <Text style={[D.sessionName, { color: sessionColor }]} numberOfLines={1}>
        {sessionDisplay}
      </Text>
      <Text style={D.chevron}>›</Text>
    </Pressable>
  );
}

const D = StyleSheet.create({
  card: {
    backgroundColor: '#2F3031',
    borderRadius: 16,
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  dayInfo: {
    width: 44,
    flexShrink: 0,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: QS,
    letterSpacing: -0.2,
  },
  dayLabelToday: {
    color: GOLD,
  },
  dateText: {
    fontSize: 10,
    color: QS,
    marginTop: 2,
  },
  sessionName: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    letterSpacing: -0.2,
  },
  chevron: {
    fontSize: 20,
    color: QS,
    fontWeight: '300',
    lineHeight: 24,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function WeekBuilderScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();

  const [training,  setTraining]  = useState<TrainingSettings | null>(null);
  const [routines,  setRoutines]  = useState<SavedRoutine[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  // Which day slot is being edited (0-6), or null
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const weekDates  = getCurrentWeekDates();
  const todayIdx   = isTodayIdx(weekDates);

  const load = useCallback(async () => {
    const [settings, savedRoutines] = await Promise.all([
      getUserSettings(),
      getSavedRoutines(),
    ]);
    const t = settings.training ?? DEFAULT_TRAINING_SETTINGS;
    setTraining({ ...DEFAULT_TRAINING_SETTINGS, ...t });
    setRoutines(savedRoutines);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rawPlan = training?.weekPlan ?? [];
  const weekPlan: WeekDayEntry[] = Array.from({ length: 7 }, (_, i) => rawPlan[i] ?? {});

  const handlePick = useCallback(async (item: PickerItem) => {
    if (editingIdx === null || !training) return;
    setEditingIdx(null);

    // Always build a full 7-entry plan from the current training state (avoids stale closure)
    const base = training.weekPlan ?? [];
    const newPlan: WeekDayEntry[] = Array.from({ length: 7 }, (_, i) => base[i] ?? {});

    if (item.type === 'rest') {
      newPlan[editingIdx] = { isRest: true };
    } else if (item.type === 'clear') {
      newPlan[editingIdx] = {};
    } else if (item.type === 'split') {
      newPlan[editingIdx] = { sessionName: item.name, splitId: item.id };
    } else if (item.type === 'routine') {
      newPlan[editingIdx] = { sessionName: item.name, routineId: item.id };
    }

    const updatedTraining = { ...training, weekPlan: newPlan };
    setTraining(updatedTraining);

    setSaving(true);
    try {
      // 1. Save weekPlan JSON blob (local display)
      const settings = await getUserSettings();
      await saveUserSettings({ ...settings, training: updatedTraining });

      // 2. Sync to workout_schedule table (read by TodaysSessionCarousel + Jarvis)
      const uid = getStorageUserId();
      if (supabase && isSupabaseConfigured() && uid) {
        const dayOfWeek = DAY_NAMES[editingIdx];

        if (item.type === 'clear') {
          await supabase
            .from('workout_schedule')
            .delete()
            .eq('user_id', uid)
            .eq('day_of_week', dayOfWeek);
        } else {
          let workoutType: string | null = null;
          let exerciseIds: string[] = [];
          let isRestDay = false;

          if (item.type === 'rest') {
            isRestDay = true;
          } else if (item.type === 'split') {
            workoutType = item.name;
            // TMLSN protocol splits: resolve exercises via protocol day
            const protocolDay = workoutTypeToProtocolDay(item.name);
            if (protocolDay) {
              exerciseIds = getDefaultTmlsnExercises(protocolDay).map((e) => e.id);
            } else {
              // Other TMLSN splits: look up directly
              const split = TMLSN_SPLITS.find((s) => s.id === item.id);
              exerciseIds = (split?.exercises ?? []).map((ex) => {
                const resolved = ex.name; // toExerciseUuid falls back to name-based UUID
                return toExerciseUuid(resolved);
              });
            }
          } else if (item.type === 'routine') {
            workoutType = item.name;
            const routine = routines.find((r) => r.id === item.id);
            if (routine) {
              exerciseIds = routine.exercises.map((ex) =>
                toExerciseUuid(ex.exerciseDbId ?? ex.id)
              );
            }
          }

          await supabase.from('workout_schedule').upsert(
            {
              user_id: uid,
              day_of_week: dayOfWeek,
              workout_type: workoutType,
              exercise_ids: exerciseIds,
              is_rest_day: isRestDay,
            },
            { onConflict: 'user_id,day_of_week' }
          );
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      if (__DEV__) console.warn('[WeekBuilder] save error:', e);
    } finally {
      setSaving(false);
    }
  }, [editingIdx, training, routines]);

  // Session count summary
  const sessionCount = weekPlan.filter(
    (e) => e && !e.isRest && (e.sessionName || e.splitId || e.routineId)
  ).length;
  const restCount = weekPlan.filter((e) => e?.isRest).length;

  if (!training) {
    return (
      <View style={[S.screen, { paddingTop: insets.top + 20, justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient
          colors={['#2F3031', '#1A1A1A']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
          pointerEvents="none"
        />
        <ActivityIndicator color={GOLD} style={{ zIndex: 1 }} />
      </View>
    );
  }

  const splits = TMLSN_SPLITS.map((s) => ({ id: s.id, name: s.name }));

  return (
    <View style={[S.screen, { paddingTop: insets.top }]}>
      {/* Background — matches FitnessHub (nutrition tab) */}
      <LinearGradient
        colors={['#2F3031', '#1A1A1A']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
        pointerEvents="none"
      />

      {/* ── Header ── */}
      <View style={S.header}>
        <Pressable
          style={({ pressed }) => [S.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={QS} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={S.headerEyebrow}>Builder</Text>
          <Text style={S.headerTitle}>Build your week.</Text>
        </View>
        {saving ? (
          <ActivityIndicator color={GOLD} size="small" />
        ) : saved ? (
          <Text style={S.savedBadge}>Saved ✓</Text>
        ) : null}
      </View>

      {/* ── Summary card ── */}
      <View style={S.summaryCard}>
        <View style={S.summaryItem}>
          <Text style={S.summaryCount}>{sessionCount}</Text>
          <Text style={S.summaryLabel}>sessions</Text>
        </View>
        <View style={S.summaryDivider} />
        <View style={S.summaryItem}>
          <Text style={S.summaryCount}>{restCount}</Text>
          <Text style={S.summaryLabel}>rest days</Text>
        </View>
        <View style={S.summaryDivider} />
        <View style={S.summaryItem}>
          <Text style={S.summaryCount}>{7 - sessionCount - restCount}</Text>
          <Text style={S.summaryLabel}>unplanned</Text>
        </View>
      </View>

      {/* ── Week rows ── */}
      <ScrollView
        style={S.scroll}
        contentContainerStyle={[S.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={S.weekLabel}>This Week</Text>

        <View style={S.dayList}>
          {DAYS.map((day, i) => (
            <DayRow
              key={day}
              dayLabel={day}
              date={weekDates[i]!}
              entry={weekPlan[i]}
              isToday={i === todayIdx}
              onPress={() => setEditingIdx(i)}
            />
          ))}
        </View>

        <Text style={S.hint}>
          Tap any day to assign a session, mark it as rest, or leave it unplanned.{'\n'}
          Changes save automatically.
        </Text>
      </ScrollView>

      {/* ── Session picker modal ── */}
      <SessionPickerModal
        visible={editingIdx !== null}
        dayLabel={editingIdx !== null ? `${DAYS[editingIdx]}  ·  ${formatShortDate(weekDates[editingIdx!]!)}` : ''}
        splits={splits}
        routines={routines}
        onPick={handlePick}
        onClose={() => setEditingIdx(null)}
      />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: QS,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  savedBadge: {
    fontSize: 11,
    color: GREEN,
    letterSpacing: 0.2,
  },

  // Summary card — matches FitnessHub card style
  summaryCard: {
    backgroundColor: '#2F3031',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: PAD,
    marginBottom: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontSize: 10,
    color: QS,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: BORDER,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: PAD,
    paddingTop: 20,
  },

  // Section label — matches FitnessHub toolsLabel
  weekLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: QS,
    marginBottom: 14,
  },

  // Day cards list
  dayList: {
    gap: 6,
  },

  hint: {
    fontSize: 11,
    color: SUB,
    lineHeight: 17,
    marginTop: 24,
    letterSpacing: 0.1,
  },
});
