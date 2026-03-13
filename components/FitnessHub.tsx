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
import { AnimatedPressable } from './AnimatedPressable';
import { TodaysSessionCarousel } from './TodaysSessionCarousel';
import { ZoneOneCard } from './ZoneOneCard';
import { useJarvis } from '../hooks/useJarvis';
import { emitWorkoutExpandOrigin, emitClosePopup } from '../utils/fabBridge';

import { EXERCISE_DATABASE } from '../utils/exerciseDb/exerciseDatabase';
import { getUserSettings } from '../utils/storage';
import { DEFAULT_TRAINING_SETTINGS } from '../constants/storageDefaults';
import type { TrainingSettings } from '../types';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const PAD    = 16;
const GOLD   = '#D4B896';
const BORDER = 'rgba(255,255,255,0.05)';
// AddFoodCard-inspired glass style for interactive rows
const GLASS_BG     = 'rgba(47, 48, 49, 0.55)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.16)';


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
  onMinimize,
}: {
  workoutName: string;
  elapsedSeconds: number;
  onResume: () => void;
  onMinimize?: () => void;
}) {
  return (
    // Gradient border shell
    <LinearGradient
      colors={['#5a5b5c', '#44454A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={S.inProgressBorderGrad}
    >
      {/* Gradient fill inset 1px */}
      <LinearGradient
        colors={['#363738', '#2E2F30']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={S.inProgressFillGrad}
      >
        {/* Header row: label + active dot */}
        <View style={S.inProgressHeader}>
          <Text style={S.inProgressEyebrow}>IN PROGRESS</Text>
          <View style={S.activeDot} />
        </View>

        {/* Workout name */}
        <Text style={S.inProgressTitle} numberOfLines={1}>{workoutName}</Text>

        {/* Divider */}
        <View style={S.inProgressDivider} />

        {/* Timer */}
        <Text style={S.inProgressElapsed}>{formatElapsed(elapsedSeconds)}</Text>

        {/* Buttons row */}
        <View style={S.inProgressBtnRow}>
          <AnimatedPressable
            onPress={onResume}
            style={S.pillPrimary}
          >
            <Text style={S.pillPrimaryText}>Resume</Text>
          </AnimatedPressable>
          {onMinimize && (
            <AnimatedPressable
              onPress={onMinimize}
              style={S.pillOutline}
            >
              <Text style={S.pillOutlineText}>Minimize</Text>
            </AnimatedPressable>
          )}
        </View>
      </LinearGradient>
    </LinearGradient>
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
    <AnimatedPressable
      style={T.card}
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
    </AnimatedPressable>
  );
}

const T = StyleSheet.create({
  card: {
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  textBlock: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(198,198,198,0.6)',
    marginTop: 3,
    letterSpacing: -0.1,
  },
  tagWrap: {
    backgroundColor: 'rgba(212,184,150,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(212,184,150,0.22)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chevron: {
    fontSize: 18,
    color: 'rgba(198,198,198,0.35)',
    fontWeight: '300',
    lineHeight: 22,
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
              <AnimatedPressable
                onPress={() => setShowWorkoutBlock(false)}
                style={S.overlayBtn}
              >
                <Text style={S.overlayBtnText}>Got it</Text>
              </AnimatedPressable>
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

  // In-progress card — full width, more prominent
  inProgressBorderGrad: {
    marginHorizontal: 0,
    marginBottom: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  inProgressFillGrad: {
    borderRadius: 19,
    padding: 24,
  },
  inProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inProgressEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#C6C6C6',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  inProgressTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  inProgressDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  inProgressElapsed: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    marginBottom: 20,
  },
  inProgressBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillPrimary: {
    height: 44,
    borderRadius: 38,
    backgroundColor: '#C6C6C6',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2F3032',
  },
  pillOutline: {
    height: 44,
    borderRadius: 38,
    backgroundColor: 'rgba(198,198,198,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.18)',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOutlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C6C6C6',
  },
  toolsSection: {
    paddingHorizontal: 4,
    paddingBottom: 32,
  },
  toolList: {
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 20,
    marginHorizontal: 12,
  },
  toolsLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#ABABAB',
    marginBottom: 14,
    paddingHorizontal: 12,
  },

  overlayRoot:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlayContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  overlayCard: {
    backgroundColor: Colors.primaryDark,
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
    height: 44,
    paddingHorizontal: 28,
    borderRadius: 38,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
});
