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
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { CaretLeft, CaretRight } from 'phosphor-react-native';

import { HomeGradientBackground } from '../components/HomeGradientBackground';
import { useJarvis } from '../hooks/useJarvis';
import { Colors } from '../constants/theme';
import type { WorkoutContext, ScheduledSet } from '../lib/getWorkoutContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const H_PAD = 16;
const CARD_GAP = 10;
const CARD_SIZE = Math.floor((SCREEN_WIDTH - H_PAD * 2 - CARD_GAP) / 2);
const CARD_RADIUS = 20;
const CHAMPAGNE = '#D4B896';
const GREEN = '#22C55E';
const MUTED = 'rgba(198,198,198,0.55)';
const WEIGHT_INCREMENT_KG = 2.5;

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

function maxRpe(sets: ScheduledSet[]): number | null {
  const vals = sets.map((s) => s.rpe).filter((r): r is number => r != null && r > 0);
  return vals.length > 0 ? Math.max(...vals) : null;
}

function avgRpe(sets: ScheduledSet[]): number | null {
  const vals = sets.map((s) => s.rpe).filter((r): r is number => r != null && r > 0);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function sessionGroups(recentSets: ScheduledSet[]): ScheduledSet[][] {
  const groups: ScheduledSet[][] = [];
  let cur: ScheduledSet[] = [];
  let lastDate: string | null = null;
  for (const s of recentSets) {
    if (lastDate !== s.sessionDate) {
      if (cur.length) groups.push(cur);
      cur = [];
      lastDate = s.sessionDate;
    }
    cur.push(s);
  }
  if (cur.length) groups.push(cur);
  return groups;
}

function rpeTrend(recentSets: ScheduledSet[]): 'up' | 'down' | 'stable' | null {
  const groups = sessionGroups(recentSets).slice(0, 3);
  if (groups.length < 2) return null;
  const avgs = groups.map(avgRpe).filter((a): a is number => a != null);
  if (avgs.length < 2) return null;
  const diff = avgs[0] - avgs[avgs.length - 1];
  if (diff >= 0.5) return 'up';
  if (diff <= -0.5) return 'down';
  return 'stable';
}

function lastSummary(lastSets: ScheduledSet[]): string {
  if (lastSets.length === 0) return '—';
  const w = lastSets[0].weight ?? 0;
  const reps = lastSets.map((s) => s.reps ?? 0).join('/');
  const rpe = maxRpe(lastSets);
  return rpe != null ? `${w}kg × ${reps}\nRPE ${rpe}` : `${w}kg × ${reps}`;
}

function computeExercisePlans(context: WorkoutContext | null): ExercisePlan[] {
  if (!context?.todayPlan || context.todayPlan.isRestDay) return [];
  const { todayPlan, exerciseHistory, trainingSettings } = context;
  const framework = trainingSettings?.volumeFramework ?? 'builder';
  const names = todayPlan.exerciseNames ?? [];
  const history = exerciseHistory ?? [];

  return todayPlan.exerciseIds.map((_, i) => {
    const name = names[i] ?? `Exercise ${i + 1}`;
    const recentSets = history[i]?.recentSets ?? [];
    const lastSets = getLastSets(recentSets);
    const lastStr = lastSummary(lastSets);

    const baseWeight =
      lastSets.find((s) => s.targetWeight != null)?.targetWeight ??
      lastSets[0]?.weight ?? 0;
    const baseReps =
      lastSets.find((s) => s.targetReps != null)?.targetReps ??
      lastSets[0]?.reps ?? 8;

    let targetWeight = baseWeight;
    let targetReps = baseReps;
    let note: string | null = null;

    if (framework === 'builder') {
      const hitTarget = lastSets.length > 0 && lastSets.every((s) => {
        const r = s.reps ?? 0;
        const t = s.targetReps ?? r;
        return t > 0 && r >= t;
      });
      const maxR = maxRpe(lastSets);
      if (maxR != null && maxR >= 9) {
        note = 'Autoregulate today.';
      } else if (hitTarget) {
        targetWeight = baseWeight + WEIGHT_INCREMENT_KG;
      }
    } else if (framework === 'ghost') {
      const trend = rpeTrend(recentSets);
      if (trend === 'up') {
        targetWeight = Math.max(0, baseWeight - WEIGHT_INCREMENT_KG);
        note = 'RPE up — reduce load.';
      } else if (trend === 'stable') {
        targetReps = baseReps + 1;
        note = 'Add a rep.';
      } else if (trend === 'down') {
        targetWeight = baseWeight + WEIGHT_INCREMENT_KG;
        note = 'Add weight.';
      }
    }

    return { name, hasHistory: lastSets.length > 0, lastStr, targetWeight, targetReps, note };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PulsingDot() {
  const opacity = useSharedValue(0.7);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.cardOuter, style]}>
      <BlurView intensity={22} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: CARD_RADIUS }]} />
      <View style={[StyleSheet.absoluteFill, styles.cardFill, { borderRadius: CARD_RADIUS }]} />
      <LinearGradient
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
        style={[StyleSheet.absoluteFill, { borderRadius: CARD_RADIUS }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.20)']}
        start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: CARD_RADIUS }]}
        pointerEvents="none"
      />
      <View style={[StyleSheet.absoluteFill, styles.cardBorder, { borderRadius: CARD_RADIUS }]} pointerEvents="none" />
      {children}
    </View>
  );
}

