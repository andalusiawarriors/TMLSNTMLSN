// ============================================================
// TMLSN — Fitness Hub  (redesign v4 — clean, no emojis, no monospace)
// Layout:
//   Zone 1: ZoneOneCard (ghost/builder fallback) OR TodaysSessionCarousel
//   Zone 2: Divider → "Tools" label → clean text rows
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { Platform } from 'react-native';

import { Colors } from '../constants/theme';
import { useActiveWorkout } from '../context/ActiveWorkoutContext';
import { useAuth } from '../context/AuthContext';
import { invalidateTodayWorkoutContextCache } from '../lib/getWorkoutContext';
import { AnimatedFadeInUp } from './AnimatedFadeInUp';
import { TodaysSessionCarousel } from './TodaysSessionCarousel';
import { ZoneOneCard } from './ZoneOneCard';
import { ShinyText } from './ShinyText';
import { useJarvis } from '../hooks/useJarvis';
import { emitWorkoutExpandOrigin, emitClosePopup } from '../utils/fabBridge';

import { EXERCISE_DATABASE } from '../utils/exerciseDb/exerciseDatabase';
import { getUserSettings } from '../utils/storage';
import { DEFAULT_TRAINING_SETTINGS } from '../constants/storageDefaults';
import type { TrainingSettings } from '../types';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const PAD    = 16;
const MUTED  = '#404a52';
const QS     = '#ABABAB';
const GOLD   = '#D4B896';
const SUB    = '#7a8690';
const BORDER = 'rgba(255,255,255,0.05)';

// Silver gradient (matches TodaysSessionCarousel StartButton)
const SILVER = ['#B8BABC', '#D6D8DA', '#A0A4A8', '#6B6F74'] as const;
const SILVER_LOCS = [0, 0.37, 0.69, 1] as const;

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

// ─── In Progress Workout Card (replaces Today's Session when workout is minimized) ────

