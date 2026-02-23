import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Spacing } from '../../../constants/theme';
import { AnimatedFadeInUp } from '../../../components/AnimatedFadeInUp';
import { PillSegmentedControl, type SegmentValue } from '../../../components/PillSegmentedControl';
import { HomeGradientBackground } from '../../../components/HomeGradientBackground';
import { StatisticsButtonWidget } from '../../../components/StatisticsButtonWidget';
import { WorkoutProgressWidget } from '../../../components/WorkoutProgressWidget';
import { FitnessGraphWidget } from '../../../components/FitnessGraphWidget';

const SEGMENT_CONTROL_WIDTH = Dimensions.get('window').width - Spacing.md * 2;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [animTrigger, setAnimTrigger] = useState(0);
  const [progressSegment, setProgressSegment] = useState<SegmentValue>('Nutrition');

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
    }, [])
  );

  return (
    <View style={styles.wrapper}>
      <HomeGradientBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
      <AnimatedFadeInUp delay={0} duration={380} trigger={animTrigger}>
        <View style={styles.toggleWrap}>
          <PillSegmentedControl
            value={progressSegment}
            onValueChange={(v) => setProgressSegment(v as 'Nutrition' | 'Fitness')}
            width={SEGMENT_CONTROL_WIDTH}
          />
        </View>
      </AnimatedFadeInUp>
      <AnimatedFadeInUp delay={50} duration={380} trigger={animTrigger}>
        <View style={styles.progressSection}>
          {progressSegment === 'Fitness' && (
            <>
              <FitnessGraphWidget />
              <WorkoutProgressWidget />
              <StatisticsButtonWidget />
            </>
          )}
        </View>
      </AnimatedFadeInUp>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  container: {
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    paddingBottom: Spacing.xxl,
  },
  toggleWrap: {
    marginTop: Spacing.sm,
    marginBottom: 4,
    alignSelf: 'center',
  },
  progressSection: {
    marginTop: Spacing.xl,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
});
