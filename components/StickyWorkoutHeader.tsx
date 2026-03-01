import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AnimatedReanimated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  animStyle: any;
  workoutName: string;
  elapsedSeconds: number;
  totalVolumeDisplay: number;
  weightUnit: 'lb' | 'kg';
  completedSetsCount: number;
  exerciseCount: number;
  onFinish: () => void;
  onMinimize: () => void;
  paddingTop: number;
  colors: {
    primaryDark: string;
    primaryLight: string;
    tabBarBorder: [string, string];
    tabBarFill: [string, string];
  };
};

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

export function StickyWorkoutHeader({
  animStyle,
  workoutName,
  elapsedSeconds,
  totalVolumeDisplay,
  weightUnit,
  completedSetsCount,
  exerciseCount,
  onFinish,
  onMinimize,
  paddingTop,
  colors,
}: Props) {
  return (
    <AnimatedReanimated.View
      style={[
        styles.container,
        { backgroundColor: colors.primaryDark, paddingTop },
        animStyle,
      ]}
    >
      {/* Top bar row */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={onMinimize}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.sideButtonWrap}
        >
          <View style={styles.minimizeIconButton}>
            <LinearGradient
              colors={colors.tabBarBorder}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 15 }]}
            />
            <LinearGradient
              colors={colors.tabBarFill}
              style={{ position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderRadius: 14 }}
            />
            <Ionicons name="chevron-down" size={18} color={colors.primaryLight} />
          </View>
        </TouchableOpacity>

        <View style={styles.center} pointerEvents="box-none">
          <Text style={[styles.workoutName, { color: colors.primaryLight }]} numberOfLines={1}>
            {workoutName}
          </Text>
          <Text style={[styles.timer, { color: colors.primaryLight + '99' }]}>
            {formatElapsed(elapsedSeconds)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onFinish}
          style={[styles.finishButton, { backgroundColor: colors.primaryLight }]}
        >
          <Text style={[styles.finishButtonText, { color: colors.primaryDark }]}>Finish</Text>
        </TouchableOpacity>
      </View>

      {/* Stats pills */}
      <View style={styles.statsRow}>
        <View style={[styles.pill, { backgroundColor: colors.primaryLight + '12' }]}>
          <Text style={[styles.pillIcon, { color: colors.primaryLight + '80' }]}>⚖</Text>
          <Text style={[styles.pillValue, { color: colors.primaryLight }]}>{Math.round(totalVolumeDisplay).toLocaleString()}</Text>
          <Text style={[styles.pillUnit, { color: colors.primaryLight + '80' }]}>{weightUnit}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: colors.primaryLight + '12' }]}>
          <Text style={[styles.pillIcon, { color: colors.primaryLight + '80' }]}>◉</Text>
          <Text style={[styles.pillValue, { color: colors.primaryLight }]}>{completedSetsCount}</Text>
          <Text style={[styles.pillUnit, { color: colors.primaryLight + '80' }]}>sets</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: colors.primaryLight + '12' }]}>
          <Text style={[styles.pillIcon, { color: colors.primaryLight + '80' }]}>◎</Text>
          <Text style={[styles.pillValue, { color: colors.primaryLight }]}>{exerciseCount}</Text>
          <Text style={[styles.pillUnit, { color: colors.primaryLight + '80' }]}>exercises</Text>
        </View>
      </View>
    </AnimatedReanimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 99,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  sideButtonWrap: { width: 44, alignItems: 'flex-start' },
  minimizeIconButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  workoutName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  timer: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  finishButton: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  finishButtonText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },
  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillIcon: { fontSize: 11 },
  pillValue: { fontSize: 13, fontWeight: '600' },
  pillUnit: { fontSize: 11, fontWeight: '500' },
});
