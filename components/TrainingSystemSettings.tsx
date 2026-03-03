// ============================================================
// TMLSN — Training System Settings
// Volume Framework · Schedule Mode · Week Reset
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getUserSettings, saveUserSettings } from '../utils/storage';
import { DEFAULT_TRAINING_SETTINGS } from '../constants/storageDefaults';
import { Font, Spacing } from '../constants/theme';
import {
  SETTINGS_CARD_BG,
  SETTINGS_CARD_BORDER,
  SETTINGS_ACCENT_GOLD,
  SETTINGS_ICON_COLOR,
} from './SettingsShared';
import type {
  UserSettings,
  TrainingSettings,
  VolumeFramework,
  ScheduleMode,
  WeekReset,
  RpMuscleTarget,
  RangeMuscleTarget,
} from '../types';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const GOLD = SETTINGS_ACCENT_GOLD;           // #D4B896
const GOLD_DARK = '#A8895E';
const GOLD_BG = 'rgba(212,184,150,0.07)';
const GOLD_BORDER = 'rgba(212,184,150,0.28)';
const CARD_BG = SETTINGS_CARD_BG;
const CARD_BORDER = SETTINGS_CARD_BORDER;
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = SETTINGS_ICON_COLOR;  // rgba(255,255,255,0.7)
const TEXT_MUTED = 'rgba(255,255,255,0.35)';
const SURFACE2 = 'rgba(255,255,255,0.05)';
const DIVIDER = 'rgba(255,255,255,0.08)';

// ─── Static Data ──────────────────────────────────────────────────────────────
const VOLUME_FRAMEWORKS = [
  {
    id: 'rp' as VolumeFramework,
    label: 'RP Landmarks',
    tag: 'Science-Based',
    icon: 'analytics-outline' as const,
    description: 'MEV → MAV → MRV per muscle. Train within your adaptive range, not beyond it.',
    detail: 'Min Effective · Max Adaptive · Max Recoverable',
  },
  {
    id: 'range' as VolumeFramework,
    label: 'Target Range',
    tag: 'Simple',
    icon: 'options-outline' as const,
    description: 'Set a weekly set range per muscle group. Hit the window, stay out of junk volume.',
    detail: 'e.g. Chest: 10–20 sets/week · Quads: 12–20 sets/week',
  },
  {
    id: 'custom' as VolumeFramework,
    label: 'Custom',
    tag: 'Full Control',
    icon: 'construct-outline' as const,
    description: 'Define your own targets. You know your body — build your own model.',
    detail: 'Set exact targets per muscle · Override any default',
  },
] as const;

const SCHEDULE_MODES = [
  {
    id: 'builder' as ScheduleMode,
    label: 'Builder',
    tag: 'Manual',
    icon: 'calendar-outline' as const,
    description: 'You construct the week. Drag workouts into days, edit anytime.',
    detail: 'Mid-week editing is optional — toggle it on or off per cycle.',
    options: [{ id: 'allowMidWeekEdits' as const, label: 'Allow mid-week edits' }],
  },
  {
    id: 'tmlsn' as ScheduleMode,
    label: 'TMLSN Protocol',
    tag: 'Preset',
    icon: 'flash-outline' as const,
    description: 'The TMLSN schedule is set for you. Daily push notifications confirm your session.',
    detail: 'Mon: Push · Tue: Pull · Wed: Legs · Thu: Push · Fri: Pull · Sat: Full · Sun: Rest',
    options: [
      { id: 'scheduleNotifications' as const, label: 'Daily session notifications' },
      { id: 'scheduleReminderEnabled' as const, label: 'Morning reminder at 05:30' },
    ],
  },
  {
    id: 'ghost' as ScheduleMode,
    label: 'Ghost',
    tag: 'No Schedule',
    icon: 'radio-button-off-outline' as const,
    description: 'Pure tracking. No schedule, no notifications. Log when you train.',
    detail: 'Volume tracking still active. History still recorded.',
    options: [] as { id: 'allowMidWeekEdits' | 'scheduleNotifications' | 'scheduleReminderEnabled'; label: string }[],
  },
] as const;

const WEEK_RESETS = [
  { id: 'monday' as WeekReset,     label: 'Monday – Sunday',   description: 'Standard calendar week' },
  { id: 'rolling' as WeekReset,    label: 'Rolling 7 Days',    description: 'From your last logged workout' },
  { id: 'custom_day' as WeekReset, label: 'Custom Start Day',  description: 'You pick the anchor day' },
] as const;

