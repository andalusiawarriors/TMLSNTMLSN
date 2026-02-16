// ============================================================
// TMLSN — Pick exercise from database for custom routines
// ============================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
} from 'react-native';
import { EXERCISE_DATABASE, EXERCISES_BY_CATEGORY } from '../utils/exerciseDb/exerciseDatabase';
import type { Exercise as DbExercise } from '../utils/exerciseDb/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Font } from '../constants/theme';

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
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>add exercise</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.search}
            placeholder="search exercises..."
            placeholderTextColor={Colors.primaryLight + '80'}
            value={search}
            onChangeText={setSearch}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryRow}
          >
            <TouchableOpacity
              style={[styles.chip, !selectedCategory && styles.chipActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>all</Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filteredExercises}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.equipment.join(', ')} · {item.movementType}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No exercises match your search.</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.primaryDark,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontFamily: Font.semiBold,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    textTransform: 'lowercase',
  },
  closeBtn: {
    fontFamily: Font.monoMedium,
    fontSize: 18,
    color: Colors.primaryLight,
  },
  search: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  categoryScroll: {
    maxHeight: 44,
    marginBottom: Spacing.sm,
  },
  categoryRow: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryDarkLighter,
    ...Shadows.card,
  },
  chipActive: {
    backgroundColor: Colors.primaryLight,
  },
  chipText: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.label,
    color: Colors.primaryLight,
    letterSpacing: -0.5,
  },
  chipTextActive: {
    color: Colors.primaryDark,
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  row: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryDarkLighter,
  },
  rowName: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.5,
  },
  rowMeta: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    color: Colors.primaryLight + '99',
    marginTop: 2,
  },
  empty: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight + '80',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
