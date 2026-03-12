// ============================================================
// TMLSN — CreateExerciseSheet
// Minimal create custom exercise form (Fitness Hub style)
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TmlsnText } from './ui/TmlsnText';
import * as Theme from '../constants/theme';
import type { ExerciseCategory, EquipmentType, Laterality, LoadEntryMode, CreateExerciseInput } from '../utils/exerciseDb/types';

const { Colors, Typography, Spacing } = Theme;

export type { CreateExerciseInput };
const R = 16;

const CATEGORY_OPTIONS: ExerciseCategory[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'full_body', 'olympic',
];

const EQUIPMENT_OPTIONS: EquipmentType[] = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight',
  'kettlebell', 'ez_bar', 'smith_machine', 'resistance_band', 'trx', 'plate', 'trap_bar',
];

const CATEGORY_LABELS: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', abs: 'Abs', full_body: 'Full Body', olympic: 'Olympic',
};

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine',
  bodyweight: 'Bodyweight', kettlebell: 'Kettlebell', ez_bar: 'EZ Bar',
  smith_machine: 'Smith', resistance_band: 'Band', trx: 'TRX', plate: 'Plate',   trap_bar: 'Trap Bar',
};

interface CreateExerciseSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Persist and return created exercise. Caller handles add-to-list and select. */
  onSave: (data: CreateExerciseInput) => Promise<unknown>;
}

