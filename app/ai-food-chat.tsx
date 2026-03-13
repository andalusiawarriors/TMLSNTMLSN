/**
 * AI Food Chat — Full-screen chat.
 * User types a meal (e.g. "200g chicken breast, 200g broccoli, 20ml olive oil");
 * we parse, run parallel search, show inline results; tap → AddMealSheet → arch updates.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Animated as RNAnimated,
  Easing,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CaretLeft, CaretRight, Plus, Microphone } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Colors } from '../constants/theme';
import { CalorieArch } from '../components/CalorieArch';
import { CalendarOverlay } from '../components/CalendarOverlay';
import { NotebookDotGrid } from '../components/NotebookDotGrid';
import { useAnimatedRingNumber } from '../hooks/useAnimatedRingNumber';
import { useAnimatedProgress } from '../hooks/useAnimatedProgress';
import { AddMealSheet } from '../components/AddMealSheet';
import { FoodResultRow } from '../components/FoodResultRow';
import {
  getNutritionLogByDate,
  getNutritionLogs,
  getUserSettings,
  saveNutritionLog,
  saveSavedFood,
} from '../utils/storage';
import {
  getListFoodSearchTokens,
  extractQuantityAndFood,
  searchFoods,
  isTmlsnTop100,
  isFoundationVerified,
  type ParsedNutrition,
} from '../utils/foodApi';
import { generateId, getTodayDateString, toDateString } from '../utils/helpers';
import { emitNutritionLogUpdated } from '../utils/fabBridge';
import { NutritionLog, Meal, MealType, UserSettings } from '../types';
import { DEFAULT_GOALS } from '../constants/storageDefaults';
import { resolveGrams } from '../components/UnitWheelPicker';
import type { AddMealUnit } from '../utils/unitGrams';

const QUICKSILVER_VERIFIED_BADGE = require('../assets/quicksilver_verified_badge.png');
const GOLD_VERIFIED_BADGE = require('../assets/gold_checkmark_badge.png');
const CHAMPAGNE_GRADIENT = ['#E5D4B8', '#D4B896', '#A8895E'] as const;
const QUICKSILVER_GRADIENT = ['#6b6f74', '#a0a4a8', '#d6d8da', '#b8babc'] as const;
const CHAMPAGNE = '#D4B896';
const MUTED = 'rgba(198,198,198,0.55)';
const ADD_MEAL_VERIFIED_TICK_SIZE = 18;
/** Toggle for A/B: 'white' or 'black' dot grid variant */
const DOT_GRID_VARIANT = 'white' as const;

/** Ring 1: radial gradient outside-in, extends screen border to border (incl. top padding area) */
function Ring1Gradient() {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');
  const topExtension = Math.max(insets.top, 120);
  const fullHeight = height + topExtension;
  return (
    <View style={[StyleSheet.absoluteFill, { top: -topExtension, height: fullHeight, zIndex: 0 }]} pointerEvents="none">
      <Svg width={width} height={fullHeight} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="ring1Grad" cx="50%" cy="50%" rx="55%" ry="55%" fx="50%" fy="50%">
            <Stop offset="0" stopColor="#1a1a1a" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#1a1a1a" stopOpacity="0.95" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={fullHeight} fill="url(#ring1Grad)" />
      </Svg>
    </View>
  );
}

const ADD_MEAL_UNITS_SET = new Set<string>([
  'tbsp', 'tsp', 'cup', '2cup', 'halfCup', 'quarterCup', '100g', '1g', 'ml', '100ml', 'oz',
]);

function mapRawUnitToAddMealUnit(rawUnit: string | null, amount: string): { unit: string; amount: string } {
  if (!rawUnit) return { unit: '1g', amount: amount || '100' };
  const u = rawUnit.toLowerCase();
  if (u === 'g' || u === 'gram' || u === 'grams') return { unit: '1g', amount: amount || '100' };
  if (u === 'ml' || u === 'milliliter' || u === 'milliliters') return { unit: 'ml', amount: amount || '100' };
  if (ADD_MEAL_UNITS_SET.has(u)) return { unit: u, amount: amount || '1' };
  return { unit: '1g', amount: amount || '100' };
}

