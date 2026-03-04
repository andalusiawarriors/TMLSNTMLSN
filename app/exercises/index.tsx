// ============================================================
// TMLSN — Exercise Library
// Full exercise database browser: search, category filter,
// favorites section, recently-done toggle, liquid-glass dark UI.
// System font only.
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { EXERCISE_DATABASE } from '../../utils/exerciseDb/exerciseDatabase';
import type { Exercise } from '../../utils/exerciseDb/types';
import { getWorkoutSessions } from '../../utils/storage';
import { getAllExerciseSettings } from '../../utils/exerciseSettings';
import { HomeGradientBackground } from '../../components/HomeGradientBackground';

// ── Design tokens ─────────────────────────────────────────────
const BG           = '#2F3031';
const TEXT_PRIMARY = '#C6C6C6';
const TEXT_DIM     = 'rgba(198,198,198,0.55)';
const GLASS_FILL   = 'rgba(47,48,49,0.42)';
const GLASS_BORDER = 'rgba(198,198,198,0.18)';
const BLUR         = 22;

// ── Mappings ──────────────────────────────────────────────────
const CATEGORIES = [
  'All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Full Body',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', abs: 'Abs', full_body: 'Full Body',
  cardio: 'Cardio', olympic: 'Olympic',
};

const LABEL_TO_CATEGORY: Record<string, string> = {
  Chest: 'chest', Back: 'back', Shoulders: 'shoulders',
  Biceps: 'biceps', Triceps: 'triceps', Forearms: 'forearms',
  Quads: 'quads', Hamstrings: 'hamstrings', Glutes: 'glutes',
  Calves: 'calves', Abs: 'abs', 'Full Body': 'full_body',
};

const EQUIP_LABELS: Record<string, string> = {
  barbell: 'Bar', dumbbell: 'DB', cable: 'Cable', machine: 'Machine',
  bodyweight: 'BW', kettlebell: 'KB', ez_bar: 'EZ',
  smith_machine: 'Smith', resistance_band: 'Band', trx: 'TRX',
};

// ── Exercise Row ──────────────────────────────────────────────
interface RowProps { exercise: Exercise; isFav: boolean; onPress: (ex: Exercise) => void }

function ExerciseRow({ exercise: ex, isFav, onPress }: RowProps) {
  const catLabel   = CATEGORY_LABELS[ex.category] ?? ex.category;
  const equipChips = ex.equipment.slice(0, 3).map((e) => EQUIP_LABELS[e] ?? e);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress(ex)}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowName} numberOfLines={1}>{ex.name}</Text>
        {isFav && <Text style={styles.star}>★</Text>}
      </View>
      <View style={styles.rowBottom}>
        <View style={styles.chips}>
          {equipChips.map((c, i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipText}>{c}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.muscleLabel}>{catLabel}</Text>
      </View>
    </Pressable>
  );
}

// ── Favorites Section ─────────────────────────────────────────
interface FavSectionProps { exercises: Exercise[]; onPress: (ex: Exercise) => void }

