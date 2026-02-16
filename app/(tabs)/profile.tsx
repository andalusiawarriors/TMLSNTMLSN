import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { StatisticsButtonWidget } from '../../components/StatisticsButtonWidget';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your account and settings</Text>
      <View style={styles.progressSection}>
        <StatisticsButtonWidget />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  container: {
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    paddingBottom: Spacing.xxl,
  },
  progressSection: {
    marginTop: Spacing.xl,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'EBGaramond_800ExtraBold',
    fontSize: Typography.h1 + 8,
    color: Colors.primaryLight,
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: 'DMMono_400Regular',
    fontSize: Typography.label,
    color: Colors.primaryLight,
    opacity: 0.8,
    marginTop: Spacing.sm,
    letterSpacing: -0.1,
  },
});
