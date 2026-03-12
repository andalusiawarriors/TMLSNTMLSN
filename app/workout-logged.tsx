import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';
import { FlatFitnessBackground } from '../components/FlatFitnessBackground';
import { getWorkoutSessions, getUserSettings } from '../utils/storage';
import { toDisplayVolume, toDisplayWeight, formatWeightDisplay, formatVolumeDisplay } from '../utils/units';
import { supabaseGetExercisePrescriptions } from '../utils/supabaseStorage';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { PostSessionSummary, type ExerciseSummaryItem } from '../components/PostSessionSummary';
import { shouldTriggerLowRpeWarning } from '../utils/rpe';
import { DynamicIslandRPEWarning } from '../components/DynamicIslandRPEWarning';
import { startRPEActivity, stopRPEActivity, sendRPENotification } from '../lib/liveActivity';
import type { DifficultyBand } from '../lib/progression/decideNextPrescription';
import { isDeloadWeek } from '../lib/progression/decideNextPrescription';

// ── Layout ─────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const OUTER_PAD = 20;
const TILE_GAP  = 12;
const TILE_SIZE = Math.floor((SW - OUTER_PAD * 2 - TILE_GAP) / 2);

// ── Color tokens (matches progress-graph.tsx exactly) ──────────
const C_TEXT     = Colors.primaryLight;           // '#C6C6C6'
const C_TEXT_DIM = 'rgba(198,198,198,0.55)';

// ── Stat tile (exact copy of StatSquareTile from progress-graph) ─
function StatSquareTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={tile.shadow}>
      <View style={tile.wrap}>
        <BlurView
          intensity={26}
          tint="dark"
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
        />
        <View style={[StyleSheet.absoluteFillObject, tile.fillOverlay, { borderRadius: 38 }]} />
        {/* Diagonal specular */}
        <LinearGradient
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.06)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        {/* Top-rim lensing */}
        <LinearGradient
          colors={['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.05)', 'transparent']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.16 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        {/* Bottom depth */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.20)']}
          start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
          pointerEvents="none"
        />
        {/* Border rim */}
        <View
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38, borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' }]}
          pointerEvents="none"
        />
        <View style={tile.inner}>
          <View style={tile.valueRow}>
            <Text style={tile.value}>{value}</Text>
          </View>
          <Text style={tile.label} numberOfLines={2}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const tile = StyleSheet.create({
  shadow: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 38,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 18,
    elevation: 10,
  },
  wrap: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  fillOverlay: {
    backgroundColor: 'rgba(47,48,49,0.28)',
  },
  inner: {
    flex: 1,
    padding: 18,
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  valueRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  value: {
    fontSize: 28,
    fontWeight: '600',
    color: C_TEXT,
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: C_TEXT_DIM,
    lineHeight: 16,
  },
});

// ── Exercise breakdown glass card ───────────────────────────────
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={card.shadow}>
      <View style={card.wrap}>
        <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 28, backgroundColor: 'rgba(47,48,49,0.28)' }]} />
        <LinearGradient
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.04)', 'transparent']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.16 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]}
          pointerEvents="none"
        />
        <View
          style={[StyleSheet.absoluteFillObject, { borderRadius: 28, borderWidth: 1, borderColor: 'rgba(198,198,198,0.18)' }]}
          pointerEvents="none"
        />
        <View style={card.inner}>{children}</View>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  shadow: {
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  wrap: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  inner: {
    padding: 18,
    zIndex: 1,
  },
});

