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
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { getUserSettings, saveUserSettings } from '../../../utils/storage';
import type { UserSettings } from '../../../types';

const Font = {
  mono: 'DMMono_400Regular',
  semiBold: 'EBGaramond_600SemiBold',
} as const;

const REST_TIMER_OPTIONS = [60, 90, 120, 180];
const REST_TIMER_LABELS: Record<number, string> = {
  60: '1 min',
  90: '1:30',
  120: '2 min',
  180: '3 min',
};

export default function WorkoutSettingsScreen() {
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
      <View style={styles.container}>
        <Text style={styles.loadingText}>loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Weight unit */}
      <View style={styles.section}>
        <Text style={[styles.settingLabel, { marginBottom: Spacing.xs }]}>weight unit</Text>
        <Text style={styles.settingHint}>kg or lbs</Text>
        <View style={[styles.segmentRow, { marginTop: Spacing.sm }]}>
          {(['kg', 'lb'] as const).map((unit) => (
            <TouchableOpacity
              key={unit}
              style={[
                styles.segmentButton,
                settings.weightUnit === unit && styles.segmentButtonActive,
              ]}
              onPress={() => updateSettings({ weightUnit: unit })}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentButtonText,
                  settings.weightUnit === unit && styles.segmentButtonTextActive,
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
          <Text style={styles.settingLabel}>default rest timer</Text>
          <Switch
            value={settings.defaultRestTimerEnabled !== false}
            onValueChange={(v) => updateSettings({ defaultRestTimerEnabled: v })}
            trackColor={{ false: Colors.primaryLight + '40', true: Colors.primaryLight + '80' }}
            thumbColor={(settings.defaultRestTimerEnabled !== false) ? Colors.primaryDark : Colors.primaryLight}
          />
        </View>
        <Text style={styles.settingHint}>used when adding new exercises</Text>
        {(settings.defaultRestTimerEnabled !== false) && (
          <View style={[styles.optionsRow, { marginTop: Spacing.sm }]}>
              {REST_TIMER_OPTIONS.map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={[
                    styles.optionChip,
                    (settings.defaultRestTimer ?? 120) === sec && styles.optionChipActive,
                  ]}
                  onPress={() => updateSettings({ defaultRestTimer: sec })}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      (settings.defaultRestTimer ?? 120) === sec && styles.optionChipTextActive,
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
              <Text style={styles.settingLabel}>rest timer sound</Text>
              <Switch
                value={settings.restTimerSound}
                onValueChange={(v) => updateSettings({ restTimerSound: v })}
                trackColor={{ false: Colors.primaryLight + '40', true: Colors.primaryLight + '80' }}
                thumbColor={settings.restTimerSound ? Colors.primaryDark : Colors.primaryLight}
              />
            </View>
            <Text style={styles.settingHint}>play sound when rest timer completes</Text>
          </View>

          {/* Rest timer notification */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.settingLabel}>rest timer notification</Text>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(v) => updateSettings({ notificationsEnabled: v })}
                trackColor={{ false: Colors.primaryLight + '40', true: Colors.primaryLight + '80' }}
                thumbColor={settings.notificationsEnabled ? Colors.primaryDark : Colors.primaryLight}
              />
            </View>
            <Text style={styles.settingHint}>push notification when rest timer completes</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
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
    fontFamily: Font.mono,
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
    fontFamily: Font.mono,
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
    fontFamily: Font.mono,
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
    fontFamily: Font.mono,
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
