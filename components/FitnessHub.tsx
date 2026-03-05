// ============================================================
// TMLSN — Fitness Hub
// Tile grid for the fitness. home tab.
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  TouchableOpacity,
  Platform,
  Image,
  Modal,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { Colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useActiveWorkout } from '../context/ActiveWorkoutContext';
import { AnimatedFadeInUp } from './AnimatedFadeInUp';
import TiltPressable from './TiltPressable';
import { TodaysSessionCarousel } from './TodaysSessionCarousel';
import { emitWorkoutOriginRoute } from '../utils/fabBridge';

import { BarbellIcon, PlayIcon, CaretRight } from 'phosphor-react-native';

import { EXERCISE_DATABASE } from '../utils/exerciseDb/exerciseDatabase';
import { getAllExerciseSettings } from '../utils/exerciseSettings';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PARENT_PAD = 19;
const GRID_GAP = 14;
const CARD_SIZE = Math.floor((SCREEN_WIDTH - PARENT_PAD * 2 - GRID_GAP) / 2);
const TILE_RADIUS = 38;
const PILL_WIDTH = SCREEN_WIDTH - PARENT_PAD * 2;
const PILL_HEIGHT = 76;
const PILL_RADIUS = 38;
const PILL_GAP = 14;

function MiniStatRow({ value, label }: { value: string; label: string }) {
  return (
    <View style={miniStyles.row}>
      <Text style={miniStyles.value}>{value}</Text>
      <Text style={miniStyles.label}>{label}</Text>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  value: { fontSize: 22, fontWeight: '700', letterSpacing: -0.6, color: Colors.primaryLight, lineHeight: 26 },
  label: { fontSize: 11, fontWeight: '500', color: 'rgba(198,198,198,0.45)', letterSpacing: -0.1 },
});

interface TileData {
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

function TileCard({ item, index, animTrigger, children, onPressOverride }: { item: TileData; index: number; animTrigger: number; children?: React.ReactNode; onPressOverride?: () => void }) {
  const router = useRouter();
  const handlePress = onPressOverride ?? (() => router.push(item.route as any));
  return (
    <AnimatedFadeInUp delay={50 + index * 45} duration={440} trigger={animTrigger}>
      <View style={tileStyles.tileWrap}>
        <TiltPressable
          style={{ width: CARD_SIZE, height: CARD_SIZE }}
          borderRadius={TILE_RADIUS}
          shadowStyle={tileStyles.shadow}
          longPressMs={210}
          onPress={handlePress}
        >
          <View style={tileStyles.glass}>
            <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]} />
            <View style={[StyleSheet.absoluteFillObject, tileStyles.fill, { borderRadius: TILE_RADIUS }]} />
            <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }} style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
            <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.18 }} style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.22)']} start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
            <View style={[StyleSheet.absoluteFillObject, tileStyles.border, { borderRadius: TILE_RADIUS }]} pointerEvents="none" />
            {children ? <View style={tileStyles.widgetContent}>{children}</View> : null}
            <View style={tileStyles.label}>
              <Text style={tileStyles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={tileStyles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
            </View>
          </View>
        </TiltPressable>
      </View>
    </AnimatedFadeInUp>
  );
}

const tileStyles = StyleSheet.create({
  tileWrap: { width: CARD_SIZE, height: CARD_SIZE, borderRadius: TILE_RADIUS, overflow: 'visible' as const },
  shadow: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.34, shadowRadius: 22, elevation: 12 },
  glass: { flex: 1, borderRadius: TILE_RADIUS, overflow: 'hidden', backgroundColor: 'transparent' },
  fill: { backgroundColor: 'rgba(47, 48, 49, 0.30)' },
  border: { borderWidth: 1, borderColor: 'rgba(198,198,198,0.22)' },
  widgetContent: { position: 'absolute', top: 18, left: 18, right: 18, bottom: 60, justifyContent: 'center', alignItems: 'center' },
  label: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, lineHeight: 21, color: Colors.primaryLight },
  subtitle: { fontSize: 12, fontWeight: '500', color: 'rgba(198,198,198,0.55)', marginTop: 5, letterSpacing: -0.1 },
});