// ── Helpers ────────────────────────────────────────────────────
function formatDuration(mins: number): string {
  if (mins <= 0) return '--';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Main screen ────────────────────────────────────────────────
export default function WorkoutLoggedScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useSupabaseUser();

  const [session, setSession] = useState<any>(null);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');

  // Post-session summary state
  const [summaryItems, setSummaryItems] = useState<ExerciseSummaryItem[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [nextIsDeload, setNextIsDeload] = useState(false);

  // Dynamic Island RPE warning state
  const [rpeWarning, setRpeWarning] = useState<{ visible: boolean; rpe: number }>({ visible: false, rpe: 0 });
  const [isInjured, setIsInjured] = useState(false);

  useEffect(() => {
    async function load() {
      const [sessions, settings] = await Promise.all([
        getWorkoutSessions(),
        getUserSettings(),
      ]);
      const found = sessions.find((s: any) => s.id === sessionId);
      setSession(found || null);
      setAllSessions(sessions.filter((s: any) => s.id !== sessionId));
      setWeightUnit(settings.weightUnit);

      // Load prescriptions from Supabase for post-session summary
      if (found && user?.id) {
        const canonicalIds = (found.exercises ?? []).map(
          (ex: any) => ex.exerciseDbId ?? ex.name ?? ex.id
        );
        const prescriptions = await supabaseGetExercisePrescriptions(user.id, canonicalIds);

        const items: ExerciseSummaryItem[] = (found.exercises ?? []).map((ex: any) => {
          const key = ex.exerciseDbId ?? ex.name ?? ex.id;
          const p   = prescriptions[key];

          // Average RPE across completed sets in this session
          const rpeVals = (ex.sets ?? [])
            .filter((s: any) => s.completed && s.rpe != null && s.rpe > 0)
            .map((s: any) => Number(s.rpe));
          const avgRpe = rpeVals.length > 0
            ? rpeVals.reduce((a: number, b: number) => a + b, 0) / rpeVals.length
            : null;

          // Map goal → ExerciseSummaryItem action
          let action: ExerciseSummaryItem['action'] = 'build_reps';
          if (p?.isCalibrating)           action = 'calibrate';
          else if (p?.goal === 'add_load')   action = 'add_weight';
          else if (p?.goal === 'reduce_load') action = 'deload';

          // Convert stored weight (always kg) to display unit
          const nextWeightKg   = p?.nextWeight ?? 0;
          const nextWeightDisp = settings.weightUnit === 'lb'
            ? Number((nextWeightKg * 2.20462).toFixed(1))
            : Number(nextWeightKg.toFixed(1));

          return {
            exerciseName:      ex.name ?? 'Exercise',
            action,
            nextWeightDisplay: nextWeightDisp,
            weightUnit:        settings.weightUnit as 'kg' | 'lb',
            nextBand:          (p?.difficultyBand ?? 'easy') as DifficultyBand,
            reason:            p?.reason ?? '',
            isCalibrating:     p?.isCalibrating ?? false,
            avgRpe,
            repRangeLow:       ex.repRangeLow  ?? 8,
            repRangeHigh:      ex.repRangeHigh ?? 12,
          };
        });

        setSummaryItems(items);

        // Check if next week is deload (counter was incremented by supabaseSaveWorkoutSession)
        const { data: ts } = await import('../lib/supabase').then(m =>
          m.supabase?.from('training_settings').select('deload_week_counter').eq('user_id', user.id).maybeSingle() ?? Promise.resolve({ data: null })
        );
        if (ts) setNextIsDeload(isDeloadWeek(Number(ts.deload_week_counter ?? 0)));

        // Trigger Dynamic Island RPE warning if any exercise had a low-effort average RPE
        const lowRpe = items.find(i => shouldTriggerLowRpeWarning(i.avgRpe));
        if (lowRpe && lowRpe.avgRpe != null) {
          const roundedRpe = Math.round(lowRpe.avgRpe!);
          const worstEx    = lowRpe.exerciseName ?? '';
          startRPEActivity(roundedRpe, worstEx, 'post', 12000);
          sendRPENotification(roundedRpe, worstEx, 'post');
          setTimeout(() => setRpeWarning({ visible: true, rpe: roundedRpe }), 800);
        }

        // Show post-session summary after a short delay
        setTimeout(() => setShowSummary(true), 1200);
      }
    }
    if (sessionId) load();
  }, [sessionId, user?.id]);

  // ── Stats ──────────────────────────────────────────────────
  const duration   = session?.duration ?? 0;
  const totalSets  = session
    ? session.exercises.reduce((a: number, ex: any) => a + ex.sets.filter((s: any) => s.completed).length, 0)
    : 0;
  const totalExs   = session?.exercises?.length ?? 0;
  const rawVolume  = session
    ? session.exercises.reduce(
        (a: number, ex: any) =>
          a + ex.sets.filter((s: any) => s.completed).reduce((b: number, s: any) => b + s.weight * s.reps, 0),
        0
      )
    : 0;
  const volumeStr  = rawVolume > 0
    ? formatVolumeDisplay(toDisplayVolume(rawVolume, weightUnit), weightUnit)
    : '--';

  // ── PR detection ─────────────────────────────────────────────
  const prExercises = React.useMemo<Set<string>>(() => {
    if (!session) return new Set();
    const prs = new Set<string>();
    for (const ex of session.exercises) {
      const key = ex.exerciseDbId ?? ex.name;
      if (!key) continue;
      const sessionMax = ex.sets
        .filter((s: any) => s.completed && s.weight > 0)
        .reduce((m: number, s: any) => Math.max(m, s.weight), 0);
      if (sessionMax <= 0) continue;
      const priorMax = allSessions.reduce((m: number, sess: any) => {
        const matchEx = sess.exercises?.find(
          (e: any) => (ex.exerciseDbId && e.exerciseDbId === ex.exerciseDbId) || e.name === ex.name
        );
        if (!matchEx) return m;
        const exMax = (matchEx.sets ?? [])
          .filter((s: any) => s.weight > 0)
          .reduce((mm: number, s: any) => Math.max(mm, s.weight), 0);
        return Math.max(m, exMax);
      }, 0);
      if (sessionMax > priorMax) prs.add(key);
    }
    return prs;
  }, [session, allSessions]);

  const prCount = prExercises.size;

  const workoutName = session?.name || 'Workout';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.root}>
        <FlatFitnessBackground />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 48 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ─────────────────────────────────────── */}
          <View style={styles.hero}>
            <View style={styles.checkCircle}>
              <Text style={styles.checkMark}>✓</Text>
            </View>
            <Text style={styles.heroTitle}>Workout Logged</Text>
            <Text style={styles.heroSub}>{workoutName}</Text>
            {prCount > 0 && (
              <View style={styles.prBanner}>
                <Text style={styles.prBannerText}>🏆 {prCount} PR{prCount > 1 ? 's' : ''} this session</Text>
              </View>
            )}
          </View>

          {/* ── 2×2 Stat tiles ───────────────────────────── */}
          <View style={styles.tilesGrid}>
            <StatSquareTile label="duration" value={formatDuration(duration)} />
            <StatSquareTile label="volume" value={volumeStr} />
            <StatSquareTile label="sets" value={totalSets > 0 ? String(totalSets) : '--'} />
            <StatSquareTile label="exercises" value={totalExs > 0 ? String(totalExs) : '--'} />
          </View>

          {/* ── Exercise breakdown ───────────────────────── */}
          {session && session.exercises.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Exercises</Text>
              <GlassCard>
                {session.exercises.map((ex: any, idx: number) => {
                  const key      = ex.exerciseDbId ?? ex.name;
                  const isPR     = key ? prExercises.has(key) : false;
                  const doneSets = ex.sets.filter((s: any) => s.completed);
                  const isLast   = idx === session.exercises.length - 1;

                  return (
                    <View key={ex.id ?? idx}>
                      <View style={styles.exRow}>
                        <View style={styles.exLeft}>
                          <Text style={styles.exName} numberOfLines={1}>{ex.name}</Text>
                          <Text style={styles.exSets}>
                            {doneSets.length} set{doneSets.length !== 1 ? 's' : ''}
                            {doneSets.length > 0 && doneSets[0].weight > 0
                              ? ` · ${formatWeightDisplay(toDisplayWeight(doneSets[0].weight, weightUnit), weightUnit)}`
                              : ''}
                          </Text>
                        </View>
                        {isPR && (
                          <View style={styles.prBadge}>
                            <Text style={styles.prBadgeText}>PR</Text>
                          </View>
                        )}
                      </View>
                      {!isLast && (
                        <View style={styles.exDivider} />
                      )}
                    </View>
                  );
                })}
              </GlassCard>
            </View>
          )}

          {/* ── Done button ──────────────────────────────── */}
          <View style={styles.doneWrap}>
            <Pressable
              style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.82 }]}
              onPress={() => router.replace('/(tabs)' as any)}
            >
              {/* Glass layers */}
              <BlurView intensity={20} tint="light" style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]} />
              <LinearGradient
                colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.12)']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
                pointerEvents="none"
              />
              <View
                style={[StyleSheet.absoluteFillObject, { borderRadius: 38, borderWidth: 1, borderColor: 'rgba(198,198,198,0.35)' }]}
                pointerEvents="none"
              />
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* ── Dynamic Island RPE Warning (absolute overlay at top) ── */}
        <DynamicIslandRPEWarning
          visible={rpeWarning.visible}
          rpe={rpeWarning.rpe}
          context="post"
          isInjured={isInjured}
          onInjuredChange={setIsInjured}
          onDismiss={() => { setRpeWarning({ visible: false, rpe: 0 }); stopRPEActivity(); }}
        />
      </View>

      {/* ── Post-session summary bottom sheet ─────────────────── */}
      {showSummary && (
        <PostSessionSummary
          items={summaryItems}
          isDeloadWeek={nextIsDeload}
          onClose={() => setShowSummary(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  scroll: {
    paddingHorizontal: OUTER_PAD,
  },

  // Hero
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(198,198,198,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(198,198,198,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  checkMark: {
    fontSize: 32,
    color: C_TEXT,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: C_TEXT,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 16,
    fontWeight: '500',
    color: C_TEXT_DIM,
    letterSpacing: -0.2,
  },
  prBanner: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,215,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  prBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
    letterSpacing: -0.1,
  },

  // Tiles
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
    marginBottom: 28,
  },

  // Exercises section
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C_TEXT_DIM,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  exLeft: {
    flex: 1,
    marginRight: 12,
  },
  exName: {
    fontSize: 15,
    fontWeight: '500',
    color: C_TEXT,
    marginBottom: 2,
  },
  exSets: {
    fontSize: 13,
    fontWeight: '400',
    color: C_TEXT_DIM,
  },
  exDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(198,198,198,0.12)',
  },
  prBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.30)',
  },
  prBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFD700',
    letterSpacing: 0.4,
  },

  // Done button
  doneWrap: {
    paddingTop: 4,
  },
  doneBtn: {
    height: 56,
    borderRadius: 38,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  doneBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: C_TEXT,
    letterSpacing: -0.2,
    zIndex: 1,
  },
});
