import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../constants/theme';
import { TmlsnText } from './ui/TmlsnText';
import { getUserSettings, saveUserSettings } from '../utils/storage';
import type { UserSettings } from '../types';
import {
  SettingsSectionHeader,
  SettingsCard,
  SettingsRow,
  SettingsToggleRow,
  SETTINGS_ICON_COLOR,
} from './SettingsShared';

const REST_TIMER_OPTIONS = [60, 90, 120, 180];
const REST_TIMER_LABELS: Record<number, string> = {
  60: '1 min',
  90: '1:30',
  120: '2 min',
  180: '3 min',
};

function SegmentPill({
  label,
  selected,
  onPress,
}: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected && styles.pillActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <TmlsnText style={[styles.pillText, selected && styles.pillTextActive]}>{label}</TmlsnText>
    </Pressable>
  );
}

export default function AppSettingsScreen() {
  const insets = useSafeAreaInsets();
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
      <View style={[styles.container, { backgroundColor: Colors.primaryDark }]}>
        <TmlsnText style={styles.loadingText}>loading...</TmlsnText>
      </View>
    );
  }

  const contentBottom = insets.bottom + Spacing.xxl;

  return (
    <View style={[styles.container, { backgroundColor: Colors.primaryDark }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: Spacing.md, paddingBottom: contentBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSectionHeader label="Units" />
        <SettingsCard>
          <SettingsRow
            icon="barbell-outline"
            label="Weight unit"
            subtitle="kg or lbs"
            last={false}
            right={
              <View style={styles.pillRow}>
                <SegmentPill
                  label="kg"
                  selected={settings.weightUnit === 'kg'}
                  onPress={() => updateSettings({ weightUnit: 'kg' })}
                />
                <SegmentPill
                  label="lbs"
                  selected={settings.weightUnit === 'lb'}
                  onPress={() => updateSettings({ weightUnit: 'lb' })}
                />
              </View>
            }
          />
          <SettingsRow
            icon="water-outline"
            label="Volume unit"
            subtitle="oz or ml"
            last
            right={
              <View style={styles.pillRow}>
                <SegmentPill
                  label="oz"
                  selected={settings.volumeUnit === 'oz'}
                  onPress={() => updateSettings({ volumeUnit: 'oz' })}
                />
                <SegmentPill
                  label="ml"
                  selected={settings.volumeUnit === 'ml'}
                  onPress={() => updateSettings({ volumeUnit: 'ml' })}
                />
              </View>
            }
          />
        </SettingsCard>

        <SettingsSectionHeader label="Training" />
        <SettingsCard>
          <SettingsRow
            icon="fitness-outline"
            label="Training focus"
            subtitle="shapes your progressive overload targets"
            last
            right={
              <View style={styles.pillRow}>
                <SegmentPill
                  label="Hypertrophy"
                  selected={(settings.training?.trainingFocus ?? 'hypertrophy') === 'hypertrophy'}
                  onPress={() => updateSettings({ training: { ...(settings.training as any), trainingFocus: 'hypertrophy' } })}
                />
                <SegmentPill
                  label="Strength"
                  selected={settings.training?.trainingFocus === 'strength'}
                  onPress={() => updateSettings({ training: { ...(settings.training as any), trainingFocus: 'strength' } })}
                />
              </View>
            }
          />
        </SettingsCard>

        <SettingsSectionHeader label="Workout" />
        <SettingsCard>
          <SettingsToggleRow
            icon="time-outline"
            label="Default rest timer"
            subtitle="used when adding new exercises"
            value={settings.defaultRestTimerEnabled !== false}
            onValueChange={(v) => updateSettings({ defaultRestTimerEnabled: v })}
            last={settings.defaultRestTimerEnabled === false}
          />
          {(settings.defaultRestTimerEnabled !== false) && (
            <>
              <View style={[styles.chipRowWrap, styles.rowBorder]}>
                <View style={styles.chipRow}>
                  {REST_TIMER_OPTIONS.map((sec) => (
                    <Pressable
                      key={sec}
                      onPress={() => updateSettings({ defaultRestTimer: sec })}
                      style={({ pressed }) => [
                        styles.chip,
                        (settings.defaultRestTimer ?? 120) === sec && styles.chipActive,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <TmlsnText
                        style={[
                          styles.chipText,
                          (settings.defaultRestTimer ?? 120) === sec && styles.chipTextActive,
                        ]}
                      >
                        {REST_TIMER_LABELS[sec]}
                      </TmlsnText>
                    </Pressable>
                  ))}
                </View>
              </View>
              <SettingsToggleRow
                icon="volume-medium-outline"
                label="Rest timer sound"
                subtitle="play sound when rest timer completes"
                value={settings.restTimerSound}
                onValueChange={(v) => updateSettings({ restTimerSound: v })}
                last={false}
              />
              <SettingsToggleRow
                icon="notifications-outline"
                label="Rest timer notification"
                subtitle="push notification when rest timer completes"
                value={settings.notificationsEnabled}
                onValueChange={(v) => updateSettings({ notificationsEnabled: v })}
                last
              />
            </>
          )}
        </SettingsCard>

        <SettingsSectionHeader label="Workout" />
        <SettingsCard>
          <SettingsRow
            icon="barbell-outline"
            label="Dumbbell weight entry"
            subtitle="for bilateral exercises (e.g. lateral raise)"
            last={false}
            right={
              <View style={styles.pillRow}>
                <SegmentPill
                  label="Per hand"
                  selected={(settings.dumbbellWeightPreference ?? 'per_hand') === 'per_hand'}
                  onPress={() => updateSettings({ dumbbellWeightPreference: 'per_hand' })}
                />
                <SegmentPill
                  label="Total"
                  selected={(settings.dumbbellWeightPreference ?? 'per_hand') === 'total'}
                  onPress={() => updateSettings({ dumbbellWeightPreference: 'total' })}
                />
              </View>
            }
          />
        </SettingsCard>

        <SettingsSectionHeader label="Display" />
        <SettingsCard>
          <SettingsRow
            icon="body-outline"
            label="Body map figure"
            subtitle="anatomical figure for muscle heatmap"
            last
            right={
              <View style={styles.pillRow}>
                <SegmentPill
                  label="Male"
                  selected={(settings.bodyMapGender ?? 'male') === 'male'}
                  onPress={() => updateSettings({ bodyMapGender: 'male' })}
                />
                <SegmentPill
                  label="Female"
                  selected={(settings.bodyMapGender ?? 'male') === 'female'}
                  onPress={() => updateSettings({ bodyMapGender: 'female' })}
                />
              </View>
            }
          />
        </SettingsCard>

        <View style={{ height: Spacing.xxl }} />
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
    paddingTop: Spacing.md,
  },
  loadingText: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pillActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: SETTINGS_ICON_COLOR,
  },
  pillTextActive: {
    color: '#2F3031',
  },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  chipRowWrap: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: SETTINGS_ICON_COLOR,
  },
  chipTextActive: {
    color: '#2F3031',
  },
});
