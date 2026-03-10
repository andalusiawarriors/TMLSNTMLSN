// ============================================================
// TMLSN — Fitness Hub  (redesign v4 — clean, no emojis, no monospace)
// Layout:
//   Zone 1: ZoneOneCard (ghost/builder fallback) OR TodaysSessionCarousel
//   Zone 2: Divider → "Tools" label → clean text rows
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';

import { Colors } from '../constants/theme';
import { useActiveWorkout } from '../context/ActiveWorkoutContext';
import { AnimatedFadeInUp } from './AnimatedFadeInUp';
import { TodaysSessionCarousel } from './TodaysSessionCarousel';
import { ZoneOneCard } from './ZoneOneCard';

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

export function FitnessHub() {
  const [animTrigger, setAnimTrigger]         = useState(0);
  const [showWorkoutBlock, setShowWorkoutBlock] = useState(false);
  const [training, setTraining]               = useState<TrainingSettings>(DEFAULT_TRAINING_SETTINGS);
  const { activeWorkout, setOriginRoute }     = useActiveWorkout();
  const router                                = useRouter();

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      getUserSettings().then((s) => {
        setTraining({ ...DEFAULT_TRAINING_SETTINGS, ...s.training });
      });
    }, []),
  );

  const handlePress = useCallback(
    (route: string) => {
      if (activeWorkout) { setShowWorkoutBlock(true); return; }
      setOriginRoute('/(tabs)/nutrition');
      router.push(route as any);
    },
    [activeWorkout, router, setOriginRoute],
  );

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
      <ZoneOneCard />
      <TodaysSessionCarousel animTrigger={animTrigger} />

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