function WorkoutPill({ item, index, animTrigger, icon, route, onPress }: { item: TileData; index: number; animTrigger: number; icon: React.ReactNode; route: string; onPress: (route: string) => void }) {
  const handlePress = useCallback(() => onPress(route), [route, onPress]);
  return (
    <AnimatedFadeInUp delay={50 + index * 45} duration={440} trigger={animTrigger}>
      <View style={pillStyles.pillWrap} collapsable={false}>
        <Pressable
          style={({ pressed }) => [pillStyles.pillPressable, pressed && pillStyles.pillPressed]}
          onPress={handlePress}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <View style={pillStyles.glass}>
            <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_RADIUS }]} />
            <View style={[StyleSheet.absoluteFillObject, pillStyles.fill, { borderRadius: PILL_RADIUS }]} />
            <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.07)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }} style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_RADIUS }]} pointerEvents="none" />
            <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.18 }} style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_RADIUS }]} pointerEvents="none" />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.22)']} start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_RADIUS }]} pointerEvents="none" />
            <View style={[StyleSheet.absoluteFillObject, pillStyles.border, { borderRadius: PILL_RADIUS }]} pointerEvents="none" />
            <View style={pillStyles.pillContent}>
              <View style={pillStyles.pillIcon}>{icon}</View>
              <View style={pillStyles.pillLabel}>
                <Text style={pillStyles.pillTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={pillStyles.pillSubtitle} numberOfLines={1}>{item.subtitle}</Text>
              </View>
              <CaretRight size={18} color="rgba(198,198,198,0.5)" weight="regular" />
            </View>
          </View>
        </Pressable>
      </View>
    </AnimatedFadeInUp>
  );
}

const pillStyles = StyleSheet.create({
  pillWrap: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    overflow: 'visible' as const,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  pillPressable: { flex: 1, borderRadius: PILL_RADIUS, overflow: 'hidden' as const },
  pillPressed: { opacity: 0.92 },
  glass: { flex: 1, borderRadius: PILL_RADIUS, overflow: 'hidden', backgroundColor: 'transparent' },
  fill: { backgroundColor: 'rgba(47, 48, 49, 0.35)' },
  border: { borderWidth: 1, borderColor: 'rgba(198,198,198,0.28)' },
  pillContent: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, gap: 16 },
  pillIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(198,198,198,0.14)', alignItems: 'center', justifyContent: 'center' },
  pillLabel: { flex: 1, minWidth: 0 },
  pillTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, color: Colors.primaryLight },
  pillSubtitle: { fontSize: 12, fontWeight: '500', color: 'rgba(198,198,198,0.6)', marginTop: 3, letterSpacing: -0.1 },
});

