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

// ── Design tokens (match workout tracker pill system) ───────────────────────
// Card gradient: same as Card.tsx gradientFill
const SHEET_BORDER_GRADIENT: [string, string] = ['#525354', '#48494A'];
const SHEET_FILL_GRADIENT: [string, string] = ['#363738', '#2E2F30'];

const PILL_H = 36;            // category filter chip height
const PILL_RADIUS = 18;       // fully-rounded pill
const ROW_RADIUS = 12;        // exercise list rows
const CLOSE_BTN_SIZE = 32;    // header close icon circle

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
              <Ionicons name="add-circle-outline" size={20} color={Colors.primaryLight + '50'} />
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
const styles = StyleSheet.create({
  // Scrim (absorbs taps outside the sheet)
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // Sheet outer shell — provides gradient border ring
  sheetOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },

  // Inner gradient fill sits inset 1px from the border gradient
  sheetFill: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 0, // no bottom border needed (touches screen edge)
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
  },

  // Drag handle
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primaryLight + '30',
    marginTop: 10,
    marginBottom: 4,
  },

  // Header row
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
  },
  closeBtn: {
    width: CLOSE_BTN_SIZE,
    height: CLOSE_BTN_SIZE,
    borderRadius: CLOSE_BTN_SIZE / 2,
    backgroundColor: Colors.primaryLight + '12',
    borderWidth: 1,
    borderColor: Colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    opacity: 0.7,
    backgroundColor: Colors.primaryLight + '20',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight + '08',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '18',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  search: {
    flex: 1,
    fontSize: Typography.body,
    fontWeight: '500',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
    paddingVertical: 0, // rely on parent height
    // Remove default focus outline on web/Expo Go
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  // Category chips
  chipScrollView: {
    maxHeight: PILL_H + 8,
    marginBottom: Spacing.sm,
  },
  chipRow: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  chip: {
    height: PILL_H,
    borderRadius: PILL_RADIUS,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight + '0A',
    borderWidth: 1,
    borderColor: Colors.primaryLight + '20',
  },
  chipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryLight,
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipText: {
    fontSize: Typography.label,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: Colors.primaryLight + 'BB',
  },
  chipTextActive: {
    color: Colors.primaryDark,
  },

  // Exercise list
  list: {
    flexShrink: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 6,
  },

  // Exercise rows — pill card style
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: Spacing.md,
    borderRadius: ROW_RADIUS,
    backgroundColor: Colors.primaryLight + '08',
    borderWidth: 1,
    borderColor: Colors.primaryLight + '12',
  },
  rowPressed: {
    backgroundColor: Colors.primaryLight + '14',
    borderColor: Colors.primaryLight + '22',
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
    color: Colors.primaryLight + '60',
    marginTop: 2,
  },

  // Empty state
  emptyWrap: {
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.body,
    fontWeight: '500',
    letterSpacing: -0.11,
    color: Colors.primaryLight + '60',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
