// ============================================================
// TMLSN — Pick exercise from database for custom routines
// Redesigned to match workout tracker card + pill aesthetic
// ============================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  FlatList,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EXERCISE_DATABASE, EXERCISES_BY_CATEGORY } from '../utils/exerciseDb/exerciseDatabase';
import type { Exercise as DbExercise } from '../utils/exerciseDb/types';
import * as Theme from '../constants/theme';

const { Colors, Typography, Spacing, BorderRadius } = Theme;

// ── Design tokens ─────────────────────────────────────────────────────────
// R = dominant border-radius for every pill/card in this modal.
const R = 38;
const SHEET_BORDER_GRADIENT: [string, string] = ['#525354', '#48494A'];
const SHEET_FILL_GRADIENT: [string, string] = ['#363738', '#2E2F30'];

// ── Category labels ─────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
  full_body: 'Full Body',
  cardio: 'Cardio',
  olympic: 'Olympic',
};

// ── Component interface (unchanged) ─────────────────────────────────────────
interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: { id: string; name: string; exerciseDbId: string; restTimer: number }) => void;
  defaultRestTimer?: number;
}

export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  defaultRestTimer = 120,
}: ExercisePickerModalProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => Object.keys(EXERCISES_BY_CATEGORY).sort(),
    []
  );

  const filteredExercises = useMemo(() => {
    const cat = selectedCategory ? EXERCISES_BY_CATEGORY[selectedCategory] ?? [] : EXERCISE_DATABASE;
    const q = search.toLowerCase().trim();
    if (!q) return cat;
    return cat.filter(
      (ex) =>
        ex.name.toLowerCase().includes(q) ||
        ex.category.toLowerCase().includes(q) ||
        ex.equipment.some((e) => e.toLowerCase().includes(q))
    );
  }, [search, selectedCategory]);

  const handleSelect = (ex: DbExercise) => {
    onSelect({
      id: ex.id,
      name: ex.name,
      exerciseDbId: ex.id,
      restTimer: defaultRestTimer,
    });
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      {/* ── Scrim ─────────────────────────────────────────────────────── */}
      <Pressable style={styles.scrim} onPress={onClose} />

      {/* ── Bottom sheet ──────────────────────────────────────────────── */}
      <View style={[styles.sheetOuter, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        {/* gradient border ring (1px) */}
        <LinearGradient
          colors={SHEET_BORDER_GRADIENT}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* gradient fill (inset 1px) */}
        <LinearGradient
          colors={SHEET_FILL_GRADIENT}
          style={styles.sheetFill}
        />

        {/* ── Drag handle ─────────────────────────────────────────────── */}
        <View style={styles.handle} />

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>add exercise</Text>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
          >
            <Ionicons name="close" size={18} color={Colors.primaryLight} />
          </Pressable>
        </View>

        {/* ── Search input ────────────────────────────────────────────── */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={Colors.primaryLight + '60'} style={styles.searchIcon} />
          <TextInput
            style={styles.search}
            placeholder="search exercises..."
            placeholderTextColor={Colors.primaryLight + '50'}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        {/* ── Category filter chips ────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScrollView}
          contentContainerStyle={styles.chipRow}
        >
          {/* "All" chip */}
          <Pressable
            style={({ pressed }) => [
              styles.chip,
              !selectedCategory && styles.chipActive,
              pressed && styles.chipPressed,
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>all</Text>
          </Pressable>

          {categories.map((cat) => (
            <Pressable
              key={cat}
              style={({ pressed }) => [
                styles.chip,
                selectedCategory === cat && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
              onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                {CATEGORY_LABELS[cat] ?? cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Exercise list ────────────────────────────────────────────── */}
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => handleSelect(item)}
            >
              {/* Left: name + meta */}
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {item.equipment.join(', ')} · {item.movementType}
                </Text>
              </View>
              {/* Right: add chevron */}
              {/* Subtle pill add button */}
              <View style={styles.addBtn}>
                <Ionicons name="add" size={16} color={Colors.primaryLight + '60'} />
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No exercises match your search.</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
// Single radius constant R=38 used for every pill/card surface.
const styles = StyleSheet.create({

  // ── Scrim ──────────────────────────────────────────────────────────────
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },

  // ── Sheet: outer gradient-border shell + inner fill ────────────────────
  sheetOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '88%',
    borderTopLeftRadius: R,
    borderTopRightRadius: R,
    overflow: 'hidden',
  },
  sheetFill: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 0,
    borderTopLeftRadius: R - 1,
    borderTopRightRadius: R - 1,
  },

  // ── Drag handle ────────────────────────────────────────────────────────
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primaryLight + '28',
    marginTop: 12,
    marginBottom: 2,
  },

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
  },
  // Close button: R pill, no border — fill only, same surface as chips
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: R,
    backgroundColor: Colors.primaryLight + '0E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    backgroundColor: Colors.primaryLight + '1C',
    opacity: 0.85,
  },

  // ── Search input: R pill, single subtle border, no icon border ──────────
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: R,
    backgroundColor: Colors.primaryLight + '09',
    borderWidth: 1,
    borderColor: Colors.primaryLight + '15',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 10,
    opacity: 0.5,
  },
  search: {
    flex: 1,
    fontSize: Typography.body,
    fontWeight: '500',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  // ── Category chips: R pill, no border on inactive, subtle fill active ───
  chipScrollView: {
    maxHeight: 44,
    marginBottom: Spacing.sm,
  },
  chipRow: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  chip: {
    height: 36,
    borderRadius: R,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    // Inactive: no border, muted fill — calm and flat
    backgroundColor: Colors.primaryLight + '0C',
  },
  chipActive: {
    // Active: slightly brighter fill, still no harsh border
    backgroundColor: Colors.primaryLight + '18',
  },
  chipPressed: {
    opacity: 0.72,
  },
  chipText: {
    fontSize: Typography.label,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: Colors.primaryLight + 'A0',
  },
  chipTextActive: {
    color: Colors.primaryLight,
  },

  // ── Exercise list ───────────────────────────────────────────────────────
  list: {
    flexShrink: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 7,
  },

  // Row: R pill, no border — fill only. Separation comes from the gap.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: R,
    backgroundColor: Colors.primaryLight + '09',
  },
  rowPressed: {
    backgroundColor: Colors.primaryLight + '15',
  },
  rowText: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
  },
  rowMeta: {
    fontSize: Typography.label,
    fontWeight: '500',
    letterSpacing: -0.11,
    color: Colors.primaryLight + '70',
    marginTop: 2,
  },

  // Add button: R pill, same surface as chip inactive, no border
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: R,
    backgroundColor: Colors.primaryLight + '0E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty state ─────────────────────────────────────────────────────────
  emptyWrap: {
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.body,
    fontWeight: '500',
    letterSpacing: -0.11,
    color: Colors.primaryLight + '55',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

/*
 * ── Verification checklist ───────────────────────────────────────────────────
 * Visual:
 *   [ ] Sheet top corners are clearly rounded (R=38) — not squared off
 *   [ ] Drag handle is centered, subtle (not prominent)
 *   [ ] Header: title left, close pill right, both vertically centred
 *   [ ] Close button: small pill, no outline, fill-only surface
 *   [ ] Search bar: pill shape (R=38), single thin border, icon + placeholder
 *   [ ] Chips: same height, no border, muted fill; active chip is visibly
 *       brighter (not white/inverted) — calm difference, not jarring
 *   [ ] Rows: pill shape (R=38), no border, uniform vertical padding,
 *       clear name / dimmer meta hierarchy, small add-pill icon right-aligned
 *   [ ] No element has more than one border weight — everything uses fill-only
 *       surfaces except the search input
 *
 * Interaction:
 *   [ ] Typing in search narrows list immediately
 *   [ ] Tapping a chip filters; tapping same chip again shows all
 *   [ ] Tapping a row calls onSelect and closes modal
 *   [ ] Tapping scrim (above sheet) closes modal
 *   [ ] Close pill also dismisses correctly
 *   [ ] Empty state appears when search has no results
 *
 * Small-screen:
 *   [ ] No clipped chips or buttons at 375pt screen width
 *   [ ] List scrolls independently, sheet is max 88% height
 *   [ ] Safe area bottom padding respected (notch / home indicator)
 * ────────────────────────────────────────────────────────────────────────────
 */
