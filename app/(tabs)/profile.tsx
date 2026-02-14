import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../../constants/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your account and settings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.md,
    justifyContent: 'flex-start',
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