type IngredientBlock = {
  label: string;
  amount: string;
  rawUnit: string | null;
  foodName: string;
  results: ParsedNutrition[];
  confirmed?: boolean;
  confirmedCal?: number;
  confirmedName?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  ingredientBlocks?: IngredientBlock[];
};

const INPUT_BOX_WIDTH = 370;
const INPUT_BOX_HEIGHT = 93;
const INPUT_BOX_RADIUS = 28;
const INPUT_BOX_BOTTOM_GAP = 31;
/** Button: 33×33 circle, 7px horizontal and 10px vertical from chatbot borders, transparent fill, 1px stroke #C6C6C6. */
const SIDE_BUTTON_SIZE = 33;
const SIDE_BUTTON_INSET_H = 7;
const SIDE_BUTTON_INSET_V = 10;
const SIDE_BUTTON_ICON_SIZE = 17;

export type AiFoodChatOverlayProps = {
  overlayMode?: boolean;
  onClose?: () => void;
  backButtonTopOffset?: number;
};

const AI_CHAT_CONTENT_FADE_MS = 220;

export default function AiFoodChatScreen(props?: AiFoodChatOverlayProps) {
  const { overlayMode = false, onClose, backButtonTopOffset } = props ?? {};
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const contentOpacity = useRef(new RNAnimated.Value(overlayMode ? 0 : 1)).current;
  const handleBackOrClose = overlayMode ? (onClose ?? (() => {})) : () => router.back();

  useEffect(() => {
    if (!overlayMode) return;
    RNAnimated.timing(contentOpacity, {
      toValue: 1,
      duration: AI_CHAT_CONTENT_FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [overlayMode, contentOpacity]);
  const [viewingDate, setViewingDate] = useState<string>(() => getTodayDateString());
  const viewingDateAsDate = useMemo(() => new Date(viewingDate + 'T12:00:00'), [viewingDate]);
  const prevDay = useMemo(() => {
    const d = new Date(viewingDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d;
  }, [viewingDate]);
  const nextDay = useMemo(() => {
    const d = new Date(viewingDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d;
  }, [viewingDate]);
  const handleSelectDate = useCallback((dateString: string) => {
    setViewingDate(dateString);
  }, []);
  const [showCalendar, setShowCalendar] = useState(false);
  const [todayLog, setTodayLog] = useState<NutritionLog | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Repeat last: show meal-type pills, then preview + Log it
  const [showRepeatPills, setShowRepeatPills] = useState(false);
  const [repeatPreview, setRepeatPreview] = useState<{
    mealType: MealType;
    date: string;
    meals: Meal[];
    totalCal: number;
  } | null>(null);
  const [repeatLoading, setRepeatLoading] = useState(false);

  // AddMealSheet state (for when user taps a result)
  const [sheetVisible, setSheetVisible] = useState(false);
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [mealName, setMealName] = useState('');
  const [addMealTitleBrand, setAddMealTitleBrand] = useState('');
  const [addMealBrandName, setAddMealBrandName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [addMealUnit, setAddMealUnit] = useState<string>('1g');
  const [addMealAmount, setAddMealAmount] = useState('');
  const [hasAddMealSelectedFood, setHasAddMealSelectedFood] = useState(false);
  const [selectedFoodForSheet, setSelectedFoodForSheet] = useState<ParsedNutrition | null>(null);
  const selectedFoodRef = useRef<ParsedNutrition | null>(null);
  const pendingConfirmRef = useRef<{ msgId: string; blockIndex: number } | null>(null);

  const goals = settings?.dailyGoals ?? DEFAULT_GOALS;
  const log = todayLog && todayLog.date === viewingDate ? todayLog : {
    calories: 0, protein: 0, carbs: 0, fat: 0, meals: [] as Meal[],
  };
  const hasLoggedFood = log.meals.length > 0;
  const _calRatio = goals.calories > 0 ? log.calories / goals.calories : 0;
  const _protRatio = goals.protein > 0 ? log.protein / goals.protein : 0;
  const _carbRatio = goals.carbs > 0 ? log.carbs / goals.carbs : 0;
  const _fatRatio = goals.fat > 0 ? log.fat / goals.fat : 0;

  const animatedCal = useAnimatedRingNumber(log.calories, 380, { haptic: 'none' });
  const animatedProtein = useAnimatedRingNumber(log.protein, 380, { haptic: 'none' });
  const animatedCarbs = useAnimatedRingNumber(log.carbs, 380, { haptic: 'none' });
  const animatedFat = useAnimatedRingNumber(log.fat, 380, { haptic: 'none' });
  const animCalProgress = useAnimatedProgress(Math.min(_calRatio, 3), _calRatio > 1 ? 800 : 600);
  const animProteinProgress = useAnimatedProgress(Math.min(_protRatio, 3), _protRatio > 1 ? 800 : 600);
  const animCarbsProgress = useAnimatedProgress(Math.min(_carbRatio, 3), _carbRatio > 1 ? 800 : 600);
  const animFatProgress = useAnimatedProgress(Math.min(_fatRatio, 3), _fatRatio > 1 ? 800 : 600);
  const heroData = {
    calories: { current: log.calories, goal: goals.calories },
    protein: { current: log.protein, goal: goals.protein },
    carbs: { current: log.carbs, goal: goals.carbs },
    fat: { current: log.fat, goal: goals.fat },
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [userSettings, nutritionLog] = await Promise.all([
        getUserSettings(),
        getNutritionLogByDate(viewingDate),
      ]);
      if (!cancelled) {
        setSettings(userSettings);
        if (nutritionLog) setTodayLog(nutritionLog);
        else {
          setTodayLog({
            id: generateId(),
            date: viewingDate,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            water: 0,
            meals: [],
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [viewingDate]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [messages.length]);

  const fillFormFromFood = useCallback((data: ParsedNutrition, amount: string, unit: string) => {
    selectedFoodRef.current = data;
    setSelectedFoodForSheet(data);
    setHasAddMealSelectedFood(true);
    setAddMealUnit(unit);
    setAddMealAmount(amount);
    setMealName(data.name);
    const top100 = isTmlsnTop100(data);
    const isVerified = isFoundationVerified(data);
    setAddMealTitleBrand(top100 ? 'TMLSN TOP 100' : isVerified ? 'TMLSN VERIFIED' : (data.brand || ''));
    setAddMealBrandName(data.brand || '');
    const grams = parseFloat(amount) * resolveGrams(unit as AddMealUnit, data.portions);
    const scale = grams / 100;
    setCalories(String(Math.round((data.calories || 0) * scale)));
    setProtein(String(Math.round((data.protein || 0) * scale)));
    setCarbs(String(Math.round((data.carbs || 0) * scale)));
    setFat(String(Math.round((data.fat || 0) * scale)));
  }, []);

  const handleAddMeal = useCallback(async () => {
    if (!mealName || !calories) return;

    const foodForVerification = selectedFoodRef.current ?? selectedFoodForSheet;
    const newMeal: Meal = {
      id: generateId(),
      name: mealName,
      mealType,
      time: new Date().toISOString(),
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      ...(addMealAmount.trim() && { amount: addMealAmount.trim() }),
      ...(addMealUnit && { unit: addMealUnit }),
      ...(foodForVerification && {
        fdcId: foodForVerification.fdcId,
        source: foodForVerification.source,
        dataType: foodForVerification.dataType,
        brand: foodForVerification.brand ?? '',
      }),
    };

    const currentLog = todayLog && todayLog.date === viewingDate ? todayLog : {
      id: generateId(),
      date: viewingDate,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      water: 0,
      meals: [] as Meal[],
    };

    const updatedLog: NutritionLog = {
      ...currentLog,
      calories: currentLog.calories + newMeal.calories,
      protein: currentLog.protein + newMeal.protein,
      carbs: currentLog.carbs + newMeal.carbs,
      fat: currentLog.fat + newMeal.fat,
      meals: [...currentLog.meals, newMeal],
    };

    await saveNutritionLog(updatedLog);
    setTodayLog(updatedLog);
    emitNutritionLogUpdated();
    await saveSavedFood({
      name: mealName,
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const pending = pendingConfirmRef.current;
    if (pending) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== pending.msgId || !m.ingredientBlocks) return m;
          const blocks = [...m.ingredientBlocks];
          if (blocks[pending.blockIndex]) {
            blocks[pending.blockIndex] = {
              ...blocks[pending.blockIndex],
              confirmed: true,
              confirmedCal: newMeal.calories,
              confirmedName: mealName,
            };
          }
          const allConfirmed = blocks.every((b) => b.confirmed);
          const totalCal = blocks.reduce((s, b) => s + (b.confirmedCal ?? 0), 0);
          return {
            ...m,
            ingredientBlocks: blocks,
            text: allConfirmed ? `${blocks.length} items logged — ${totalCal} cal total. Anything else?` : m.text,
          };
        })
      );
      pendingConfirmRef.current = null;
    }

    setSheetVisible(false);
    setMealName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setAddMealUnit('1g');
    setAddMealAmount('');
    setHasAddMealSelectedFood(false);
    setSelectedFoodForSheet(null);
    selectedFoodRef.current = null;
  }, [
    mealName,
    calories,
    protein,
    carbs,
    fat,
    mealType,
    addMealAmount,
    addMealUnit,
    selectedFoodForSheet,
    todayLog,
    viewingDate,
  ]);

  const handleSend = useCallback(async () => {
    const line = inputText.trim();
    if (!line || isSearching) return;
    setInputText('');

    const userMsg: ChatMessage = { id: generateId(), role: 'user', text: line };
    setMessages((prev) => [...prev, userMsg]);
    setIsSearching(true);

    let tokens = getListFoodSearchTokens(line);
    if (tokens.length === 0) tokens = [line];

    const blocks: IngredientBlock[] = tokens.map((t) => {
      const extracted = extractQuantityAndFood(t);
      const { unit, amount } = mapRawUnitToAddMealUnit(extracted.rawUnit, extracted.amount);
      const label = extracted.rawUnit
        ? `${extracted.foodName} — ${extracted.amount}${extracted.rawUnit}`
        : `${extracted.foodName} — ${extracted.amount}`;
      return {
        label,
        amount: extracted.amount,
        rawUnit: extracted.rawUnit,
        foodName: extracted.foodName,
        results: [],
      };
    });

    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        text: `Searching ${blocks.length} item${blocks.length === 1 ? '' : 's'}...`,
        ingredientBlocks: blocks,
      },
    ]);

    const searchQueries = blocks.map((b) => b.foodName);
    const resultsPerQuery = await Promise.all(searchQueries.map((q) => searchFoods(q)));

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== assistantId) return m;
        const newBlocks = m.ingredientBlocks!.map((blk, i) => ({
          ...blk,
          results: resultsPerQuery[i] ?? [],
        }));
        return { ...m, ingredientBlocks: newBlocks, text: undefined };
      })
    );
    setIsSearching(false);
  }, [inputText, isSearching]);

  const handleResultPress = useCallback(
    (msgId: string, blockIndex: number, item: ParsedNutrition) => {
      const msg = messages.find((m) => m.id === msgId);
      const block = msg?.ingredientBlocks?.[blockIndex];
      if (!block) return;
      const { unit, amount } = mapRawUnitToAddMealUnit(block.rawUnit, block.amount);
      fillFormFromFood(item, amount, unit);
      pendingConfirmRef.current = { msgId, blockIndex };
      setSheetVisible(true);
    },
    [messages, fillFormFromFood]
  );

  const handleCloseSheet = useCallback(() => {
    setSheetVisible(false);
    pendingConfirmRef.current = null;
    setMealName('');
    setAddMealTitleBrand('');
    setAddMealBrandName('');
    setHasAddMealSelectedFood(false);
    setSelectedFoodForSheet(null);
    selectedFoodRef.current = null;
  }, []);

  const loadRepeatPreview = useCallback(async (type: MealType) => {
    setRepeatLoading(true);
    setRepeatPreview(null);
    try {
      const logs = await getNutritionLogs();
      const sorted = [...logs].sort((a, b) => (b.date > a.date ? 1 : -1));
      const today = getTodayDateString();
      for (const log of sorted) {
        if (log.date === today) continue;
        const mealsOfType = log.meals.filter((m) => m.mealType === type);
        if (mealsOfType.length === 0) continue;
        const totalCal = mealsOfType.reduce((s, m) => s + m.calories, 0);
        setRepeatPreview({
          mealType: type,
          date: log.date,
          meals: mealsOfType,
          totalCal,
        });
        return;
      }
    } finally {
      setRepeatLoading(false);
    }
  }, []);

  const handleRepeatLogIt = useCallback(async () => {
    const preview = repeatPreview;
    if (!preview) return;

    const currentLog = todayLog && todayLog.date === viewingDate ? todayLog : {
      id: generateId(),
      date: viewingDate,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      water: 0,
      meals: [] as Meal[],
    };

    const newMeals: Meal[] = preview.meals.map((m) => ({
      ...m,
      id: generateId(),
      time: new Date().toISOString(),
    }));

    const updatedLog: NutritionLog = {
      ...currentLog,
      calories: currentLog.calories + preview.totalCal,
      protein: currentLog.protein + newMeals.reduce((s, m) => s + m.protein, 0),
      carbs: currentLog.carbs + newMeals.reduce((s, m) => s + m.carbs, 0),
      fat: currentLog.fat + newMeals.reduce((s, m) => s + m.fat, 0),
      meals: [...currentLog.meals, ...newMeals],
    };

    await saveNutritionLog(updatedLog);
    setTodayLog(updatedLog);
    emitNutritionLogUpdated();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRepeatPreview(null);
    setShowRepeatPills(false);
  }, [repeatPreview, todayLog, viewingDate]);

  const formatRepeatDate = (dateStr: string) => {
    const today = getTodayDateString();
    if (dateStr === today) return 'today';
    const d = new Date(dateStr + 'T12:00:00');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (dateStr === yesterdayStr) return 'yesterday';
    return `on ${dateStr}`;
  };

  return (
    <>
      {!overlayMode && <Stack.Screen options={{ headerShown: false }} />}
      <View style={[styles.root, overlayMode && styles.rootOverlay]}>
        <NotebookDotGrid variant={DOT_GRID_VARIANT} />
        <Ring1Gradient />
        <View style={[StyleSheet.absoluteFill, { zIndex: 100, pointerEvents: 'box-none' }]}>
          <View style={[styles.dateRowWrap, { top: insets.top + 38 - 110 + 14 }]} pointerEvents="box-none">
            <View style={styles.dateRow}>
              <Pressable onPress={() => handleSelectDate(toDateString(prevDay))} style={{ padding: 1 }} hitSlop={8}>
                <Ionicons name="chevron-back" size={16} color={Colors.primaryLight} />
              </Pressable>
              <Pressable onPress={() => setShowCalendar(true)} style={{ padding: 4 }} hitSlop={8}>
                <Text style={styles.dateRowText}>
                  {viewingDateAsDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </Pressable>
              <Pressable onPress={() => handleSelectDate(toDateString(nextDay))} style={{ padding: 1 }} hitSlop={8}>
                <Ionicons name="chevron-forward" size={16} color={Colors.primaryLight} />
              </Pressable>
            </View>
          </View>
          <SafeAreaView
            style={[
              styles.archTopSafe,
              overlayMode && {
                paddingTop: insets.top + 38 - 110 + 14 + 24 + 8,
              },
            ]}
            edges={overlayMode ? [] : ['top', 'left', 'right']}
            pointerEvents="none"
          >
            <View style={styles.archWrap}>
              <View style={styles.archInner}>
                <CalorieArch
                  data={heroData}
                  calorieDisplay={animatedCal}
                  proteinDisplay={animatedProtein}
                  carbsDisplay={animatedCarbs}
                  fatDisplay={animatedFat}
                  calorieGoal={goals.calories}
                  calProgress={animCalProgress}
                  proteinProgress={animProteinProgress}
                  carbsProgress={animCarbsProgress}
                  fatProgress={animFatProgress}
                  emptyState={false}
                />
              </View>
            </View>
          </SafeAreaView>
        </View>
        <Pressable
          style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
          onPress={overlayMode ? (onClose ?? (() => {})) : undefined}
        >
          <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <RNAnimated.View style={{ flex: 1, opacity: overlayMode ? contentOpacity : 1 }} pointerEvents="box-none">
            <View style={[styles.archWrap, overlayMode && backButtonTopOffset != null && { paddingTop: backButtonTopOffset }]}>
            <View style={styles.header}>
              {!overlayMode && (
                <Pressable onPress={handleBackOrClose} style={styles.backBtn} hitSlop={12}>
                  <CaretLeft size={22} color={Colors.primaryLight} weight="bold" />
                </Pressable>
              )}
              <View style={styles.headerSpacer} />
            </View>
          </View>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={[styles.scrollContent, overlayMode && { flexGrow: 1 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                style={overlayMode ? { flexGrow: 1, minHeight: 400 } : undefined}
                onPress={overlayMode ? (onClose ?? (() => {})) : undefined}
              >
              {messages.length === 0 && !showRepeatPills && !repeatPreview && (
                <View style={styles.preChatWrap} />
              )}

              {showRepeatPills && !repeatPreview && (
                <View style={styles.repeatWrap}>
                  <Text style={styles.preChatLabel}>Repeat which meal?</Text>
                  {repeatLoading ? (
                    <ActivityIndicator color={MUTED} style={{ marginVertical: 16 }} />
                  ) : (
                    <>
                      <View style={styles.repeatPillsRow}>
                        {(['breakfast', 'lunch', 'dinner'] as const).map((type) => (
                          <Pressable
                            key={type}
                            style={({ pressed }) => [styles.repeatPill, pressed && styles.preChatBtnPressed]}
                            onPress={() => loadRepeatPreview(type)}
                          >
                            <Text style={styles.preChatBtnText}>{type}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable
                        style={({ pressed }) => [styles.preChatBtn, pressed && styles.preChatBtnPressed, { marginTop: 12 }]}
                        onPress={() => { setShowRepeatPills(false); }}
                      >
                        <Text style={styles.preChatBtnText}>Back</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}

              {repeatPreview && (
                <View style={styles.repeatWrap}>
                  <Text style={styles.repeatPreviewTitle}>
                    Last {repeatPreview.mealType} — {formatRepeatDate(repeatPreview.date)}
                  </Text>
                  <Text style={styles.repeatPreviewSummary}>
                    {repeatPreview.meals.map((m) => m.name).join(', ')} — {repeatPreview.totalCal} cal
                  </Text>
                  <View style={styles.repeatActionsRow}>
                    <Pressable
                      style={({ pressed }) => [styles.repeatLogBtn, pressed && styles.preChatBtnPressed]}
                      onPress={handleRepeatLogIt}
                    >
                      <Text style={styles.repeatLogBtnText}>Log it</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.preChatBtn, pressed && styles.preChatBtnPressed]}
                      onPress={() => { setRepeatPreview(null); setShowRepeatPills(true); }}
                    >
                      <Text style={styles.preChatBtnText}>Choose another</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {messages.map((m) =>
                m.role === 'user' ? (
                  <View key={m.id} style={styles.msgUserWrap}>
                    <View style={styles.msgUserBubble}>
                      <Text style={styles.msgUserText}>{m.text}</Text>
                    </View>
                  </View>
                ) : (
                  <View key={m.id} style={styles.msgAssistant}>
                    {m.text ? (
                      <Text style={styles.msgAssistantText}>{m.text}</Text>
                    ) : null}
                    {m.ingredientBlocks?.map((block, blockIdx) =>
                      block.confirmed ? (
                        <View key={blockIdx} style={styles.confirmedRow}>
                          <Text style={styles.confirmedText}>
                            ✓ {block.confirmedName ?? block.foodName} — {block.label.split(' — ')[1] ?? ''} — {block.confirmedCal} cal
                          </Text>
                        </View>
                      ) : (
                        <View key={blockIdx} style={styles.blockWrap}>
                          <Text style={styles.blockLabel}>{block.label}</Text>
                          {(block.results?.length ?? 0) > 0 ? (
                            block.results!.map((item, idx) => (
                              <FoodResultRow
                                key={idx}
                                item={item}
                                onPress={() => handleResultPress(m.id, blockIdx, item)}
                              />
                            ))
                          ) : (
                            <Text style={styles.noResults}>No results</Text>
                          )}
                        </View>
                      )
                    )}
                  </View>
                )
              )}

              {isSearching && (
                <View style={styles.msgAssistant}>
                  <ActivityIndicator size="small" color={MUTED} />
                  <Text style={[styles.msgAssistantText, { marginTop: 8 }]}>Searching...</Text>
                </View>
              )}
              </Pressable>
            </ScrollView>

            <View style={[styles.inputRow, { paddingBottom: INPUT_BOX_BOTTOM_GAP }]}>
              <View style={[styles.inputButtonsRow, { width: Math.min(INPUT_BOX_WIDTH, Dimensions.get('window').width - 2 * H_PAD) }]}>
                <Pressable
                  style={({ pressed }) => [styles.inputBtn, pressed && styles.preChatBtnPressed]}
                  onPress={() => router.push({ pathname: '/scan-food-camera', params: { mode: 'barcode' } } as any)}
                >
                  <Text style={styles.inputBtnText}>scan food</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.inputBtn, pressed && styles.preChatBtnPressed]}
                  onPress={() => setShowRepeatPills(true)}
                >
                  <Text style={styles.inputBtnText}>repeat last</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.inputBtn, pressed && styles.preChatBtnPressed]}
                  onPress={() => router.push('/saved-foods' as any)}
                >
                  <Text style={styles.inputBtnText}>saved foods</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => inputRef.current?.focus()}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                style={{ alignSelf: 'center' }}
              >
              <LinearGradient
                colors={['#1A1A1A', 'rgba(198,198,198,0.3)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.inputBoxBorder,
                  {
                    width: Math.min(INPUT_BOX_WIDTH, Dimensions.get('window').width - 2 * H_PAD),
                    height: INPUT_BOX_HEIGHT,
                    borderRadius: INPUT_BOX_RADIUS + 1,
                  },
                ]}
              >
                <View style={styles.inputBox}>
                <LinearGradient
                  colors={['rgba(26,26,26,0)', 'rgba(198,198,198,0.5)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={[styles.sideButtonBorder, styles.sideButtonLeft]}
                >
                  <Pressable
                    style={({ pressed }) => [styles.sideButton, pressed && styles.sideButtonPressed]}
                    onPress={() => { /* TODO: upload/take picture */ }}
                  >
                    <View style={styles.sideButtonFill}>
                      <Plus size={SIDE_BUTTON_ICON_SIZE} color="#C6C6C6" weight="bold" />
                    </View>
                  </Pressable>
                </LinearGradient>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="200g of chicken, 200g of broccoli..."
                  placeholderTextColor={MUTED}
                  value={inputText}
                  onChangeText={setInputText}
                  editable={!isSearching}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  multiline={false}
                />
                <LinearGradient
                  colors={['rgba(26,26,26,0)', 'rgba(198,198,198,0.5)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={[styles.sideButtonBorder, styles.sideButtonRight]}
                >
                  <Pressable
                    style={({ pressed }) => [styles.sideButton, pressed && styles.sideButtonPressed]}
                    onPress={handleSend}
                    disabled={!inputText.trim() || isSearching}
                  >
                    <View style={styles.sideButtonFill}>
                      <Microphone size={SIDE_BUTTON_ICON_SIZE} color="#C6C6C6" weight="bold" />
                    </View>
                  </Pressable>
                </LinearGradient>
                </View>
              </LinearGradient>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
          </RNAnimated.View>
        </SafeAreaView>
        </Pressable>
      </View>

      <AddMealSheet
        visible={sheetVisible}
        onClose={handleCloseSheet}
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
        onSubmit={handleAddMeal}
        hasSelectedFood={hasAddMealSelectedFood}
        goldBadge={GOLD_VERIFIED_BADGE}
        quicksilverBadge={QUICKSILVER_VERIFIED_BADGE}
        champagneGradient={CHAMPAGNE_GRADIENT}
        quicksilverGradient={QUICKSILVER_GRADIENT}
        verifiedTickSize={ADD_MEAL_VERIFIED_TICK_SIZE}
        userVolumeUnit={settings?.volumeUnit}
        selectedFood={selectedFoodForSheet}
        dayLog={{
          calories: log.calories,
          protein: log.protein,
          carbs: log.carbs,
          fat: log.fat,
        }}
        dailyGoals={goals}
      />

      <CalendarOverlay
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        selectedDate={viewingDateAsDate}
        onSelectDate={(date) => {
          handleSelectDate(toDateString(date));
          setShowCalendar(false);
        }}
      />
    </>
  );
}

const H_PAD = 16;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a1a', overflow: 'visible' as const },
  rootOverlay: { backgroundColor: 'transparent' },
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    paddingBottom: 6,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: Colors.primaryLight,
  },
  headerSpacer: { width: 40 },
  dateRowWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 0 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dateRowText: { fontSize: 14, color: Colors.primaryLight, fontWeight: '500' },
  archTopSafe: { flex: 0, alignItems: 'center', paddingTop: 4 },
  archWrap: { paddingTop: 4 },
  archInner: { alignItems: 'center', paddingTop: 8 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 16, paddingBottom: 32 },
  preChatWrap: { alignItems: 'center', paddingVertical: 32, paddingTop: 80, gap: 12 },
  preChatLabel: { fontSize: 12, color: MUTED, letterSpacing: 0.5, marginBottom: 4 },
  inputButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inputBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.25)',
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBtnText: { fontSize: 14, color: Colors.primaryLight, fontWeight: '500' },
  preChatBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.25)',
  },
  preChatBtnPressed: { opacity: 0.7 },
  preChatBtnText: { fontSize: 15, color: Colors.primaryLight, fontWeight: '500' },
  repeatWrap: { alignItems: 'center', paddingVertical: 32, paddingTop: 80, paddingHorizontal: H_PAD },
  repeatPillsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  repeatPill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.25)',
  },
  repeatPreviewTitle: { fontSize: 15, fontWeight: '600', color: Colors.primaryLight, marginBottom: 6 },
  repeatPreviewSummary: { fontSize: 14, color: MUTED, marginBottom: 16, textAlign: 'center' },
  repeatActionsRow: { flexDirection: 'row', gap: 12 },
  repeatLogBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(212,184,150,0.25)',
    borderWidth: 1,
    borderColor: CHAMPAGNE,
  },
  repeatLogBtnText: { fontSize: 15, color: Colors.primaryLight, fontWeight: '600' },
  msgAssistant: { marginBottom: 16, alignSelf: 'flex-start', maxWidth: '95%' },
  msgAssistantText: { fontSize: 14, color: Colors.primaryLight, lineHeight: 21 },
  msgUserWrap: { marginBottom: 16, alignSelf: 'flex-end', maxWidth: '82%' },
  msgUserBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CHAMPAGNE,
  },
  msgUserText: { fontSize: 14, color: Colors.primaryLight, lineHeight: 20 },
  blockWrap: { marginTop: 12 },
  blockLabel: { fontSize: 13, fontWeight: '600', color: Colors.primaryLight, marginBottom: 6 },
  noResults: { fontSize: 13, color: MUTED, fontStyle: 'italic' },
  confirmedRow: { marginTop: 8 },
  confirmedText: { fontSize: 13, color: Colors.primaryLight },
  inputRow: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: 12,
  },
  inputBoxBorder: {
    padding: 1,
    overflow: 'hidden',
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SIDE_BUTTON_INSET_H,
    paddingVertical: SIDE_BUTTON_INSET_V,
    borderRadius: INPUT_BOX_RADIUS,
    backgroundColor: '#252525',
    overflow: 'hidden',
  },
  sideButtonBorder: {
    position: 'absolute',
    bottom: SIDE_BUTTON_INSET_V,
    width: SIDE_BUTTON_SIZE,
    height: SIDE_BUTTON_SIZE,
    borderRadius: SIDE_BUTTON_SIZE / 2,
    padding: 1,
    overflow: 'hidden',
  },
  sideButtonLeft: {
    left: SIDE_BUTTON_INSET_H,
  },
  sideButtonRight: {
    right: SIDE_BUTTON_INSET_H,
  },
  sideButton: {
    flex: 1,
    overflow: 'hidden',
  },
  sideButtonFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(51,51,51,1)',
    borderRadius: (SIDE_BUTTON_SIZE - 2) / 2,
  },
  sideButtonPressed: { opacity: 0.6 },
  input: {
    flex: 1,
    marginTop: 11,
    paddingLeft: 23 - SIDE_BUTTON_INSET_H,
    paddingRight: SIDE_BUTTON_INSET_H + SIDE_BUTTON_SIZE,
    paddingVertical: 0,
    color: Colors.primaryLight,
    fontSize: 15,
  },
});
