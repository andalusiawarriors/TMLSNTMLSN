// ============================================================
// TMLSN — CreateExerciseAISheet
// AI-assisted custom exercise creation via natural language.
// User types e.g. "create single arm cable lateral raise";
// AI extracts structured fields → confirmation card → save.
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CaretRight, CaretDown } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TmlsnText } from './ui/TmlsnText';
import * as Theme from '../constants/theme';
import { Colors } from '../constants/theme';
import type {
  CreateExerciseInput,
  ExerciseCategory,
  EquipmentType,
  Laterality,
  LoadEntryMode,
} from '../utils/exerciseDb/types';
import { extractExerciseFromNaturalLanguage } from '../lib/extractExerciseFromNaturalLanguage';
import { CreateExerciseSheet } from './CreateExerciseSheet';

const { Spacing } = Theme;
const R = 16;

const CATEGORIES: ExerciseCategory[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'full_body', 'olympic',
];

const CATEGORY_LABELS: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', abs: 'Abs', full_body: 'Full Body', olympic: 'Olympic',
};

const EQUIPMENT_OPTIONS: EquipmentType[] = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight',
  'kettlebell', 'ez_bar', 'smith_machine', 'resistance_band', 'trx', 'plate', 'trap_bar',
];

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine',
  bodyweight: 'Bodyweight', kettlebell: 'Kettlebell', ez_bar: 'EZ Bar',
  smith_machine: 'Smith', resistance_band: 'Band', trx: 'TRX', plate: 'Plate', trap_bar: 'Trap Bar',
};

type EditDropdownField = 'category' | 'equipment' | 'laterality' | 'loadEntryMode' | null;

interface CreateExerciseAISheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: CreateExerciseInput) => Promise<unknown>;
}

type Step = 'input' | 'confirm' | 'manual';

