import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Stack, useRouter } from 'expo-router';
import { CaretLeft, CaretRight } from 'phosphor-react-native';

import { HomeGradientBackground } from '../components/HomeGradientBackground';
import { useJarvis } from '../hooks/useJarvis';
import { Colors } from '../constants/theme';
import type { WorkoutContext, ScheduledSet } from '../lib/getWorkoutContext';
import { decideNextPrescription } from '../lib/progression/decideNextPrescription';
import { toDisplayWeight } from '../utils/units';

// ─── Constants ───────────────────────────────────────────────────────────────

const H_PAD = 16;
const CHAMPAGNE = '#D4B896';
const GREEN = '#22C55E';
const MUTED = 'rgba(198,198,198,0.55)';

// Typing animation config
const CHARS_PER_TICK = 4;
const TICK_MS = 12;

// ─── Types ────────────────────────────────────────────────────────────────────

type ExercisePlan = {
  name: string;
  hasHistory: boolean;
  lastStr: string;
  targetWeight: number;
  targetReps: number;
  note: string | null;
};

// ─── Exercise plan computation ────────────────────────────────────────────────

function getLastSets(recentSets: ScheduledSet[]): ScheduledSet[] {
  if (recentSets.length === 0) return [];
  const first = recentSets[0].sessionDate;
  return recentSets.filter((s) => s.sessionDate === first);
}

function lastSummary(lastSets: ScheduledSet[], weightUnit: 'kg' | 'lb'): string {
  if (lastSets.length === 0) return '—';
  const wLb = lastSets[0].weight ?? 0;
  const w = toDisplayWeight(wLb, weightUnit);
  const reps = lastSets.map((s) => s.reps ?? 0).join('/');
  const rpeVals = lastSets.map((s) => s.rpe).filter((r): r is number => r != null && r > 0);
  const rpe = rpeVals.length > 0 ? Math.max(...rpeVals) : null;
  return rpe != null ? `${w} ${weightUnit} × ${reps}\nRPE ${rpe}` : `${w} ${weightUnit} × ${reps}`;
}

