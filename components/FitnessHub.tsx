// ============================================================
// TMLSN — Fitness Hub
// Tile grid for the fitness. home tab.
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { Colors } from '../constants/theme';
import { AnimatedFadeInUp } from './AnimatedFadeInUp';
import TiltPressable from './TiltPressable';

import { EXERCISE_DATABASE } from '../utils/exerciseDb/exerciseDatabase';
import { getAllExerciseSettings } from '../utils/exerciseSettings';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PARENT_PAD = 19;
const GRID_GAP = 14;
const CARD_SIZE = Math.floor((SCREEN_WIDTH - PARENT_PAD * 2 - GRID_GAP) / 2);
const TILE_RADIUS = 38;

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

function TileCard({ item, index, animTrigger, children }: { item: TileData; index: number; animTrigger: number; children?: React.ReactNode }) {
  const router = useRouter();
  return (
    <AnimatedFadeInUp delay={50 + index * 45} duration={440} trigger={animTrigger}>
      <View style={tileStyles.tileWrap}>
        <TiltPressable
          style={{ width: CARD_SIZE, height: CARD_SIZE }}
          borderRadius={TILE_RADIUS}
          shadowStyle={tileStyles.shadow}
          longPressMs={210}
          onPress={() => router.push(item.route as any)}
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

export function FitnessHub() {
  const [animTrigger, setAnimTrigger] = useState(0);
  const [favCount, setFavCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      getAllExerciseSettings().then((settings) => {
        setFavCount(Object.values(settings).filter((s) => s.favorite).length);
      });
    }, []),
  );

  const exercisesTile: TileData = {
    id: 'exercises',
    title: 'exercises.',
    subtitle: `${EXERCISE_DATABASE.length} exercises`,
    route: '/exercises',
  };

  return (
    <View style={styles.wrap}>
      <TileCard item={exercisesTile} index={0} animTrigger={animTrigger}>
        <View style={{ alignSelf: 'flex-start', gap: 5 }}>
          <MiniStatRow value={String(EXERCISE_DATABASE.length)} label="total" />
          {favCount > 0 && <MiniStatRow value={String(favCount)} label="starred" />}
        </View>
      </TileCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 24,
  },
});