const RP_MUSCLE_KEYS = [
  { id: 'chest',      name: 'Chest' },
  { id: 'back',       name: 'Back' },
  { id: 'quads',      name: 'Quads' },
  { id: 'hamstrings', name: 'Hamstrings' },
  { id: 'shoulders',  name: 'Shoulders' },
  { id: 'biceps',     name: 'Biceps' },
  { id: 'triceps',    name: 'Triceps' },
  { id: 'calves',     name: 'Calves' },
  { id: 'glutes',     name: 'Glutes' },
  { id: 'core',       name: 'Core' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={styles.sectionLabel}>{children}</Text>
  );
}

function TagChip({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.tag, active && styles.tagActive]}>
      <Text style={[styles.tagText, active && styles.tagTextActive]}>{label}</Text>
    </View>
  );
}

type ToggleRowProps = {
  label: string;
  enabled: boolean;
  onToggle: () => void;
};

function ToggleRow({ label, enabled, onToggle }: ToggleRowProps) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.toggleRow}
    >
      <Text style={[styles.toggleLabel, enabled && styles.toggleLabelActive]}>{label}</Text>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ false: 'rgba(255,255,255,0.15)', true: GOLD }}
        thumbColor={enabled ? '#1a1a1a' : 'rgba(255,255,255,0.5)'}
        ios_backgroundColor="rgba(255,255,255,0.15)"
      />
    </Pressable>
  );
}

type SelectionCardProps = {
  icon: string;
  label: string;
  tag: string;
  description: string;
  detail: string;
  selected: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
};

function SelectionCard({
  icon, label, tag, description, detail, selected, onSelect, children,
}: SelectionCardProps) {
  return (
    <Pressable
      onPress={onSelect}
      style={[styles.selCard, selected && styles.selCardActive]}
    >
      {selected && (
        <LinearGradient
          colors={[GOLD, GOLD_DARK]}
          style={styles.selCardAccentBar}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      )}
      <View style={styles.selCardHeader}>
        <View style={styles.selCardTitleRow}>
          <Ionicons
            name={icon as any}
            size={17}
            color={selected ? GOLD : TEXT_MUTED}
            style={styles.selCardIcon}
          />
          <Text style={[styles.selCardLabel, selected && styles.selCardLabelActive]}>
            {label}
          </Text>
        </View>
        <TagChip label={tag} active={selected} />
      </View>
      <Text style={[styles.selCardDesc, selected && styles.selCardDescActive]}>
        {description}
      </Text>
      <Text style={styles.selCardDetail}>{detail}</Text>
      {children}
    </Pressable>
  );
}

// ─── RP Editor ────────────────────────────────────────────────────────────────
type RPEditorProps = {
  targets: Record<string, RpMuscleTarget>;
  onChange: (muscle: string, key: keyof RpMuscleTarget, val: number) => void;
};

