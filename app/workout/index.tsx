import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { saveWorkoutSession } from '../../utils/storage';
import { setSessionCompletedDate } from '../../utils/storage';
import { logStreakWorkout } from '../../utils/streak';
import { WorkoutSession } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useActiveWorkout } from '../../context/ActiveWorkoutContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Gear, List } from 'phosphor-react-native';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { WorkoutCore } from '../../components/WorkoutCore';
import { DynamicIslandRPEWarning } from '../../components/DynamicIslandRPEWarning';
import { useButtonSound } from '../../hooks/useButtonSound';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { formatLocalYMD } from '../../lib/time';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BUTTON_WIDTH = Math.min(380, SCREEN_WIDTH - 40);
const MAIN_MENU_BUTTON_HEIGHT = 69;
const MAIN_MENU_BUTTON_GAP = 15;

export type WorkoutScreenModalProps = {
  asModal?: boolean;
  initialActiveWorkout?: WorkoutSession | null;
  onCloseModal?: () => void;
};

export default function WorkoutScreen({
  asModal = false,
  initialActiveWorkout = null,
  onCloseModal,
}: WorkoutScreenModalProps = {}) {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeWorkout, setActiveWorkout } = useActiveWorkout();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { playIn, playOut } = useButtonSound();
  const windowHeight = Dimensions.get('window').height;

  const [rpeWarning, setRpeWarning] = useState<{
    visible: boolean;
    rpe: number;
    exerciseName: string;
    weightBumpDisplay?: string | null;
  }>({ visible: false, rpe: 0, exerciseName: '' });
  const [isInjured, setIsInjured] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');

  const handleWeightUnitReady = useCallback((w: 'kg' | 'lb') => setWeightUnit(w), []);

  const handleFinish = useCallback(async (payload: WorkoutSession) => {
    await saveWorkoutSession(payload);
    await logStreakWorkout();
    await setSessionCompletedDate(formatLocalYMD(new Date()), user?.id);
    setActiveWorkout(null);

    const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!session) {
      if (__DEV__) console.log('[Workout] blocked post-save: no session');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCloseModal?.();
      Alert.alert('Saved locally', 'Log in to post this workout to Explore.');
      router.push('/workout-history');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCloseModal?.();
    router.push({ pathname: '/workout-save', params: { sessionId: payload.id } });
  }, [setActiveWorkout, onCloseModal, router, user?.id]);

  const handleRpeWarning = useCallback((rpe: number, exerciseName: string, weightBumpDisplay?: string | null) => {
    setRpeWarning({ visible: true, rpe, exerciseName, weightBumpDisplay });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      {/* Workout home – background, header (settings | history), three start buttons */}
      {!asModal && !activeWorkout && (
        <>
          <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
            <ImageBackground
              source={require('../../assets/home-background.png')}
              style={{ width: SCREEN_WIDTH, height: windowHeight, position: 'absolute', top: 0, left: 0 }}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['transparent', 'rgba(47, 48, 49, 0.4)', 'rgba(47, 48, 49, 0.85)', '#2F3031', '#1a1a1a']}
                locations={[0, 0.2, 0.35, 0.45, 0.65]}
                style={StyleSheet.absoluteFill}
              />
            </ImageBackground>
          </View>
          <View
            style={[
              styles.exploreHeader,
              styles.exploreHeaderOverlay,
              { paddingTop: 54, paddingHorizontal: Spacing.md + (insets.left || 0), paddingRight: Spacing.md + (insets.right || 0) },
            ]}
          >
            <Pressable onPress={() => router.push('/workout/settings')} style={styles.exploreHeaderIconWrap} hitSlop={12}>
              <Gear size={24} weight="regular" color={colors.primaryLight} />
            </Pressable>
            <View style={styles.exploreHeaderSpacer} />
            <Pressable onPress={() => router.push('/workout-history')} style={styles.exploreHeaderIconWrap} hitSlop={12}>
              <List size={24} weight="regular" color={colors.primaryLight} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={[
              styles.workoutHomeContent,
              { paddingTop: 54 + 48, paddingBottom: Math.max(Spacing.xl, insets.bottom + 100), paddingHorizontal: Spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.workoutHomeTitle, { color: colors.primaryLight }]}>Start workout</Text>
            <AnimatedPressable
              style={[styles.workoutHomeButton, { backgroundColor: colors.primaryDarkLighter, borderColor: colors.primaryLight + '25' }]}
              onPressIn={playIn}
              onPressOut={playOut}
              onPress={() => router.push('/workout/tmlsn-routines')}
            >
              <Text style={[styles.workoutHomeButtonText, { color: colors.primaryLight }]}>TMLSN workouts</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.workoutHomeButton, { backgroundColor: colors.primaryDarkLighter, borderColor: colors.primaryLight + '25' }]}
              onPressIn={playIn}
              onPressOut={playOut}
              onPress={() => router.push('/workout/your-routines')}
            >
              <Text style={[styles.workoutHomeButtonText, { color: colors.primaryLight }]}>Your workouts</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.workoutHomeButton, { backgroundColor: colors.primaryDarkLighter, borderColor: colors.primaryLight + '25' }]}
              onPressIn={playIn}
              onPressOut={playOut}
              onPress={() => router.push({ pathname: '/workout', params: { startEmpty: '1' } })}
            >
              <Text style={[styles.workoutHomeButtonText, { color: colors.primaryLight }]}>Empty workout</Text>
            </AnimatedPressable>
          </ScrollView>
        </>
      )}

      <WorkoutCore
        onFinish={handleFinish}
        useStickyHeader={false}
        enableReorder={false}
        enableStatsModal={false}
        enableRpeBump={true}
        recentSessions={[]}
        onRpeWarning={handleRpeWarning}
        onWeightUnitReady={handleWeightUnitReady}
        expandOnFocus={false}
        asModal={asModal}
        initialActiveWorkout={initialActiveWorkout}
        onCloseModal={onCloseModal}
      />

      <DynamicIslandRPEWarning
        visible={rpeWarning.visible}
        rpe={rpeWarning.rpe}
        exerciseName={rpeWarning.exerciseName}
        context="active"
        weightBumpDisplay={rpeWarning.weightBumpDisplay}
        weightUnit={weightUnit}
        isInjured={isInjured}
        onInjuredChange={setIsInjured}
        onDismiss={() => {
          setRpeWarning(prev => ({ ...prev, visible: false }));
          require('../../lib/liveActivity').revertWorkoutActivity();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    overflow: 'visible',
  },
  exploreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    zIndex: 1,
  },
  exploreHeaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  exploreHeaderIconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreHeaderSpacer: {
    flex: 1,
  },
  workoutHomeContent: { flex: 1, paddingBottom: Spacing.xl },
  workoutHomeTitle: { fontSize: Typography.h2, fontWeight: '600', marginBottom: Spacing.xl },
  workoutHomeButton: {
    width: '100%',
    maxWidth: BUTTON_WIDTH,
    height: MAIN_MENU_BUTTON_HEIGHT,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MAIN_MENU_BUTTON_GAP,
  },
  workoutHomeButtonText: { fontSize: Typography.body, fontWeight: '600' },
});
