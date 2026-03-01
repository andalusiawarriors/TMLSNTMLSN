import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchFoodsProgressive, searchFoodsNextPage, preloadCommonSearches, ParsedNutrition, isTmlsnTop100, isFoundationVerified } from '../utils/foodApi';
import { addToFoodHistory } from '../utils/foodHistory';
import { getNutritionLogByDate, saveNutritionLog, saveSavedFood } from '../utils/storage';
import { getTodayDateString, generateId } from '../utils/helpers';
import { Colors, Spacing, Typography } from '../constants/theme';
import { BackButton } from '../components/BackButton';
import { Button } from '../components/Button';
import { HomeGradientBackground } from '../components/HomeGradientBackground';
import { Input } from '../components/Input';
import { UnitWheelPicker, UNIT_TO_GRAMS, type AddMealUnit } from '../components/UnitWheelPicker';
import { AddMealSheet } from '../components/AddMealSheet';
import type { Meal, MealType, NutritionLog } from '../types';

const QUICKSILVER_VERIFIED_BADGE = require('../assets/quicksilver_verified_badge.png');
const GOLD_VERIFIED_BADGE = require('../assets/gold_checkmark_badge.png');
const SEARCH_DEBOUNCE_MS = 500;
const SEARCH_PAGE_SIZE = 25;
/** Tick inline with food name — match height to name line height (fontSize 15 ~ 18px). */
const TMLSN_VERIFIED_TICK_HEIGHT = 18;
/** Tick next to add-meal overlay title (title uses titleSmall ~ half h1). */
const ADD_MEAL_VERIFIED_TICK_HEIGHT = Math.round(Typography.h1 * 0.5);
/** Quicksilver gradient for food labels on this page only (not arch/bar/home). */
const QUICKSILVER_GRADIENT = ['#6b6f74', '#a0a4a8', '#d6d8da', '#b8babc'] as const;
/** First two colors ≤5%; rest (a1a7ae, c6c6c7) equally split. */
const QUICKSILVER_GRADIENT_LOCATIONS = [0, 0.025, 0.525, 1] as const;
const QUICKSILVER_TEXT = '#9A9EA4'; // solid color so nutrition is always visible on cards
const CHAMPAGNE_TEXT = '#D4B896'; // solid gold for Top 100 nutrition
const CHAMPAGNE_GRADIENT = ['#E5D4B8', '#D4B896', '#A8895E'] as const;
/** Stripe gradients with fade at top/bottom so corners soften. */
const CHAMPAGNE_STRIPE_GRADIENT = ['rgba(229,212,184,0)', '#E5D4B8', '#D4B896', '#A8895E', 'rgba(168,137,94,0)'] as const;
const CHAMPAGNE_STRIPE_LOCATIONS = [0, 0.2, 0.5, 0.8, 1] as const;
const QUICKSILVER_STRIPE_GRADIENT = ['rgba(110,124,135,0)', '#6e7c87', '#7e8e9a', '#a1a7ae', '#c6c6c7', 'rgba(198,198,199,0)'] as const;
const QUICKSILVER_STRIPE_GRADIENT_LOCATIONS = [0, 0.18, 0.4, 0.6, 0.82, 1] as const;

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};
const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type HistoryTab = 'all' | 'saved';

