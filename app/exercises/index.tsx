// ============================================================
// TMLSN — Exercise Library
// Full exercise database browser: search, category filter,
// favorites section, recently-done toggle, liquid-glass dark UI.
// System font only.
// ============================================================

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { EXERCISE_DATABASE, searchExercises } from '../../utils/exerciseDb/exerciseDatabase';
import type { Exercise } from '../../utils/exerciseDb/types';
import type { CreateExerciseInput } from '../../utils/exerciseDb/types';
import { getWorkoutSessions } from '../../utils/storage';
import { getAllExerciseSettings, resetAllRepRangesToDefault } from '../../utils/exerciseSettings';
import { supabaseFetchUserExercises, supabaseInsertUserExercise } from '../../utils/supabaseStorage';
import { useAuth } from '../../context/AuthContext';
import { CreateExerciseAISheet } from '../../components/CreateExerciseAISheet';
import { FlatFitnessBackground } from '../../components/FlatFitnessBackground';

// ── Design tokens ─────────────────────────────────────────────
const BG           = '#1A1A1A';
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

type FilterMode = 'all' | 'yours' | 'builtin' | 'recent';
const FILTER_LABELS: Record<FilterMode, string> = {
  all: 'All',
  yours: 'Your exercises',
  builtin: 'Built-in',
  recent: 'Recently done',
};

const EQUIP_LABELS: Record<string, string> = {
  barbell: 'Bar', dumbbell: 'DB', cable: 'Cable', machine: 'Machine',
  bodyweight: 'BW', kettlebell: 'KB', ez_bar: 'EZ',
  smith_machine: 'Smith', resistance_band: 'Band', trx: 'TRX',
  plate: 'Plate', trap_bar: 'Trap Bar',
};

// ── Exercise Row ──────────────────────────────────────────────
interface RowProps { exercise: Exercise; isFav: boolean; isCustom?: boolean; onPress: (ex: Exercise) => void }