function ExerciseCard({ plan }: { plan: ExercisePlan }) {
  return (
    <GlassCard style={styles.card}>
      <View style={styles.cardInner}>
        {/* Exercise name */}
        <Text style={styles.cardName} numberOfLines={2}>{plan.name}</Text>

        {/* Data or no-data */}
        {plan.hasHistory ? (
          <View style={styles.cardDataRow}>
            {/* LAST column */}
            <View style={styles.cardDataCol}>
              <Text style={styles.cardDataLabel}>LAST</Text>
              <Text style={styles.cardDataLast}>{plan.lastStr}</Text>
            </View>

            {/* Vertical divider */}
            <View style={styles.cardVDivider} />

            {/* TODAY column */}
            <View style={[styles.cardDataCol, styles.cardDataColRight]}>
              <Text style={styles.cardDataLabel}>TODAY</Text>
              <Text style={styles.cardDataToday}>
                {plan.targetWeight > 0 ? `${plan.targetWeight}` : '—'}
                {'\n'}
                <Text style={styles.cardDataTodayUnit}>
                  {plan.targetWeight > 0 ? 'kg' : ''}{'  × '}{plan.targetReps}
                </Text>
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.cardNoData}>No workout{'\n'}data yet</Text>
        )}

        {/* Note */}
        {plan.note ? <Text style={styles.cardNote}>{plan.note}</Text> : null}
      </View>
    </GlassCard>
  );
}

function ExercisePager({ plans }: { plans: ExercisePlan[] }) {
  const [page, setPage] = useState(0);

  // Group into pages of 4
  const pages: ExercisePlan[][] = [];
  for (let i = 0; i < plans.length; i += 4) {
    pages.push(plans.slice(i, i + 4));
  }
  const pageCount = pages.length;

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          setPage(Math.round(x / SCREEN_WIDTH));
        }}
        style={styles.pagerScroll}
      >
        {pages.map((pagePlans, pi) => (
          <View key={pi} style={styles.pagerPage}>
            {/* Row 1 */}
            <View style={styles.pagerRow}>
              {([0, 1] as const).map((col) =>
                pagePlans[col] ? (
                  <ExerciseCard key={col} plan={pagePlans[col]!} />
                ) : (
                  <View key={col} style={styles.cardPlaceholder} />
                )
              )}
            </View>
            {/* Row 2 — only if we have exercises for it */}
            {(pagePlans[2] || pagePlans[3]) ? (
              <View style={[styles.pagerRow, { marginTop: CARD_GAP }]}>
                {([2, 3] as const).map((col) =>
                  pagePlans[col] ? (
                    <ExerciseCard key={col} plan={pagePlans[col]!} />
                  ) : (
                    <View key={col} style={styles.cardPlaceholder} />
                  )
                )}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      {/* Page dots */}
      {pageCount > 1 && (
        <View style={styles.pageDots}>
          {Array.from({ length: pageCount }).map((_, i) => (
            <View key={i} style={[styles.pageDot, i === page && styles.pageDotActive]} />
          ))}
        </View>
      )}
    </View>
  );
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
                  {/* ── 2×2 pager ── */}
                  <Text style={styles.sectionLabel}>TODAY'S SESSION</Text>
                  <ExercisePager plans={exercisePlans} />

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
                    <Text style={styles.msgAssistantText}>{m.content}</Text>
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

  // Pager
  pagerScroll: { marginHorizontal: -H_PAD },
  pagerPage: {
    width: SCREEN_WIDTH,
    paddingHorizontal: H_PAD,
  },
  pagerRow: { flexDirection: 'row', gap: CARD_GAP },

  // Page dots
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
  },
  pageDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(198,198,198,0.25)',
  },
  pageDotActive: {
    backgroundColor: CHAMPAGNE,
    width: 14,
  },

  // Glass card base
  cardOuter: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 14,
    elevation: 6,
    overflow: 'hidden',
  },
  cardFill: { backgroundColor: 'rgba(47,48,49,0.30)' },
  cardBorder: { borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },
  card: {},
  cardPlaceholder: { width: CARD_SIZE, height: CARD_SIZE },

  // Card content
  cardInner: {
    flex: 1,
    padding: 13,
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryLight,
    letterSpacing: -0.2,
    lineHeight: 17,
  },
  cardDataRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  cardDataCol: { flex: 1 },
  cardDataColRight: { alignItems: 'flex-end' },
  cardVDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(198,198,198,0.15)',
    marginHorizontal: 10,
  },
  cardDataLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: MUTED,
    marginBottom: 4,
  },
  cardDataLast: {
    fontSize: 11,
    color: CHAMPAGNE,
    fontWeight: '500',
    lineHeight: 16,
  },
  cardDataToday: {
    fontSize: 16,
    color: Colors.primaryLight,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 20,
    textAlign: 'right',
  },
  cardDataTodayUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: MUTED,
  },
  cardNoData: {
    fontSize: 11,
    color: MUTED,
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 10,
  },
  cardNote: {
    fontSize: 10,
    color: CHAMPAGNE,
    fontStyle: 'italic',
    marginTop: 6,
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