export function CreateExerciseAISheet({
  visible,
  onClose,
  onSave,
}: CreateExerciseAISheetProps) {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [draft, setDraft] = useState<CreateExerciseInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [showManualSheet, setShowManualSheet] = useState(false);
  const [manualInitialData, setManualInitialData] = useState<CreateExerciseInput | null>(null);
  const [editDropdownOpen, setEditDropdownOpen] = useState<EditDropdownField>(null);

  const reset = useCallback(() => {
    setInputText('');
    setStep('input');
    setDraft(null);
    setError(null);
    setFollowUp(null);
    setEditDropdownOpen(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleExtract = useCallback(async () => {
    const t = inputText.trim();
    if (!t || loading) return;

    setLoading(true);
    setError(null);
    setFollowUp(null);

    const result = await extractExerciseFromNaturalLanguage(t);

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDraft(result.draft);
    setStep('confirm');
    if (result.confidence === 'low' && result.followUp) {
      setFollowUp(result.followUp);
    } else {
      setFollowUp(null);
    }
  }, [inputText, loading]);

  const handleConfirm = useCallback(async () => {
    if (!draft) return;
    setLoading(true);
    try {
      const result = await onSave(draft);
      if (result != null) {
        handleClose();
      }
    } finally {
      setLoading(false);
    }
  }, [draft, onSave, handleClose]);

  const handleEditInFullForm = useCallback(() => {
    setEditDropdownOpen(null);
    if (draft) {
      setManualInitialData(draft);
      setShowManualSheet(true);
    }
  }, [draft]);

  const updateDraft = useCallback((updates: Partial<CreateExerciseInput>) => {
    setDraft((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const closeEditDropdown = useCallback(() => setEditDropdownOpen(null), []);

  const handleManualSave = useCallback(
    async (data: CreateExerciseInput) => {
      const result = await onSave(data);
      if (result != null) {
        setShowManualSheet(false);
        setManualInitialData(null);
        handleClose();
      }
      return result;
    },
    [onSave, handleClose]
  );

  const handleCreateManually = useCallback(() => {
    setManualInitialData(null);
    setShowManualSheet(true);
  }, []);

  if (!visible) return null;

  return (
    <>
      <Modal visible={visible && !showManualSheet} transparent animationType="slide" onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardWrap}
          >
            <Pressable
              style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.grabber} />
              <View style={styles.header}>
                <TmlsnText variant="h2" style={styles.title}>Create exercise</TmlsnText>
                <Pressable
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                  onPress={handleClose}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={18} color={Colors.primaryLight} />
                </Pressable>
              </View>

              {step === 'input' && (
                <View style={styles.inputSection}>
                  <TmlsnText variant="body" style={styles.hint}>
                    Describe the exercise naturally. For example:
                  </TmlsnText>
                  <View style={styles.examples}>
                    <Text style={styles.example}>• "single arm cable lateral raise"</Text>
                    <Text style={styles.example}>• "smith incline press"</Text>
                    <Text style={styles.example}>• "seated one arm dumbbell curl"</Text>
                  </View>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. create cable lateral raise"
                      placeholderTextColor={Colors.primaryLight + '40'}
                      value={inputText}
                      onChangeText={setInputText}
                      editable={!loading}
                      returnKeyType="send"
                      onSubmitEditing={handleExtract}
                      {...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {})}
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.sendBtn,
                        (!inputText.trim() || loading) && styles.sendBtnDisabled,
                        pressed && !loading && styles.sendBtnPressed,
                      ]}
                      onPress={handleExtract}
                      disabled={!inputText.trim() || loading}
                    >
                      <CaretRight size={20} weight="bold" color={Colors.primaryLight} />
                    </Pressable>
                  </View>
                  {error && (
                    <View style={styles.errorRow}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.createManuallyBtn, pressed && styles.createManuallyBtnPressed]}
                    onPress={handleCreateManually}
                  >
                    <Text style={styles.createManuallyBtnText}>Create manually</Text>
                  </Pressable>
                </View>
              )}

              {step === 'confirm' && draft && (
                <ScrollView
                  style={styles.confirmScroll}
                  contentContainerStyle={styles.confirmContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {followUp && (
                    <View style={styles.followUpBubble}>
                      <Text style={styles.followUpText}>{followUp}</Text>
                      <Text style={styles.followUpHint}>You can edit below before saving.</Text>
                    </View>
                  )}
                  <View style={styles.confirmCard}>
                    <Text style={styles.confirmName}>{draft.name}</Text>

                    <View style={styles.confirmMeta}>
                      <Pressable
                        style={({ pressed }) => [styles.confirmRow, pressed && styles.confirmRowPressed]}
                        onPress={() => setEditDropdownOpen((v) => (v === 'category' ? null : 'category'))}
                      >
                        <Text style={styles.confirmLabel}>Category</Text>
                        <View style={styles.confirmValueRow}>
                          <Text style={styles.confirmValue}>{CATEGORY_LABELS[draft.category] ?? draft.category}</Text>
                          <CaretDown size={14} weight="bold" color={Colors.primaryLight + '80'} style={{ marginLeft: 4 }} />
                        </View>
                      </Pressable>
                      {editDropdownOpen === 'category' && (
                        <View style={styles.fieldDropdown}>
                          <ScrollView style={styles.fieldDropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                            {CATEGORIES.map((c) => (
                              <Pressable
                                key={c}
                                style={({ pressed }) => [styles.fieldDropdownItem, pressed && styles.fieldDropdownItemPressed]}
                                onPress={() => { updateDraft({ category: c }); closeEditDropdown(); }}
                              >
                                <Text style={[styles.fieldDropdownItemText, draft.category === c && styles.fieldDropdownItemActive]}>
                                  {CATEGORY_LABELS[c] ?? c}
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      <Pressable
                        style={({ pressed }) => [styles.confirmRow, pressed && styles.confirmRowPressed]}
                        onPress={() => setEditDropdownOpen((v) => (v === 'equipment' ? null : 'equipment'))}
                      >
                        <Text style={styles.confirmLabel}>Equipment</Text>
                        <View style={styles.confirmValueRow}>
                          <Text style={styles.confirmValue} numberOfLines={1}>
                            {draft.equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(', ')}
                          </Text>
                          <CaretDown size={14} weight="bold" color={Colors.primaryLight + '80'} style={{ marginLeft: 4 }} />
                        </View>
                      </Pressable>
                      {editDropdownOpen === 'equipment' && (
                        <View style={styles.fieldDropdown}>
                          <ScrollView style={styles.fieldDropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                            {EQUIPMENT_OPTIONS.map((eq) => {
                              const isSelected = draft.equipment.includes(eq);
                              return (
                                <Pressable
                                  key={eq}
                                  style={({ pressed }) => [styles.fieldDropdownItem, pressed && styles.fieldDropdownItemPressed]}
                                  onPress={() => {
                                    const next = isSelected
                                      ? draft.equipment.filter((e) => e !== eq)
                                      : [...draft.equipment, eq];
                                    if (next.length > 0) updateDraft({ equipment: next });
                                  }}
                                >
                                  <Text style={[styles.fieldDropdownItemText, isSelected && styles.fieldDropdownItemActive]}>
                                    {isSelected ? '✓ ' : ''}{EQUIPMENT_LABELS[eq] ?? eq}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}

                      <Pressable
                        style={({ pressed }) => [styles.confirmRow, pressed && styles.confirmRowPressed]}
                        onPress={() => setEditDropdownOpen((v) => (v === 'laterality' ? null : 'laterality'))}
                      >
                        <Text style={styles.confirmLabel}>Laterality</Text>
                        <View style={styles.confirmValueRow}>
                          <Text style={styles.confirmValue}>
                            {draft.laterality === 'unilateral' ? 'Unilateral' : 'Bilateral'}
                          </Text>
                          <CaretDown size={14} weight="bold" color={Colors.primaryLight + '80'} style={{ marginLeft: 4 }} />
                        </View>
                      </Pressable>
                      {editDropdownOpen === 'laterality' && (
                        <View style={styles.fieldDropdown}>
                          <Pressable
                            style={({ pressed }) => [styles.fieldDropdownItem, pressed && styles.fieldDropdownItemPressed]}
                            onPress={() => { updateDraft({ laterality: 'bilateral' }); closeEditDropdown(); }}
                          >
                            <Text style={[styles.fieldDropdownItemText, draft.laterality === 'bilateral' && styles.fieldDropdownItemActive]}>
                              Bilateral
                            </Text>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [styles.fieldDropdownItem, pressed && styles.fieldDropdownItemPressed]}
                            onPress={() => { updateDraft({ laterality: 'unilateral' }); closeEditDropdown(); }}
                          >
                            <Text style={[styles.fieldDropdownItemText, draft.laterality === 'unilateral' && styles.fieldDropdownItemActive]}>
                              Unilateral
                            </Text>
                          </Pressable>
                        </View>
                      )}

                      <Pressable
                        style={({ pressed }) => [styles.confirmRow, pressed && styles.confirmRowPressed]}
                        onPress={() => setEditDropdownOpen((v) => (v === 'loadEntryMode' ? null : 'loadEntryMode'))}
                      >
                        <Text style={styles.confirmLabel}>Weight entry</Text>
                        <View style={styles.confirmValueRow}>
                          <Text style={styles.confirmValue}>
                            {draft.loadEntryMode === 'per_hand' ? 'Per hand' : draft.loadEntryMode === 'per_side' ? 'Per side' : 'Total'}
                          </Text>
                          <CaretDown size={14} weight="bold" color={Colors.primaryLight + '80'} style={{ marginLeft: 4 }} />
                        </View>
                      </Pressable>
                      {editDropdownOpen === 'loadEntryMode' && (
                        <View style={styles.fieldDropdown}>
                          <Pressable
                            style={({ pressed }) => [styles.fieldDropdownItem, pressed && styles.fieldDropdownItemPressed]}
                            onPress={() => { updateDraft({ loadEntryMode: 'total' }); closeEditDropdown(); }}
                          >
                            <Text style={[styles.fieldDropdownItemText, draft.loadEntryMode === 'total' && styles.fieldDropdownItemActive]}>Total</Text>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [styles.fieldDropdownItem, pressed && styles.fieldDropdownItemPressed]}
                            onPress={() => { updateDraft({ loadEntryMode: 'per_hand' }); closeEditDropdown(); }}
                          >
                            <Text style={[styles.fieldDropdownItemText, draft.loadEntryMode === 'per_hand' && styles.fieldDropdownItemActive]}>Per hand</Text>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [styles.fieldDropdownItem, pressed && styles.fieldDropdownItemPressed]}
                            onPress={() => { updateDraft({ loadEntryMode: 'per_side' }); closeEditDropdown(); }}
                          >
                            <Text style={[styles.fieldDropdownItemText, draft.loadEntryMode === 'per_side' && styles.fieldDropdownItemActive]}>Per side</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>

                    <Pressable
                      style={({ pressed }) => [styles.createManuallyBtn, pressed && styles.createManuallyBtnPressed]}
                      onPress={handleCreateManually}
                    >
                      <Text style={styles.createManuallyBtnText}>Create manually</Text>
                    </Pressable>
                    <View style={styles.confirmActions}>
                      <Pressable
                        style={({ pressed }) => [styles.editFullFormLink, pressed && { opacity: 0.7 }]}
                        onPress={handleEditInFullForm}
                      >
                        <Text style={styles.editFullFormLinkText}>Edit in full form</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.confirmBtn,
                          loading && styles.confirmBtnDisabled,
                          pressed && !loading && styles.confirmBtnPressed,
                        ]}
                        onPress={handleConfirm}
                        disabled={loading}
                      >
                        <Text style={styles.confirmBtnText}>
                          {loading ? 'Saving...' : 'Save exercise'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </ScrollView>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <CreateExerciseSheet
        visible={showManualSheet}
        onClose={() => {
          setShowManualSheet(false);
          setManualInitialData(null);
        }}
        onSave={handleManualSave}
        initialData={manualInitialData}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.primaryDarkLighter,
    borderTopLeftRadius: R * 2,
    borderTopRightRadius: R * 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: Dimensions.get('window').height * 0.85,
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
  inputSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  hint: {
    color: Colors.primaryLight + '80',
    fontSize: 14,
    marginBottom: 8,
  },
  examples: {
    marginBottom: 16,
    gap: 4,
  },
  example: {
    color: Colors.primaryLight + '60',
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: R,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.primaryLight,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: R,
    backgroundColor: Colors.primaryLight + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnPressed: {
    opacity: 0.85,
  },
  errorRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  errorText: {
    color: Colors.primaryLight + '90',
    fontSize: 13,
  },
  createManuallyBtn: {
    height: 48,
    borderRadius: R,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  createManuallyBtnPressed: {
    opacity: 0.85,
  },
  createManuallyBtnText: {
    color: Colors.primaryLight,
    fontSize: 15,
    fontWeight: '600',
  },
  followUpBubble: {
    backgroundColor: 'rgba(212,184,150,0.12)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,184,150,0.2)',
  },
  followUpText: {
    color: Colors.primaryLight,
    fontSize: 14,
    fontWeight: '500',
  },
  followUpHint: {
    color: Colors.primaryLight + '70',
    fontSize: 12,
    marginTop: 4,
  },
  confirmScroll: {
    maxHeight: 360,
  },
  confirmContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  confirmCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: R,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: Spacing.lg,
  },
  confirmName: {
    color: Colors.primaryLight,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  confirmMeta: {
    gap: 0,
    marginBottom: 12,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  confirmRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  confirmValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  fieldDropdown: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    marginBottom: 4,
    marginLeft: 0,
    marginRight: 0,
    maxHeight: 160,
    overflow: 'hidden',
  },
  fieldDropdownScroll: {
    maxHeight: 156,
    paddingVertical: 4,
  },
  fieldDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  fieldDropdownItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  fieldDropdownItemText: {
    color: Colors.primaryLight,
    fontSize: 14,
    fontWeight: '500',
  },
  fieldDropdownItemActive: {
    fontWeight: '600',
  },
  editFullFormLink: {
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  editFullFormLinkText: {
    color: Colors.primaryLight + '80',
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  confirmLabel: {
    color: Colors.primaryLight + '70',
    fontSize: 13,
  },
  confirmValue: {
    color: Colors.primaryLight,
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 0,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  confirmBtn: {
    flex: 1,
    minHeight: 48,
    height: 48,
    borderRadius: R,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnPressed: {
    opacity: 0.85,
  },
  confirmBtnText: {
    color: Colors.primaryDark,
    fontSize: 15,
    fontWeight: '700',
  },
});
