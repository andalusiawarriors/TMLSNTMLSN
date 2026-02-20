import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Typography, Spacing } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { AnimatedFadeInUp } from '../../components/AnimatedFadeInUp';
import { PillSegmentedControl, type SegmentValue } from '../../components/PillSegmentedControl';
import { HomeGradientBackground } from '../../components/HomeGradientBackground';
import { StatisticsButtonWidget } from '../../components/StatisticsButtonWidget';

const SEGMENT_CONTROL_WIDTH = Dimensions.get('window').width - Spacing.md * 2;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
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
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 52 }]}
        showsVerticalScrollIndicator={false}
      >
      <AnimatedFadeInUp delay={0} duration={380} trigger={animTrigger}>
        <Text style={[styles.title, { color: colors.primaryLight }]}>progress.</Text>
      </AnimatedFadeInUp>
      <AnimatedFadeInUp delay={50} duration={380} trigger={animTrigger}>
        <View style={styles.toggleWrap}>
          <PillSegmentedControl
            value={progressSegment}
            onValueChange={setProgressSegment}
            width={SEGMENT_CONTROL_WIDTH}
          />
        </View>
      </AnimatedFadeInUp>
      <AnimatedFadeInUp delay={100} duration={380} trigger={animTrigger}>
        <Text style={[styles.subtitle, { color: colors.primaryLight }]}>your account and settings</Text>
      </AnimatedFadeInUp>
      <AnimatedFadeInUp delay={150} duration={380} trigger={animTrigger}>
        <View style={styles.progressSection}>
          <StatisticsButtonWidget />
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
  title: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
  },
  subtitle: {
    fontSize: Typography.label,
    opacity: 0.8,
    marginTop: Spacing.sm,
    letterSpacing: -0.1,
  },
});
