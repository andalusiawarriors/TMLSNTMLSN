// TMLSN — ExerciseStatsModal
// Bottom-sheet modal: per-exercise line charts for current workout

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Animated, Dimensions, TouchableWithoutFeedback } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

type ExerciseSet = { weight: number; reps: number; completed: boolean };
type Exercise = { id: string; name: string; sets: ExerciseSet[] };
type Props = {
  visible: boolean;
  onClose: () => void;
  exercises: Exercise[];
  initialTab: 'volume' | 'sets';
  weightUnit: 'lb' | 'kg';
};

const CHART_W = 280, CHART_H = 90, PAD_L = 8, PAD_R = 8, PAD_T = 8, PAD_B = 8;
const INNER_W = CHART_W - PAD_L - PAD_R;
const INNER_H = CHART_H - PAD_T - PAD_B;

function buildChartPaths(data: number[]) {
  const minVal = Math.min(...data), maxVal = Math.max(...data), range = maxVal - minVal || 1;
  const getX = (i: number) => PAD_L + (i / Math.max(data.length - 1, 1)) * INNER_W;
  const getY = (v: number) => PAD_T + INNER_H - ((v - minVal) / range) * INNER_H;
  const pathD = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(2)},${getY(v).toFixed(2)}`).join(' ');
  const areaD = `${pathD} L ${getX(data.length - 1).toFixed(2)},${CHART_H} L ${getX(0).toFixed(2)},${CHART_H} Z`;
  return { pathD, areaD, getX, getY };
}

function ExerciseChart({ exercise, tab }: { exercise: Exercise; tab: 'volume' | 'sets'; weightUnit: 'lb' | 'kg' }) {
  const completed = exercise.sets.filter(s => s.completed);
  const data = tab === 'volume' ? completed.map(s => s.weight * s.reps) : completed.map(s => s.reps);
  if (data.length < 2) return <Text style={s.noData}>Not enough data</Text>;

  const { pathD, areaD, getX, getY } = buildChartPaths(data);
  const gradId = `g_${exercise.id}_${tab}`;
  const colW = data.length > 1 ? INNER_W / (data.length - 1) : INNER_W;
  const fmt = (v: number) => tab === 'volume' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`) : `${v}`;

  const labelLayout = (i: number) => {
    const cx = getX(i), half = colW / 2;
    if (data.length === 1) return { left: 0, width: CHART_W };
    if (i === 0) return { left: 0, width: cx + half };
    if (i === data.length - 1) return { left: cx - half, width: CHART_W - (cx - half) };
    return { left: cx - half, width: colW };
  };

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H} style={{ marginVertical: 4 }}>
        <Defs>
          <SvgLinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="rgba(198,198,198,0.25)" />
            <Stop offset="1" stopColor="rgba(198,198,198,0)" />
          </SvgLinearGradient>
        </Defs>
        <Path d={areaD} fill={`url(#${gradId})`} />
        <Path d={pathD} stroke="rgba(198,198,198,0.9)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((v, i) => <Circle key={i} cx={getX(i)} cy={getY(v)} r={4} fill="#C6C6C6" />)}
      </Svg>
      <View style={[s.labelRow, { width: CHART_W }]}>
        {data.map((_, i) => <View key={i} style={[s.labelCell, labelLayout(i)]}><Text style={s.labelSet}>Set {i + 1}</Text></View>)}
      </View>
      <View style={[s.labelRow, { width: CHART_W, marginTop: 2 }]}>
        {data.map((v, i) => <View key={i} style={[s.labelCell, labelLayout(i)]}><Text style={s.labelVal}>{fmt(v)}</Text></View>)}
      </View>
    </View>
  );
}

const { height: SCREEN_H } = Dimensions.get('window');

export default function ExerciseStatsModal({ visible, onClose, exercises, initialTab, weightUnit }: Props) {
  const [activeTab, setActiveTab] = useState<'volume' | 'sets'>(initialTab);
  const ty = useRef(new Animated.Value(300)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      ty.setValue(300); op.setValue(0);
      Animated.parallel([
        Animated.spring(ty, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4 }),
        Animated.timing(op, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(ty, { toValue: 300, duration: 220, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.backdrop, { opacity: op }]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[s.sheet, { transform: [{ translateY: ty }], opacity: op }]} pointerEvents="box-none">
        <View style={s.handleWrap}><View style={s.handle} /></View>
        <View style={s.tabRow}>
          {(['volume', 'sets'] as const).map(tab => (
            <Pressable key={tab} style={[s.tabPill, activeTab === tab && s.tabPillOn]} onPress={() => setActiveTab(tab)}>
              <Text style={[s.tabText, activeTab === tab && s.tabTextOn]}>{tab === 'volume' ? 'Volume' : 'Sets'}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {exercises.length === 0
            ? <View style={s.empty}><Text style={s.emptyText}>No exercises yet</Text></View>
            : exercises.map(ex => (
              <View key={ex.id} style={s.section}>
                <Text style={s.exName}>{ex.name}</Text>
                <ExerciseChart exercise={ex} tab={activeTab} weightUnit={weightUnit} />
              </View>
            ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: SCREEN_H * 0.85, backgroundColor: 'rgba(20,20,20,0.96)', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  tabRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16 },
  tabPill: { paddingHorizontal: 20, paddingVertical: 7, borderRadius: 20 },
  tabPillOn: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  tabTextOn: { color: '#141414', fontWeight: '600' },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  section: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, marginBottom: 12 },
  exName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
  noData: { fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingVertical: 24 },
  labelRow: { flexDirection: 'row', position: 'relative', height: 16 },
  labelCell: { position: 'absolute', alignItems: 'center' },
  labelSet: { fontSize: 11, color: 'rgba(198,198,198,0.5)' },
  labelVal: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.3)' },
});
