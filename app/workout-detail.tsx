import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Spacing, Typography, Colors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { getWorkoutSessions, getUserSettings } from '../utils/storage';
import { getSessionDisplayName } from '../utils/workoutSessionDisplay';
import { WorkoutSession, Set } from '../types';
import { formatWeightDisplay, toDisplayWeight, toDisplayVolume } from '../utils/units';
import { HomeGradientBackground } from '../components/HomeGradientBackground';
import { StickyGlassHeader } from '../components/ui/StickyGlassHeader';
import { LiquidGlassPill } from '../components/ui/liquidGlass';

const C_TEXT = Colors.primaryLight;

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');
  const [headerHeight, setHeaderHeight] = useState(0);
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  useEffect(() => {
    async function load() {
      if (!sessionId) return;
      try {
        const [loadedSessions, settings] = await Promise.all([
          getWorkoutSessions(),
          getUserSettings(),
        ]);
        const found = loadedSessions.find((s) => s.id === sessionId);
        if (found) setSession(found);
        setWeightUnit(settings?.weightUnit ?? 'lb');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  const backButton = (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
      }}
      style={({ pressed }) => [styles.backChip, pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] }]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <View style={styles.backChipInner}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(47,48,49,0.40)' }]} />
        <LinearGradient
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.03)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <Ionicons name="chevron-back" size={20} color={C_TEXT} style={{ zIndex: 2 }} />
      </View>
    </Pressable>
  );

  if (loading || !session) {
    return (
      <View style={styles.container}>
        <HomeGradientBackground />
        <View style={[styles.loadingHeader, { paddingTop: insets.top + 8 }]}>
          {backButton}
        </View>
        <ActivityIndicator style={{ marginTop: insets.top + Spacing.xxl }} color={colors.primaryLight} />
      </View>
    );
  }

  const rawVolume = session.exercises.reduce(
    (acc, ex) =>
      acc + ex.sets.filter((s) => s.completed).reduce((sacc, set) => sacc + set.weight * set.reps, 0),
    0
  );
  const volumeDisplay = toDisplayVolume(rawVolume, weightUnit);

  return (
    <View style={styles.container}>
      <HomeGradientBackground />

      <StickyGlassHeader
        title=""
        leftSlot={null}
        topPadding={8}
        topSlotMarginBottom={10}
        topSlot={
          <View style={styles.headerTopRow}>
            {backButton}
            <View style={styles.headerInfoBlock}>
              <Text style={[styles.headerTitle, { color: colors.primaryLight }]} numberOfLines={1}>
                {getSessionDisplayName(session).toLowerCase()}.
              </Text>
              <Text style={[styles.headerDate, { color: colors.primaryLight + '60' }]}>
                {format(new Date(session.date), 'MMM d, yyyy • h:mm a').toLowerCase()}
              </Text>
            </View>
            <View style={styles.headerPillsRow}>
              <LiquidGlassPill
                label={`${session.duration}m`}
                scrubEnabled={false}
              />
              <LiquidGlassPill
                label={`${formatWeightDisplay(volumeDisplay, weightUnit)} ${weightUnit}`}
                scrubEnabled={false}
              />
            </View>
          </View>
        }
        scrollY={scrollY}
        onLayout={setHeaderHeight}
      >
        {null}
      </StickyGlassHeader>

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + 8, paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {session.exercises.map((ex, i) => (
          <View key={ex.id} style={styles.exerciseCardWrap}>
            <View style={styles.glassCard}>
              <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFillObject, styles.glassRadius]} />
              <View style={[StyleSheet.absoluteFillObject, styles.glassFill, styles.glassRadius]} />
              <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }} style={[StyleSheet.absoluteFillObject, styles.glassRadius]} pointerEvents="none" />
              <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.18 }} style={[StyleSheet.absoluteFillObject, styles.glassRadius]} pointerEvents="none" />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.22)']} start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, styles.glassRadius]} pointerEvents="none" />
              <View style={[StyleSheet.absoluteFillObject, styles.glassBorder, styles.glassRadius]} pointerEvents="none" />
              <View style={styles.exerciseCardContent}>
                <Text style={[styles.exerciseTitle, { color: colors.primaryLight }]}>
                  {i + 1}. {ex.name}
                </Text>
                {ex.notes ? (
                  <Text style={[styles.exerciseNotes, { color: colors.primaryLight + 'A0' }]}>{ex.notes}</Text>
                ) : null}

                <View style={[styles.setRowHeader, { borderBottomColor: colors.primaryLight + '30' }]}>
                  <Text style={[styles.setColText, { flex: 0.5, color: colors.primaryLight + '80' }]}>Set</Text>
                  <Text style={[styles.setColText, { flex: 1, color: colors.primaryLight + '80' }]}>Weight</Text>
                  <Text style={[styles.setColText, { flex: 1, color: colors.primaryLight + '80' }]}>Reps</Text>
                </View>

                {ex.sets.map((set, sIdx) => {
                  const displayWt = toDisplayWeight(set.weight, weightUnit);
                  const isCompleted = set.completed;
                  return (
                    <View key={set.id}>
                      <View style={[styles.setRow, !isCompleted && { opacity: 0.5 }]}>
                        <Text style={[styles.setValText, { flex: 0.5, color: colors.primaryLight }]}>{sIdx + 1}</Text>
                        <Text style={[styles.setValText, { flex: 1, color: colors.primaryLight }]}>
                          {displayWt > 0 ? displayWt : '-'} {weightUnit}
                        </Text>
                        <Text style={[styles.setValText, { flex: 1, color: colors.primaryLight }]}>
                          {set.reps > 0 ? set.reps : '-'}
                        </Text>
                      </View>
                      {(set as Set & { notes?: string }).notes ? (
                        <View style={styles.setNotesRow}>
                          <Text style={[styles.setNotesText, { color: colors.primaryLight + '80' }]}>Note: {(set as Set & { notes?: string }).notes}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const GLASS_RADIUS = 16;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2F3031' },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg },
  loadingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backChip: { borderRadius: 20, overflow: 'hidden' },
  backChipInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(198,198,198,0.18)',
    overflow: 'hidden',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerInfoBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'left',
  },
  headerDate: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'left',
  },
  headerPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  exerciseCardWrap: {
    borderRadius: GLASS_RADIUS,
    marginBottom: Spacing.md,
    overflow: 'visible' as const,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  glassCard: {
    borderRadius: GLASS_RADIUS,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  glassRadius: { borderRadius: GLASS_RADIUS },
  glassFill: { backgroundColor: 'rgba(47, 48, 49, 0.30)' },
  glassBorder: { borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },
  exerciseCardContent: { padding: Spacing.lg, zIndex: 1 },
  exerciseTitle: { fontSize: Typography.body, fontWeight: '600', marginBottom: Spacing.xs },
  exerciseNotes: { fontSize: Typography.label, fontStyle: 'italic', marginBottom: Spacing.sm },
  setRowHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.xs,
  },
  setColText: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  setRow: { flexDirection: 'row', paddingVertical: Spacing.sm, alignItems: 'center' },
  setValText: { fontSize: Typography.body, textAlign: 'center' },
  setNotesRow: { paddingLeft: 40, paddingBottom: Spacing.sm },
  setNotesText: { fontSize: Typography.label, fontStyle: 'italic' },
});
