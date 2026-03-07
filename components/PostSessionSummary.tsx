/**
 * PostSessionSummary
 *
 * Bottom sheet shown after a workout is logged.
 * Displays per-exercise progression decisions: next weight, band, reasoning.
 * Includes deload notice, calibration notice, and "push harder?" prompt.
 *
 * Design: glass morphism — matches workout-logged.tsx and TodaysSessionCarousel.tsx.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { DifficultyBand } from '../lib/progression/decideNextPrescription';

const { width: SW } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const C_TEXT  = '#edf0f2';
const C_DIM   = 'rgba(198,198,198,0.55)';
const C_DIM2  = '#7a8690';
const C_BG    = '#111112';
const C_CARD  = 'rgba(47,48,49,0.85)';

// Band colours
const BAND_COLORS: Record<DifficultyBand, { bg: string; border: string; text: string }> = {
  easy:    { bg: 'rgba(52,199,89,0.14)',   border: 'rgba(52,199,89,0.32)',   text: '#34C759' },
  medium:  { bg: 'rgba(10,132,255,0.14)',  border: 'rgba(10,132,255,0.32)',  text: '#0A84FF' },
  hard:    { bg: 'rgba(255,149,0,0.14)',   border: 'rgba(255,149,0,0.32)',   text: '#FF9500' },
  extreme: { bg: 'rgba(255,59,48,0.14)',   border: 'rgba(255,59,48,0.32)',   text: '#FF3B30' },
};

const BAND_LABELS: Record<DifficultyBand, string> = {
  easy:    'Easy',
  medium:  'Medium',
  hard:    'Hard',
  extreme: 'Extreme',
};

const ACTION_ICONS: Record<string, string> = {
  add_weight:  '↑',
  build_reps:  '→',
  deload:      '↓',
  calibrate:   '◎',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExerciseSummaryItem = {
  exerciseName: string;
  action: 'add_weight' | 'build_reps' | 'deload' | 'calibrate';
  nextWeightDisplay: number;
  weightUnit: 'kg' | 'lb';
  nextBand: DifficultyBand;
  reason: string;
  isCalibrating: boolean;
  avgRpe?: number | null;
  repRangeLow: number;
  repRangeHigh: number;
};

export type PostSessionSummaryProps = {
  items: ExerciseSummaryItem[];
  isDeloadWeek: boolean;
  /** Called when user taps "Push harder" — should trigger Blitz Mode or increase aggression */
  onPushHarder?: () => void;
  onClose: () => void;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function BandBadge({ band }: { band: DifficultyBand }) {
  const c = BAND_COLORS[band];
  return (
    <View style={[badge.root, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[badge.text, { color: c.text }]}>{BAND_LABELS[band]}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  root: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

function ActionArrow({ action }: { action: ExerciseSummaryItem['action'] }) {
  const colors: Record<string, string> = {
    add_weight:  '#34C759',
    build_reps:  '#0A84FF',
    deload:      '#FF9500',
    calibrate:   '#ABABAB',
  };
  return (
    <Text style={{ fontSize: 18, fontWeight: '600', color: colors[action] ?? C_DIM }}>
      {ACTION_ICONS[action] ?? '·'}
    </Text>
  );
}

function ExerciseRow({ item }: { item: ExerciseSummaryItem }) {
  const weightStr = item.nextWeightDisplay > 0
    ? `${item.nextWeightDisplay} ${item.weightUnit}`
    : '—';

  return (
    <View style={row.root}>
      {/* Top: exercise name + band */}
      <View style={row.header}>
        <Text style={row.name} numberOfLines={1}>{item.exerciseName}</Text>
        <BandBadge band={item.nextBand} />
      </View>

      {/* Middle: action + next weight */}
      <View style={row.dataRow}>
        <ActionArrow action={item.action} />
        <Text style={row.weight}>{weightStr}</Text>
        <Text style={row.repRange}>
          {item.repRangeLow}–{item.repRangeHigh} reps
        </Text>
      </View>

      {/* Bottom: reason */}
      <Text style={row.reason} numberOfLines={2}>{item.reason}</Text>

      {/* Calibration notice */}
      {item.isCalibrating && (
        <View style={row.calibBadge}>
          <Text style={row.calibText}>Calibrating — baseline set</Text>
        </View>
      )}
    </View>
  );
}

const row = StyleSheet.create({
  root: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(198,198,198,0.10)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C_TEXT,
    letterSpacing: -0.2,
    marginRight: 10,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  weight: {
    fontSize: 22,
    fontWeight: '600',
    color: C_TEXT,
    letterSpacing: -0.6,
  },
  repRange: {
    fontSize: 13,
    fontWeight: '500',
    color: C_DIM2,
    letterSpacing: -0.1,
    marginLeft: 2,
  },
  reason: {
    fontSize: 13,
    fontWeight: '400',
    color: C_DIM,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  calibBadge: {
    marginTop: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(171,171,171,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(171,171,171,0.22)',
  },
  calibText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ABABAB',
    letterSpacing: 0.2,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export function PostSessionSummary({
  items,
  isDeloadWeek,
  onPushHarder,
  onClose,
}: PostSessionSummaryProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%', '92%'], []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.55}
      />
    ),
    []
  );

  // "Push harder?" only when RPE was low AND it's not a deload week
  // (during deload, easy effort is expected — don't nag the user)
  const lowRpeExercises = items.filter(
    (i) => i.avgRpe != null && i.avgRpe < 8
  );
  const showPushHarder = !isDeloadWeek && lowRpeExercises.length > 0 && onPushHarder != null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={sheet.bg}
      handleIndicatorStyle={sheet.handle}
    >
      <BottomSheetView style={sheet.root}>
        {/* ── Header ─────────────────────────────────── */}
        <View style={sheet.header}>
          <Text style={sheet.title}>Next Session</Text>
          <Text style={sheet.subtitle}>Here's your prescription</Text>
        </View>

        {/* ── Deload notice ──────────────────────────── */}
        {isDeloadWeek && (
          <View style={sheet.deloadBanner}>
            <Text style={sheet.deloadIcon}>🔄</Text>
            <View style={{ flex: 1 }}>
              <Text style={sheet.deloadTitle}>Deload week incoming</Text>
              <Text style={sheet.deloadSub}>
                Weights drop to 50% next week. This is planned — your body needs it.
              </Text>
            </View>
          </View>
        )}

        {/* ── Exercise list ──────────────────────────── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={sheet.listContent}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <View style={sheet.emptyState}>
              <Text style={sheet.emptyIcon}>📊</Text>
              <Text style={sheet.emptyTitle}>No prescriptions yet</Text>
              <Text style={sheet.emptySub}>
                Complete a few sets with weight and RPE data — your progression plan will appear here next session.
              </Text>
            </View>
          ) : (
            items.map((item, idx) => (
              <ExerciseRow key={`${item.exerciseName}-${idx}`} item={item} />
            ))
          )}

          {/* ── "Push harder?" prompt ──────────────── */}
          {showPushHarder && (
            <View style={sheet.pushCard}>
              <View style={sheet.pushCardInner}>
                <BlurView
                  intensity={26}
                  tint="dark"
                  style={[StyleSheet.absoluteFillObject, { borderRadius: 22 }]}
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.85, y: 0.85 }}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: 22 }]}
                  pointerEvents="none"
                />
                <View
                  style={[StyleSheet.absoluteFillObject, { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(198,198,198,0.15)' }]}
                  pointerEvents="none"
                />
                <View style={sheet.pushContent}>
                  <Text style={sheet.pushTitle}>This felt easy</Text>
                  <Text style={sheet.pushSub}>
                    Your RPE was under 8 on {lowRpeExercises.length}{' '}
                    exercise{lowRpeExercises.length > 1 ? 's' : ''}.
                    Should we increase the weight more aggressively?
                  </Text>
                  <View style={sheet.pushActions}>
                    <Pressable
                      style={({ pressed }) => [sheet.pushBtn, sheet.pushBtnPrimary, pressed && { opacity: 0.75 }]}
                      onPress={onPushHarder}
                    >
                      <Text style={[sheet.pushBtnText, { color: '#111112' }]}>Push harder</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [sheet.pushBtn, sheet.pushBtnGhost, pressed && { opacity: 0.6 }]}
                      onPress={onClose}
                    >
                      <Text style={[sheet.pushBtnText, { color: C_DIM }]}>Keep as-is</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ── Close button ───────────────────────── */}
          <Pressable
            style={({ pressed }) => [sheet.doneBtn, pressed && { opacity: 0.78 }]}
            onPress={onClose}
          >
            <BlurView intensity={20} tint="light" style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]} />
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.12)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
              pointerEvents="none"
            />
            <View
              style={[StyleSheet.absoluteFillObject, { borderRadius: 38, borderWidth: 1, borderColor: 'rgba(198,198,198,0.30)' }]}
              pointerEvents="none"
            />
            <Text style={sheet.doneBtnText}>Done</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </BottomSheetView>
    </BottomSheet>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sheet = StyleSheet.create({
  bg: {
    backgroundColor: C_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    backgroundColor: 'rgba(198,198,198,0.35)',
    width: 38,
  },
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(198,198,198,0.10)',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: C_TEXT,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: C_DIM2,
    letterSpacing: -0.1,
  },

  // Deload banner
  deloadBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,149,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,149,0,0.28)',
  },
  deloadIcon: {
    fontSize: 22,
    marginTop: 1,
  },
  deloadTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
    marginBottom: 3,
  },
  deloadSub: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,149,0,0.70)',
    lineHeight: 18,
  },

  // Exercise list
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: C_TEXT,
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '400',
    color: C_DIM,
    lineHeight: 20,
    textAlign: 'center',
  },

  // Push harder card
  pushCard: {
    marginTop: 20,
    marginBottom: 6,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  pushCardInner: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  pushContent: {
    padding: 18,
    zIndex: 1,
  },
  pushTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C_TEXT,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  pushSub: {
    fontSize: 14,
    fontWeight: '400',
    color: C_DIM,
    lineHeight: 20,
    marginBottom: 16,
  },
  pushActions: {
    flexDirection: 'row',
    gap: 10,
  },
  pushBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushBtnPrimary: {
    backgroundColor: C_TEXT,
  },
  pushBtnGhost: {
    backgroundColor: 'rgba(198,198,198,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.20)',
  },
  pushBtnText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  // Done button
  doneBtn: {
    height: 56,
    borderRadius: 38,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
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