function InProgressWorkoutCard({
  workoutName,
  elapsedSeconds,
  onResume,
}: {
  workoutName: string;
  elapsedSeconds: number;
  onResume: () => void;
}) {
  return (
    <View style={S.hero}>
      <Text style={S.inProgressEyebrow}>in progress</Text>
      <ShinyText
        text={workoutName}
        speed={5}
        delay={0}
        spread={120}
        yoyo={false}
        color="#b5b5b5"
        shineColor="#ffffff"
        direction="right"
        style={S.inProgressTitle}
        containerStyle={{ marginBottom: 4, marginLeft: -(PAD + 4) }}
      />
      <Text style={S.inProgressElapsed}>{formatElapsed(elapsedSeconds)}</Text>
      <View style={S.startBtnWrap}>
        <Pressable onPress={onResume} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <LinearGradient
            colors={SILVER}
            locations={SILVER_LOCS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={S.resumeBtn}
          >
            <Text style={S.resumeBtnIcon}>▶</Text>
            <Text style={S.resumeBtnText}>Resume</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Tool Row — card style matching TodaysSessionCarousel exercise rows ────────

function ToolRow({
  name,
  sub,
  tag,
  onPress,
}: {
  name: string;
  sub: string;
  tag?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [T.card, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <View style={T.textBlock}>
        <Text style={T.name}>{name}</Text>
        <Text style={T.sub}>{sub}</Text>
      </View>
      {tag ? (
        <View style={T.tagWrap}>
          <Text style={T.tagText}>{tag}</Text>
        </View>
      ) : (
        <Text style={T.chevron}>›</Text>
      )}
    </Pressable>
  );
}

const T = StyleSheet.create({
  card: {
    backgroundColor: '#2F3031',
    borderRadius: 16,
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  textBlock: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: QS,
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 12,
    color: '#ABABAB',
    marginTop: 2,
  },
  tagWrap: {
    backgroundColor: 'rgba(212,184,150,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(212,184,150,0.14)',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '600',
    color: GOLD,
    letterSpacing: 0.5,
  },
  chevron: {
    fontSize: 20,
    color: '#ABABAB',
    fontWeight: '300',
    lineHeight: 24,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export type FitnessHubProps = {
  /** When provided, FitnessHub registers its refresh function here for parent pull-to-refresh. */
  refreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;
};

export function FitnessHub({ refreshRef }: FitnessHubProps = {}) {
  const [animTrigger, setAnimTrigger]         = useState(0);
  const [showWorkoutBlock, setShowWorkoutBlock] = useState(false);
  const [training, setTraining]               = useState<TrainingSettings>(DEFAULT_TRAINING_SETTINGS);
  const {
    activeWorkout,
    minimized,
    expandWorkout,
    setOriginRoute,
    reconcileActiveWorkoutState,
    workoutStartTime,
  } = useActiveWorkout();
  const { user } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const jarvis   = useJarvis();

  const performRefresh = useCallback(async () => {
    if (user?.id) invalidateTodayWorkoutContextCache(user.id);
    await jarvis.refresh();
    await reconcileActiveWorkoutState(pathname);
    setAnimTrigger((t) => t + 1);
  }, [jarvis, pathname, reconcileActiveWorkoutState, user?.id]);

  useEffect(() => {
    if (refreshRef) {
      refreshRef.current = performRefresh;
      return () => { refreshRef.current = null; };
    }
  }, [refreshRef, performRefresh]);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!workoutStartTime) return;
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - workoutStartTime) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [workoutStartTime]);

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      getUserSettings().then((s) => {
        setTraining({ ...DEFAULT_TRAINING_SETTINGS, ...s.training });
      });
    }, []),
  );

  const handlePress = useCallback(
    async (route: string) => {
      const reconciled = await reconcileActiveWorkoutState(pathname);
      if (reconciled) { setShowWorkoutBlock(true); return; }
      setOriginRoute('/(tabs)/nutrition');
      router.push(route as any);
    },
    [pathname, reconcileActiveWorkoutState, router, setOriginRoute],
  );

  const handleResumeMinimizedWorkout = useCallback(() => {
    emitClosePopup();
    const route =
      segments.includes('(profile)') ? '/(tabs)/(profile)'
      : pathname.includes('nutrition') ? '/(tabs)/nutrition'
      : pathname.includes('prompts') ? '/(tabs)/prompts'
      : pathname.includes('workout') ? '/(tabs)/workout'
      : '/(tabs)/nutrition';
    emitWorkoutExpandOrigin(route);
    setOriginRoute(route);
    expandWorkout();
    router.replace('/(tabs)/workout' as any);
  }, [expandWorkout, pathname, segments, setOriginRoute, router]);

  const scheduleMode = training.scheduleMode ?? 'ghost';
  const isBuilder    = scheduleMode === 'builder';
  const exCount      = EXERCISE_DATABASE.length;

  const toolRows: Array<{
    name: string; sub: string; tag?: string;
    route?: string; action?: () => void;
  }> = [
    {
      name: 'TMLSN Routines',
      sub: 'Curated splits with progressive overload',
      tag: 'default',
      route: '/fitness-hub-tmlsn-routines',
    },
    {
      name: 'Your Routines',
      sub: 'Custom programs',
      route: '/fitness-hub-your-routines',
    },
    ...(isBuilder
      ? [{
          name: 'Build your week',
          sub: 'Plan sessions for each day',
          tag: 'builder',
          route: '/week-builder',
        }]
      : []),
    {
      name: 'Exercise Database',
      sub: `${exCount} exercises  ·  muscles  ·  graphs`,
      route: '/exercises',
    },
  ];

  return (
    <View style={S.container}>

      {/* ── Zone 1 ── */}
      <ZoneOneCard jarvis={jarvis} />
      {activeWorkout && minimized ? (
        <InProgressWorkoutCard
          workoutName={activeWorkout.name ?? 'Workout'}
          elapsedSeconds={elapsedSeconds}
          onResume={handleResumeMinimizedWorkout}
        />
      ) : (
        <TodaysSessionCarousel animTrigger={animTrigger} jarvis={jarvis} />
      )}

      {/* ── Zone 2: Tools ── */}
      <View style={S.toolsSection}>
        <AnimatedFadeInUp delay={40} duration={340} trigger={animTrigger}>
          <View style={S.divider} />
          <Text style={S.toolsLabel}>Tools</Text>
        </AnimatedFadeInUp>
        <View style={S.toolList}>
          {toolRows.map((row, i) => (
            <AnimatedFadeInUp key={row.name} delay={80 + i * 60} duration={320} trigger={animTrigger}>
              <ToolRow
                name={row.name}
                sub={row.sub}
                tag={row.tag}
                onPress={() => {
                  if (row.action) { row.action(); return; }
                  if (row.route) handlePress(row.route);
                }}
              />
            </AnimatedFadeInUp>
          ))}
        </View>
      </View>

      {/* Workout-already-active blocker */}
      <Modal visible={showWorkoutBlock} transparent animationType="fade">
        <Pressable style={S.overlayRoot} onPress={() => setShowWorkoutBlock(false)}>
          <BlurView
            intensity={48}
            tint="dark"
            style={StyleSheet.absoluteFill}
            {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
          <View style={S.overlayContent} onStartShouldSetResponder={() => true}>
            <View style={S.overlayCard}>
              <Text style={S.overlayText}>
                A workout can't be started while one is already in progress.
              </Text>
              <TouchableOpacity
                onPress={() => setShowWorkoutBlock(false)}
                style={S.overlayBtn}
                activeOpacity={0.85}
              >
                <Text style={S.overlayBtnText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: {},

  hero: {
    paddingHorizontal: PAD,
    paddingBottom: 24,
  },
  inProgressEyebrow: {
    fontSize: 16,
    fontWeight: '600',
    color: '#979798',
    letterSpacing: -0.8,
    marginTop: -8,
    marginBottom: 10,
    marginLeft: -(PAD + 4),
    alignSelf: 'flex-start',
  },
  inProgressTitle: {
    height: 42,
    fontSize: 35,
    fontWeight: '600',
    letterSpacing: -1.75,
    lineHeight: 41,
    textAlign: 'left',
    textTransform: 'lowercase',
    color: '#b5b5b5',
  },
  inProgressElapsed: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ABABAB',
    marginLeft: -(PAD + 4),
    marginTop: -4,
    marginBottom: 20,
  },
  startBtnWrap: {
    marginLeft: -(PAD + 4),
    marginRight: 4 - PAD,
    marginTop: -6,
  },
  resumeBtn: {
    width: '100%',
    height: 55,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resumeBtnIcon: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resumeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  toolsSection: {
    paddingHorizontal: PAD,
    paddingBottom: 32,
  },
  toolList: {
    gap: 6,
    marginLeft: -(PAD + 4),
    marginRight: 4 - PAD,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 20,
  },
  toolsLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#ABABAB',
    marginBottom: 14,
  },

  overlayRoot:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlayContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  overlayCard: {
    backgroundColor: 'rgba(28,29,30,0.97)',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    minWidth: 260,
  },
  overlayText: {
    fontSize: 16,
    lineHeight: 23,
    color: Colors.primaryLight,
    textAlign: 'center',
    marginBottom: 22,
  },
  overlayBtn: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
  },
  overlayBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
});
