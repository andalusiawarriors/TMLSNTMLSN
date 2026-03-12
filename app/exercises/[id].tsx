// ============================================================
// TMLSN — Exercise Detail
// Per-exercise: progress chart, muscle info, algorithm settings.
// System font only.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Polyline, Line, Rect, Text as SvgText, Circle } from 'react-native-svg';
import { EXERCISE_MAP, getLoadEntryModeForExercise } from '../../utils/exerciseDb/exerciseDatabase';
import type { Exercise } from '../../utils/exerciseDb/types';
import { getWorkoutSessions, getUserSettings } from '../../utils/storage';
import type { UserSettings } from '../../types';
import { supabaseFetchUserExercises } from '../../utils/supabaseStorage';
import { useAuth } from '../../context/AuthContext';
import {
  getExerciseSettings,
  saveExerciseSettings,
  toggleFavorite,
  DEFAULT_EXERCISE_SETTINGS,
} from '../../utils/exerciseSettings';
import { FlatFitnessBackground } from '../../components/FlatFitnessBackground';

// ── Layout & tokens ───────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const OUTER_PAD     = 20;
const CARD_RADIUS   = 22;
const CARD_GAP      = 14;
const BG            = '#1A1A1A';
const TEXT_PRIMARY  = '#C6C6C6';
const TEXT_DIM      = 'rgba(198,198,198,0.55)';
const TEXT_VERY_DIM = 'rgba(198,198,198,0.35)';
const GLASS_FILL    = 'rgba(47,48,49,0.42)';
const GLASS_BORDER  = 'rgba(198,198,198,0.18)';
const BLUR          = 22;

// Chart layout
const CHART_W       = SW - OUTER_PAD * 2;
const CHART_H       = 180;
const Y_AXIS_W      = 52;
const PLOT_W        = CHART_W - Y_AXIS_W;
const PAD_TOP       = 18;
const PAD_BOT       = 36; // room for x-axis labels
const PLOT_H        = CHART_H - PAD_TOP - PAD_BOT;

// ── Label mappings ────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', abs: 'Abs', full_body: 'Full Body',
  cardio: 'Cardio', olympic: 'Olympic',
};

const EQUIP_LABELS: Record<string, string> = {
  barbell: 'Bar', dumbbell: 'DB', cable: 'Cable', machine: 'Machine',
  bodyweight: 'BW', kettlebell: 'KB', ez_bar: 'EZ',
  smith_machine: 'Smith', resistance_band: 'Band', trx: 'TRX',
  plate: 'Plate', trap_bar: 'Trap Bar',
};

const MUSCLE_LABELS: Record<string, string> = {
  chest_upper: 'Upper Chest', chest_mid: 'Mid Chest', chest_lower: 'Lower Chest',
  lats: 'Lats', traps_upper: 'Traps', traps_mid: 'Traps', traps_lower: 'Traps',
  rhomboids: 'Rhomboids', erector_spinae: 'Erectors', teres_major: 'Teres Major',
  front_delts: 'Front Delts', side_delts: 'Side Delts', rear_delts: 'Rear Delts',
  rotator_cuff: 'Rotator Cuff',
  biceps_long: 'Biceps', biceps_short: 'Biceps', brachialis: 'Brachialis',
  brachioradialis: 'Brachioradialis',
  triceps_long: 'Triceps', triceps_lateral: 'Triceps', triceps_medial: 'Triceps',
  forearm_flexors: 'Forearms', forearm_extensors: 'Forearms',
  rectus_abdominis: 'Abs', obliques: 'Obliques', transverse_abdominis: 'Core', serratus: 'Serratus',
  quads_rectus_femoris: 'Quads', quads_vastus_lateralis: 'Quads',
  quads_vastus_medialis: 'Quads', quads_vastus_intermedius: 'Quads',
  hamstrings_biceps_femoris: 'Hamstrings', hamstrings_semitendinosus: 'Hamstrings',
  hamstrings_semimembranosus: 'Hamstrings',
  glutes_max: 'Glutes', glutes_med: 'Glutes Med', glutes_min: 'Glutes Min',
  hip_flexors: 'Hip Flexors', adductors: 'Adductors', abductors: 'Abductors',
  calves_gastrocnemius: 'Calves', calves_soleus: 'Soleus', tibialis_anterior: 'Tibialis',
};

// Smallest-increment cycle options
const INCREMENT_OPTIONS = [1.25, 2.5, 5, 10, 20];

// ── Chart data type ───────────────────────────────────────────
interface ChartPoint { date: string; maxWeight: number; volume: number }