export default function SearchFoodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ParsedNutrition[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('all');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<ParsedNutrition[]>([]);
  resultsRef.current = results;

  const [showAddMealOverlay, setShowAddMealOverlay] = useState(false);
  const [addMealTitleBrand, setAddMealTitleBrand] = useState('');
  const [addMealBrandName, setAddMealBrandName] = useState('');
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [addMealUnit, setAddMealUnit] = useState<AddMealUnit>('100g');
  const [addMealAmount, setAddMealAmount] = useState('1');
  const selectedFoodRef = useRef<ParsedNutrition | null>(null);
  const [selectedFood, setSelectedFood] = useState<ParsedNutrition | null>(null);

  useEffect(() => {
    preloadCommonSearches();
  }, []);

  const runSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed === lastQueryRef.current) return;
    lastQueryRef.current = trimmed;

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setResults([]);
    setLoading(true);
    setPage(1);
    setHasMore(true);
    setLoadingMore(false);

    searchFoodsProgressive(trimmed, (rawResults) => {
      if (trimmed !== lastQueryRef.current) return;
      const seenFdcId = new Set<number>();
      const seenContent = new Set<string>();
      const contentKey = (r: ParsedNutrition) =>
        `${(r.name ?? '').trim().toLowerCase()}|${(r.brand ?? '').trim().toLowerCase()}|${r.calories}|${r.protein}|${r.carbs}|${r.fat}`;
      const deduped: ParsedNutrition[] = [];
      for (const r of rawResults) {
        if (r.source === 'usda' && r.fdcId != null) {
          if (seenFdcId.has(r.fdcId)) continue;
          seenFdcId.add(r.fdcId);
        }
        const ck = contentKey(r);
        if (seenContent.has(ck)) continue;
        seenContent.add(ck);
        deduped.push(r);
      }
      setResults(deduped);
      setHasMore(deduped.length > 0);
      if (deduped.length > 0) setLoading(false);
    }, SEARCH_PAGE_SIZE, signal)
      .then(() => {
        if (trimmed === lastQueryRef.current) setLoading(false);
      })
      .catch(() => {
        if (trimmed === lastQueryRef.current) setLoading(false);
      });
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !query.trim()) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    searchFoodsNextPage(query, nextPage, (newResults) => {
      const current = resultsRef.current;
      const existingFdcIds = new Set(current.map((r) => r.fdcId).filter((id): id is number => id != null));
      const contentKey = (r: ParsedNutrition) =>
        `${(r.name ?? '').trim().toLowerCase()}|${(r.brand ?? '').trim().toLowerCase()}|${r.calories}|${r.protein}|${r.carbs}|${r.fat}`;
      const existingContent = new Set(current.map(contentKey));
      const fresh = newResults.filter((r) => {
        if (r.source === 'usda' && r.fdcId != null && existingFdcIds.has(r.fdcId)) return false;
        if (existingContent.has(contentKey(r))) return false;
        return true;
      });
      if (fresh.length > 0) {
        setResults((prev) => [...prev, ...fresh]);
      }
      if (newResults.length === 0) setHasMore(false);
      setPage(nextPage);
      setLoadingMore(false);
    }, SEARCH_PAGE_SIZE).catch(() => {
      setLoadingMore(false);
    });
  }, [loadingMore, hasMore, query, page]);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const q = text.trim();
    if (q.length >= 3) {
      timeoutRef.current = setTimeout(() => runSearch(text), SEARCH_DEBOUNCE_MS);
    } else {
      setResults([]);
    }
  };

  const handleSelect = (food: ParsedNutrition) => {
    addToFoodHistory(food);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectedFoodRef.current = food;
    setSelectedFood(food);
    setMealName(food.name);
    const top100 = isTmlsnTop100(food);
    const isTmlsnVerified = isFoundationVerified(food);
    setAddMealTitleBrand(top100 ? 'TMLSN TOP 100' : isTmlsnVerified ? 'TMLSN VERIFIED' : (food.brand ?? ''));
    setAddMealBrandName(food.brand ?? '');
    setAddMealUnit('100g');
    setAddMealAmount('1');
    const factor = UNIT_TO_GRAMS['100g'] / 100;
    setCalories(String(Math.round((food.calories || 0) * factor)));
    setProtein(String(Math.round((food.protein || 0) * factor)));
    setCarbs(String(Math.round((food.carbs || 0) * factor)));
    setFat(String(Math.round((food.fat || 0) * factor)));
    setShowAddMealOverlay(true);
  };

  useEffect(() => {
    const food = selectedFoodRef.current;
    if (!food) return;
    const amt = parseFloat(addMealAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    const grams = amt * UNIT_TO_GRAMS[addMealUnit];
    const scale = grams / 100;
    setCalories(String(Math.round((food.calories || 0) * scale)));
    setProtein(String(Math.round((food.protein || 0) * scale)));
    setCarbs(String(Math.round((food.carbs || 0) * scale)));
    setFat(String(Math.round((food.fat || 0) * scale)));
  }, [addMealUnit, addMealAmount]);

  const closeAddMealOverlay = () => {
    selectedFoodRef.current = null;
    setSelectedFood(null);
    setAddMealTitleBrand(''); setAddMealBrandName('');
    setAddMealUnit('100g'); setAddMealAmount('1');
    setShowAddMealOverlay(false);
  };

  const handleAddMealOverlay = async () => {
    if (!mealName.trim() || !calories.trim()) {
      Alert.alert('Error', 'Please enter at least meal name and calories');
      return;
    }
    const today = getTodayDateString();
    let todayLog = await getNutritionLogByDate(today);
    if (!todayLog) {
      todayLog = {
        id: generateId(),
        date: today,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        water: 0,
        meals: [],
      };
    }
    const newMeal: Meal = {
      id: generateId(),
      name: mealName.trim(),
      mealType,
      time: new Date().toISOString(),
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
    };
    const updatedLog: NutritionLog = {
      ...todayLog,
      calories: todayLog.calories + newMeal.calories,
      protein: todayLog.protein + newMeal.protein,
      carbs: todayLog.carbs + newMeal.carbs,
      fat: todayLog.fat + newMeal.fat,
      meals: [...todayLog.meals, newMeal],
    };
    await saveNutritionLog(updatedLog);
    await saveSavedFood({
      name: mealName.trim(),
      calories: newMeal.calories,
      protein: newMeal.protein,
      carbs: newMeal.carbs,
      fat: newMeal.fat,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    selectedFoodRef.current = null;
    setSelectedFood(null);
    setAddMealTitleBrand(''); setAddMealBrandName('');
    setMealName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setAddMealUnit('100g'); setAddMealAmount('1');
    setMealType('breakfast');
    setShowAddMealOverlay(false);
  };

  const TABS: { key: HistoryTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'saved', label: 'Saved' },
  ];

  const hasQuery = query.trim().length > 0;
  const listData = hasQuery ? results : [];

  const listHeader = (
    <>
      {/* Search bar — full width, magnifying glass, placeholder, clear X (FAB popup card style) */}
      <View style={styles.searchRow}>
        <View style={[styles.searchInputWrap, styles.cardBorderWrap]}>
          <LinearGradient colors={Colors.tabBarBorder} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderRadius: FAB_CARD_BORDER_RADIUS }]} />
          <View style={[styles.cardShell, styles.searchInputShell]}>
            <Ionicons name="search" size={20} color={Colors.primaryLight} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Food"
              placeholderTextColor="#888"
              value={query}
              onChangeText={handleChangeText}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => { setQuery(''); setResults([]); setSearchError(null); setPage(1); setHasMore(true); }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color={Colors.primaryLight} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* History tabs */}
      <View style={styles.tabsRow}>
        {TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setHistoryTab(key)}
            style={({ pressed }) => [styles.tab, pressed && { opacity: 0.8 }]}
          >
            <Text style={[styles.tabText, historyTab === key && styles.tabTextActive]}>
              {label}
            </Text>
            {historyTab === key && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      {/* Action cards — Barcode scan, Meal scan, Scan label (FAB popup card style) */}
      <View style={styles.actionRow}>
        <Pressable onPress={() => router.push({ pathname: '/scan-food-camera', params: { mode: 'barcode' } })} style={({ pressed }) => [styles.actionCardWrap, pressed && { opacity: 0.85 }]}>
          <View style={styles.actionCardBorderWrap}>
            <LinearGradient colors={Colors.tabBarBorder} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderRadius: ACTION_CARD_RADIUS }]} />
            <View style={[styles.cardShell, styles.actionCardShell]}>
              <Ionicons name="barcode-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionCardText}>barcode scan</Text>
            </View>
          </View>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/scan-food-camera', params: { mode: 'ai' } })} style={({ pressed }) => [styles.actionCardWrap, pressed && { opacity: 0.85 }]}>
          <View style={styles.actionCardBorderWrap}>
            <LinearGradient colors={Colors.tabBarBorder} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderRadius: ACTION_CARD_RADIUS }]} />
            <View style={[styles.cardShell, styles.actionCardShell]}>
              <Ionicons name="restaurant-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionCardText}>meal scan</Text>
            </View>
          </View>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/scan-food-camera', params: { mode: 'label' } })} style={({ pressed }) => [styles.actionCardWrap, pressed && { opacity: 0.85 }]}>
          <View style={styles.actionCardBorderWrap}>
            <LinearGradient colors={Colors.tabBarBorder} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderRadius: ACTION_CARD_RADIUS }]} />
            <View style={[styles.cardShell, styles.actionCardShell]}>
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionCardText}>label scan</Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* History section — placeholder cards when no query, loading/empty when searching */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>History</Text>
          <TouchableOpacity style={styles.mostFrequentButton}>
            <Text style={styles.mostFrequentText}>Most Frequent</Text>
            <Ionicons name="filter" size={16} color={Colors.primaryLight} />
          </TouchableOpacity>
        </View>
        {loading && listData.length === 0 && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.primaryLight} />
          </View>
        )}
        {!loading && searchError && (
          <Text style={styles.emptyText}>{searchError}</Text>
        )}
        {!hasQuery && (
          <View style={styles.historyCards}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.historyCardBorderWrap}>
                <LinearGradient colors={Colors.tabBarBorder} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderRadius: FAB_CARD_BORDER_RADIUS }]} />
                <View style={[styles.cardShell, styles.historyCardShell]}>
                  <View style={styles.historyCardLeft} />
                  <TouchableOpacity onPress={() => {}} activeOpacity={0.7} style={styles.historyCardAddButtonWrap}>
                    <View style={styles.addButtonBorderWrap}>
                      <LinearGradient colors={Colors.tabBarBorder} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderRadius: ADD_BUTTON_RADIUS }]} />
                      <View style={[styles.addButtonShell, { backgroundColor: CARD_FILL }]}>
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );

  return (
    <View style={styles.wrapper}>
      <HomeGradientBackground />
      <View style={styles.container} pointerEvents="box-none">
      <BackButton />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      <FlatList
        data={listData}
        keyExtractor={(_, i) => String(i)}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={listHeader}
        onEndReached={query.trim() && results.length > 0 && hasMore && !loadingMore ? loadMore : undefined}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => {
          const hasBrand = item.brand && item.brand.trim() !== '';
          const top100 = isTmlsnTop100(item);
          const isVerified = isFoundationVerified(item);
          const showVerifiedStripe = !hasBrand && (top100 || isVerified);
          return (
          <TouchableOpacity
            style={styles.historyCardBorderWrap}
            onPress={() => handleSelect(item)}
            activeOpacity={0.7}
          >
            <LinearGradient colors={Colors.tabBarBorder} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderRadius: FAB_CARD_BORDER_RADIUS }]} />
            {showVerifiedStripe && (
              <LinearGradient
                colors={top100 ? CHAMPAGNE_STRIPE_GRADIENT : QUICKSILVER_STRIPE_GRADIENT}
                locations={top100 ? CHAMPAGNE_STRIPE_LOCATIONS : QUICKSILVER_STRIPE_GRADIENT_LOCATIONS}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.verifiedCardLeftStripe}
              />
            )}
            <View style={[styles.cardShell, styles.historyCardShell]}>
            <View style={styles.historyCardLeft}>
              {(() => {
                const top100 = isTmlsnTop100(item);
                const isVerified = isFoundationVerified(item);
                const brandLabel = item.brand && item.brand.trim() !== '' ? item.brand : '';
                if (brandLabel) {
                  return (
                    <>
                      <Text style={[styles.resultBrand, item.source === 'off' && { color: '#FFFFFF' }]} numberOfLines={1} ellipsizeMode="tail">
                        {brandLabel}
                      </Text>
                      {top100 ? (
                        <View style={[styles.verifiedNameRow, { marginTop: 2 }]}>
                          <MaskedView
                            style={styles.verifiedNameMaskWrap}
                            maskElement={
                              <Text style={[styles.resultName, styles.verifiedNameText, { backgroundColor: 'transparent' }]} numberOfLines={1} ellipsizeMode="tail">
                                {item.name}
                              </Text>
                            }
                          >
                            <LinearGradient colors={CHAMPAGNE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                              <Text style={[styles.resultName, styles.verifiedNameText, { opacity: 0 }]} numberOfLines={1} ellipsizeMode="tail">
                                {item.name}
                              </Text>
                            </LinearGradient>
                          </MaskedView>
                          <Image
                            source={GOLD_VERIFIED_BADGE}
                            style={{ width: TMLSN_VERIFIED_TICK_HEIGHT, height: TMLSN_VERIFIED_TICK_HEIGHT, marginLeft: 2, flexShrink: 0 }}
                            resizeMode="contain"
                          />
                        </View>
                      ) : isVerified ? (
                        <View style={[styles.verifiedNameRow, { marginTop: 2 }]}>
                          <MaskedView
                            style={styles.verifiedNameMaskWrap}
                            maskElement={
                              <Text style={[styles.resultName, styles.verifiedNameText, { backgroundColor: 'transparent' }]} numberOfLines={1} ellipsizeMode="tail">
                                {item.name}
                              </Text>
                            }
                          >
                            <LinearGradient colors={QUICKSILVER_GRADIENT} locations={QUICKSILVER_GRADIENT_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                              <Text style={[styles.resultName, styles.verifiedNameText, { opacity: 0 }]} numberOfLines={1} ellipsizeMode="tail">
                                {item.name}
                              </Text>
                            </LinearGradient>
                          </MaskedView>
                          <Image
                            source={QUICKSILVER_VERIFIED_BADGE}
                            style={{ width: TMLSN_VERIFIED_TICK_HEIGHT, height: TMLSN_VERIFIED_TICK_HEIGHT, marginLeft: 2 }}
                            resizeMode="contain"
                          />
                        </View>
                      ) : (
                        <Text style={[styles.resultName, item.source === 'off' && { color: '#FFFFFF' }, { marginTop: 2 }]} numberOfLines={1} ellipsizeMode="tail">
                          {item.name}
                        </Text>
                      )}
                    </>
                  );
                }
                if (top100) {
                  return (
                    <View style={styles.verifiedNameRow}>
                      <MaskedView
                        style={styles.verifiedNameMaskWrap}
                        maskElement={
                          <Text style={[styles.resultName, styles.verifiedNameText, { backgroundColor: 'transparent' }]} numberOfLines={1} ellipsizeMode="tail">
                            {item.name}
                          </Text>
                        }
                      >
                        <LinearGradient colors={CHAMPAGNE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                          <Text style={[styles.resultName, styles.verifiedNameText, { opacity: 0 }]} numberOfLines={1} ellipsizeMode="tail">
                            {item.name}
                          </Text>
                        </LinearGradient>
                      </MaskedView>
                      <Image
                        source={GOLD_VERIFIED_BADGE}
                        style={{ width: TMLSN_VERIFIED_TICK_HEIGHT, height: TMLSN_VERIFIED_TICK_HEIGHT, marginLeft: 2 }}
                        resizeMode="contain"
                      />
                    </View>
                  );
                }
                if (isVerified) {
                  return (
                    <View style={styles.verifiedNameRow}>
                      <MaskedView
                        style={styles.verifiedNameMaskWrap}
                        maskElement={
                          <Text style={[styles.resultName, styles.verifiedNameText, { backgroundColor: 'transparent' }]} numberOfLines={1} ellipsizeMode="tail">
                            {item.name}
                          </Text>
                        }
                      >
                        <LinearGradient colors={QUICKSILVER_GRADIENT} locations={QUICKSILVER_GRADIENT_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                          <Text style={[styles.resultName, styles.verifiedNameText, { opacity: 0 }]} numberOfLines={1} ellipsizeMode="tail">
                            {item.name}
                          </Text>
                        </LinearGradient>
                      </MaskedView>
                      <Image
                        source={QUICKSILVER_VERIFIED_BADGE}
                        style={{ width: TMLSN_VERIFIED_TICK_HEIGHT, height: TMLSN_VERIFIED_TICK_HEIGHT, marginLeft: 2 }}
                        resizeMode="contain"
                      />
                    </View>
                  );
                }
                return null;
              })()}
              {!(item.brand && item.brand.trim() !== '') && !isTmlsnTop100(item) && !isFoundationVerified(item) ? (
                <Text style={[styles.resultName, item.source === 'off' && { color: '#FFFFFF' }]} numberOfLines={1} ellipsizeMode="tail">
                  {item.name}
                </Text>
              ) : null}
              <View style={styles.macrosRow}>
                <Text style={styles.macrosPrefix}>per 100{item.unit ?? 'g'}</Text>
                {isTmlsnTop100(item) ? (
                  <Text style={{ fontSize: 12, fontWeight: '500', color: CHAMPAGNE_TEXT }}>
                    {item.calories} cal · {item.protein}g P · {item.carbs}g C · {item.fat}g F
                  </Text>
                ) : isFoundationVerified(item) ? (
                  <Text style={{ fontSize: 12, fontWeight: '500', color: QUICKSILVER_TEXT }}>
                    {item.calories} cal · {item.protein}g P · {item.carbs}g C · {item.fat}g F
                  </Text>
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: '500', color: '#FFFFFF' }}>
                    {item.calories} cal · {item.protein}g P · {item.carbs}g C · {item.fat}g F
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={() => handleSelect(item)} activeOpacity={0.7} style={styles.historyCardAddButtonWrap}>
              <View style={styles.addButtonBorderWrap}>
                <LinearGradient colors={Colors.tabBarBorder} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderRadius: ADD_BUTTON_RADIUS }]} />
                <View style={[styles.addButtonShell, { backgroundColor: CARD_FILL }]}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>
            </View>
          </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          hasQuery && !loading && !searchError ? (
            <Text style={styles.emptyText}>No results found</Text>
          ) : null
        }
        ListFooterComponent={
          hasQuery && results.length > 0 && !loading ? (
            loadingMore ? (
              <ActivityIndicator color="#ffffff" style={{ paddingVertical: 24 }} />
            ) : hasMore ? (
              <TouchableOpacity
                onPress={loadMore}
                style={{ paddingVertical: 24, alignItems: 'center' }}
                activeOpacity={0.6}
              >
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>
                  Show more results
                </Text>
              </TouchableOpacity>
            ) : null
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
      </KeyboardAvoidingView>

      {/* Add Meal sheet — half-screen bottom sheet (same as nutrition flow) */}
      <AddMealSheet
        visible={showAddMealOverlay}
        onClose={closeAddMealOverlay}
        mealName={mealName}
        addMealTitleBrand={addMealTitleBrand}
        addMealBrandName={addMealBrandName}
        mealType={mealType}
        setMealType={setMealType}
        calories={calories}
        protein={protein}
        carbs={carbs}
        fat={fat}
        setCalories={setCalories}
        setProtein={setProtein}
        setCarbs={setCarbs}
        setFat={setFat}
        addMealUnit={addMealUnit}
        setAddMealUnit={setAddMealUnit}
        addMealAmount={addMealAmount}
        setAddMealAmount={setAddMealAmount}
        onSubmit={handleAddMealOverlay}
        hasSelectedFood={true}
        goldBadge={GOLD_VERIFIED_BADGE}
        quicksilverBadge={QUICKSILVER_VERIFIED_BADGE}
        champagneGradient={CHAMPAGNE_GRADIENT}
        quicksilverGradient={QUICKSILVER_GRADIENT}
        verifiedTickSize={ADD_MEAL_VERIFIED_TICK_HEIGHT}
        selectedFood={selectedFood}
      />
      </View>
    </View>
  );
}