function computeExercisePlans(context: WorkoutContext | null): ExercisePlan[] {
  if (!context?.todayPlan || context.todayPlan.isRestDay) return [];
  const { todayPlan, exerciseHistory } = context;
  const names = todayPlan.exerciseNames ?? [];
  const history = exerciseHistory ?? [];
  const details = context.todayExerciseDetails ?? [];
  const weightUnit = (context.weightUnit ?? 'lb') as 'kg' | 'lb';

  return todayPlan.exerciseIds.map((_, i) => {
    const name = names[i] ?? `Exercise ${i + 1}`;
    const recentSets = history[i]?.recentSets ?? [];
    const lastSets = getLastSets(recentSets);
    const lastStr = lastSummary(lastSets, weightUnit);

    const exDetail = details[i];
    const repRangeLow = exDetail?.repRangeLow ?? 10;
    const repRangeHigh = exDetail?.repRangeHigh ?? 12;

    const workingSets = lastSets.map((s) => ({
      weight: s.weight ?? 0,
      reps: s.reps ?? 0,
      rpe: s.rpe ?? null,
      completed: true,
    }));

    const decision = decideNextPrescription({
      sets: workingSets,
      repRangeLow,
      repRangeHigh,
      currentTargetReps: repRangeLow,
      overloadCategory: 'compound_small',
      currentBand: (exDetail?.currentBand as 'easy' | 'medium' | 'hard' | 'extreme') ?? 'easy',
      consecutiveSuccess: exDetail?.consecutiveSuccess ?? 0,
      consecutiveFailure: exDetail?.consecutiveFailure ?? 0,
      isCalibrating: false,
      isDeloadWeek: false,
    });

    const targetWeight =
      weightUnit === 'kg' ? (decision?.nextWeightKg ?? 0) : (decision?.nextWeightLb ?? 0);
    const targetReps = decision?.nextRepTarget ?? repRangeLow;
    const note = decision?.reason ?? null;

    return { name, hasHistory: lastSets.length > 0, lastStr, targetWeight, targetReps, note };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingMessage({ text, onDone }: { text: string; onDone: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const posRef = useRef(0);

  useEffect(() => {
    posRef.current = 0;
    setDisplayed('');
    const id = setInterval(() => {
      posRef.current = Math.min(posRef.current + CHARS_PER_TICK, text.length);
      setDisplayed(text.slice(0, posRef.current));
      if (posRef.current >= text.length) {
        clearInterval(id);
        onDone();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [text]);

  return (
    <Text style={styles.msgAssistantText}>
      {displayed || ' '}
      {displayed.length < text.length ? (
        <Text style={{ color: CHAMPAGNE, opacity: 0.7 }}>▍</Text>
      ) : null}
    </Text>
  );
}

function PulsingDot() {
  const opacity = useSharedValue(0.7);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

function VolumeChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TmlsnAIPage() {
  const router = useRouter();
  const jarvis = useJarvis();
  const { context, messages, sendMessage, isLoading, contextLoading, noUser } = jarvis;
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const [animatingIdx, setAnimatingIdx] = useState<number | null>(null);
  const doneIdxRef = useRef<number>(-1);

  // Trigger typing animation when a new assistant message arrives
  useEffect(() => {
    if (messages.length === 0) return;
    const lastIdx = messages.length - 1;
    const lastMsg = messages[lastIdx];
    if (lastMsg.role === 'assistant' && lastIdx > doneIdxRef.current) {
      setAnimatingIdx(lastIdx);
    }
  }, [messages.length]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const t = inputText.trim();
    if (!t || isLoading) return;
    setInputText('');
    sendMessage(t);
  }, [inputText, isLoading, sendMessage]);

  const exercisePlans = computeExercisePlans(context);
  const weeklyVolume = context?.weeklyVolume ?? [];
  const isRestDay = context?.todayPlan?.isRestDay ?? false;
  const day = context?.todayPlan?.dayOfWeek;
  const workoutType = context?.todayPlan?.workoutType ?? '';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        <HomeGradientBackground />

        <SafeAreaView style={styles.safe}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
              <CaretLeft size={22} color={Colors.primaryLight} weight="bold" />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>tmlsnAI</Text>
              <PulsingDot />
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {workoutType ? (
            <Text style={styles.subheader} numberOfLines={1}>{workoutType}</Text>
          ) : null}

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── States ── */}
              {contextLoading ? (
                <View style={styles.stateWrap}>
                  <ActivityIndicator color={MUTED} size="small" />
                  <Text style={styles.stateText}>  Initialising...</Text>
                </View>
              ) : noUser ? (
                <View style={styles.stateWrap}>
                  <Text style={styles.stateText}>Sign in to use tmlsnAI</Text>
                </View>
              ) : isRestDay ? (
                <View style={styles.restCard}>
                  <Text style={styles.restDay}>{day} — Rest Day</Text>
                  <Text style={styles.restSub}>Recovery is training.</Text>
                </View>
              ) : exercisePlans.length === 0 ? (
                <View style={styles.stateWrap}>
                  <Text style={styles.stateText}>
                    No exercises configured.{'\n'}Add them in Training Settings → Protocol Templates.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Today's Session moved to FitnessHub */}

                  {/* ── Volume chips ── */}
                  {weeklyVolume.length > 0 && (
                    <View style={styles.chipsWrap}>
                      <Text style={styles.sectionLabel}>WEEKLY VOLUME</Text>
                      <View style={styles.chipsRow}>
                        {weeklyVolume.map((v, i) => (
                          <VolumeChip
                            key={i}
                            label={v.muscleGroup ?? '—'}
                            value={v.mrv != null ? `${v.setsDone}/${v.mrv}` : String(v.setsDone)}
                          />
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* ── Divider ── */}
              <View style={styles.dividerWrap}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>Ask tmlsnAI</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* ── Chat ── */}
              {messages.map((m, i) =>
                m.role === 'assistant' ? (
                  <View key={i} style={styles.msgAssistant}>
                    {i === animatingIdx ? (
                      <TypingMessage
                        text={m.content}
                        onDone={() => {
                          doneIdxRef.current = i;
                          setAnimatingIdx(null);
                        }}
                      />
                    ) : (
                      <Text style={styles.msgAssistantText}>{m.content}</Text>
                    )}
                  </View>
                ) : (
                  <View key={i} style={styles.msgUserWrap}>
                    <View style={styles.msgUserBubble}>
                      <Text style={styles.msgUserText}>{m.content}</Text>
                    </View>
                  </View>
                )
              )}

              {isLoading && (
                <View style={styles.msgAssistant}>
                  <Text style={styles.msgAssistantText}>Thinking...</Text>
                </View>
              )}
            </ScrollView>

            {/* ── Input bar ── */}
            {!noUser && (
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Ask tmlsnAI..."
                  placeholderTextColor={MUTED}
                  value={inputText}
                  onChangeText={setInputText}
                  editable={!isLoading && !contextLoading}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  multiline={false}
                />
                <Pressable
                  style={({ pressed }) => [styles.sendBtn, pressed && styles.sendBtnPressed]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || isLoading}
                >
                  <CaretRight size={18} weight="bold" color={Colors.primaryLight} />
                </Pressable>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a1a' },
  safe: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    paddingBottom: 6,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: Colors.primaryLight,
  },
  headerSpacer: { width: 40 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  subheader: {
    textAlign: 'center',
    fontSize: 12,
    color: MUTED,
    marginBottom: 8,
    letterSpacing: 0.2,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 8, paddingBottom: 32 },

  // States
  stateWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  stateText: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22 },
  restCard: { paddingVertical: 32, alignItems: 'center' },
  restDay: { fontSize: 18, fontWeight: '600', color: Colors.primaryLight, letterSpacing: -0.3 },
  restSub: { fontSize: 13, color: MUTED, marginTop: 6 },

  // Section label
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: MUTED,
    marginBottom: 10,
    marginTop: 4,
  },

  // Volume chips
  chipsWrap: { marginTop: 16, marginBottom: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(198,198,198,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.18)',
  },
  chipLabel: { fontSize: 12, color: MUTED },
  chipValue: { fontSize: 12, fontWeight: '600', color: Colors.primaryLight },

  // Divider
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(198,198,198,0.12)' },
  dividerLabel: { fontSize: 11, color: MUTED, letterSpacing: 0.5 },

  // Chat
  msgAssistant: { marginBottom: 16, alignSelf: 'flex-start', maxWidth: '95%' },
  msgAssistantText: {
    fontSize: 14,
    color: Colors.primaryLight,
    lineHeight: 21,
  },
  msgUserWrap: { marginBottom: 16, alignSelf: 'flex-end', maxWidth: '82%' },
  msgUserBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CHAMPAGNE,
  },
  msgUserText: { fontSize: 14, color: Colors.primaryLight, lineHeight: 20 },

  // Input bar
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: H_PAD,
    paddingVertical: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(198,198,198,0.08)',
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(198,198,198,0.08)',
    color: Colors.primaryLight,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.14)',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(198,198,198,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPressed: { opacity: 0.6 },
});
