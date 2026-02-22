import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Typography, Spacing } from '../constants/theme';

export default function PreferencesScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.primaryLight }]}>preferences</Text>
        <Text style={[styles.placeholder, { color: colors.primaryLight }]}>
          Preferences screen — coming soon.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  title: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
    marginBottom: Spacing.md,
  },
  placeholder: {
    fontSize: Typography.body,
    opacity: 0.8,
  },
});