export function CreateExerciseSheet({
  visible,
  onClose,
  onSave,
}: CreateExerciseSheetProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('chest');
  const [equipment, setEquipment] = useState<EquipmentType[]>(['dumbbell']);
  const [laterality, setLaterality] = useState<Laterality>('bilateral');
  const [loadEntryMode, setLoadEntryMode] = useState<LoadEntryMode>('per_hand');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleEquipment = (eq: EquipmentType) => {
    setEquipment((prev) =>
      prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
    );
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (equipment.length === 0) return;

    setSaving(true);
    try {
      const result = await onSave({
        name: trimmed,
        category,
        equipment,
        laterality,
        loadEntryMode,
        description: description.trim() || undefined,
      });
      if (result != null) {
        onClose();
        setName('');
        setCategory('chest');
        setEquipment(['dumbbell']);
        setLaterality('bilateral');
        setLoadEntryMode('per_hand');
        setDescription('');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <TmlsnText variant="h2" style={styles.title}>Create exercise</TmlsnText>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              onPress={onClose}
              hitSlop={10}
            >
              <Ionicons name="close" size={18} color={Colors.primaryLight} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.field}>
              <TmlsnText variant="label" style={styles.label}>Name</TmlsnText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Single-Arm Cable Row"
                placeholderTextColor={Colors.primaryLight + '40'}
                style={styles.input}
                autoCorrect={false}
                {...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {})}
              />
            </View>

            <View style={styles.field}>
              <TmlsnText variant="label" style={styles.label}>Category</TmlsnText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {CATEGORY_OPTIONS.map((c) => (
                  <Pressable
                    key={c}
                    style={({ pressed }) => [
                      styles.chip,
                      category === c && styles.chipActive,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() => setCategory(c)}
                  >
                    <TmlsnText variant="body" style={[styles.chipText, category === c && styles.chipTextActive]}>
                      {CATEGORY_LABELS[c] ?? c}
                    </TmlsnText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.field}>
              <TmlsnText variant="label" style={styles.label}>Equipment</TmlsnText>
              <View style={styles.chipWrap}>
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <Pressable
                    key={eq}
                    style={({ pressed }) => [
                      styles.chip,
                      equipment.includes(eq) && styles.chipActive,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() => toggleEquipment(eq)}
                  >
                    <TmlsnText variant="body" style={[styles.chipText, equipment.includes(eq) && styles.chipTextActive]}>
                      {EQUIPMENT_LABELS[eq] ?? eq}
                    </TmlsnText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <TmlsnText variant="label" style={styles.label}>Laterality</TmlsnText>
              <View style={styles.pillRow}>
                <Pressable
                  style={({ pressed }) => [styles.pill, laterality === 'bilateral' && styles.pillActive, pressed && styles.pillPressed]}
                  onPress={() => setLaterality('bilateral')}
                >
                  <TmlsnText variant="body" style={[styles.pillText, laterality === 'bilateral' && styles.pillTextActive]}>Bilateral</TmlsnText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.pill, laterality === 'unilateral' && styles.pillActive, pressed && styles.pillPressed]}
                  onPress={() => setLaterality('unilateral')}
                >
                  <TmlsnText variant="body" style={[styles.pillText, laterality === 'unilateral' && styles.pillTextActive]}>Unilateral</TmlsnText>
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <TmlsnText variant="label" style={styles.label}>Weight entry</TmlsnText>
              <View style={styles.pillRow}>
                <Pressable
                  style={({ pressed }) => [styles.pill, loadEntryMode === 'total' && styles.pillActive, pressed && styles.pillPressed]}
                  onPress={() => setLoadEntryMode('total')}
                >
                  <TmlsnText variant="body" style={[styles.pillText, loadEntryMode === 'total' && styles.pillTextActive]}>Total</TmlsnText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.pill, loadEntryMode === 'per_hand' && styles.pillActive, pressed && styles.pillPressed]}
                  onPress={() => setLoadEntryMode('per_hand')}
                >
                  <TmlsnText variant="body" style={[styles.pillText, loadEntryMode === 'per_hand' && styles.pillTextActive]}>Per hand</TmlsnText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.pill, loadEntryMode === 'per_side' && styles.pillActive, pressed && styles.pillPressed]}
                  onPress={() => setLoadEntryMode('per_side')}
                >
                  <TmlsnText variant="body" style={[styles.pillText, loadEntryMode === 'per_side' && styles.pillTextActive]}>Per side</TmlsnText>
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <TmlsnText variant="label" style={styles.label}>Description (optional)</TmlsnText>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Row cable to hip, squeeze shoulder blade"
                placeholderTextColor={Colors.primaryLight + '40'}
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                {...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {})}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                (!name.trim() || equipment.length === 0 || saving) && styles.saveBtnDisabled,
                pressed && !saving && styles.saveBtnPressed,
              ]}
              onPress={handleSave}
              disabled={!name.trim() || equipment.length === 0 || saving}
            >
              <TmlsnText variant="body" style={styles.saveBtnText}>
                {saving ? 'Saving...' : 'Create exercise'}
              </TmlsnText>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.primaryDarkLighter,
    borderTopLeftRadius: R * 2,
    borderTopRightRadius: R * 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: Dimensions.get('window').height * 0.9,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primaryLight + '40',
    marginTop: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontWeight: '600',
    color: Colors.primaryLight,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight + '0E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    backgroundColor: Colors.primaryLight + '1C',
    opacity: 0.85,
  },
  scroll: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  field: {
    gap: Spacing.sm,
  },
  label: {
    color: Colors.primaryLight + '80',
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: R,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.primaryLight,
  },
  textArea: {
    minHeight: 72,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight + '0C',
  },
  chipActive: {
    backgroundColor: Colors.primaryLight + '18',
  },
  chipPressed: {
    opacity: 0.72,
  },
  chipText: {
    color: Colors.primaryLight + 'A0',
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.primaryLight,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight + '0C',
  },
  pillActive: {
    backgroundColor: Colors.primaryLight + '18',
  },
  pillPressed: {
    opacity: 0.72,
  },
  pillText: {
    color: Colors.primaryLight + 'A0',
    fontWeight: '600',
  },
  pillTextActive: {
    color: Colors.primaryLight,
  },
  saveBtn: {
    height: 52,
    borderRadius: R,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnPressed: {
    opacity: 0.85,
  },
  saveBtnText: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
});
