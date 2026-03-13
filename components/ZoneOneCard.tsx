// ============================================================
// ZoneOneCard — hero fallback when no scheduled session
// Renders for: ghost mode, builder (no session today), no archetype set.
// Hidden when TodaysSessionCarousel has a full session or rest day to show.
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { getUserSettings, getWorkoutSessions } from '../utils/storage';
import type { UseJarvisResult } from '../hooks/useJarvis';
import { DEFAULT_TRAINING_SETTINGS } from '../constants/storageDefaults';
import { ShinyText } from './ShinyText';
import type { TrainingSettings, WorkoutSession } from '../types';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const PAD    = 16;
const TEXT   = '#edf0f2';
const SUB    = '#7a8690';
const GOLD   = '#D4B896';
const QS     = '#ABABAB';
const BORDER = 'rgba(255,255,255,0.05)';

// Silver gradient — same as TodaysSessionCarousel start button
const SILVER      = ['#B8BABC', '#D6D8DA', '#A0A4A8', '#6B6F74'] as const;
const SILVER_LOCS = [0, 0.37, 0.69, 1] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDaysAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7)  return `${days} days ago`;
  if (days < 14) return '1 week ago';
  return `${Math.floor(days / 7)} weeks ago`;
}

function formatDuration(minutes: number): string {
  return minutes > 0 ? `${minutes} min` : '—';
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StartButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <LinearGradient
        colors={SILVER}
        locations={SILVER_LOCS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={S.startBtn}
      >
        <Text style={S.startBtnIcon}>▶</Text>
        <Text style={S.startBtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function LastSessionCard({ session }: { session: WorkoutSession }) {
  return (
    <View style={S.lastCard}>
      <View style={S.lastCardLeft}>
        <Text style={S.lastCardLabel}>last session</Text>
        <Text style={S.lastCardName} numberOfLines={1}>{session.name}</Text>
      </View>
      <View style={S.lastCardMeta}>
        <Text style={S.lastCardMetaVal}>{formatDuration(session.duration ?? 0)}</Text>
        <Text style={S.lastCardMetaDot}>·</Text>
        <Text style={S.lastCardMetaVal}>{formatDaysAgo(session.date)}</Text>
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ZoneOneCard({ jarvis }: { jarvis: UseJarvisResult }) {
  const [training,    setTraining]    = useState<TrainingSettings | null>(null);
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);
  const [hasHistory,  setHasHistory]  = useState(false);
  const { context, contextLoading, contextError, refresh } = jarvis;
  const router                        = useRouter();

  // Hide when TodaysSessionCarousel is handling it (full session, named session, or rest day)
  const isHandledByCarousel =
    !contextLoading &&
    context !== null &&
    context.todayPlan !== null &&
    (context.todayPlan.isRestDay ||
     !!context.todayPlan.workoutType ||
     (Array.isArray(context.todayPlan.exerciseIds) && context.todayPlan.exerciseIds.length > 0));

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [settings, sessions] = await Promise.all([getUserSettings(), getWorkoutSessions()]);
        if (cancelled) return;
        const t = settings.training ?? DEFAULT_TRAINING_SETTINGS;
        setTraining({ ...DEFAULT_TRAINING_SETTINGS, ...t });
        const completed = sessions
          .filter((s) => s.isComplete)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setLastSession(completed[0] ?? null);
        setHasHistory(completed.length > 0);
      })();
      return () => { cancelled = true; };
    }, []),
  );

  if (training === null)       return null;
  if (contextLoading)          return null;
  if (isHandledByCarousel)     return null;

  const scheduleMode = training.scheduleMode ?? 'ghost';
  const archetype    = training.archetype    ?? 'general';

  // ShinyText title props — matches TodaysSessionCarousel session name exactly
  const titleStyle         = S.sessionName;
  const titleContainerStyle = { marginBottom: 0, marginLeft: -(PAD + 4) } as const;

  // ── No archetype configured ──
  if (archetype === 'general' && scheduleMode === 'ghost' && !hasHistory) {
    return (
      <View style={S.hero}>
        <ShinyText
          text="Tell TMLSN how you train."
          speed={5} delay={0} spread={120} yoyo={false}
          color="#b5b5b5" shineColor="#ffffff" direction="right"
          style={titleStyle} containerStyle={titleContainerStyle}
        />
        <Text style={S.eyebrow}>getting started</Text>
        <Text style={S.sub}>Pick your training style and get a personalised hub.</Text>
        <Pressable
          style={({ pressed }) => [S.setupBtn, pressed && { opacity: 0.75 }]}
          onPress={() => router.push('/training-settings' as any)}
        >
          <Text style={S.setupBtnText}>Set up training</Text>
        </Pressable>
      </View>
    );
  }

  // ── Ghost mode ──
  if (scheduleMode === 'ghost') {
    return (
      <View style={S.hero}>
        <ShinyText
          text="Train when ready."
          speed={5} delay={0} spread={120} yoyo={false}
          color="#b5b5b5" shineColor="#ffffff" direction="right"
          style={titleStyle} containerStyle={titleContainerStyle}
        />
        <Text style={S.eyebrow}>today's session</Text>
        {lastSession && (
          <View style={S.lastCardWrap}>
            <LastSessionCard session={lastSession} />
          </View>
        )}
        <View style={S.startBtnWrap}>
          <StartButton
            label="Start Training"
            onPress={() => router.push('/fitness-hub-start-empty' as any)}
          />
        </View>
      </View>
    );
  }

  // ── Builder mode (nothing today) ──
  if (scheduleMode === 'builder') {
    return (
      <View style={S.hero}>
        <ShinyText
          text="No session today."
          speed={5} delay={0} spread={120} yoyo={false}
          color="#b5b5b5" shineColor="#ffffff" direction="right"
          style={titleStyle} containerStyle={titleContainerStyle}
        />
        <Text style={S.eyebrow}>today's session</Text>
        <View style={S.startBtnWrap}>
          <StartButton
            label="Start Session"
            onPress={() => router.push('/fitness-hub-your-routines' as any)}
          />
        </View>
        <Pressable onPress={() => router.push('/week-builder' as any)} style={{ marginTop: 10 }}>
          <Text style={S.secondaryLink}>or build your week →</Text>
        </Pressable>
      </View>
    );
  }

  // ── TMLSN mode (no plan yet) ──
  if (scheduleMode === 'tmlsn') {
    // A missing plan after load is not a real loading state; surface retry instead.
    if (contextError || context === null || context.todayPlan === null) {
      return (
        <View style={S.hero}>
          <ShinyText
            text="couldn't load session."
            speed={5} delay={0} spread={120} yoyo={false}
            color="#b5b5b5" shineColor="#ffffff" direction="right"
            style={titleStyle} containerStyle={titleContainerStyle}
          />
          <Text style={S.eyebrow}>today's session</Text>
          <Text style={S.sub}>Check your connection and try again.</Text>
          <Pressable
            style={({ pressed }) => [S.setupBtn, pressed && { opacity: 0.75 }]}
            onPress={refresh}
          >
            <Text style={S.setupBtnText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  hero: {
    paddingHorizontal: PAD,
    paddingBottom: 24,
  },

  // Session name — same style as TodaysSessionCarousel
  sessionName: {
    height: 42,
    fontSize: 35,
    fontWeight: '600',
    letterSpacing: -1.75,
    lineHeight: 41,
    textAlign: 'left',
    textAlignVertical: 'top',
    textTransform: 'lowercase',
  },

  // Eyebrow — same style as TodaysSessionCarousel
  eyebrow: {
    fontSize: 16,
    fontWeight: '600',
    color: '#979798',
    letterSpacing: -0.8,
    marginTop: -8,
    marginBottom: 10,
    marginLeft: -(PAD + 4),
    alignSelf: 'flex-start',
  },

  sub: {
    fontSize: 13,
    fontWeight: '400',
    color: SUB,
    marginBottom: 24,
    letterSpacing: -0.1,
    lineHeight: 19,
  },

  // Last session card — matches exercise row card style
  lastCardWrap: {
    marginLeft: -(PAD + 4),
    marginRight: 4 - PAD,
    marginBottom: 6,
  },
  lastCard: {
    backgroundColor: 'rgba(47, 48, 49, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 18,
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  lastCardLeft: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  lastCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: QS,
    textTransform: 'lowercase',
    letterSpacing: -0.1,
  },
  lastCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT,
    textTransform: 'lowercase',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  lastCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  lastCardMetaVal: {
    fontSize: 12,
    fontWeight: '500',
    color: QS,
  },
  lastCardMetaDot: {
    fontSize: 12,
    color: '#404a52',
  },

  // Start button — matches TodaysSessionCarousel
  startBtnWrap: {
    marginLeft: -(PAD + 4),
    marginRight: 4 - PAD,
  },
  startBtn: {
    width: '100%',
    height: 55,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startBtnIcon: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },

  secondaryLink: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '400',
    color: QS,
  },

  // Setup button (getting started state)
  setupBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(47, 48, 49, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  setupBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: QS,
    letterSpacing: -0.1,
  },
});
