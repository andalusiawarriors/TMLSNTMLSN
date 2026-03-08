/**
 * Shared set table for active workout and edit past workout.
 * Single source of truth: SET | PREVIOUS | KG/LB | REPS | RPE | ✓, editing, RPE popup, ghost apply, swipe-to-delete.
 * No navigation dependency. Receives all data/callbacks via props.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Keyboard,
  TouchableOpacity,
  InputAccessoryView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import type { Exercise } from '../types';
import type { PrevSet } from '../utils/workoutSetTable';
import { toDisplayWeight, formatWeightDisplay, parseNumericInput } from '../utils/units';
import { getRpeLabel } from '../utils/rpe';
import { Input } from './Input';
import { Colors, Typography } from '../constants/theme';
import Slider from '@react-native-community/slider';
import { updateToRPEWarning, sendRPENotification } from '../lib/liveActivity';

const SET_TABLE_FLEX = {
  set: 0.85,
  previous: 0.8,
  weight: 0.95,
  reps: 0.95,
  rpe: 0.75,
  check: 0.65,
} as const;
const SET_INPUT_PILL_HEIGHT = 40;
const SET_INPUT_MAX_WIDTH = 68;
const SET_INPUT_MIN_WIDTH = 52;
const SET_INPUT_BORDER_RADIUS = 10;
const SET_INPUT_PADDING_H = 6;
const SET_CHECK_BUTTON_SIZE = 36;

export type WorkoutSetTableProps = {
  exercise: Exercise;
  exerciseIndex: number;
  prevSets: PrevSet[];
  ghostWeight: string | null;
  ghostReps: string | null;
  weightUnit: 'kg' | 'lb';
  colors: {
    primaryLight: string;
    primaryDark: string;
    tabBarBorder?: [string, string] | string;
    tabBarFill?: [string, string] | string;
  };
  updateSet: (
    exerciseIndex: number,
    setIndex: number,
    patch: { weight?: number; reps?: number; completed?: boolean; rpe?: number | null }
  ) => void;
  onRemoveSet: (exerciseIndex: number, setIndex: number) => void;
  onAddSet: (exerciseIndex: number) => void;
  onSetNotesPress?: (exerciseIndex: number, setIndex: number) => void;
  onRestTimerStart?: (exerciseIndex: number, setIndex: number, setId: string, durationSec: number) => void;
  onRestTimerSkip?: (setId: string) => void;
  keyboardHeight?: number;
  /** When parent increments this (e.g. on overlay tap), table commits active field and dismisses. */
  externalCommitTrigger?: number;
  onFocusCell?: (exerciseIndex: number, setIndex: number) => void;
  onSetRowLayout?: (exerciseIndex: number, setIndex: number, y: number) => void;
  playIn: () => void;
  playOut: () => void;
  /** Legacy: prescription from DB. Ghost values (ghostWeight/ghostReps) are canonical; prescription is fallback when no history. */
  prescription?: { nextWeight: number; goal: string } | null;
  /** Human-readable reason for the ghost (e.g. "Add weight", "Build reps", "Deload"). Optional, for future tooltip. */
  ghostReason?: string | null;
};

