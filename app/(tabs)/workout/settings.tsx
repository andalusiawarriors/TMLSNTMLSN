import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Font } from '../../../constants/theme';
import { useTheme } from '../../../context/ThemeContext';
import { getUserSettings, saveUserSettings } from '../../../utils/storage';
import type { UserSettings } from '../../../types';
import { HomeGradientBackground } from '../../../components/HomeGradientBackground';

const REST_TIMER_OPTIONS = [60, 90, 120, 180];
const REST_TIMER_LABELS: Record<number, string> = {
  60: '1 min',
  90: '1:30',
  120: '2 min',
  180: '3 min',
};

export default function WorkoutSettingsScreen() {
  const { colors } = useTheme();
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const loadSettings = useCallback(async () => {
    const s = await getUserSettings();
    setSettings(s);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...updates };
    setSettings(next);
    await saveUserSettings(next);
  };

  if (!settings) {
    return (
      <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
        <HomeGradientBackground />
        <Text style={[styles.loadingText, { color: colors.primaryLight }]}>loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      <HomeGradientBackground />
      <ScrollView
        style={styles.scrollLayer}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      {/* Weight unit */}
      <View style={styles.section}>
        <Text style={[styles.settingLabel, { marginBottom: Spacing.xs, color: colors.primaryLight }]}>weight unit</Text>
        <Text style={[styles.settingHint, { color: colors.primaryLight + '99' }]}>kg or lbs</Text>
        <View style={[styles.segmentRow, { marginTop: Spacing.sm }]}>
          {(['kg', 'lb'] as const).map((unit) => (
            <TouchableOpacity
              key={unit}
              style={[
                styles.segmentButton,
                { backgroundColor: colors.primaryDarkLighter },
                settings.weightUnit === unit && { backgroundColor: colors.primaryLight },
              ]}
              onPress={() => updateSettings({ weightUnit: unit })}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentButtonText,
                  { color: colors.primaryLight },
                  settings.weightUnit === unit && { color: colors.primaryDark },
                ]}
              >
                {unit === 'kg' ? 'kg' : 'lbs'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Default rest timer */}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={[styles.settingLabel, { color: colors.primaryLight }]}>default rest timer</Text>
          <Switch
            value={settings.defaultRestTimerEnabled !== false}
            onValueChange={(v) => updateSettings({ defaultRestTimerEnabled: v })}
            trackColor={{ false: colors.primaryLight + '40', true: colors.primaryLight + '80' }}
            thumbColor={(settings.defaultRestTimerEnabled !== false) ? colors.primaryDark : colors.primaryLight}
          />
        </View>
        <Text style={[styles.settingHint, { color: colors.primaryLight + '99' }]}>used when adding new exercises</Text>
        {(settings.defaultRestTimerEnabled !== false) && (
          <View style={[styles.optionsRow, { marginTop: Spacing.sm }]}>
              {REST_TIMER_OPTIONS.map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={[
                    styles.optionChip,
                    { backgroundColor: colors.primaryLight + '15' },
                    (settings.defaultRestTimer ?? 120) === sec && { backgroundColor: colors.accentBlue },
                  ]}
                  onPress={() => updateSettings({ defaultRestTimer: sec })}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      { color: colors.primaryLight + '80' },
                      (settings.defaultRestTimer ?? 120) === sec && { color: colors.white },
                    ]}
                  >
                    {REST_TIMER_LABELS[sec]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
        )}
      </View>

      {(settings.defaultRestTimerEnabled !== false) && (
        <>
          {/* Rest timer sound */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={[styles.settingLabel, { color: colors.primaryLight }]}>rest timer sound</Text>
              <Switch
                value={settings.restTimerSound}
                onValueChange={(v) => updateSettings({ restTimerSound: v })}
                trackColor={{ false: colors.primaryLight + '40', true: colors.primaryLight + '80' }}
                thumbColor={settings.restTimerSound ? colors.primaryDark : colors.primaryLight}
              />
            </View>
            <Text style={[styles.settingHint, { color: colors.primaryLight + '99' }]}>play sound when rest timer completes</Text>
          </View>

          {/* Rest timer notification */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={[styles.settingLabel, { color: colors.primaryLight }]}>rest timer notification</Text>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(v) => updateSettings({ notificationsEnabled: v })}
                trackColor={{ false: colors.primaryLight + '40', true: colors.primaryLight + '80' }}
                thumbColor={settings.notificationsEnabled ? colors.primaryDark : colors.primaryLight}
              />
            </View>
            <Text style={[styles.settingHint, { color: colors.primaryLight + '99' }]}>push notification when rest timer completes</Text>
          </View>
        </>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  scrollLayer: {
    zIndex: 2,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  loadingText: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontFamily: Font.semiBold,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    color: Colors.primaryLight + '99',
    marginBottom: Spacing.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryDarkLighter,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  segmentButtonActive: {
    backgroundColor: Colors.primaryLight,
  },
  segmentButtonText: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
  },
  segmentButtonTextActive: {
    color: Colors.primaryDark,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  optionChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryDarkLighter,
    ...Shadows.card,
  },
  optionChipActive: {
    backgroundColor: Colors.primaryLight,
  },
  optionChipText: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
  },
  optionChipTextActive: {
    color: Colors.primaryDark,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  settingLabel: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
    flex: 1,
  },
  settingHint: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    color: Colors.primaryLight + '99',
    marginTop: Spacing.xs,
  },
});