function RPEditor({ targets, onChange }: RPEditorProps) {
  return (
    <View style={styles.editorWrap}>
      <View style={styles.editorHeaderRow}>
        <Text style={[styles.editorColHeader, { flex: 1 }]}>MUSCLE</Text>
        {(['MEV', 'MAV', 'MRV'] as const).map(h => (
          <Text key={h} style={[styles.editorColHeader, styles.editorColHeaderGold, styles.editorNumCol]}>
            {h}
          </Text>
        ))}
      </View>
      {RP_MUSCLE_KEYS.map(({ id, name }) => {
        const t = targets[id] ?? DEFAULT_TRAINING_SETTINGS.rpMuscleTargets[id];
        return (
          <View key={id} style={styles.editorRow}>
            <Text style={[styles.editorMuscle, { flex: 1 }]}>{name}</Text>
            {(['mev', 'mav', 'mrv'] as const).map(key => (
              <TextInput
                key={key}
                style={styles.editorInput}
                value={String(t[key])}
                onChangeText={v => onChange(id, key, parseInt(v, 10) || 0)}
                keyboardType="numeric"
                maxLength={3}
                selectTextOnFocus
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ─── Range Editor ─────────────────────────────────────────────────────────────
type RangeEditorProps = {
  targets: Record<string, RangeMuscleTarget>;
  onChange: (muscle: string, key: keyof RangeMuscleTarget, val: number) => void;
};

function RangeEditor({ targets, onChange }: RangeEditorProps) {
  return (
    <View style={styles.editorWrap}>
      <View style={styles.editorHeaderRow}>
        <Text style={[styles.editorColHeader, { flex: 1 }]}>MUSCLE</Text>
        {(['MIN', 'MAX'] as const).map(h => (
          <Text key={h} style={[styles.editorColHeader, styles.editorColHeaderGold, styles.editorNumColWide]}>
            {h}
          </Text>
        ))}
      </View>
      {RP_MUSCLE_KEYS.map(({ id, name }) => {
        const t = targets[id] ?? DEFAULT_TRAINING_SETTINGS.rangeMuscleTargets[id];
        return (
          <View key={id} style={styles.editorRow}>
            <Text style={[styles.editorMuscle, { flex: 1 }]}>{name}</Text>
            {(['min', 'max'] as const).map(key => (
              <TextInput
                key={key}
                style={[styles.editorInput, styles.editorInputWide]}
                value={String(t[key])}
                onChangeText={v => onChange(id, key, parseInt(v, 10) || 0)}
                keyboardType="numeric"
                maxLength={3}
                selectTextOnFocus
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ─── Week Reset Row ───────────────────────────────────────────────────────────
type WeekResetRowProps = {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  last?: boolean;
};

function WeekResetRow({ label, description, selected, onSelect, last }: WeekResetRowProps) {
  return (
    <Pressable
      onPress={onSelect}
      style={[styles.resetRow, selected && styles.resetRowActive, !last && styles.resetRowBorder]}
    >
      {selected && (
        <LinearGradient
          colors={[GOLD, GOLD_DARK]}
          style={styles.resetRowAccentBar}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      )}
      <View style={styles.resetRowText}>
        <Text style={[styles.resetRowLabel, selected && styles.resetRowLabelActive]}>{label}</Text>
        <Text style={styles.resetRowDesc}>{description}</Text>
      </View>
      <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
        {selected && <View style={styles.radioInner} />}
      </View>
    </Pressable>
  );
}

// ─── Config Summary ───────────────────────────────────────────────────────────
type ConfigSummaryProps = { training: TrainingSettings };

function ConfigSummary({ training }: ConfigSummaryProps) {
  const vf = VOLUME_FRAMEWORKS.find(f => f.id === training.volumeFramework);
  const sm = SCHEDULE_MODES.find(m => m.id === training.scheduleMode);
  const wr = WEEK_RESETS.find(w => w.id === training.weekReset);

  const rows: [string, string][] = [
    ['Volume', vf?.label ?? '—'],
    ['Schedule', sm?.label ?? '—'],
    ['Week Reset', wr?.label ?? '—'],
  ];
  if (training.scheduleMode === 'builder') {
    rows.push(['Mid-week edits', training.allowMidWeekEdits ? 'On' : 'Off']);
  }
  if (training.scheduleMode === 'tmlsn') {
    rows.push(['Notifications', training.scheduleNotifications ? 'On' : 'Off']);
    rows.push(['Morning reminder', training.scheduleReminderEnabled ? '05:30' : 'Off']);
  }

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryHeader}>CURRENT CONFIG</Text>
      {rows.map(([key, val], i) => (
        <View key={key} style={[styles.summaryRow, i < rows.length - 1 && styles.summaryRowBorder]}>
          <Text style={styles.summaryKey}>{key}</Text>
          <Text style={styles.summaryVal}>{val}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TrainingSystemSettings() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [training, setTraining] = useState<TrainingSettings>(DEFAULT_TRAINING_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    const s = await getUserSettings();
    setSettings(s);
    setTraining(s.training ?? DEFAULT_TRAINING_SETTINGS);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const handleSave = async () => {
    if (!settings || saving) return;
    setSaving(true);
    try {
      const next: UserSettings = { ...settings, training };
      await saveUserSettings(next);
      setSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const setVolumeFramework = (id: VolumeFramework) =>
    setTraining(prev => ({ ...prev, volumeFramework: id }));

  const setScheduleMode = (id: ScheduleMode) =>
    setTraining(prev => ({ ...prev, scheduleMode: id }));

  const setWeekReset = (id: WeekReset) =>
    setTraining(prev => ({ ...prev, weekReset: id }));

  const toggleOption = (key: 'allowMidWeekEdits' | 'scheduleNotifications' | 'scheduleReminderEnabled') =>
    setTraining(prev => ({ ...prev, [key]: !prev[key] }));

  const handleRPChange = (muscle: string, key: keyof RpMuscleTarget, val: number) =>
    setTraining(prev => ({
      ...prev,
      rpMuscleTargets: {
        ...prev.rpMuscleTargets,
        [muscle]: { ...(prev.rpMuscleTargets[muscle] ?? DEFAULT_TRAINING_SETTINGS.rpMuscleTargets[muscle]), [key]: val },
      },
    }));

  const handleRangeChange = (muscle: string, key: keyof RangeMuscleTarget, val: number) =>
    setTraining(prev => ({
      ...prev,
      rangeMuscleTargets: {
        ...prev.rangeMuscleTargets,
        [muscle]: { ...(prev.rangeMuscleTargets[muscle] ?? DEFAULT_TRAINING_SETTINGS.rangeMuscleTargets[muscle]), [key]: val },
      },
    }));

  if (!settings) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Volume Framework ── */}
        <SectionLabel>VOLUME FRAMEWORK</SectionLabel>
        <View style={styles.cardGroup}>
          {VOLUME_FRAMEWORKS.map(fw => (
            <SelectionCard
              key={fw.id}
              icon={fw.icon}
              label={fw.label}
              tag={fw.tag}
              description={fw.description}
              detail={fw.detail}
              selected={training.volumeFramework === fw.id}
              onSelect={() => setVolumeFramework(fw.id)}
            >
              {training.volumeFramework === fw.id && fw.id === 'rp' && (
                <RPEditor
                  targets={training.rpMuscleTargets}
                  onChange={handleRPChange}
                />
              )}
              {training.volumeFramework === fw.id && fw.id === 'range' && (
                <RangeEditor
                  targets={training.rangeMuscleTargets}
                  onChange={handleRangeChange}
                />
              )}
              {training.volumeFramework === fw.id && fw.id === 'custom' && (
                <View style={styles.customHint}>
                  <Text style={styles.customHintText}>
                    → Custom muscle target editor available in Volume Settings
                  </Text>
                </View>
              )}
            </SelectionCard>
          ))}
        </View>

        <View style={styles.divider} />

        {/* ── Schedule Mode ── */}
        <SectionLabel>SCHEDULE MODE</SectionLabel>
        <View style={styles.cardGroup}>
          {SCHEDULE_MODES.map(mode => (
            <SelectionCard
              key={mode.id}
              icon={mode.icon}
              label={mode.label}
              tag={mode.tag}
              description={mode.description}
              detail={mode.detail}
              selected={training.scheduleMode === mode.id}
              onSelect={() => setScheduleMode(mode.id)}
            >
              {training.scheduleMode === mode.id && mode.options.length > 0 && (
                <View style={styles.toggleGroup}>
                  {mode.options.map(opt => (
                    <ToggleRow
                      key={opt.id}
                      label={opt.label}
                      enabled={training[opt.id]}
                      onToggle={() => toggleOption(opt.id)}
                    />
                  ))}
                </View>
              )}
            </SelectionCard>
          ))}
        </View>

        <View style={styles.divider} />

        {/* ── Week Reset ── */}
        <SectionLabel>WEEK RESET</SectionLabel>
        <View style={[styles.card, styles.resetCard]}>
          {WEEK_RESETS.map((opt, i) => (
            <WeekResetRow
              key={opt.id}
              label={opt.label}
              description={opt.description}
              selected={training.weekReset === opt.id}
              onSelect={() => setWeekReset(opt.id)}
              last={i === WEEK_RESETS.length - 1}
            />
          ))}
        </View>

        <View style={styles.divider} />

        {/* ── Config Summary ── */}
        <ConfigSummary training={training} />

        {/* ── Save Button ── */}
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            saved && styles.saveButtonSaved,
            pressed && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#1a1a1a" size="small" />
          ) : (
            <Text style={[styles.saveButtonText, saved && styles.saveButtonTextSaved]}>
              {saved ? 'Saved ✓' : 'Save Training Settings'}
            </Text>
          )}
        </Pressable>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2F3031',
  },
  loading: {
    flex: 1,
    backgroundColor: '#2F3031',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },

  // Section label
  sectionLabel: {
    fontFamily: Font.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: TEXT_MUTED,
    marginBottom: 12,
    marginTop: 4,
    paddingHorizontal: 2,
  },

  // Card group
  cardGroup: {
    gap: 8,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },

  // Selection card
  selCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  selCardActive: {
    backgroundColor: GOLD_BG,
    borderColor: GOLD_BORDER,
  },
  selCardAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  selCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  selCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selCardIcon: {
    marginRight: 9,
  },
  selCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: -0.2,
  },
  selCardLabelActive: {
    color: TEXT_PRIMARY,
  },
  selCardDesc: {
    fontSize: 12.5,
    color: TEXT_MUTED,
    lineHeight: 18,
    marginBottom: 5,
    marginLeft: 26,
  },
  selCardDescActive: {
    color: TEXT_SECONDARY,
  },
  selCardDetail: {
    fontFamily: Font.mono,
    fontSize: 10.5,
    color: TEXT_MUTED,
    letterSpacing: 0.2,
    marginLeft: 26,
  },

  // Tag chip
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  tagActive: {
    backgroundColor: 'rgba(212,184,150,0.14)',
    borderColor: 'rgba(212,184,150,0.32)',
  },
  tagText: {
    fontFamily: Font.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: TEXT_MUTED,
  },
  tagTextActive: {
    color: GOLD,
  },

  // Toggle
  toggleGroup: {
    marginTop: 10,
    marginLeft: 26,
    gap: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleLabel: {
    fontSize: 12.5,
    color: TEXT_MUTED,
    flex: 1,
    marginRight: 8,
  },
  toggleLabelActive: {
    color: TEXT_SECONDARY,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginVertical: Spacing.lg,
  },

  // Week Reset card
  resetCard: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  resetRowActive: {
    backgroundColor: GOLD_BG,
  },
  resetRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: DIVIDER,
  },
  resetRowAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  resetRowText: {
    flex: 1,
    paddingLeft: 6,
  },
  resetRowLabel: {
    fontSize: 13.5,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 2,
  },
  resetRowLabelActive: {
    color: TEXT_PRIMARY,
  },
  resetRowDesc: {
    fontFamily: Font.mono,
    fontSize: 10.5,
    color: TEXT_MUTED,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: GOLD,
    backgroundColor: GOLD,
  },
  radioInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1a1a1a',
  },

  // RP / Range Editor
  editorWrap: {
    marginTop: 14,
    marginLeft: 0,
    borderTopWidth: 0.5,
    borderTopColor: DIVIDER,
    paddingTop: 10,
  },
  editorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  editorColHeader: {
    fontFamily: Font.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    color: TEXT_MUTED,
    textAlign: 'center',
  },
  editorColHeaderGold: {
    color: GOLD,
  },
  editorNumCol: {
    width: 52,
  },
  editorNumColWide: {
    width: 64,
  },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: DIVIDER,
    gap: 6,
  },
  editorMuscle: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  editorInput: {
    width: 52,
    height: 30,
    backgroundColor: SURFACE2,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: Font.mono,
    color: TEXT_PRIMARY,
  },
  editorInputWide: {
    width: 64,
  },

  // Custom hint
  customHint: {
    marginTop: 10,
    marginLeft: 26,
    padding: 12,
    backgroundColor: SURFACE2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DIVIDER,
    borderStyle: 'dashed',
  },
  customHintText: {
    fontFamily: Font.mono,
    fontSize: 11.5,
    color: TEXT_MUTED,
  },

  // Config summary
  summaryCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 16,
    marginBottom: Spacing.lg,
  },
  summaryHeader: {
    fontFamily: Font.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: TEXT_MUTED,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: DIVIDER,
  },
  summaryKey: {
    fontFamily: Font.mono,
    fontSize: 12,
    color: TEXT_MUTED,
  },
  summaryVal: {
    fontFamily: Font.mono,
    fontSize: 12,
    color: GOLD,
  },

  // Save button
  saveButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: GOLD,
    marginBottom: Spacing.md,
  },
  saveButtonSaved: {
    backgroundColor: 'rgba(212,184,150,0.18)',
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  saveButtonTextSaved: {
    color: GOLD,
  },
});