function FavoritesSection({ exercises, onPress }: FavSectionProps) {
  if (!exercises.length) return null;
  return (
    <View style={styles.favSection}>
      <Text style={styles.sectionLabel}>favorites</Text>
      <View style={styles.favCard}>
        <BlurView intensity={BLUR} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: GLASS_FILL }]} />
        {exercises.map((ex, idx) => {
          const catLabel   = CATEGORY_LABELS[ex.category] ?? ex.category;
          const equipChips = ex.equipment.slice(0, 3).map((e) => EQUIP_LABELS[e] ?? e);
          const isLast     = idx === exercises.length - 1;
          return (
            <View key={ex.id}>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => onPress(ex)}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.rowName} numberOfLines={1}>{ex.name}</Text>
                  <Text style={styles.star}>★</Text>
                </View>
                <View style={styles.rowBottom}>
                  <View style={styles.chips}>
                    {equipChips.map((c, i) => (
                      <View key={i} style={styles.chip}>
                        <Text style={styles.chipText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.muscleLabel}>{catLabel}</Text>
                </View>
              </Pressable>
              {!isLast && <View style={styles.separator} />}
            </View>
          );
        })}
      </View>
      <Text style={styles.allLabel}>all exercises</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function ExerciseLibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [searchQuery,      setSearchQuery]      = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showRecentlyDone, setShowRecentlyDone] = useState(false);
  const [favoriteIds,      setFavoriteIds]      = useState<Set<string>>(new Set());
  const [recentIds,        setRecentIds]        = useState<string[]>([]);

  // ── Load on focus ──
  const loadData = useCallback(async () => {
    try {
      const settings = await getAllExerciseSettings();
      const favs = new Set<string>();
      for (const [id, s] of Object.entries(settings)) {
        if (s.favorite) favs.add(id);
      }
      setFavoriteIds(favs);
    } catch { /* ignore */ }

    try {
      const sessions = await getWorkoutSessions();
      const sorted   = [...sessions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      const seen = new Map<string, true>();
      for (const session of sorted) {
        for (const ex of session.exercises ?? []) {
          if (ex.exerciseDbId && !seen.has(ex.exerciseDbId)) {
            seen.set(ex.exerciseDbId, true);
          }
          if (seen.size >= 30) break;
        }
        if (seen.size >= 30) break;
      }
      setRecentIds(Array.from(seen.keys()));
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // ── Derived ──
  const allExercises = useMemo(() => EXERCISE_DATABASE, []);

  const recentlyDone = useMemo((): Exercise[] => {
    if (!recentIds.length) return [];
    const order = new Map(recentIds.map((id, i) => [id, i]));
    return allExercises
      .filter((ex) => order.has(ex.id))
      .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  }, [allExercises, recentIds]);

  const favoriteExercises = useMemo(
    () => allExercises.filter((ex) => favoriteIds.has(ex.id)),
    [allExercises, favoriteIds],
  );

  const searchNorm        = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
  const activeCategoryKey = useMemo(
    () => (selectedCategory === 'All' ? '' : (LABEL_TO_CATEGORY[selectedCategory] ?? '')),
    [selectedCategory],
  );

  const applyFilters = useCallback(
    (list: Exercise[]) => {
      let out = list;
      if (activeCategoryKey) out = out.filter((ex) => ex.category === activeCategoryKey);
      if (searchNorm)         out = out.filter((ex) => ex.name.toLowerCase().includes(searchNorm));
      return out;
    },
    [activeCategoryKey, searchNorm],
  );

  const mainList = useMemo(
    () => applyFilters(showRecentlyDone ? recentlyDone : allExercises),
    [showRecentlyDone, recentlyDone, allExercises, applyFilters],
  );

  const filteredFavorites = useMemo(
    () => applyFilters(favoriteExercises),
    [favoriteExercises, applyFilters],
  );

  const handlePress = useCallback(
    (ex: Exercise) => {
      Haptics.selectionAsync();
      router.push(`/exercises/${ex.id}` as any);
    },
    [router],
  );

  const renderSeparator = useCallback(() => <View style={styles.separator} />, []);
  const renderRow = useCallback(
    ({ item }: { item: Exercise }) => (
      <ExerciseRow exercise={item} isFav={favoriteIds.has(item.id)} onPress={handlePress} />
    ),
    [favoriteIds, handlePress],
  );
  const keyExtractor = useCallback((item: Exercise) => item.id, []);

  // Header section heights for FlatList top padding
  const HEADER_TOP   = insets.top + 8;
  const HEADER_TITLE = 44;
  const HEADER_SRCH  = 46 + 8; // input + margin
  const HEADER_PILLS = 38 + 4;
  const HEADER_REC   = recentIds.length > 0 ? 38 + 8 : 0;
  const HEADER_BORD  = 5;
  const HEADER_H     = HEADER_TOP + HEADER_TITLE + HEADER_SRCH + HEADER_PILLS + HEADER_REC + HEADER_BORD;

  return (
    <View style={styles.root}>
      <HomeGradientBackground />

      {/* ── Sticky Header ── */}
      <View style={[styles.stickyHeader, { paddingTop: HEADER_TOP }]} pointerEvents="box-none">
        <BlurView intensity={BLUR} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: GLASS_FILL }]} />

        {/* Back + Title */}
        <View style={[styles.headerRow, { height: HEADER_TITLE }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
            hitSlop={12}
          >
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>exercises.</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <BlurView intensity={BLUR} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(47,48,49,0.55)' }]} />
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="search exercises..."
            placeholderTextColor={TEXT_DIM}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContent}
          style={[styles.pillsScroll, { height: HEADER_PILLS }]}
        >
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => { Haptics.selectionAsync(); setSelectedCategory(cat); }}
                style={({ pressed }) => [
                  styles.catPill,
                  active  && styles.catPillActive,
                  pressed && !active && { opacity: 0.6 },
                ]}
              >
                <Text style={[styles.catPillText, active && styles.catPillTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Recently done toggle */}
        {recentIds.length > 0 && (
          <View style={styles.recentRow}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setShowRecentlyDone((v) => !v); }}
              style={({ pressed }) => [
                styles.recentPill,
                showRecentlyDone && styles.recentPillActive,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.recentText, showRecentlyDone && styles.recentTextActive]}>
                {showRecentlyDone ? '● recently done' : '○ recently done'}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.headerBorder} />
      </View>

      {/* ── Main list ── */}
      <FlatList
        data={mainList}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        ItemSeparatorComponent={renderSeparator}
        contentContainerStyle={[styles.listContent, { paddingTop: HEADER_H }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          !showRecentlyDone && filteredFavorites.length > 0
            ? <FavoritesSection exercises={filteredFavorites} onPress={handlePress} />
            : null
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>no exercises found</Text>
          </View>
        }
        removeClippedSubviews
        maxToRenderPerBatch={20}
        windowSize={10}
        initialNumToRender={24}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Header
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 100, overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backChevron: {
    color: TEXT_PRIMARY, fontSize: 30, lineHeight: 34,
    fontWeight: '300', marginTop: -2,
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    color: TEXT_PRIMARY, fontSize: 20, fontWeight: '600', letterSpacing: -0.5,
  },
  headerBorder: { height: 1, backgroundColor: GLASS_BORDER, marginTop: 4 },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    height: 38, borderRadius: 19,
    borderWidth: 1, borderColor: GLASS_BORDER, overflow: 'hidden',
    paddingHorizontal: 12,
  },
  searchIcon: { color: TEXT_DIM, fontSize: 19, marginRight: 6, marginTop: -1 },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 14, height: 38, padding: 0 },

  // Category pills
  pillsScroll: { maxHeight: 42, marginBottom: 0 },
  pillsContent: { paddingHorizontal: 16, gap: 6, alignItems: 'center', paddingVertical: 2 },
  catPill: {
    borderRadius: 13, paddingHorizontal: 13, paddingVertical: 5,
    borderWidth: 1, borderColor: GLASS_BORDER,
    backgroundColor: 'rgba(47,48,49,0.30)',
  },
  catPillActive: {
    backgroundColor: 'rgba(198,198,198,0.15)',
    borderColor: 'rgba(198,198,198,0.30)',
  },
  catPillText:       { color: TEXT_DIM, fontSize: 12, fontWeight: '500' },
  catPillTextActive: { color: TEXT_PRIMARY, fontWeight: '600' },

  // Recently done toggle
  recentRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  recentPill: {
    alignSelf: 'flex-start', borderRadius: 13,
    paddingHorizontal: 13, paddingVertical: 5,
    borderWidth: 1, borderColor: GLASS_BORDER,
    backgroundColor: 'rgba(47,48,49,0.30)',
  },
  recentPillActive: {
    backgroundColor: 'rgba(198,198,198,0.13)',
    borderColor: 'rgba(198,198,198,0.28)',
  },
  recentText:       { color: TEXT_DIM, fontSize: 12, fontWeight: '500' },
  recentTextActive: { color: TEXT_PRIMARY, fontWeight: '600' },

  // List
  listContent: { paddingBottom: 60 },

  // Exercise row
  row:        { paddingHorizontal: 16, paddingVertical: 12 },
  rowPressed: { backgroundColor: 'rgba(198,198,198,0.06)' },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  rowName: {
    flex: 1, color: TEXT_PRIMARY, fontSize: 15,
    fontWeight: '600', letterSpacing: -0.2,
  },
  star: { color: '#F5C542', fontSize: 14, marginLeft: 6 },
  rowBottom: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: { flexDirection: 'row', gap: 5, flexShrink: 1 },
  chip: {
    borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: 'rgba(198,198,198,0.09)',
    borderWidth: 1, borderColor: 'rgba(198,198,198,0.11)',
  },
  chipText:    { color: TEXT_DIM, fontSize: 11, fontWeight: '500' },
  muscleLabel: { color: TEXT_DIM, fontSize: 11, marginLeft: 8, flexShrink: 0 },

  // Separator
  separator: {
    height: 1, marginHorizontal: 16,
    backgroundColor: 'rgba(198,198,198,0.10)',
  },

  // Favorites section
  favSection: { marginBottom: 4 },
  favCard: {
    marginHorizontal: 12, borderRadius: 18,
    borderWidth: 1, borderColor: GLASS_BORDER, overflow: 'hidden',
  },
  sectionLabel: {
    color: TEXT_DIM, fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2,
  },
  allLabel: {
    color: TEXT_DIM, fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 2,
  },

  // Empty
  emptyWrap: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: TEXT_DIM, fontSize: 15 },
});
