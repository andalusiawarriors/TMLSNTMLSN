// ============================================================
// TMLSN — CreateExerciseSheet
// Minimal create custom exercise form (Fitness Hub style)
// ============================================================

import React, { useState, useEffect } from 'react';
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
import { CaretDown } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TmlsnText } from './ui/TmlsnText';
import * as Theme from '../constants/theme';
import type { ExerciseCategory, EquipmentType, Laterality, LoadEntryMode, CreateExerciseInput } from '../utils/exerciseDb/types';

const { Colors, Spacing } = Theme;

export type { CreateExerciseInput };
const R = 16;

type DropdownField = 'category' | 'equipment' | 'laterality' | 'loadEntryMode' | null;

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
  smith_machine: 'Smith', resistance_band: 'Band', trx: 'TRX', plate: 'Plate', trap_bar: 'Trap Bar',
};

interface CreateExerciseSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Persist and return created exercise. Caller handles add-to-list and select. */
  onSave: (data: CreateExerciseInput) => Promise<unknown>;
  /** Pre-fill form (e.g. from AI confirmation edit). */
  initialData?: CreateExerciseInput | null;
}

export function CreateExerciseSheet({
  visible,
  onClose,
  onSave,
  initialData,
}: CreateExerciseSheetProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialData?.name ?? '');
  const [category, setCategory] = useState<ExerciseCategory>(initialData?.category ?? 'chest');
  const [equipment, setEquipment] = useState<EquipmentType[]>(
    initialData?.equipment?.length ? initialData.equipment : ['dumbbell']
  );
  const [laterality, setLaterality] = useState<Laterality>(initialData?.laterality ?? 'bilateral');
  const [loadEntryMode, setLoadEntryMode] = useState<LoadEntryMode>(initialData?.loadEntryMode ?? 'per_hand');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<DropdownField>(null);

  // Sync when initialData changes (e.g. opened from AI edit)
  useEffect(() => {
    if (visible && initialData) {
      setName(initialData.name);
      setCategory(initialData.category);
      setEquipment(initialData.equipment?.length ? initialData.equipment : ['dumbbell']);
      setLaterality(initialData.laterality ?? 'bilateral');
      setLoadEntryMode(initialData.loadEntryMode ?? 'per_hand');
      setDescription(initialData.description ?? '');
    }
  }, [visible, initialData]);

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
              <Text style={styles.label}>Name</Text>
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

            <View style={styles.fieldBlock}>
              <Pressable
                style={({ pressed }) => [styles.fieldRow, pressed && styles.fieldRowPressed]}
                onPress={() => setDropdownOpen((v) => (v === 'category' ? null : 'category'))}
              >
                <Text style={styles.label}>Category</Text>
                <View style={styles.fieldValueRow}>
                  <Text style={styles.fieldValue}>{CATEGORY_LABELS[category] ?? category}</Text>
                  <CaretDown size={14} weight="bold" color={Colors.primaryLight + '80'} style={{ marginLeft: 6 }} />
                </View>
              </Pressable>
              {dropdownOpen === 'category' && (
                <View style={styles.dropdown}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {CATEGORY_OPTIONS.map((c) => (
                      <Pressable
                        key={c}
                        style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
                        onPress={() => { setCategory(c); setDropdownOpen(null); }}
                      >
                        <Text style={[styles.dropdownItemText, category === c && styles.dropdownItemActive]}>
                          {CATEGORY_LABELS[c] ?? c}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.fieldBlock}>
              <Pressable
                style={({ pressed }) => [styles.fieldRow, pressed && styles.fieldRowPressed]}
                onPress={() => setDropdownOpen((v) => (v === 'equipment' ? null : 'equipment'))}
              >
                <Text style={styles.label}>Equipment</Text>
                <View style={styles.fieldValueRow}>
                  <Text style={styles.fieldValue} numberOfLines={1}>
                    {equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(', ')}
                  </Text>
                  <CaretDown size={14} weight="bold" color={Colors.primaryLight + '80'} style={{ marginLeft: 6 }} />
                </View>
              </Pressable>
              {dropdownOpen === 'equipment' && (
                <View style={styles.dropdown}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {EQUIPMENT_OPTIONS.map((eq) => {
                      const sel = equipment.includes(eq);
                      return (
                        <Pressable
                          key={eq}
                          style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
                          onPress={() => {
                            toggleEquipment(eq);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, sel && styles.dropdownItemActive]}>
                            {sel ? '✓ ' : ''}{EQUIPMENT_LABELS[eq] ?? eq}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.fieldBlock}>
              <Pressable
                style={({ pressed }) => [styles.fieldRow, pressed && styles.fieldRowPressed]}
                onPress={() => setDropdownOpen((v) => (v === 'laterality' ? null : 'laterality'))}
              >
                <Text style={styles.label}>Laterality</Text>
                <View style={styles.fieldValueRow}>
                  <Text style={styles.fieldValue}>{laterality === 'unilateral' ? 'Unilateral' : 'Bilateral'}</Text>
                  <CaretDown size={14} weight="bold" color={Colors.primaryLight + '80'} style={{ marginLeft: 6 }} />
                </View>
              </Pressable>
              {dropdownOpen === 'laterality' && (
                <View style={styles.dropdown}>
                  <Pressable
                    style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
                    onPress={() => { setLaterality('bilateral'); setDropdownOpen(null); }}
                  >
                    <Text style={[styles.dropdownItemText, laterality === 'bilateral' && styles.dropdownItemActive]}>Bilateral</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
                    onPress={() => { setLaterality('unilateral'); setDropdownOpen(null); }}
                  >
                    <Text style={[styles.dropdownItemText, laterality === 'unilateral' && styles.dropdownItemActive]}>Unilateral</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.fieldBlock}>
              <Pressable
                style={({ pressed }) => [styles.fieldRow, pressed && styles.fieldRowPressed]}
                onPress={() => setDropdownOpen((v) => (v === 'loadEntryMode' ? null : 'loadEntryMode'))}
              >
                <Text style={styles.label}>Weight entry</Text>
                <View style={styles.fieldValueRow}>
                  <Text style={styles.fieldValue}>
                    {loadEntryMode === 'per_hand' ? 'Per hand' : loadEntryMode === 'per_side' ? 'Per side' : 'Total'}
                  </Text>
                  <CaretDown size={14} weight="bold" color={Colors.primaryLight + '80'} style={{ marginLeft: 6 }} />
                </View>
              </Pressable>
              {dropdownOpen === 'loadEntryMode' && (
                <View style={styles.dropdown}>
                  <Pressable
                    style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
                    onPress={() => { setLoadEntryMode('total'); setDropdownOpen(null); }}
                  >
                    <Text style={[styles.dropdownItemText, loadEntryMode === 'total' && styles.dropdownItemActive]}>Total</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
                    onPress={() => { setLoadEntryMode('per_hand'); setDropdownOpen(null); }}
                  >
                    <Text style={[styles.dropdownItemText, loadEntryMode === 'per_hand' && styles.dropdownItemActive]}>Per hand</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
                    onPress={() => { setLoadEntryMode('per_side'); setDropdownOpen(null); }}
                  >
                    <Text style={[styles.dropdownItemText, loadEntryMode === 'per_side' && styles.dropdownItemActive]}>Per side</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description (optional)</Text>
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
              <Text style={styles.saveBtnText}>
                {saving ? 'Saving...' : 'Create exercise'}
              </Text>
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
    maxHeight: 500,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  field: {
    gap: 8,
  },
  fieldBlock: {
    gap: 0,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fieldRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  fieldValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  fieldValue: {
    color: Colors.primaryLight,
    fontSize: 15,
    fontWeight: '500',
    maxWidth: '70%',
  },
  label: {
    color: Colors.primaryLight + '80',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 0,
  },
  dropdown: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 4,
    maxHeight: 180,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 176,
    paddingVertical: 4,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dropdownItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dropdownItemText: {
    color: Colors.primaryLight,
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownItemActive: {
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: 12,
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
