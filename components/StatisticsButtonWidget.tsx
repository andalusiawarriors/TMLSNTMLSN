// ============================================================
// TMLSN — Statistics button widget (pressable, navigates to full stats)
// Same style as streak/achievements cards
// ============================================================

import React from 'react';
import { Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useButtonSound } from '../hooks/useButtonSound';
import { AnimatedPressable } from './AnimatedPressable';
import { Card } from './Card';
import { Colors, Font, Typography } from '../constants/theme';

const PROGRESS_CARD_WIDTH = Math.min(380, Dimensions.get('window').width - 40);
const PROGRESS_CARD_HEIGHT = 237;

export function StatisticsButtonWidget() {
  const router = useRouter();
  const { playIn, playOut } = useButtonSound();

  return (
    <AnimatedPressable
      onPressIn={playIn}
      onPressOut={playOut}
      onPress={() => router.push('/(tabs)/(profile)/statistics')}
      style={styles.wrap}
    >
      <Card gradientFill borderRadius={38} style={styles.card}>
        <Text style={styles.cardText}>statistics</Text>
      </Card>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    marginBottom: 15,
  },
  card: {
    width: PROGRESS_CARD_WIDTH,
    height: PROGRESS_CARD_HEIGHT,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    marginVertical: 0,
  },
  cardText: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.promptText,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: -0.1,
    color: '#C6C6C6',
    textAlign: 'center',
  },
});