function AnimatedSetNoteRow({
  notes,
  isExpanded,
  onToggle,
  onEdit,
  colors,
}: {
  notes: string;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  colors: { primaryLight: string };
}) {
  const open = useSharedValue(isExpanded ? 1 : 0);
  useEffect(() => {
    open.value = withTiming(isExpanded ? 1 : 0, { duration: 160, easing: Easing.out(Easing.cubic) });
  }, [isExpanded]);
  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.985 + 0.015 * open.value }],
    opacity: 0.85 + 0.15 * open.value,
  }));
  return (
    <Pressable onPress={onToggle} hitSlop={8}>
      <Animated.View style={[styles.setNoteRowInner, bubbleStyle]}>
        {!isExpanded ? (
          <>
            <Text style={[styles.setNoteText, { color: colors.primaryLight + 'D9' }]} numberOfLines={2} ellipsizeMode="tail">
              {notes}
            </Text>
            <Text style={styles.setNoteFadeHint}>tap to expand</Text>
          </>
        ) : (
          <>
            <Text style={styles.setNoteTextExpanded}>{notes}</Text>
            <Text style={styles.setNoteFadeHint}>tap to collapse</Text>
            <TouchableOpacity onPress={onEdit} style={styles.setNoteEditButton}>
              <Ionicons name="pencil-sharp" size={14} color={colors.primaryLight + '60'} />
              <Text style={styles.setNoteEditButtonText}>Edit Note</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function WorkoutSetTable({
  exercise,
  exerciseIndex,
  prevSets,
  ghostWeight,
  ghostReps,
  weightUnit,
  colors,
  updateSet,
  onRemoveSet,
  onAddSet,
  onSetNotesPress,
  onRestTimerStart,
  onRestTimerSkip,
  keyboardHeight = 0,
  externalCommitTrigger = 0,
  onFocusCell,
  onSetRowLayout,
  playIn,
  playOut,
  prescription = null,
  ghostReason,
}: WorkoutSetTableProps) {
  const [editingCell, setEditingCell] = useState<{
    exerciseIndex: number;
    setIndex: number;
    field: 'weight' | 'reps' | 'rpe';
  } | null>(null);
  const [editingCellValue, setEditingCellValue] = useState('');
  const [rpePopup, setRpePopup] = useState<{ exerciseIndex: number; setIndex: number; value: number } | null>(null);
  const [pressedCheckRowKey, setPressedCheckRowKey] = useState<string | null>(null);
  const [expandedSetNotes, setExpandedSetNotes] = useState<Record<string, boolean>>({});
  const [ghostTooltip, setGhostTooltip] = useState<{ lastText: string; targetText: string } | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitInProgressRef = useRef(false);
  const accessoryViewID = `set-confirm-${exerciseIndex}`;

  const commitActiveFieldIfNeeded = useCallback(
    (source: 'done' | 'outside' | 'blur') => {
      if (!editingCell) return;
      if (commitInProgressRef.current) return;
      commitInProgressRef.current = true;
      const { exerciseIndex: exIdx, setIndex, field } = editingCell;
      const set = exercise.sets[setIndex];
      if (field === 'weight') {
        const n = parseNumericInput(editingCellValue, 'float');
        if (n !== null) updateSet(exIdx, setIndex, { weight: n });
      } else if (field === 'rpe') {
        const n = parseNumericInput(editingCellValue, 'float');
        if (n !== null) updateSet(exIdx, setIndex, { rpe: Math.min(10, Math.max(1, n)) });
      } else {
        const n = parseNumericInput(editingCellValue, 'int');
        if (n !== null) updateSet(exIdx, setIndex, { reps: n });
      }
      setEditingCell(null);
      setEditingCellValue('');
      Keyboard.dismiss();
      commitInProgressRef.current = false;
    },
    [editingCell, editingCellValue, exercise.sets, updateSet]
  );

  const commitActiveFieldRef = useRef(commitActiveFieldIfNeeded);
  commitActiveFieldRef.current = commitActiveFieldIfNeeded;
  useEffect(() => {
    if (externalCommitTrigger > 0) commitActiveFieldRef.current('outside');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCommitTrigger]);

  return (
    <>
      <View style={styles.setTableHeader}>
        <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.set }]}>
          <Text style={[styles.setTableHeaderLabel, { color: colors.primaryLight + '50' }]} numberOfLines={1} ellipsizeMode="tail">SET</Text>
        </View>
        <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.previous }]}>
          <Text style={[styles.setTableHeaderLabel, { color: colors.primaryLight + '50' }]} numberOfLines={1} ellipsizeMode="tail">PREVIOUS</Text>
        </View>
        <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.weight }]}>
          <Text style={[styles.setTableHeaderLabel, { color: colors.primaryLight + '50' }]} numberOfLines={1} ellipsizeMode="tail">{weightUnit.toUpperCase()}</Text>
        </View>
        <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.reps }]}>
          <Text style={[styles.setTableHeaderLabel, { color: colors.primaryLight + '50' }]} numberOfLines={1} ellipsizeMode="tail">REPS</Text>
        </View>
        <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.rpe }]}>
          <Text style={[styles.setTableHeaderLabel, { color: colors.primaryLight + '50' }]} numberOfLines={1} ellipsizeMode="tail">RPE</Text>
        </View>
        <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.check }]}>
          <Text style={[styles.setTableHeaderLabel, { color: colors.primaryLight + '50' }]} numberOfLines={1}>✓</Text>
        </View>
      </View>

      {exercise.sets.map((set, setIndex) => {
        const isCompleted = set.completed;
        const rowKey = `${exerciseIndex}-${setIndex}`;
        // Only show ghost for sets that have a corresponding previous set, or when prescription drives the target.
        const hasHistoryForSet = setIndex < prevSets.length;
        const effectiveGhostWeight = (prescription != null || hasHistoryForSet) ? ghostWeight : null;
        const effectiveGhostReps = (prescription != null || hasHistoryForSet) ? ghostReps : null;
        return (
          <View key={set.id} style={styles.setBlock} onLayout={(e) => onSetRowLayout?.(exerciseIndex, setIndex, e.nativeEvent.layout.y)}>
            <Swipeable
              renderRightActions={() => (
                <Pressable
                  style={({ pressed }) => [styles.setRowDeleteAction, pressed && { opacity: 0.8 }]}
                  onPressIn={playIn}
                  onPressOut={playOut}
                  onPress={() => onRemoveSet(exerciseIndex, setIndex)}
                >
                  <Text style={styles.setRowDeleteText}>Delete</Text>
                </Pressable>
              )}
              friction={2}
              rightThreshold={40}
            >
              <View
                style={[
                  styles.setRowWrapper,
                  isCompleted && pressedCheckRowKey !== rowKey && { backgroundColor: colors.primaryLight + '0A', borderColor: colors.primaryLight + '20' },
                  pressedCheckRowKey === rowKey && { backgroundColor: colors.primaryLight + '18', borderColor: colors.primaryLight + '25' },
                ]}
              >
                <View style={[styles.setRow, { borderBottomWidth: 1 }]}>
                  <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.set }]}>
                    <TouchableOpacity
                      onPress={() => onSetNotesPress?.(exerciseIndex, setIndex)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.setDotPressable}
                    >
                      <View style={[styles.setDot, { borderColor: colors.primaryLight + '30' }, isCompleted && { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight }]}>
                        <Text style={[styles.setDotText, { color: colors.primaryLight + '80' }, isCompleted && { color: colors.primaryDark }]}>{setIndex + 1}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.previous }]}>
                    <View style={styles.setPreviousTextWrap}>
                      <Text style={[styles.setCellDim, { color: colors.primaryLight + '50' }, isCompleted && { color: colors.primaryLight + '70' }]} numberOfLines={1} ellipsizeMode="tail">
                        {prevSets[setIndex]?.weight > 0
                          ? `${formatWeightDisplay(toDisplayWeight(prevSets[setIndex].weight, weightUnit), weightUnit)}×${prevSets[setIndex].reps}`
                          : '—'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.setTableCell, styles.setInputCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.weight, zIndex: 1 }]}>
                    <View style={styles.setCellContentCenter}>
                      {editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'weight' ? (
                        <View style={[styles.setInputCellBase, { borderColor: colors.primaryLight + '25', backgroundColor: colors.primaryLight + '08' }, styles.setInputCellActiveVisual, { borderColor: colors.primaryLight + '45', backgroundColor: colors.primaryLight + '12' }]} collapsable={false}>
                          <Input
                            value={editingCellValue}
                            onChangeText={setEditingCellValue}
                            onFocus={() => onFocusCell?.(exerciseIndex, setIndex)}
                            onBlur={() => commitActiveFieldIfNeeded('blur')}
                            onEndEditing={() => {}}
                            autoFocus
                            keyboardType="decimal-pad"
                            placeholder="—"
                            multiline={false}
                            maxLength={5}
                            inputAccessoryViewID={Platform.OS === 'ios' ? accessoryViewID : undefined}
                            containerStyle={styles.setInputCellInner}
                            style={[styles.setInputTextVisible, styles.setInputFixedDimensions, { color: colors.primaryLight, backgroundColor: 'transparent' }]}
                            placeholderTextColor={colors.primaryLight + '50'}
                            selectionColor={colors.primaryLight + '60'}
                            textAlignVertical="center"
                          />
                        </View>
                      ) : (
                        <Pressable
                          onPressIn={playIn}
                          onPressOut={playOut}
                          onPress={() => {
                            const displayValue = set.weight > 0 ? formatWeightDisplay(toDisplayWeight(set.weight, weightUnit), weightUnit) : '';
                            setEditingCell({ exerciseIndex, setIndex, field: 'weight' });
                            setEditingCellValue(displayValue);
                          }}
                          onLongPress={set.weight === 0 && effectiveGhostWeight ? () => {
                            const _prev = prevSets[setIndex]?.weight > 0 && prevSets[setIndex]?.reps > 0
                              ? prevSets[setIndex]
                              : prevSets.find((s) => s.weight > 0 && s.reps > 0) ?? null;
                            const _lastText = _prev
                              ? `${formatWeightDisplay(toDisplayWeight(_prev.weight, weightUnit), weightUnit)}×${_prev.reps}`
                              : '—';
                            const _tw = effectiveGhostWeight ?? '—';
                            const _tr = effectiveGhostReps ?? '—';
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
                            setGhostTooltip({ lastText: _lastText, targetText: `${_tw}×${_tr}` });
                            tooltipTimerRef.current = setTimeout(() => setGhostTooltip(null), 2500);
                          } : undefined}
                          style={[styles.setInputPlaceholder, { backgroundColor: colors.primaryLight + '0A' }]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={[styles.setInputPlaceholderText, set.weight > 0 ? { color: colors.primaryLight } : effectiveGhostWeight ? { color: colors.primaryLight + '50' } : { color: colors.primaryLight + '40' }]}>
                            {set.weight > 0 ? formatWeightDisplay(toDisplayWeight(set.weight, weightUnit), weightUnit) : (effectiveGhostWeight ?? '—')}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>

                  <View style={[styles.setTableCell, styles.setInputCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.reps, zIndex: 1 }]}>
                    <View style={styles.setCellContentCenter}>
                      {editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'reps' ? (
                        <View style={[styles.setInputCellBase, { borderColor: colors.primaryLight + '25', backgroundColor: colors.primaryLight + '08' }, styles.setInputCellActiveVisual, { borderColor: colors.primaryLight + '45', backgroundColor: colors.primaryLight + '12' }]} collapsable={false}>
                          <Input
                            value={editingCellValue}
                            onChangeText={setEditingCellValue}
                            onFocus={() => onFocusCell?.(exerciseIndex, setIndex)}
                            onBlur={() => commitActiveFieldIfNeeded('blur')}
                            onEndEditing={() => {}}
                            autoFocus
                            keyboardType="number-pad"
                            placeholder="—"
                            multiline={false}
                            maxLength={4}
                            inputAccessoryViewID={Platform.OS === 'ios' ? accessoryViewID : undefined}
                            containerStyle={styles.setInputCellInner}
                            style={[styles.setInputTextVisible, styles.setInputFixedDimensions, { color: colors.primaryLight, backgroundColor: 'transparent' }]}
                            placeholderTextColor={colors.primaryLight + '50'}
                            selectionColor={colors.primaryLight + '60'}
                            textAlignVertical="center"
                          />
                        </View>
                      ) : (
                        <Pressable
                          onPressIn={playIn}
                          onPressOut={playOut}
                          onPress={() => {
                            const displayValue = set.reps > 0 ? String(set.reps) : '';
                            setEditingCell({ exerciseIndex, setIndex, field: 'reps' });
                            setEditingCellValue(displayValue);
                          }}
                          onLongPress={set.reps === 0 && effectiveGhostReps ? () => {
                            const _prev = prevSets[setIndex]?.weight > 0 && prevSets[setIndex]?.reps > 0
                              ? prevSets[setIndex]
                              : prevSets.find((s) => s.weight > 0 && s.reps > 0) ?? null;
                            const _lastText = _prev
                              ? `${formatWeightDisplay(toDisplayWeight(_prev.weight, weightUnit), weightUnit)}×${_prev.reps}`
                              : '—';
                            const _tw = effectiveGhostWeight ?? '—';
                            const _tr = effectiveGhostReps ?? '—';
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
                            setGhostTooltip({ lastText: _lastText, targetText: `${_tw}×${_tr}` });
                            tooltipTimerRef.current = setTimeout(() => setGhostTooltip(null), 2500);
                          } : undefined}
                          style={[styles.setInputPlaceholder, { backgroundColor: colors.primaryLight + '0A' }]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={[styles.setInputPlaceholderText, set.reps > 0 ? { color: colors.primaryLight } : effectiveGhostReps ? { color: colors.primaryLight + '50' } : { color: colors.primaryLight + '40' }]}>
                            {set.reps > 0 ? String(set.reps) : (effectiveGhostReps ?? '—')}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>

                  <View style={[styles.setTableCell, styles.setInputCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.rpe }]}>
                    <View style={styles.setCellContentCenter}>
                      <Pressable
                        onPressIn={playIn}
                        onPressOut={playOut}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setRpePopup({ exerciseIndex, setIndex, value: set.rpe ?? 7 });
                        }}
                        style={[styles.setRpeInactivePill, set.rpe != null && { borderColor: colors.primaryLight + '40', backgroundColor: colors.primaryLight + '12' }]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={[styles.setRpePillText, set.rpe != null ? { color: colors.primaryLight } : { color: colors.primaryLight + '35' }]}>
                          {set.rpe != null ? (set.rpe % 1 === 0 ? String(set.rpe) : set.rpe.toFixed(1)) : '—'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.check }]}>
                    <View style={styles.setCellContentCenter}>
                      <Pressable
                        style={[styles.setCheckWrap, { borderColor: colors.primaryLight + '30' }, isCompleted && { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight }]}
                        onPressIn={() => { playIn(); setPressedCheckRowKey(rowKey); }}
                        onPressOut={() => { playOut(); setPressedCheckRowKey(null); }}
                        onPress={() => {
                          const nextCompleted = !set.completed;
                          const isEditingThisSet = editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex;
                          const setUpdates: { weight?: number; reps?: number; rpe?: number | null; completed: boolean } = { completed: nextCompleted };
                          if (isEditingThisSet && editingCell) {
                            if (editingCell.field === 'weight') {
                              const n = parseNumericInput(editingCellValue, 'float');
                              if (n !== null) setUpdates.weight = n;
                            } else if (editingCell.field === 'rpe') {
                              const n = parseNumericInput(editingCellValue, 'float');
                              if (n !== null) setUpdates.rpe = Math.min(10, Math.max(1, n));
                            } else {
                              const n = parseNumericInput(editingCellValue, 'int');
                              if (n !== null) setUpdates.reps = n;
                            }
                            setEditingCell(null);
                            setEditingCellValue('');
                            Keyboard.dismiss();
                          }
                          if (nextCompleted) {
                            if ((setUpdates.weight ?? set.weight) === 0 && effectiveGhostWeight !== null) {
                              const gw = parseNumericInput(effectiveGhostWeight, 'float');
                              if (gw !== null) setUpdates.weight = gw;
                            }
                            if ((setUpdates.reps ?? set.reps) === 0 && effectiveGhostReps !== null) {
                              const gr = parseNumericInput(effectiveGhostReps, 'int');
                              if (gr !== null) setUpdates.reps = gr;
                            }
                          } else {
                            // Revert ghost-applied values back to 0 so ghost shows again
                            if (effectiveGhostWeight !== null && set.weight > 0) {
                              const displayedWeight = formatWeightDisplay(toDisplayWeight(set.weight, weightUnit), weightUnit);
                              if (displayedWeight === effectiveGhostWeight) setUpdates.weight = 0;
                            }
                            if (effectiveGhostReps !== null && set.reps > 0) {
                              if (String(set.reps) === effectiveGhostReps) setUpdates.reps = 0;
                            }
                          }
                          updateSet(exerciseIndex, setIndex, setUpdates);
                          if (nextCompleted && exercise.restTimer && onRestTimerStart) {
                            onRestTimerStart(exerciseIndex, setIndex, set.id, exercise.restTimer);
                          } else if (!nextCompleted && onRestTimerSkip) {
                            onRestTimerSkip(set.id);
                          }
                          if (nextCompleted) {
                            const finalRpe = setUpdates.rpe ?? set.rpe;
                            const hasNextSet = exercise.sets.length > setIndex + 1;
                            if (finalRpe != null && finalRpe < 7 && hasNextSet) {
                              const roundedRpe = Math.round(finalRpe);
                              updateToRPEWarning(roundedRpe, exercise.name);
                              sendRPENotification(roundedRpe, exercise.name, 'active');
                            }
                          }
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="checkmark" size={24} color={isCompleted ? colors.primaryDark : colors.primaryLight + '40'} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            </Swipeable>

            <View style={styles.setNoteRowOuter}>
              {!set.notes ? (
                <Pressable style={styles.setNoteRow} onPress={() => onSetNotesPress?.(exerciseIndex, setIndex)} hitSlop={8}>
                  <Text style={[styles.setNoteText, { color: colors.primaryLight + '40' }]}>+ note</Text>
                </Pressable>
              ) : (
                <AnimatedSetNoteRow
                  notes={set.notes}
                  isExpanded={!!expandedSetNotes[set.id]}
                  onToggle={() => setExpandedSetNotes((prev) => ({ ...prev, [set.id]: !prev[set.id] }))}
                  onEdit={() => onSetNotesPress?.(exerciseIndex, setIndex)}
                  colors={colors}
                />
              )}
            </View>
          </View>
        );
      })}

      <Pressable
        style={({ pressed }) => [styles.addSetButtonBlock, { backgroundColor: colors.primaryLight + '15' }, pressed && { opacity: 0.85 }]}
        onPressIn={playIn}
        onPressOut={playOut}
        onPress={() => onAddSet(exerciseIndex)}
      >
        <Text style={[styles.addSetButtonBlockText, { color: colors.primaryLight + '90' }]}>+ Add Set</Text>
      </Pressable>

      {Platform.OS === 'ios' && editingCell && (
        <InputAccessoryView nativeID={accessoryViewID}>
          <View style={[styles.keyboardAccessoryBar, { backgroundColor: colors.primaryDark, borderTopColor: colors.primaryLight + '18' }]}>
            <Pressable
              onPressIn={playIn}
              onPressOut={playOut}
              onPress={() => commitActiveFieldIfNeeded('done')}
              style={styles.keyboardAccessoryDone}
              hitSlop={8}
            >
              <Text style={[styles.keyboardAccessoryDoneText, { color: colors.primaryLight }]}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}

      {Platform.OS !== 'ios' && editingCell && (
        <View style={[styles.keyboardConfirmBar, { bottom: keyboardHeight }]}>
          <Pressable
            onPressIn={playIn}
            onPressOut={playOut}
            onPress={() => commitActiveFieldIfNeeded('done')}
            style={styles.keyboardConfirmPillTouchable}
            hitSlop={8}
          >
            <View style={styles.keyboardConfirmPill}>
              <LinearGradient
                colors={colors.tabBarBorder as [string, string]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius: 24 }]}
              />
              <View style={[styles.keyboardConfirmPillShell, { backgroundColor: (colors.tabBarFill as [string, string])?.[1] ?? Colors.primaryDark }]}>
                <View style={styles.keyboardConfirmPillInner}>
                  <Ionicons name="checkmark" size={24} color={colors.primaryLight} />
                </View>
              </View>
            </View>
          </Pressable>
        </View>
      )}

      <Modal visible={rpePopup !== null} transparent animationType="slide" onRequestClose={() => setRpePopup(null)}>
        <View style={styles.rpeModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRpePopup(null)} />
          {rpePopup && (
            <View style={styles.rpePopupCard}>
              <View style={styles.rpePopupHandle} />
              <Text style={styles.rpePopupTitle}>Rate of Perceived Exertion</Text>
              <View style={styles.rpeValueRow}>
                <Text style={[styles.rpeValueBig, { color: colors.primaryLight }]}>
                  {`RPE ${rpePopup.value % 1 === 0 ? String(rpePopup.value) : rpePopup.value.toFixed(1)}`}
                </Text>
                <Text style={styles.rpeValueLabel}>{getRpeLabel(rpePopup.value)}</Text>
              </View>
              <View style={styles.rpeSliderRow}>
                <Text style={styles.rpeSliderEdge}>1</Text>
                <Slider
                  style={styles.rpeSlider}
                  minimumValue={1}
                  maximumValue={10}
                  step={0.5}
                  value={rpePopup.value}
                  onValueChange={(v) => {
                    setRpePopup((prev) => (prev ? { ...prev, value: v } : null));
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  minimumTrackTintColor={colors.primaryLight}
                  maximumTrackTintColor={colors.primaryLight + '30'}
                  thumbTintColor={colors.primaryLight}
                />
                <Text style={styles.rpeSliderEdge}>10</Text>
              </View>
              <View style={styles.rpeNumberPill}>
                {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as number[]).map((n) => {
                  const active = rpePopup.value === n;
                  return (
                    <Pressable
                      key={n}
                      style={[styles.rpeNumberPillItem, active && { backgroundColor: colors.primaryLight }]}
                      onPress={() => {
                        setRpePopup((prev) => (prev ? { ...prev, value: n } : null));
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={[styles.rpeNumberPillText, active && { color: colors.primaryDark }]}>{String(n)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.rpeButtonRow}>
                <Pressable
                  style={styles.rpeClearButton}
                  onPress={() => {
                    updateSet(rpePopup.exerciseIndex, rpePopup.setIndex, { rpe: null });
                    setRpePopup(null);
                  }}
                >
                  <Text style={styles.rpeClearButtonText}>Clear</Text>
                </Pressable>
                <Pressable
                  style={[styles.rpeDoneButton, { backgroundColor: colors.primaryLight }]}
                  onPress={() => {
                    updateSet(rpePopup.exerciseIndex, rpePopup.setIndex, { rpe: rpePopup.value });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setRpePopup(null);
                  }}
                >
                  <Text style={[styles.rpeDoneButtonText, { color: colors.primaryDark }]}>Done</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Ghost value tooltip */}
      {ghostTooltip && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setGhostTooltip(null)}>
          <Pressable
            style={styles.ghostTooltipOverlay}
            onPress={() => {
              if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
              setGhostTooltip(null);
            }}
          >
            <Pressable style={[styles.ghostTooltipCard, { backgroundColor: colors.primaryDark, borderColor: colors.primaryLight + '20' }]} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.ghostTooltipLine}>
                <Text style={[styles.ghostTooltipLabel, { color: colors.primaryLight + '55' }]}>Last time: </Text>
                <Text style={[styles.ghostTooltipValue, { color: colors.primaryLight + 'CC' }]}>{ghostTooltip.lastText}</Text>
              </Text>
              <Text style={styles.ghostTooltipLine}>
                <Text style={[styles.ghostTooltipLabel, { color: colors.primaryLight + '55' }]}>Target: </Text>
                <Text style={[styles.ghostTooltipValue, { color: colors.primaryLight + 'CC' }]}>{ghostTooltip.targetText}</Text>
              </Text>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  setTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
    width: '100%',
  },
  setTableCell: { paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  setTableCellFlex: { minWidth: 0 },
  setTableHeaderLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0,
    color: Colors.primaryLight + '50',
    textAlign: 'center',
    textTransform: 'uppercase' as const,
  },
  setInputCell: { paddingHorizontal: 2 },
  setCellContentCenter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    width: '100%',
  },
  setPreviousTextWrap: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  setInputTextVisible: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primaryLight,
    textAlign: 'center',
    letterSpacing: -0.11,
    lineHeight: 16,
    width: '100%',
    paddingVertical: 0,
  },
  setDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDotText: { fontSize: 11, fontWeight: '700' as const, color: Colors.primaryLight + '80', letterSpacing: -0.11 },
  setCellDim: { fontSize: 12, fontWeight: '500', color: Colors.primaryLight + '50', letterSpacing: -0.11, textAlign: 'center' },
  setInputCellBase: {
    marginBottom: 0,
    minHeight: SET_INPUT_PILL_HEIGHT,
    height: SET_INPUT_PILL_HEIGHT,
    maxHeight: SET_INPUT_PILL_HEIGHT,
    width: '84%',
    maxWidth: SET_INPUT_MAX_WIDTH,
    minWidth: SET_INPUT_MIN_WIDTH,
    alignSelf: 'center' as const,
    borderRadius: SET_INPUT_BORDER_RADIUS,
    borderWidth: 1,
  },
  setInputCellActiveVisual: {
    shadowColor: Colors.primaryLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 0,
  },
  setInputCellInner: {
    marginBottom: 0,
    minHeight: SET_INPUT_PILL_HEIGHT,
    height: SET_INPUT_PILL_HEIGHT,
    maxHeight: SET_INPUT_PILL_HEIGHT,
    width: '84%',
    maxWidth: SET_INPUT_MAX_WIDTH,
    minWidth: SET_INPUT_MIN_WIDTH,
    alignSelf: 'center' as const,
    borderRadius: SET_INPUT_BORDER_RADIUS,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  setInputFixedDimensions: {
    height: SET_INPUT_PILL_HEIGHT,
    minHeight: SET_INPUT_PILL_HEIGHT,
    maxHeight: SET_INPUT_PILL_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: SET_INPUT_PADDING_H,
    borderWidth: 0,
    borderRadius: SET_INPUT_BORDER_RADIUS,
  },
  setInputPlaceholder: {
    height: SET_INPUT_PILL_HEIGHT,
    width: '84%',
    maxWidth: SET_INPUT_MAX_WIDTH,
    minWidth: SET_INPUT_MIN_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight + '0A',
    borderRadius: SET_INPUT_BORDER_RADIUS,
    paddingHorizontal: SET_INPUT_PADDING_H,
  },
  setInputPlaceholderText: { fontSize: 15, fontWeight: '600' as const, color: Colors.primaryLight + '40', letterSpacing: -0.11 },
  setRpeInactivePill: {
    height: SET_INPUT_PILL_HEIGHT,
    width: '90%',
    minWidth: 0,
    maxWidth: 48,
    alignSelf: 'center' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: SET_INPUT_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '18',
    backgroundColor: Colors.primaryLight + '08',
    paddingHorizontal: 4,
  },
  setRpePillText: { fontSize: 14, fontWeight: '600' as const, letterSpacing: -0.1, textAlign: 'center' as const },
  setCheckWrap: {
    width: SET_CHECK_BUTTON_SIZE,
    height: SET_CHECK_BUTTON_SIZE,
    borderRadius: SET_CHECK_BUTTON_SIZE / 2,
    borderWidth: 2,
    borderColor: Colors.primaryLight + '30',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setRowDeleteAction: {
    backgroundColor: Colors.accentRed,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginLeft: 4,
  },
  setRowDeleteText: { fontSize: 13, fontWeight: '700' as const, color: Colors.white, letterSpacing: -0.11 },
  setBlock: { marginBottom: 6 },
  setRowWrapper: { width: '100%', borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  setDotPressable: { alignItems: 'center', gap: 2 },
  setNoteRowOuter: { width: '100%', alignItems: 'center', marginTop: 8 },
  setNoteRowInner: {
    width: '92%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(198,198,198,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.10)',
  },
  setNoteRow: {
    width: '92%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(198,198,198,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNoteText: { fontSize: 12, fontWeight: '500' as const, letterSpacing: -0.11, lineHeight: 15 },
  setNoteTextExpanded: { fontSize: 12, fontWeight: '500' as const, letterSpacing: -0.11, lineHeight: 15.6, paddingBottom: 2 },
  setNoteFadeHint: { marginTop: 6, fontSize: 11, fontWeight: '500' as const, color: Colors.primaryLight + '66', letterSpacing: -0.11 },
  setNoteEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.primaryLight + '10',
  },
  setNoteEditButtonText: { fontSize: 11, fontWeight: '600' as const, color: Colors.primaryLight + '99', letterSpacing: -0.11 },
  addSetButtonBlock: {
    alignSelf: 'stretch',
    height: 36,
    backgroundColor: Colors.primaryLight + '15',
    marginTop: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetButtonBlockText: { fontSize: Typography.label, fontWeight: '600' as const, color: Colors.primaryLight + '90', letterSpacing: -0.11 },
  keyboardAccessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  keyboardAccessoryDone: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  keyboardAccessoryDoneText: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: -0.11,
  },
  keyboardConfirmBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 20,
    paddingLeft: 20,
  },
  keyboardConfirmPillTouchable: { width: 52, height: 48 },
  keyboardConfirmPill: { width: 52, height: 48, borderRadius: 24, overflow: 'hidden' },
  keyboardConfirmPillShell: { position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderRadius: 23, overflow: 'hidden' },
  keyboardConfirmPillInner: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  rpeModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  rpePopupCard: {
    width: '100%',
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingTop: 14,
    paddingBottom: 44,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
  },
  rpePopupHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 22 },
  rpePopupTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    marginBottom: 18,
  },
  rpeValueRow: { alignItems: 'center' as const, marginBottom: 24 },
  rpeValueBig: { fontSize: 52, fontWeight: '700' as const, lineHeight: 58, letterSpacing: -2 },
  rpeValueLabel: { fontSize: 14, fontWeight: '500' as const, color: 'rgba(255,255,255,0.45)', marginTop: 6, textAlign: 'center' as const },
  rpeSliderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, width: '100%', marginBottom: 20 },
  rpeSlider: { flex: 1, height: 40 },
  rpeSliderEdge: { fontSize: 13, fontWeight: '600' as const, color: 'rgba(255,255,255,0.30)', width: 20, textAlign: 'center' as const },
  rpeNumberPill: {
    flexDirection: 'row' as const,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 3,
    marginBottom: 24,
  },
  rpeNumberPillItem: { flex: 1, height: 36, borderRadius: 999, alignItems: 'center' as const, justifyContent: 'center' as const },
  rpeNumberPillText: { fontSize: 13, fontWeight: '600' as const, color: 'rgba(255,255,255,0.45)' },
  rpeButtonRow: { flexDirection: 'row' as const, gap: 10, width: '100%' },
  rpeClearButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  rpeClearButtonText: { fontSize: 15, fontWeight: '600' as const, color: 'rgba(255,255,255,0.45)' },
  rpeDoneButton: { flex: 2, height: 50, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const },
  rpeDoneButtonText: { fontSize: 15, fontWeight: '700' as const },

  // ─── Ghost value tooltip ──────────────────────────────────────────────────
  ghostTooltipOverlay: {
    flex: 1,
    justifyContent: 'flex-end' as const,
    paddingBottom: 130,
    paddingHorizontal: 20,
  },
  ghostTooltipCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf: 'center' as const,
    minWidth: 180,
  },
  ghostTooltipLine: { fontSize: 13, lineHeight: 20, letterSpacing: -0.11 },
  ghostTooltipLabel: { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.11 },
  ghostTooltipValue: { fontSize: 13, fontWeight: '600' as const, letterSpacing: -0.11 },
});