const BACK_BUTTON_TOP = 54;
const BACK_BUTTON_SIZE = 40;
const SEARCH_BAR_TOP = BACK_BUTTON_TOP + BACK_BUTTON_SIZE + Spacing.sm;
const SEARCH_BAR_HEIGHT = 44;
const ACTION_CARD_HEIGHT = 64;
const ACTION_CARD_RADIUS = 12;
const CARD_HEIGHT = 88;
const CARD_BORDER_INSET = 1;
/** Same gradient + fill as FAB popup pills (tabBarBorder + tabBarFill). */
const FAB_CARD_BORDER_RADIUS = 12;
const ADD_BUTTON_SIZE = 36;
const ADD_BUTTON_RADIUS = ADD_BUTTON_SIZE / 2;
/** Card fill: 10% more opaque than tabBarFill[1] (darker = less transparent). */
const CARD_FILL = '#292A2B';

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SEARCH_BAR_TOP,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  searchRow: {
    marginBottom: Spacing.sm,
  },
  cardBorderWrap: {
    overflow: 'hidden',
    borderRadius: FAB_CARD_BORDER_RADIUS,
  },
  cardShell: {
    position: 'absolute',
    top: CARD_BORDER_INSET,
    left: CARD_BORDER_INSET,
    right: CARD_BORDER_INSET,
    bottom: CARD_BORDER_INSET,
    borderRadius: FAB_CARD_BORDER_RADIUS - CARD_BORDER_INSET,
    backgroundColor: CARD_FILL,
  },
  searchInputWrap: {
    height: SEARCH_BAR_HEIGHT,
  },
  searchInputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.white,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.11,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.lg,
  },
  tab: {
    paddingVertical: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.primaryLight + '99',
    letterSpacing: -0.11,
  },
  tabTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.white,
    borderRadius: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  actionCardWrap: {
    flex: 1,
  },
  actionCardBorderWrap: {
    overflow: 'hidden',
    borderRadius: ACTION_CARD_RADIUS,
    height: ACTION_CARD_HEIGHT,
  },
  actionCardShell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionCardText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: -0.11,
  },
  historySection: {
    marginTop: Spacing.xs,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.white,
    letterSpacing: -0.11,
  },
  mostFrequentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mostFrequentText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primaryLight,
    letterSpacing: -0.11,
  },
  historyCards: {
    gap: Spacing.sm,
  },
  historyCardBorderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: CARD_HEIGHT,
    borderRadius: FAB_CARD_BORDER_RADIUS,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  verifiedCardLeftStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    borderTopLeftRadius: FAB_CARD_BORDER_RADIUS,
    borderBottomLeftRadius: FAB_CARD_BORDER_RADIUS,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  historyCardShell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  historyCardLeft: {
    flex: 1,
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  historyCardAddButtonWrap: {
    width: ADD_BUTTON_SIZE,
    height: ADD_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonBorderWrap: {
    width: ADD_BUTTON_SIZE,
    height: ADD_BUTTON_SIZE,
    borderRadius: ADD_BUTTON_RADIUS,
    overflow: 'hidden',
  },
  addButtonShell: {
    position: 'absolute',
    top: CARD_BORDER_INSET,
    left: CARD_BORDER_INSET,
    right: CARD_BORDER_INSET,
    bottom: CARD_BORDER_INSET,
    borderRadius: ADD_BUTTON_RADIUS - CARD_BORDER_INSET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBrand: {
    fontSize: 11,
    color: Colors.primaryLight,
    fontWeight: '400',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  verifiedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 2,
    flexShrink: 1,
  },
  verifiedNameMaskWrap: {
    flexShrink: 1,
    maxWidth: '100%',
  },
  verifiedNameText: {
    marginBottom: 0,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -0.11,
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  macrosPrefix: {
    fontSize: 10,
    color: Colors.primaryLight,
  },
  macrosPrefixWrap: {
    alignSelf: 'flex-start',
  },
  macrosGradientWrap: {
    alignSelf: 'flex-start',
  },
  macrosValues: {
    fontSize: 12,
    color: Colors.accentChampagne,
    fontWeight: '500',
  },
  loadingRow: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