// ── SVG Progress Chart ────────────────────────────────────────
function ProgressChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <View style={chartStyles.empty}>
        <Text style={chartStyles.emptyText}>
          No workout data yet — complete a session to see your progress.
        </Text>
      </View>
    );
  }

  const weights  = data.map((d) => d.maxWeight);
  const volumes  = data.map((d) => d.volume);
  const minW     = Math.min(...weights);
  const maxW     = Math.max(...weights);
  const maxVol   = Math.max(...volumes, 1);
  const wRange   = maxW - minW || 1;

  const toX = (i: number) => {
    if (data.length === 1) return Y_AXIS_W + PLOT_W / 2;
    return Y_AXIS_W + (i / (data.length - 1)) * PLOT_W;
  };
  const toY = (w: number) =>
    PAD_TOP + PLOT_H - ((w - minW) / wRange) * PLOT_H;

  const linePoints = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.maxWeight).toFixed(1)}`).join(' ');

  const yMid    = (minW + maxW) / 2;
  const fmtW    = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
  };

  // Which x-axis labels to show (avoid crowding)
  const maxLabels  = Math.min(data.length, 5);
  const step       = Math.max(1, Math.floor(data.length / maxLabels));
  const labelIdxs  = new Set<number>();
  for (let i = 0; i < data.length; i += step) labelIdxs.add(i);
  labelIdxs.add(data.length - 1);

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {/* Volume bars */}
      {data.map((d, i) => {
        const barH = (d.volume / maxVol) * PLOT_H;
        const bx   = toX(i);
        const barW = Math.max(4, Math.min(20, PLOT_W / data.length - 4));
        return (
          <Rect
            key={`bar-${i}`}
            x={bx - barW / 2}
            y={PAD_TOP + PLOT_H - barH}
            width={barW}
            height={barH}
            fill="rgba(198,198,198,0.10)"
            rx={3}
          />
        );
      })}

      {/* Y-axis grid lines */}
      {[minW, yMid, maxW].map((v, i) => {
        const y = toY(v);
        return (
          <Line
            key={`grid-${i}`}
            x1={Y_AXIS_W} y1={y} x2={CHART_W} y2={y}
            stroke="rgba(198,198,198,0.09)" strokeWidth={1}
          />
        );
      })}

      {/* Y-axis labels */}
      {[minW, yMid, maxW].map((v, i) => (
        <SvgText
          key={`yl-${i}`}
          x={Y_AXIS_W - 6} y={toY(v) + 4}
          fontSize={9} fill={TEXT_VERY_DIM} textAnchor="end"
        >
          {fmtW(v)}
        </SvgText>
      ))}

      {/* Line */}
      {data.length > 1 && (
        <Polyline
          points={linePoints}
          fill="none"
          stroke={TEXT_PRIMARY}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Dots */}
      {data.map((d, i) => (
        <Circle
          key={`dot-${i}`}
          cx={toX(i)} cy={toY(d.maxWeight)}
          r={3.5} fill={TEXT_PRIMARY}
        />
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => {
        if (!labelIdxs.has(i)) return null;
        return (
          <SvgText
            key={`xl-${i}`}
            x={toX(i)} y={CHART_H - 4}
            fontSize={9} fill={TEXT_VERY_DIM} textAnchor="middle"
          >
            {fmtDate(d.date)}
          </SvgText>
        );
      })}
    </Svg>
  );
}

const chartStyles = StyleSheet.create({
  empty: { height: 80, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyText: {
    color: TEXT_DIM, fontSize: 13, textAlign: 'center', lineHeight: 19,
  },
});

// ── Glass Card ────────────────────────────────────────────────
function GCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[gcStyles.outer, style]}>
      <BlurView intensity={BLUR} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: GLASS_FILL }]} />
      <LinearGradient
        colors={['rgba(255,255,255,0.09)', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: CARD_RADIUS }]}
        pointerEvents="none"
      />
      <View style={[StyleSheet.absoluteFillObject, gcStyles.border]} />
      <View style={gcStyles.content}>{children}</View>
    </View>
  );
}
const gcStyles = StyleSheet.create({
  outer: {
    borderRadius: CARD_RADIUS, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 12, elevation: 6,
  },
  border: {
    borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: GLASS_BORDER,
  },
  content: { padding: 18 },
});

// ── Stepper ───────────────────────────────────────────────────
interface StepperProps {
  value: number;
  label: string;
  onDecrement: () => void;
  onIncrement: () => void;
  display?: string;
}
function Stepper({ value, label, onDecrement, onIncrement, display }: StepperProps) {
  return (
    <View style={stepStyles.row}>
      <Text style={stepStyles.label}>{label}</Text>
      <View style={stepStyles.controls}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDecrement(); }}
          style={({ pressed }) => [stepStyles.btn, pressed && { opacity: 0.5 }]}
        >
          <Text style={stepStyles.btnText}>−</Text>
        </Pressable>
        <Text style={stepStyles.value}>{display ?? value}</Text>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onIncrement(); }}
          style={({ pressed }) => [stepStyles.btn, pressed && { opacity: 0.5 }]}
        >
          <Text style={stepStyles.btnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(198,198,198,0.08)',
  },
  label: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '500', flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  btn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(198,198,198,0.10)',
    borderWidth: 1, borderColor: GLASS_BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: TEXT_PRIMARY, fontSize: 18, lineHeight: 22, fontWeight: '400' },
  value: {
    color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600',
    minWidth: 44, textAlign: 'center',
  },
});

// ── Main Screen ───────────────────────────────────────────────
export default function ExerciseDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const builtinExercise = useMemo(() => (id ? EXERCISE_MAP.get(id) : undefined), [id]);
  const [userExercise, setUserExercise] = useState<Exercise | null | undefined>(undefined);

  useEffect(() => {
    if (builtinExercise || !id || !user?.id) {
      setUserExercise(builtinExercise ? null : undefined);
      return;
    }
    let active = true;
    supabaseFetchUserExercises(user.id).then((list) => {
      if (!active) return;
      const found = list.find((ex) => ex.id === id) ?? null;
      setUserExercise(found);
    });
    return () => { active = false; };
  }, [id, user?.id, builtinExercise]);

  const exercise = builtinExercise ?? (userExercise ?? undefined);

  const [chartData,  setChartData]  = useState<ChartPoint[]>([]);
  const [isFav,      setIsFav]      = useState(false);
  const [repLow,     setRepLow]     = useState(DEFAULT_EXERCISE_SETTINGS.repRangeLow);
  const [repHigh,    setRepHigh]    = useState(DEFAULT_EXERCISE_SETTINGS.repRangeHigh);
  const [incIdx,     setIncIdx]     = useState(
    INCREMENT_OPTIONS.indexOf(DEFAULT_EXERCISE_SETTINGS.smallestIncrement) !== -1
      ? INCREMENT_OPTIONS.indexOf(DEFAULT_EXERCISE_SETTINGS.smallestIncrement)
      : 1,
  );
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [saveState,  setSaveState]  = useState<'idle' | 'saved'>('idle');

  const increment = INCREMENT_OPTIONS[incIdx];

  // ── Load data ──
  useEffect(() => {
    if (!id) return;
    let active = true;

    (async () => {
      // Settings
      const [settings, userSettings] = await Promise.all([
        getExerciseSettings(id),
        getUserSettings(),
      ]);
      if (!active) return;
      setIsFav(settings.favorite);
      setRepLow(settings.repRangeLow);
      setRepHigh(settings.repRangeHigh);
      const idx = INCREMENT_OPTIONS.indexOf(settings.smallestIncrement);
      setIncIdx(idx !== -1 ? idx : 1);
      setWeightUnit((userSettings.weightUnit ?? 'kg') as 'kg' | 'lb');
      setUserSettings(userSettings);

      // Chart
      try {
        const sessions = await getWorkoutSessions();
        const nameLower = exercise?.name.toLowerCase() ?? '';
        const points: ChartPoint[] = [];
        const sorted = [...sessions].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        for (const session of sorted) {
          if (!session.isComplete) continue;
          const match = session.exercises?.find(
            (ex) =>
              ex.exerciseDbId === id ||
              ex.name.toLowerCase() === nameLower,
          );
          if (!match) continue;
          const completedSets = (match.sets ?? []).filter((s) => s.completed);
          if (completedSets.length === 0) continue;
          const maxWeight  = Math.max(...completedSets.map((s) => s.weight ?? 0));
          const totalVol   = completedSets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0);
          points.push({ date: session.date, maxWeight, volume: totalVol });
        }
        if (active) setChartData(points);
      } catch { /* ignore */ }
    })();

    return () => { active = false; };
  }, [id, exercise]);

  // ── Favorite toggle ──
  const handleToggleFav = useCallback(async () => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newFav = await toggleFavorite(id);
    setIsFav(newFav);
  }, [id]);

  // ── Save settings ──
  const handleSave = useCallback(async () => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await saveExerciseSettings(id, {
      repRangeLow: repLow,
      repRangeHigh: repHigh,
      smallestIncrement: INCREMENT_OPTIONS[incIdx],
    });
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2000);
  }, [id, repLow, repHigh, incIdx]);

  // ── Top muscles (must be before early returns to satisfy rules of hooks) ──
  const topMuscles = useMemo(
    () =>
      exercise
        ? [...exercise.muscles]
            .sort((a, b) => b.activationPercent - a.activationPercent)
            .slice(0, 4)
            .map((m) => ({ label: MUSCLE_LABELS[m.muscleId] ?? m.muscleId, pct: m.activationPercent }))
        : [],
    [exercise],
  );

  const equipLabels = exercise ? exercise.equipment.map((e) => EQUIP_LABELS[e] ?? e).join(', ') : '';
  const catLabel = exercise ? (CATEGORY_LABELS[exercise.category] ?? exercise.category) : '';
  const loadEntryMode = exercise
    ? (exercise.loadEntryMode ?? getLoadEntryModeForExercise(exercise, userSettings))
    : 'total';
  const isCustom = !!userExercise;
  const TITLE_TOP = insets.top + 8;

  const LOAD_ENTRY_LABELS: Record<string, string> = {
    total: 'Total weight', per_hand: 'Per hand', per_side: 'Per side',
  };

  // ── Loading (fetching user exercise) ──
  const isLoadingUserExercise = !builtinExercise && id && user?.id && userExercise === undefined;
  if (isLoadingUserExercise) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <FlatFitnessBackground />
        <Text style={{ color: TEXT_DIM, fontSize: 16 }}>Loading…</Text>
      </View>
    );
  }

  // ── Not found ──
  if (!exercise) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <FlatFitnessBackground />
        <Text style={{ color: TEXT_DIM, fontSize: 16 }}>Exercise not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: TEXT_PRIMARY, fontSize: 15 }}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatFitnessBackground />

      {/* ── Fixed header bar ── */}
      <View style={[styles.fixedHeader, { paddingTop: TITLE_TOP }]}>
        <BlurView intensity={BLUR} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: GLASS_FILL }]} />
        <View style={[StyleSheet.absoluteFillObject, styles.headerBorderBottom]} />
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
            hitSlop={12}
          >
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{exercise.name}</Text>
          <Pressable
            onPress={handleToggleFav}
            style={({ pressed }) => [styles.favBtn, pressed && { opacity: 0.5 }]}
            hitSlop={12}
          >
            <Text style={[styles.favStar, isFav && styles.favStarActive]}>
              {isFav ? '★' : '☆'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: TITLE_TOP + 52, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Exercise Info card ── */}
        <GCard>
          {/* Category + equipment + scope + load entry row */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{catLabel}</Text>
            </View>
            {isCustom && (
              <View style={styles.badgeCustom}>
                <Text style={styles.badgeText}>{'Custom'}</Text>
              </View>
            )}
            {loadEntryMode !== 'total' && (
              <View style={styles.badgeLoad}>
                <Text style={styles.badgeText}>{LOAD_ENTRY_LABELS[loadEntryMode] ?? loadEntryMode}</Text>
              </View>
            )}
            <Text style={styles.equipText}>{equipLabels}</Text>
          </View>

          {/* Muscles */}
          {topMuscles.length > 0 && (
            <View style={styles.muscleSection}>
              <Text style={styles.sectionTitle}>Primary Muscles</Text>
              {topMuscles.map((m, i) => (
                <View key={i} style={styles.muscleRow}>
                  <Text style={styles.muscleName}>{m.label}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${m.pct}%` }]} />
                  </View>
                  <Text style={styles.musclePct}>{m.pct}%</Text>
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          {exercise.description && (
            <Text style={styles.description}>{exercise.description}</Text>
          )}
          {exercise.tips && (
            <Text style={styles.tips}>{exercise.tips}</Text>
          )}
        </GCard>

        {/* ── Progress Chart card ── */}
        <GCard style={{ marginTop: CARD_GAP }}>
          <Text style={styles.cardTitle}>Weight Over Time</Text>
          <View style={styles.chartSubrow}>
            <Text style={styles.cardSubtitle}>
              {chartData.length > 0
                ? `${chartData.length} session${chartData.length !== 1 ? 's' : ''}`
                : 'no data yet'}
            </Text>
            {chartData.length > 0 && (
              <Text style={styles.cardSubtitle}>
                bars = volume · line = max weight
              </Text>
            )}
          </View>
          <View style={styles.chartWrap}>
            <ProgressChart data={chartData} />
          </View>
        </GCard>

        {/* ── Algorithm Settings card ── */}
        <GCard style={{ marginTop: CARD_GAP }}>
          <Text style={styles.cardTitle}>algorithm settings.</Text>
          <Text style={styles.algoExplain}>
            The TMLSN algorithm uses your rep range to decide when to increase weight.
            Once you hit all sets within the target rep range, it bumps the load by your
            weight increase.
          </Text>

          <View style={styles.stepperSection}>
            <Stepper
              label="Rep Range Low"
              value={repLow}
              onDecrement={() => setRepLow((v) => Math.max(1, v - 1))}
              onIncrement={() => setRepLow((v) => Math.min(repHigh - 1, v + 1))}
            />
            <Stepper
              label="Rep Range High"
              value={repHigh}
              onDecrement={() => setRepHigh((v) => Math.max(repLow + 1, v - 1))}
              onIncrement={() => setRepHigh((v) => v + 1)}
            />
            <Stepper
              label="Weight Increase"
              value={INCREMENT_OPTIONS[incIdx]}
              display={`${INCREMENT_OPTIONS[incIdx]} ${weightUnit === 'kg' ? 'kg' : 'lbs'}`}
              onDecrement={() => setIncIdx((i) => Math.max(0, i - 1))}
              onIncrement={() => setIncIdx((i) => Math.min(INCREMENT_OPTIONS.length - 1, i + 1))}
            />
          </View>

          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.saveBtnText}>
              {saveState === 'saved' ? 'Saved ✓' : 'Save Settings'}
            </Text>
          </Pressable>
        </GCard>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Fixed header
  fixedHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 100, overflow: 'hidden',
  },
  headerBorderBottom: {
    borderBottomWidth: 1, borderBottomColor: GLASS_BORDER,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    height: 52, paddingHorizontal: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backChevron: {
    color: TEXT_PRIMARY, fontSize: 30, lineHeight: 34,
    fontWeight: '300', marginTop: -2,
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    color: TEXT_PRIMARY, fontSize: 17, fontWeight: '600', letterSpacing: -0.3,
  },
  favBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  favStar:       { color: TEXT_DIM, fontSize: 22 },
  favStarActive: { color: '#F5C542' },

  // Scroll
  scrollContent: { paddingHorizontal: OUTER_PAD, gap: 0 },

  // Info card internals
  badgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  badge: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(198,198,198,0.12)',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  badgeCustom: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(198,198,198,0.08)',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  badgeLoad: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(198,198,198,0.12)',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  badgeText: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600' },
  equipText: { color: TEXT_DIM, fontSize: 12 },

  muscleSection: { marginBottom: 14 },
  sectionTitle: {
    color: TEXT_DIM, fontSize: 11, fontWeight: '600',
    letterSpacing: 0.3, marginBottom: 8,
  },
  muscleRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 7,
  },
  muscleName: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '500', width: 120 },
  barTrack: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(198,198,198,0.12)', marginHorizontal: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%', backgroundColor: 'rgba(198,198,198,0.55)',
    borderRadius: 2,
  },
  musclePct: { color: TEXT_DIM, fontSize: 11, width: 32, textAlign: 'right' },

  description: {
    color: TEXT_DIM, fontSize: 13, lineHeight: 19, marginTop: 4,
  },
  tips: {
    color: TEXT_VERY_DIM, fontSize: 12, lineHeight: 18, marginTop: 8,
    fontStyle: 'italic',
  },

  // Chart card
  cardTitle: {
    color: TEXT_PRIMARY, fontSize: 16, fontWeight: '600',
    letterSpacing: -0.3, marginBottom: 4,
  },
  cardSubtitle: { color: TEXT_DIM, fontSize: 11 },
  chartSubrow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 12,
  },
  chartWrap: { marginHorizontal: -18, overflow: 'hidden' },

  // Algorithm card
  algoExplain: {
    color: TEXT_DIM, fontSize: 13, lineHeight: 20,
    marginTop: 8, marginBottom: 16,
  },
  stepperSection: { gap: 0, marginBottom: 20 },

  saveBtn: {
    borderRadius: 16, height: 46,
    backgroundColor: 'rgba(198,198,198,0.12)',
    borderWidth: 1, borderColor: 'rgba(198,198,198,0.24)',
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: {
    color: TEXT_PRIMARY, fontSize: 15, fontWeight: '600',
  },
});