export function FitnessHub() {
  const [animTrigger, setAnimTrigger] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [showWorkoutBlockOverlay, setShowWorkoutBlockOverlay] = useState(false);
  const { user } = useAuth();
  const { activeWorkout } = useActiveWorkout();
  const router = useRouter();
  const dotOpacity = useSharedValue(0.7);

  useEffect(() => {
    dotOpacity.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [dotOpacity]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      getAllExerciseSettings().then((settings) => {
        setFavCount(Object.values(settings).filter((s) => s.favorite).length);
      });
    }, []),
  );

  const handleWorkoutPress = useCallback((route: string) => {
    if (activeWorkout) {
      setShowWorkoutBlockOverlay(true);
      return;
    }
    emitWorkoutOriginRoute('/(tabs)/nutrition');
    router.push(route as any);
  }, [activeWorkout, router]);

  const exercisesTile: TileData = {
    id: 'exercises',
    title: 'exercises.',
    subtitle: `${EXERCISE_DATABASE.length} exercises`,
    route: '/exercises',
  };

  const tmlsnTile: TileData = {
    id: 'tmlsn',
    title: 'tmlsn workouts.',
    subtitle: 'TMLSN split',
    route: '/fitness-hub-tmlsn-routines',
  };

  const yourRoutinesTile: TileData = {
    id: 'your-routines',
    title: 'your workouts.',
    subtitle: 'My routines',
    route: '/fitness-hub-your-routines',
  };

  const emptyWorkoutTile: TileData = {
    id: 'empty',
    title: 'empty workout.',
    subtitle: 'Start from scratch',
    route: '/fitness-hub-start-empty',
  };

  return (
    <View style={styles.container}>
      {/* 1) tmlsnAI pill — above all */}
      {user?.id && (
        <View style={styles.aiRow}>
          <Pressable style={styles.aiButton} onPress={() => router.push('/tmlsnai' as any)}>
            <View style={styles.aiButtonBorder}>
              <LinearGradient
                colors={['#D4B896', '#A8895E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
              />
              <View style={styles.aiButtonInner}>
                <Text style={styles.aiButtonText}>tmlsnAI</Text>
                <Animated.View style={[styles.aiDot, dotStyle]} />
              </View>
            </View>
          </Pressable>
        </View>
      )}

      {/* 2) Today's Session */}
      <TodaysSessionCarousel />

      {/* 3) Exercise tile (left) + workout pills (centred) */}
      <View style={styles.wrap}>
        <View style={styles.exerciseLeft}>
          <TileCard item={exercisesTile} index={0} animTrigger={animTrigger}>
            <View style={{ alignSelf: 'flex-start', gap: 5 }}>
              <MiniStatRow value={String(EXERCISE_DATABASE.length)} label="total" />
              {favCount > 0 && <MiniStatRow value={String(favCount)} label="starred" />}
            </View>
          </TileCard>
        </View>
        <View style={styles.pillsCenter}>
          <View style={styles.pillsColumn}>
            <WorkoutPill item={tmlsnTile} index={1} animTrigger={animTrigger} icon={<Image source={require('../assets/tmlsn-routines-star.png')} style={{ width: 24, height: 24, tintColor: Colors.primaryLight }} resizeMode="contain" />} route={tmlsnTile.route} onPress={handleWorkoutPress} />
            <WorkoutPill item={yourRoutinesTile} index={2} animTrigger={animTrigger} icon={<BarbellIcon size={24} color={Colors.primaryLight} weight="regular" />} route={yourRoutinesTile.route} onPress={handleWorkoutPress} />
            <WorkoutPill item={emptyWorkoutTile} index={3} animTrigger={animTrigger} icon={<PlayIcon size={24} color={Colors.primaryLight} weight="regular" />} route={emptyWorkoutTile.route} onPress={handleWorkoutPress} />
          </View>
        </View>
      </View>

      {/* Workout block overlay — full-screen modal */}
      <Modal visible={showWorkoutBlockOverlay} transparent animationType="fade">
        <Pressable style={styles.overlayRoot} onPress={() => setShowWorkoutBlockOverlay(false)}>
          <BlurView
            intensity={48}
            tint="dark"
            style={StyleSheet.absoluteFill}
            {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
          <View style={styles.overlayContent} onStartShouldSetResponder={() => true}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayText}>
                A workout can't be started while one is already in progress.
              </Text>
              <TouchableOpacity
                onPress={() => setShowWorkoutBlockOverlay(false)}
                style={styles.overlayButton}
                activeOpacity={0.85}
              >
                <Text style={styles.overlayButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  overlayRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wrap: {
    paddingHorizontal: PARENT_PAD,
    paddingTop: 4,
    paddingBottom: 28,
  },
  exerciseLeft: {
    alignSelf: 'flex-start',
    marginBottom: GRID_GAP + 4,
  },
  pillsCenter: {
    width: '100%',
    alignItems: 'center',
  },
  pillsColumn: {
    width: PILL_WIDTH,
    gap: PILL_GAP,
  },
  overlayContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  overlayCard: {
    backgroundColor: 'rgba(47, 48, 49, 0.95)',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.2)',
    alignItems: 'center',
    minWidth: 260,
  },
  overlayText: {
    fontSize: 16,
    lineHeight: 22,
    color: Colors.primaryLight,
    textAlign: 'center',
    marginBottom: 22,
  },
  overlayButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
  },
  overlayButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  aiRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  aiButton: {},
  aiButtonBorder: {
    overflow: 'hidden' as const,
    borderRadius: 20,
    padding: 1,
  },
  aiButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 19,
    backgroundColor: '#2f3031',
  },
  aiButtonText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: Colors.primaryLight,
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
});