function ExerciseRow({ exercise: ex, isFav, isCustom, onPress }: RowProps) {
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
        <View style={styles.rowMeta}>
          <Text style={styles.muscleLabel}>{catLabel}</Text>
          {isCustom && (
            <View style={styles.customPill}>
              <Text style={styles.customPillText}>custom</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── Favorites Section ─────────────────────────────────────────
interface FavSectionProps { exercises: Exercise[]; userExerciseIds: Set<string>; onPress: (ex: Exercise) => void }

function FavoritesSection({ exercises, userExerciseIds, onPress }: FavSectionProps) {
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
          const isCustom   = userExerciseIds.has(ex.id);
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
                  <View style={styles.rowMeta}>
                    <Text style={styles.muscleLabel}>{catLabel}</Text>
                    {isCustom && (
                      <View style={styles.customPill}>
                        <Text style={styles.customPillText}>custom</Text>
                      </View>
                    )}
                  </View>
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
function sortByName(a: Exercise, b: Exercise): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export default function ExerciseLibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [searchQuery,       setSearchQuery]       = useState('');
  const [selectedCategory,  setSelectedCategory]  = useState('All');
  const [filterMode,        setFilterMode]        = useState<FilterMode>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [favoriteIds,       setFavoriteIds]       = useState<Set<string>>(new Set());
  const [recentIds,         setRecentIds]         = useState<string[]>([]);
  const [userExercises,     setUserExercises]     = useState<Exercise[]>([]);
  const [showCreateSheet,   setShowCreateSheet]   = useState(false);
  const [resetAllState,    setResetAllState]     = useState<'idle' | 'saved'>('idle');

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

    if (user?.id) {
      supabaseFetchUserExercises(user.id).then(setUserExercises);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // ── Derived ──
  const allExercises = useMemo(() => {
    const merged = [...EXERCISE_DATABASE, ...userExercises];
    return merged.sort(sortByName);
  }, [userExercises]);

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

  const userExerciseIds  = useMemo(() => new Set(userExercises.map((e) => e.id)), [userExercises]);
  const recentlyDoneIds  = useMemo(() => new Set(recentlyDone.map((e) => e.id)), [recentlyDone]);

  const scopeBaseList = useMemo(() => {
    if (filterMode === 'yours') return [...userExercises].sort(sortByName);
    if (filterMode === 'builtin') return [...EXERCISE_DATABASE].sort(sortByName);
    return allExercises;
  }, [filterMode, userExercises, allExercises]);

  const favoriteExercisesScoped = useMemo(
    () => favoriteExercises.filter((ex) => scopeBaseList.some((s) => s.id === ex.id)),
    [favoriteExercises, scopeBaseList],
  );

  const searchNorm        = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
  const activeCategoryKey = useMemo(
    () => (selectedCategory === 'All' ? '' : (LABEL_TO_CATEGORY[selectedCategory] ?? '')),
    [selectedCategory],
  );

  const applyFilters = useCallback(
    (list: Exercise[]) => {
      let out: Exercise[];
      if (searchNorm) {
        const searched = searchExercises(searchQuery.trim(), EXERCISE_DATABASE, userExercises);
        if (filterMode === 'all') out = searched;
        else if (filterMode === 'yours') out = searched.filter((ex) => userExerciseIds.has(ex.id));
        else if (filterMode === 'builtin') out = searched.filter((ex) => !userExerciseIds.has(ex.id));
        else out = searched.filter((ex) => recentlyDoneIds.has(ex.id));
      } else {
        out = list;
      }
      if (activeCategoryKey) out = out.filter((ex) => ex.category === activeCategoryKey);
      return [...out].sort(sortByName);
    },
    [activeCategoryKey, searchNorm, searchQuery, userExercises, filterMode, userExerciseIds, recentlyDoneIds],
  );

  const mainList = useMemo(
    () => applyFilters(filterMode === 'recent' ? recentlyDone : scopeBaseList),
    [filterMode, recentlyDone, scopeBaseList, applyFilters],
  );

  const filteredFavorites = useMemo(
    () => applyFilters(favoriteExercisesScoped),
    [favoriteExercisesScoped, applyFilters],
  );

  const filterOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'All' },
      { value: 'yours' as const, label: 'Your exercises' },
      { value: 'builtin' as const, label: 'Built-in' },
      ...(recentIds.length > 0 ? [{ value: 'recent' as const, label: 'Recently done' }] : []),
    ],
    [recentIds.length],
  );

  useEffect(() => {
    if (filterMode === 'recent' && recentIds.length === 0) setFilterMode('all');
  }, [filterMode, recentIds.length]);

  const handlePress = useCallback(
    (ex: Exercise) => {
      Haptics.selectionAsync();
      router.push(`/exercises/${ex.id}` as any);
    },
    [router],
  );

  const handleCreateSave = useCallback(
    async (data: CreateExerciseInput) => {
      if (!user?.id) return null;
      const created = await supabaseInsertUserExercise(user.id, data);
      if (created) {
        setUserExercises((prev) => [...prev, created].sort(sortByName));
        setShowCreateSheet(false);
      }
      return created;
    },
    [user?.id],
  );

  const handleResetAllRepRanges = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const count = await resetAllRepRangesToDefault();
    setResetAllState('saved');
    setTimeout(() => setResetAllState('idle'), 2000);
    if (count > 0) loadData();
  }, [loadData]);

  const renderSeparator = useCallback(() => <View style={styles.separator} />, []);
  const renderRow = useCallback(
    ({ item }: { item: Exercise }) => (
      <ExerciseRow
        exercise={item}
        isFav={favoriteIds.has(item.id)}
        isCustom={userExerciseIds.has(item.id)}
        onPress={handlePress}
      />
    ),
    [favoriteIds, handlePress, userExerciseIds],
  );
  const keyExtractor = useCallback((item: Exercise) => item.id, []);

  // Header section heights for FlatList top padding
  const HEADER_TOP   = insets.top + 8;
  const HEADER_TITLE = 44;
  const HEADER_SRCH  = 46 + 8; // input + margin
  const HEADER_PILLS = 38 + 4;
  const HEADER_BORD  = 5;
  const HEADER_H     = HEADER_TOP + HEADER_TITLE + HEADER_SRCH + HEADER_PILLS + HEADER_BORD;

  return (
    <View style={styles.root}>
      <FlatFitnessBackground />

      {/* ── Sticky Header ── */}
      <View style={[styles.stickyHeader, { paddingTop: HEADER_TOP }]} pointerEvents="box-none">
        <BlurView intensity={BLUR} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: GLASS_FILL }]} />

        {/* Back + Title + Create */}
        <View style={[styles.headerRow, { height: HEADER_TITLE }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
            hitSlop={12}
          >
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>exercises.</Text>
          {user?.id ? (
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setShowCreateSheet(true); }}
              style={({ pressed }) => [styles.headerActionBtn, pressed && { opacity: 0.5 }]}
              hitSlop={12}
            >
              <Ionicons name="add" size={24} color={TEXT_PRIMARY} />
            </Pressable>
          ) : (
            <View style={styles.headerActionPlaceholder} />
          )}
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

        {/* Filter pill + Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContent}
          style={[styles.pillsScroll, { height: HEADER_PILLS }]}
        >
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setShowFilterDropdown((v) => !v); }}
            style={({ pressed }) => [
              styles.filterPill,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.filterPillText} numberOfLines={1}>
              {FILTER_LABELS[filterMode]}
            </Text>
            <Ionicons name="chevron-down" size={14} color={TEXT_DIM} style={{ marginLeft: 4 }} />
          </Pressable>
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

        <View style={styles.headerBorder} />
      </View>

      {/* Filter dropdown overlay (outside header to avoid overflow clip) */}
      {showFilterDropdown && (
        <>
          <Pressable
            style={[StyleSheet.absoluteFill, { zIndex: 99 }]}
            onPress={() => setShowFilterDropdown(false)}
          />
          <View style={[styles.filterDropdown, { top: HEADER_TOP + HEADER_TITLE + HEADER_SRCH + 4 }]}>
            <BlurView intensity={BLUR} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: GLASS_FILL, borderRadius: 18 }]} />
            <View style={styles.filterDropdownContent}>
              {filterOptions.map((opt) => {
                const active = filterMode === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={({ pressed }) => [styles.filterDropdownItem, pressed && styles.filterDropdownItemPressed]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setFilterMode(opt.value);
                      setShowFilterDropdown(false);
                    }}
                  >
                    <Text style={[styles.filterDropdownItemText, active && styles.filterDropdownItemTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      )}

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
          <View>
            <Pressable
              onPress={handleResetAllRepRanges}
              style={({ pressed }) => [
                styles.resetAllRow,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.resetAllText}>
                {resetAllState === 'saved' ? 'Reset ✓' : 'Reset all rep ranges to default'}
              </Text>
            </Pressable>
            {filterMode !== 'recent' && filteredFavorites.length > 0
              ? <FavoritesSection exercises={filteredFavorites} userExerciseIds={userExerciseIds} onPress={handlePress} />
              : null}
          </View>
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

      <CreateExerciseAISheet
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onSave={handleCreateSave}
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
  headerActionBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  headerActionPlaceholder: { width: 40, height: 40 },
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

  // Filter dropdown pill
  filterPill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 13, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: GLASS_BORDER,
    backgroundColor: 'rgba(47,48,49,0.30)',
    maxWidth: 140,
  },
  filterPillText: {
    color: TEXT_PRIMARY, fontSize: 12, fontWeight: '500',
  },

  // Filter dropdown
  filterDropdown: {
    position: 'absolute', left: 16, right: 16, zIndex: 101,
    minWidth: 160, maxWidth: 220, overflow: 'hidden', borderRadius: 18,
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  filterDropdownContent: { paddingVertical: 4 },
  filterDropdownItem: {
    paddingVertical: 12, paddingHorizontal: 16,
  },
  filterDropdownItemPressed: {
    backgroundColor: 'rgba(198,198,198,0.06)',
  },
  filterDropdownItemText: {
    color: TEXT_DIM, fontSize: 14, fontWeight: '500',
  },
  filterDropdownItemTextActive: {
    color: TEXT_PRIMARY, fontWeight: '600',
  },

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
  rowMeta:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8, flexShrink: 0 },
  muscleLabel: { color: TEXT_DIM, fontSize: 11 },
  customPill: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(198,198,198,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.14)',
  },
  customPillText: { color: TEXT_DIM, fontSize: 10, fontWeight: '500', opacity: 0.75 },

  // Separator
  separator: {
    height: 1, marginHorizontal: 16,
    backgroundColor: 'rgba(198,198,198,0.10)',
  },

  // Reset all
  resetAllRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 4,
  },
  resetAllText: {
    color: TEXT_DIM,
    fontSize: 13,
    textDecorationLine: 'underline',
    fontWeight: '500',
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
