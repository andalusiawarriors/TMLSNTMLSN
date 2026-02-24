import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Alert,
  Image,
  ImageBackground,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ActivityIndicator,
  FlatList,
  TextInput,
  Platform,
  AppState,
  AppStateStatus,
  RefreshControl,
  Animated as RNAnimated,
  InteractionManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { usePathname, useLocalSearchParams, useRouter } from 'expo-router';
import { onCardSelect, emitStreakPopupState, emitProfileSheetState } from '../../utils/fabBridge';
import { StreakShiftContext } from '../../context/streakShiftContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  runOnJS,
  Easing,
  cancelAnimation,
  interpolate,
  FadeIn,
  FadeInUp,
  FadeOut,
  SlideInLeft,
  SlideInRight,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Asset } from 'expo-asset';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurRollNumber } from '../../components/BlurRollNumber';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import {
  getNutritionLogByDate,
  getNutritionLogs,
  saveNutritionLog,
  getUserSettings,
  saveUserSettings,
  getSavedFoods,
  saveSavedFood,
  getWorkoutSessions,
} from '../../utils/storage';
import { NutritionLog, Meal, MealType, UserSettings, SavedFood } from '../../types';
import { generateId, getTodayDateString, toDateString } from '../../utils/helpers';
import { type DayStatus } from '../../components/SwipeableWeekView';
import { AnimatedFadeInUp } from '../../components/AnimatedFadeInUp';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchByBarcode, searchFoodsProgressive, searchFoodsNextPage, ParsedNutrition } from '../../utils/foodApi';
import { searchFoodHistory, addToFoodHistory } from '../../utils/foodHistory';
import { analyzeFood, readNutritionLabel, isGeminiConfigured } from '../../utils/geminiApi';
import { getWeekStart, calculateWeeklyMuscleVolume, calculateHeatmap } from '../../utils/weeklyMuscleTracker';
import { workoutsToSetRecords } from '../../utils/workoutMuscles';
import { HeatmapPreviewWidgetSideBySide } from '../../components/HeatmapPreviewWidget';
import { PillSegmentedControl, type SegmentValue } from '../../components/PillSegmentedControl';
import { CalendarOverlay } from '../../components/CalendarOverlay';

// EB Garamond for Calorie tab (headings, modals, etc.)
const Font = {
  regular: 'EBGaramond_400Regular',
  medium: 'EBGaramond_500Medium',
  semiBold: 'EBGaramond_600SemiBold',
  bold: 'EBGaramond_700Bold',
  extraBold: 'EBGaramond_800ExtraBold',
} as const;

// Card letterSpacing only; font = system default (same as date/week strip in SwipeableWeekView). Rule: .cursor/rules/card-font-weight.mdc
const CardFont = { letterSpacing: -0.1 } as const;

const HeadingLetterSpacing = -1;
const CARD_LABEL_COLOR = '#FFFFFF';
const CARD_NUMBER_COLOR = '#FFFFFF'; // quantity text on cards – full white, animation restores to this
const CARD_UNIFIED_HEIGHT = Math.round(100 * 1.2); // 20% taller, all cards same height (120)
const MAIN_CARD_RING_SIZE = 100;
const SMALL_CARD_RING_SIZE = Math.round(61 * 0.95); // 5% smaller (58)
// Card fonts: 50% of base; macro labels (Calories left, Protein left, etc.) another 10% smaller (45% total)
const CARD_VALUE_FONT_SIZE = Math.round((Typography.h1 + 8) * 0.5); // 20
const CARD_LABEL_FONT_SIZE = Math.round(Typography.body * 0.45);   // 8 (Calories left)
const MACRO_VALUE_FONT_SIZE = Math.round(Typography.dataValue * 0.5); // 10
const MACRO_LABEL_FONT_SIZE = Math.round(Typography.label * 0.45);   // 6 (Protein left, etc.)

const CONTENT_PADDING = 19;
const WEEK_STRIP_PAGE_WIDTH = Dimensions.get('window').width - CONTENT_PADDING * 2;

export type NutritionScreenModalProps = {
  asModal?: boolean;
  initialOpenCard?: 'saved' | 'search' | 'scan';
  onCloseModal?: () => void;
};

export default function NutritionScreen({
  asModal = false,
  initialOpenCard,
  onCloseModal,
}: NutritionScreenModalProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openCard, addSavedFood, addFoodResult, openScan } = useLocalSearchParams<{
    openCard?: string;
    addSavedFood?: string;
    addFoodResult?: string;
    openScan?: 'barcode' | 'ai' | 'label';
  }>();
  const openCardProcessedRef = useRef(false);
  const addFoodParamProcessedRef = useRef(false);
  const [viewingDate, setViewingDate] = useState<string>(() => getTodayDateString());
  const [todayLog, setTodayLog] = useState<NutritionLog | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [showEditGoals, setShowEditGoals] = useState(false);
  const [nutritionPage, setNutritionPage] = useState(0); // 0 = macros, 1 = electrolytes
  const [fitnessCardPage, setFitnessCardPage] = useState(0);
  const [animTrigger, setAnimTrigger] = useState(0);
  const [weeklyHeatmap, setWeeklyHeatmap] = useState<ReturnType<typeof calculateHeatmap>>([]);
  const [hasHeatmapSetRecords, setHasHeatmapSetRecords] = useState(false);
  const [homeSegment, setHomeSegment] = useState<SegmentValue>('Nutrition');
  const [dayStatusByDate, setDayStatusByDate] = useState<Record<string, DayStatus>>({});
  const [workoutDateKeys, setWorkoutDateKeys] = useState<string[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  // Reset page when switching segment
  useEffect(() => {
    setNutritionPage(0);
    setFitnessCardPage(0);
  }, [homeSegment]);

  const viewingDateAsDate = useMemo(() => new Date(viewingDate + 'T12:00:00'), [viewingDate]);

  const cardScale = useSharedValue(1);
  const cardScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  // Top pills: scale-in on press (same as calorie card, no sound)
  const streakPillScale = useSharedValue(1);
  const streakPillScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: streakPillScale.value }],
  }));
  const profilePillScale = useSharedValue(1);
  const profilePillScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: profilePillScale.value }],
  }));
  const isEaten = useSharedValue(0);
  const rollTrigger = useSharedValue(0);

  const leftLabelOp = useSharedValue(1);
  const eatenLabelOp = useSharedValue(0);

  useAnimatedReaction(
    () => isEaten.value,
    (curr) => {
      leftLabelOp.value = withTiming(curr === 0 ? 1 : 0, { duration: 150 });
      eatenLabelOp.value = withTiming(curr === 1 ? 1 : 0, { duration: 150 });
    },
  );

  const leftLabelStyle = useAnimatedStyle(() => ({ opacity: leftLabelOp.value }));
  const eatenLabelStyle = useAnimatedStyle(() => ({ opacity: eatenLabelOp.value }));

  // ── Day-switch: horizontal slide left/right only (quick, no diagonal) ──
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
  const cardSlideX = useSharedValue(0);
  const cardSlideOpacity = useSharedValue(1);
  const prevDateRef = useRef<string>(viewingDate);
  const SLIDE_DISTANCE = 48;
  const SLIDE_DURATION = 140;

  const cardSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cardSlideX.value }],
    opacity: cardSlideOpacity.value,
  }));

  const [fireStreakPopupVisible, setFireStreakPopupVisible] = useState(false);
  // Fire streak popup: panel slides in from left (animated value: -width = off left, 0 = visible)
  const fireStreakSlideX = useRef(new RNAnimated.Value(-Dimensions.get('window').width)).current;
  // Content + tab bar shift: single value from layout (same rate, in sync)
  const streakShiftX = useContext(StreakShiftContext);
  const streakShiftXOrZero = useRef(new RNAnimated.Value(0)).current;
  const contentShiftX = streakShiftX ?? streakShiftXOrZero;

  useEffect(() => {
    if (fireStreakPopupVisible) {
      emitStreakPopupState(true);
      const w = Dimensions.get('window').width;
      fireStreakSlideX.setValue(-w);
      const startSlide = () => {
        RNAnimated.timing(fireStreakSlideX, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }).start();
      };
      const t = setTimeout(startSlide, 40);
      return () => clearTimeout(t);
    }
  }, [fireStreakPopupVisible]);

  const closeFireStreakPopup = useCallback(() => {
    const w = Dimensions.get('window').width;
    emitStreakPopupState(false); // layout runs shift-back in sync with panel
    RNAnimated.timing(fireStreakSlideX, {
      toValue: -w,
      duration: 100,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setFireStreakPopupVisible(false);
    });
  }, []);

  // Real blur-to-focus: BlurView overlay fades out so content goes from blurred → sharp
  const cardTextReveal = useSharedValue(1);
  const blurOverlayStyle = useAnimatedStyle(() => {
    const r = cardTextReveal.value;
    return { opacity: interpolate(r, [0, 1], [1, 0]) };
  });

  // ── New food-logging state ──
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'ai' | 'barcode' | 'label'>('ai');
  const cameraRef = useRef<any>(null);
  const clickSound = useAudioPlayer(require('../../assets/sounds/click.mp4'));
  const tapSound = useAudioPlayer(require('../../assets/sounds/tap.mp4'));
  const cardPressInSound = useAudioPlayer(require('../../assets/sounds/card-press-in.mp4'));
  const cardPressOutSound = useAudioPlayer(require('../../assets/sounds/card-press-out.mp4'));
  const [cameraLoading, setCameraLoading] = useState(false);
  const [aiPhotoBase64, setAiPhotoBase64] = useState<string | null>(null);
  const [aiDescription, setAiDescription] = useState('');
  const [showAiDescribe, setShowAiDescribe] = useState(false);
  const [showSavedFoods, setShowSavedFoods] = useState(false);
  const [savedFoodsList, setSavedFoodsList] = useState<SavedFood[]>([]);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [foodSearchResults, setFoodSearchResults] = useState<ParsedNutrition[]>([]);
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);
  const [foodSearchLoadingMore, setFoodSearchLoadingMore] = useState(false);
  const [foodSearchPage, setFoodSearchPage] = useState(1);
  const [foodSearchHasMore, setFoodSearchHasMore] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tab-bar pill dimensions for FAB positioning

  // Add Meal Form State
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealImage, setMealImage] = useState<string | undefined>();

  // Edit Goals Form State
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');
  const [editWater, setEditWater] = useState('');

  // Reload from storage whenever this tab is focused or viewing date changes
  const loadData = useCallback(async () => {
    const userSettings = await getUserSettings();
    setSettings(userSettings);
    const date = viewingDate;
    const log = await getNutritionLogByDate(date);
    if (log) {
      setTodayLog(log);
    } else {
      const newLog: NutritionLog = {
        id: generateId(),
        date,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        water: 0,
        meals: [],
      };
      await saveNutritionLog(newLog);
      setTodayLog(newLog);
    }
    // Weekly muscle heatmap for home carousel (last 7 days)
    const allSessions = await getWorkoutSessions();
    const totalExercises = allSessions.reduce((acc, s) => acc + (s.exercises ?? []).length, 0);
    const totalSets = allSessions.reduce((acc, s) => acc + (s.exercises ?? []).reduce((a, ex) => a + (ex.sets ?? []).length, 0), 0);
    if (__DEV__) {
      console.log('[Nutrition heatmap] sessions:', allSessions.length, 'exercises:', totalExercises, 'sets:', totalSets);
      const sample = allSessions[0];
      if (sample) console.log('[Nutrition heatmap] sample:', { id: sample.id, date: sample.date, duration: sample.duration });
    }
    const weekStart = getWeekStart();
    const setRecords = workoutsToSetRecords(allSessions, weekStart);
    if (__DEV__) console.log('[Heatmap] setRecords count:', setRecords.length);
    setHasHeatmapSetRecords(setRecords.length > 0);
    const weeklyVolume = calculateWeeklyMuscleVolume(setRecords);
    setWeeklyHeatmap(calculateHeatmap(weeklyVolume));
    // Calendar: which days have at least one workout (local date YYYY-MM-DD)
    const dateKeys = [
      ...new Set(
        allSessions
          .map((s) => {
            const d = new Date(s.date);
            return Number.isNaN(d.getTime()) ? null : toDateString(d);
          })
          .filter((k): k is string => k != null)
      ),
    ];
    setWorkoutDateKeys(dateKeys);
  }, [viewingDate]);

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;
  // Only run entrance animations when the tab actually gains focus, not when viewingDate changes.
  // (useFocusEffect re-runs when its callback identity changes; loadData changes with viewingDate, so we use a ref to keep the callback stable.)
  useFocusEffect(
    useCallback(() => {
      loadDataRef.current();
      if (!asModal) setAnimTrigger((t) => t + 1);
    }, [asModal])
  );

  const prevViewingDateRef = useRef(viewingDate);
  // Load the selected day's log when user taps a different date (not on initial mount)
  useEffect(() => {
    if (prevViewingDateRef.current !== viewingDate) {
      prevViewingDateRef.current = viewingDate;
      loadData();
    }
  }, [viewingDate, loadData]);

  // Also reload when app comes back from background (e.g. after switching apps)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  // Compute day status for week strip (none/miss/hit) for visible week
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const weekStart = getWeekStart(viewingDateAsDate);
      const dateStrings: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        dateStrings.push(toDateString(d));
      }
      const logs = await getNutritionLogs();
      const userSettings = await getUserSettings();
      if (cancelled || !userSettings) return;
      const goals = userSettings.dailyGoals;
      const logByDate = Object.fromEntries(logs.map((l) => [l.date, l]));
      const next: Record<string, DayStatus> = {};
      for (const ds of dateStrings) {
        const log = logByDate[ds];
        if (!log || log.calories === 0) {
          next[ds] = 'none';
        } else if (
          log.calories >= goals.calories &&
          log.protein >= goals.protein &&
          log.fat >= goals.fat
        ) {
          next[ds] = 'hit';
        } else {
          next[ds] = 'miss';
        }
      }
      if (!cancelled) setDayStatusByDate(next);
    };
    run();
    return () => { cancelled = true; };
  }, [viewingDate, todayLog]);

  const applyDateAndSlideIn = useCallback((dateString: string, direction: 'forward' | 'backward') => {
    setViewingDate(dateString);
    prevDateRef.current = dateString;
    // Start from opposite side: forward = from right, backward = from left
    const slideInX = direction === 'forward' ? SLIDE_DISTANCE : -SLIDE_DISTANCE;
    cardSlideX.value = slideInX;
    cardSlideOpacity.value = 0;
    cardTextReveal.value = 0;
    // Animate in: horizontal slide only
    cardSlideX.value = withTiming(0, { duration: SLIDE_DURATION, easing: Easing.out(Easing.quad) });
    cardSlideOpacity.value = withTiming(1, { duration: SLIDE_DURATION, easing: Easing.out(Easing.quad) });
    cardTextReveal.value = withTiming(1, { duration: SLIDE_DURATION, easing: Easing.out(Easing.quad) });
  }, [cardSlideX, cardSlideOpacity, cardTextReveal, SLIDE_DISTANCE, SLIDE_DURATION]);

  const handleSelectDate = useCallback((dateString: string) => {
    if (dateString === prevDateRef.current) return;
    const direction: 'forward' | 'backward' = dateString > prevDateRef.current ? 'forward' : 'backward';
    const slideOutX = direction === 'forward' ? -SLIDE_DISTANCE : SLIDE_DISTANCE;

    // Animate out: slide left or right only
    cardSlideX.value = withTiming(slideOutX, { duration: SLIDE_DURATION, easing: Easing.in(Easing.quad) });
    cardSlideOpacity.value = withTiming(0, { duration: SLIDE_DURATION, easing: Easing.in(Easing.quad) }, () => {
      runOnJS(applyDateAndSlideIn)(dateString, direction);
    });
  }, [cardSlideX, cardSlideOpacity, SLIDE_DISTANCE, SLIDE_DURATION, applyDateAndSlideIn]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
    }).catch(() => {});
  }, []);

  // Preload card sounds so they work in Expo Go (assets may not be ready otherwise)
  useEffect(() => {
    Asset.loadAsync([
      require('../../assets/sounds/card-press-in.mp4'),
      require('../../assets/sounds/card-press-out.mp4'),
    ]).catch(() => {});
  }, []);

  useEffect(() => {
    clickSound.volume = 0.64;
    tapSound.volume = 0.64;
    cardPressInSound.volume = 0.2;
    cardPressOutSound.volume = 0.2;
  }, [clickSound, tapSound, cardPressInSound, cardPressOutSound]);

  const playClickSound = useCallback(() => {
    try {
      clickSound.seekTo(0);
      clickSound.play();
    } catch (_) {}
  }, [clickSound]);

  const playTapSound = useCallback(() => {
    try {
      tapSound.seekTo(0);
      tapSound.play();
    } catch (_) {}
  }, [tapSound]);

  const playCardPressInSound = useCallback(() => {
    try {
      cardPressInSound.seekTo(0);
      cardPressInSound.play();
    } catch (_) {}
  }, [cardPressInSound]);
  const playCardPressOutSound = useCallback(() => {
    try {
      cardPressOutSound.seekTo(0);
      cardPressOutSound.play();
    } catch (_) {}
  }, [cardPressOutSound]);


  // ── Form helpers ──
  const resetMealForm = () => {
    setMealName(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setMealImage(undefined);
  };

  const fillAndShowForm = (data: ParsedNutrition) => {
    setMealName(data.name);
    setCalories(String(data.calories || ''));
    setProtein(String(data.protein || ''));
    setCarbs(String(data.carbs || ''));
    setFat(String(data.fat || ''));
    setShowAddMeal(true);
  };

  const handleAddMeal = async () => {
    if (!mealName || !calories) {
      Alert.alert('Error', 'Please enter at least meal name and calories');
      return;
    }

    const newMeal: Meal = {
      id: generateId(),
      name: mealName,
      mealType,
      time: new Date().toISOString(),
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      imageUri: mealImage,
    };

    if (todayLog) {
      const updatedLog: NutritionLog = {
        ...todayLog,
        calories: todayLog.calories + newMeal.calories,
        protein: todayLog.protein + newMeal.protein,
        carbs: todayLog.carbs + newMeal.carbs,
        fat: todayLog.fat + newMeal.fat,
        meals: [...todayLog.meals, newMeal],
      };

      await saveNutritionLog(updatedLog);
      setTodayLog(updatedLog);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Save to "saved foods" for quick re-logging
    await saveSavedFood({
      name: mealName,
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
    });

    // Reset form
    resetMealForm();
    setMealType('breakfast');
    setShowAddMeal(false);
    asModal && onCloseModal?.();
  };

  // ── Bridge: card selected in popup (rendered in _layout.tsx) → open feature ──
  useEffect(() => {
    const unsub = onCardSelect((card) => {
      if (card === 'saved') handleChoiceSavedFoods();
      else if (card === 'search') handleChoiceFoodDatabase();
      else if (card === 'scan') handleChoiceScanFood();
    });
    return unsub;
  }, []);

  // ── Choice popup handlers (popup is closed by _layout.tsx before emitting) ──
  const handleChoiceSavedFoods = async () => {
    const foods = await getSavedFoods();
    setSavedFoodsList(foods);
    setShowSavedFoods(true);
  };

  const handleChoiceFoodDatabase = () => {
    setFoodSearchQuery('');
    setFoodSearchResults([]);
    setShowFoodSearch(true);
  };

  const handleChoiceScanFood = async (mode: 'ai' | 'barcode' | 'label' = 'ai') => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera Required', 'Camera permission is needed to scan food.');
        return;
      }
    }
    setCameraMode(mode);
    setCameraLoading(false);
    setShowAiDescribe(false);
    setAiPhotoBase64(null);
    setAiDescription('');
    setShowCamera(true);
  };

  // When asModal (opened from FAB on another tab), open the right flow from initialOpenCard
  useEffect(() => {
    if (!asModal || !initialOpenCard) return;
    if (initialOpenCard === 'saved') handleChoiceSavedFoods();
    else if (initialOpenCard === 'search') handleChoiceFoodDatabase();
    else if (initialOpenCard === 'scan') handleChoiceScanFood();
  }, [asModal, initialOpenCard]);

  // When navigated from another tab with openCard param (legacy; FAB now uses food-action-modal)
  useEffect(() => {
    if (asModal) return;
    if (openCard !== 'saved' && openCard !== 'search' && openCard !== 'scan') {
      openCardProcessedRef.current = false;
      return;
    }
    if (openCardProcessedRef.current) return;
    openCardProcessedRef.current = true;
    if (openCard === 'saved') handleChoiceSavedFoods();
    else if (openCard === 'search') handleChoiceFoodDatabase();
    else if (openCard === 'scan') handleChoiceScanFood();
    router.setParams({});
  }, [asModal, openCard]);

  // When navigated from search-food with openScan param — open camera with that mode
  const openScanProcessedRef = useRef(false);
  useEffect(() => {
    const m = openScan as 'barcode' | 'ai' | 'label' | undefined;
    if (m !== 'barcode' && m !== 'ai' && m !== 'label') {
      openScanProcessedRef.current = false;
      return;
    }
    if (openScanProcessedRef.current) return;
    openScanProcessedRef.current = true;
    handleChoiceScanFood(m);
    router.setParams({ openScan: undefined });
  }, [openScan, router]);

  // When returning from full-screen Saved Foods or Search Food with a selection
  useEffect(() => {
    const payload = addSavedFood || addFoodResult;
    if (!payload) {
      addFoodParamProcessedRef.current = false;
      return;
    }
    if (addFoodParamProcessedRef.current) return;
    addFoodParamProcessedRef.current = true;
    try {
      const data = JSON.parse(payload) as ParsedNutrition;
      fillAndShowForm(data);
    } catch (_) {
      // ignore invalid JSON
    }
    router.setParams({ addSavedFood: undefined, addFoodResult: undefined });
  }, [addSavedFood, addFoodResult, router]);

  const handleChoiceManual = () => {
    resetMealForm();
    setShowAddMeal(true);
  };

  // ── Barcode handler ──
  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (cameraMode !== 'barcode' || cameraLoading) return;
    setCameraLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const food = await searchByBarcode(result.data);
    setCameraLoading(false);
    if (food) {
      setShowCamera(false);
      fillAndShowForm(food);
    } else {
      Alert.alert('Not Found', 'Could not find that barcode. Try searching manually.', [
        { text: 'Search', onPress: () => { setShowCamera(false); handleChoiceFoodDatabase(); } },
        { text: 'OK' },
      ]);
    }
  };

  // ── Camera shutter (AI / Label) ──
  const handleCameraShutter = async () => {
    if (!cameraRef.current || cameraLoading) return;
    setCameraLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
      if (!photo?.base64) { setCameraLoading(false); return; }
      if (cameraMode === 'label') {
        const parsed = await readNutritionLabel(photo.base64);
        setCameraLoading(false);
        if (parsed) { setShowCamera(false); fillAndShowForm(parsed); }
        else Alert.alert('Could not read label', 'Try again with better lighting or angle.');
      } else {
        setCameraLoading(false);
        setAiPhotoBase64(photo.base64);
        setShowAiDescribe(true);
      }
    } catch (e) {
      setCameraLoading(false);
      console.warn('Camera capture error:', e);
    }
  };

  // ── AI submit with description ──
  const handleAiSubmit = async () => {
    if (!aiPhotoBase64) return;
    setCameraLoading(true);
    const parsed = await analyzeFood(aiPhotoBase64, 'image/jpeg', aiDescription || undefined);
    setCameraLoading(false);
    if (parsed) {
      setShowCamera(false);
      setShowAiDescribe(false);
      fillAndShowForm(parsed);
    } else {
      Alert.alert('Analysis Failed', 'Could not analyze the photo. Try again.');
    }
  };

  // ── Food database search (debounced) ──
  const handleFoodSearch = useCallback((query: string) => {
    setFoodSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) { setFoodSearchResults([]); return; }
    setFoodSearchResults([]);
    setFoodSearchPage(1);
    setFoodSearchHasMore(true);
    setFoodSearchLoadingMore(false);
    searchTimeoutRef.current = setTimeout(async () => {
      const cached = await searchFoodHistory(query);
      if (cached.length > 0) setFoodSearchResults(cached);
      setFoodSearchLoading(true);
      searchFoodsProgressive(
        query,
        (results) => {
          const historyNames = new Set(cached.map((c) => c.name.toLowerCase()));
          const apiOnly = results.filter((f) => !historyNames.has(f.name.toLowerCase()));
          setFoodSearchResults([...cached, ...apiOnly]);
          if (results.length > 0) setFoodSearchLoading(false);
        },
      )
        .then(() => setFoodSearchLoading(false))
        .catch(() => {
          if (cached.length === 0) setFoodSearchResults([]);
          setFoodSearchLoading(false);
        });
    }, 250);
  }, []);

  const loadMoreFoodSearch = useCallback(() => {
    if (foodSearchLoadingMore || !foodSearchHasMore || !foodSearchQuery.trim()) return;
    const nextPage = foodSearchPage + 1;
    setFoodSearchLoadingMore(true);
    searchFoodsNextPage(foodSearchQuery, nextPage, (newResults) => {
      if (newResults.length === 0) {
        setFoodSearchHasMore(false);
      } else {
        const existingKeys = new Set(
          foodSearchResults.map((r) => `${r.name}|${r.brand}`.toLowerCase()),
        );
        const fresh = newResults.filter(
          (r) => !existingKeys.has(`${r.name}|${r.brand}`.toLowerCase()),
        );
        if (fresh.length === 0) {
          setFoodSearchPage(nextPage);
        } else {
          setFoodSearchResults((prev) => [...prev, ...fresh]);
          setFoodSearchPage(nextPage);
        }
      }
      setFoodSearchLoadingMore(false);
    }).catch(() => setFoodSearchLoadingMore(false));
  }, [foodSearchLoadingMore, foodSearchHasMore, foodSearchQuery, foodSearchPage, foodSearchResults]);

  const handleSelectFood = (food: ParsedNutrition) => {
    addToFoodHistory(food);
    setShowFoodSearch(false);
    fillAndShowForm(food);
  };

  const handleSelectSavedFood = (food: SavedFood) => {
    setShowSavedFoods(false);
    fillAndShowForm({
      name: food.name, brand: food.brand || '', calories: food.calories,
      protein: food.protein, carbs: food.carbs, fat: food.fat, servingSize: '',
      unit: 'g',
      source: 'usda',
    });
  };

  const openEditGoals = () => {
    if (settings) {
      setEditCalories(String(settings.dailyGoals.calories));
      setEditProtein(String(settings.dailyGoals.protein));
      setEditCarbs(String(settings.dailyGoals.carbs));
      setEditFat(String(settings.dailyGoals.fat));
      setEditWater(String(settings.dailyGoals.water));
    }
    setShowEditGoals(true);
  };

  const handleSaveGoals = async () => {
    if (!settings) return;
    const updated: UserSettings = {
      ...settings,
      dailyGoals: {
        calories: parseInt(editCalories, 10) || settings.dailyGoals.calories,
        protein: parseInt(editProtein, 10) || settings.dailyGoals.protein,
        carbs: parseInt(editCarbs, 10) || settings.dailyGoals.carbs,
        fat: parseInt(editFat, 10) || settings.dailyGoals.fat,
        water: parseInt(editWater, 10) || settings.dailyGoals.water,
      },
    };
    await saveUserSettings(updated);
    setSettings(updated);
    setShowEditGoals(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const MEAL_TYPE_LABELS: Record<MealType, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
  };
  const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

  const mealsByType = (todayLog?.meals ?? []).reduce<Record<MealType, Meal[]>>(
    (acc, meal) => {
      const type = meal.mealType ?? 'snack';
      if (!acc[type]) acc[type] = [];
      acc[type].push(meal);
      return acc;
    },
    { breakfast: [], lunch: [], dinner: [], snack: [] }
  );

  const handleAddWater = async (amount: number) => {
    if (todayLog) {
      const updatedLog: NutritionLog = {
        ...todayLog,
        water: todayLog.water + amount,
      };
      await saveNutritionLog(updatedLog);
      setTodayLog(updatedLog);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setMealImage(result.assets[0].uri);
      // In production, you would upload this to your food recognition API
      // and auto-fill the macros
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera is required!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setMealImage(result.assets[0].uri);
      // In production, you would upload this to your food recognition API
    }
  };

  const calculateProgress = (current: number, goal: number) => {
    return Math.min(Math.round((current / goal) * 100), 100);
  };

  const headerHeight = 44;

  // Carousel (horizontal paging between normal and flipped card layouts)
  const CAROUSEL_WIDTH = Dimensions.get('window').width - CONTENT_PADDING * 2;

  // Card width aligned with week-strip day cells: left edge of Monday's selected card → right edge of Sunday's selected card
  const WEEK_STRIP_HPAD = Spacing.sm;   // paddingHorizontal on weekStrip (8)
  const DAY_CARD_WIDTH = 50;            // dayCardSelected width in SwipeableWeekView
  const DAY_COL_WIDTH = (CAROUSEL_WIDTH - 2 * WEEK_STRIP_HPAD) / 7;
  const CALORIES_CARD_WIDTH = Math.round(6 * DAY_COL_WIDTH + DAY_CARD_WIDTH);
  const CALORIES_CARD_HEIGHT = 136;
  const CALORIES_CARD_RADIUS = 16;

  // Macro cards (Protein, Carbs, Fat): 3 cards + 2 gaps fill the same width as the calorie card
  const MACRO_CARD_WIDTH = Math.floor((CALORIES_CARD_WIDTH - 2 * Spacing.sm) / 3);
  const MACRO_CARD_HEIGHT = 140;
  const MACRO_CARD_RADIUS = 16;
  const handleFitnessCarouselScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / CAROUSEL_WIDTH);
    setFitnessCardPage(Math.min(1, page));
  };

  const nutritionScrollRef = useRef<ScrollView>(null);
  const handleNutritionCarouselScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / CAROUSEL_WIDTH);
    setNutritionPage(Math.min(1, page));
  };
  useEffect(() => {
    nutritionScrollRef.current?.scrollTo({ x: nutritionPage * CAROUSEL_WIDTH, animated: true });
  }, [nutritionPage]);

  const TAP_SLOP = 20; // px – only commit toggle on release when finger moved less than this (larger for Mac/simulator)
  const cardTouchStart = useRef({ x: 0, y: 0 });
  const carouselDraggedRef = useRef(false); // set true when carousel scroll starts – prevents toggle on release
  const mainScrollPullRef = useRef(false);
  const mainScrollDragBegunRef = useRef(false); // true when user is pulling down main list – don’t run card click-out animation

  const onCardPressIn = (e: { nativeEvent: { pageX: number; pageY: number } }) => {
    cardTouchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    carouselDraggedRef.current = false;
    playCardPressInSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cardScale.value = withTiming(0.99, { duration: 100, easing: Easing.out(Easing.cubic) });
  };

  const onCardPressOut = (e: { nativeEvent: { pageX: number; pageY: number } }) => {
    playCardPressOutSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { x, y } = cardTouchStart.current;
    const dx = e.nativeEvent.pageX - x;
    const dy = e.nativeEvent.pageY - y;
    const moved = Math.sqrt(dx * dx + dy * dy);
    const wasScrollPull = mainScrollPullRef.current || mainScrollDragBegunRef.current; // scroll down or drag begun (catches quick scroll before contentOffset updates)
    const wasCarouselDrag = carouselDraggedRef.current; // user slid carousel left/right during press
    const wasDrag = wasCarouselDrag || moved >= TAP_SLOP || wasScrollPull;
    if (!wasDrag) {
      isEaten.value = isEaten.value === 0 ? 1 : 0;
      rollTrigger.value = rollTrigger.value + 1;
    }
    carouselDraggedRef.current = false;
    if (wasScrollPull) {
      cardScale.value = 1; // snap back without click-out animation when touch was scroll-down
    } else {
      cardScale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) });
    }
  };

  const onCardPressOutScaleOnly = () => {
    playCardPressOutSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (mainScrollPullRef.current || mainScrollDragBegunRef.current) {
      cardScale.value = 1;
    } else {
      cardScale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) });
    }
  };

  const _unused = () => {
    fetch('http://127.0.0.1:7243/ingest/d7e803ab-9a90-4a93-8bc3-01772338bb68',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'nutrition:onCarouselScrollBeginDrag',message:'carousel scroll drag started',data:{hypothesisId:'H3'},timestamp:Date.now()})}).catch(()=>{});
    carouselDraggedRef.current = true; // user is dragging carousel – don’t count release as tap
  };

  // ── Pull-to-refresh flywheel ──
  const REFRESH_THRESHOLD = 80; // arc 0–360° over this many px
  const pullDistance = useSharedValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const isRefreshingSv = useSharedValue(0); // 1 when refreshing, 0 otherwise – for worklet opacity
  const spinAnim = useSharedValue(0);
  const flywheelFadeOut = useSharedValue(1); // 0 after refresh complete (rise + fade); reset to 1 when user pulls
  const flywheelTranslateY = useSharedValue(0); // rises (negative) when refresh completes; 0 when pulling/refreshing

  const handleMainScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    mainScrollPullRef.current = y < 0;
    if (y >= 0) mainScrollDragBegunRef.current = false; // clear when scrolled back to top
    pullDistance.value = y < 0 ? -y : 0;
  }, [pullDistance]);

  const handleMainScrollBeginDrag = useCallback(() => {
    mainScrollDragBegunRef.current = true; // user started dragging main scroll (fires before first onScroll with y < 0 on quick drag)
  }, []);

  const handleMainScrollEndDrag = useCallback(() => {
    mainScrollDragBegunRef.current = false;
  }, []);

  const FLYWHEEL_RISE_MS = 250; // flywheel rise + fade duration
  const MIN_REFRESH_HOLD_MS = 700; // keep content locked at least this long
  const LOCKED_PULL_OFFSET = 70; // keep scroll at this negative offset while refreshing
  const refreshStartTimeRef = useRef<number>(0);
  const mainScrollRef = useRef<ScrollView>(null);
  const releaseLockRef = useRef(false); // true when we're done and should stop forcing -70 and rise back

  const handleRefresh = useCallback(() => {
    releaseLockRef.current = false;
    refreshStartTimeRef.current = Date.now();
    setRefreshing(true);
    loadData().then(() => {
      const elapsed = Date.now() - refreshStartTimeRef.current;
      const waitBeforeRise = Math.max(0, MIN_REFRESH_HOLD_MS - elapsed);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        cancelAnimation(spinAnim);
        flywheelTranslateY.value = withTiming(-56, { duration: FLYWHEEL_RISE_MS });
        flywheelFadeOut.value = withTiming(0, { duration: FLYWHEEL_RISE_MS });
        setTimeout(() => {
          releaseLockRef.current = true; // stop scroll lock from overriding
          setRefreshing(false);
          requestAnimationFrame(() => {
            mainScrollRef.current?.scrollTo({ y: 0, animated: true });
          });
        }, FLYWHEEL_RISE_MS);
      }, waitBeforeRise);
    });
  }, [loadData, spinAnim, flywheelTranslateY, flywheelFadeOut]);

  // Force content to stay pulled down while refreshing (skip when we're releasing so content can rise)
  useEffect(() => {
    if (!refreshing) return;
    const id = setInterval(() => {
      if (releaseLockRef.current) return;
      mainScrollRef.current?.scrollTo({
        y: -LOCKED_PULL_OFFSET,
        animated: false,
      });
    }, 50);
    return () => clearInterval(id);
  }, [refreshing]);

  // Start / stop continuous spin and sync refreshing state to worklet; rise is started from handleRefresh
  useEffect(() => {
    isRefreshingSv.value = withTiming(refreshing ? 1 : 0, { duration: 150 });
    if (refreshing) {
      flywheelFadeOut.value = 1;
      flywheelTranslateY.value = 0;
      spinAnim.value = 0;
      spinAnim.value = withRepeat(
        withTiming(360, { duration: 800, easing: Easing.linear }),
        -1, // infinite
      );
    } else {
      cancelAnimation(spinAnim);
      // Rise + fade are started in handleRefresh when loadData completes; don't re-trigger here
    }
  }, [refreshing, spinAnim, isRefreshingSv, flywheelFadeOut, flywheelTranslateY]);

  // Reset fade and rise when user pulls so flywheel is visible again at fixed Y
  useAnimatedReaction(
    () => pullDistance.value,
    (curr) => {
      if (curr > 0) {
        flywheelFadeOut.value = 1;
        flywheelTranslateY.value = 0;
      }
    },
  );

  const flywheelStyle = useAnimatedStyle(() => {
    // Pull-phase rotation: proportional 0-360° over REFRESH_THRESHOLD (80px)
    const pullRotation = Math.min(pullDistance.value / REFRESH_THRESHOLD, 1) * 360;
    // Continuous spin: use modulo so 360→0 repeat has no visual jump
    const spinDeg = spinAnim.value % 360;
    const totalRotation = pullRotation + spinDeg;
    // Opacity: full during refresh; otherwise reveal over first 20px of pull; then multiply by complete-phase fade
    const baseOpacity = isRefreshingSv.value > 0.5
      ? 1
      : pullDistance.value > 2
        ? Math.min(pullDistance.value / 20, 1)
        : 0;
    const opacity = baseOpacity * flywheelFadeOut.value;
    return {
      transform: [
        { translateY: flywheelTranslateY.value },
        { rotate: `${totalRotation}deg` },
      ],
      opacity,
    };
  });

  const insets = useSafeAreaInsets();
  const headerTop = 54;
  const headerMeasureRef = useRef<View>(null);
  const onHeaderLayout = useCallback(() => {
    headerMeasureRef.current?.measureInWindow((x, y) => {
      fetch('http://127.0.0.1:7243/ingest/d7e803ab-9a90-4a93-8bc3-01772338bb68',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'nutrition.tsx:onHeaderLayout',message:'Header measured Y',data:{measuredY:y,headerTop,insetsTop:insets.top,expectedY:insets.top+19,gapFromNotch:y-insets.top},timestamp:Date.now(),hypothesisId:'measure'})}).catch(()=>{});
    });
  }, [headerTop, insets.top]);
  const calorieCardLeft = CONTENT_PADDING + (CAROUSEL_WIDTH - CALORIES_CARD_WIDTH) / 2;
  const TOP_RIGHT_CIRCLE_SIZE = 40;
  const TOP_RIGHT_CIRCLE_RADIUS = TOP_RIGHT_CIRCLE_SIZE / 2;
  const HEADER_PILL_SIZE = TOP_RIGHT_CIRCLE_SIZE; // 40 — circles, same y line as profile
  const HEADER_PILL_RADIUS = HEADER_PILL_SIZE / 2;
  const PILL_TO_DATE_GAP = 8;
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

  return (
    <View style={[styles.container, asModal && { backgroundColor: 'transparent' }]}>
      {!asModal && (
      <>
      <RNAnimated.View style={{ flex: 1, transform: [{ translateX: contentShiftX }] }}>
        {/* Background: picture + bottom gradient to black only */}
        <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
          <ImageBackground
            source={require('../../assets/home-background.png')}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, position: 'absolute', top: 0, left: 0 }}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['transparent', 'rgba(47, 48, 49, 0.4)', 'rgba(47, 48, 49, 0.85)', '#2F3031', '#1a1a1a']}
              locations={[0, 0.2, 0.35, 0.45, 0.65]}
              style={StyleSheet.absoluteFill}
            />
          </ImageBackground>
        </View>
        {/* Flywheel at fixed Y: reveals progressively on pull, spins on refresh, then rises with haptic */}
        <View
          style={[styles.flywheelOverlay, { top: headerTop + 12 }]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.flywheelWrap, flywheelStyle]}>
            <View style={styles.flywheelRing} />
          </Animated.View>
        </View>
        <ScrollView
        ref={mainScrollRef}
        style={styles.scrollViewLayer}
        scrollEventThrottle={16}
        onScroll={handleMainScroll}
        onScrollBeginDrag={handleMainScrollBeginDrag}
        onScrollEndDrag={handleMainScrollEndDrag}
        nestedScrollEnabled
        directionalLockEnabled
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="transparent"
          />
        }
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: headerTop + 40 },
        ]}
      >
        {/* Top-left pill — fire streak (circle, 0 superimposed on fire) */}
        <Pressable
          ref={headerMeasureRef}
          onLayout={onHeaderLayout}
          style={{
            position: 'absolute',
            top: headerTop,
            left: calorieCardLeft,
            zIndex: 10,
            width: HEADER_PILL_SIZE,
            height: HEADER_PILL_SIZE,
          }}
          onPressIn={() => { streakPillScale.value = withTiming(0.99, { duration: 100, easing: Easing.out(Easing.cubic) }); }}
          onPressOut={() => { streakPillScale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) }); }}
          onPress={() => setFireStreakPopupVisible(true)}
        >
          <Animated.View style={[{ width: HEADER_PILL_SIZE, height: HEADER_PILL_SIZE }, streakPillScaleStyle]}>
            <View
              style={{
                width: HEADER_PILL_SIZE,
                height: HEADER_PILL_SIZE,
                borderRadius: HEADER_PILL_RADIUS,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={['#4E4F50', '#4A4B4C']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: HEADER_PILL_RADIUS }}
              />
              <LinearGradient
                colors={['#363738', '#2E2F30']}
                style={{
                  position: 'absolute',
                  top: 1,
                  left: 1,
                  right: 1,
                  bottom: 1,
                  borderRadius: HEADER_PILL_RADIUS - 1,
                }}
              />
              {/* Fire centered (3–4% bigger), 0 superimposed slightly lower */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Image
                  source={require('../../assets/firestreakhomepage.png')}
                  style={{ width: 23, height: 23 }}
                  resizeMode="contain"
                />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#ffffff',
                      letterSpacing: 14 * -0.03,
                      transform: [{ translateY: 2 }],
                    }}
                  >
                    0
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </Pressable>

        {/* Top-right circle — profile */}
        <Pressable
          style={{
            position: 'absolute',
            top: headerTop,
            right: calorieCardLeft,
            zIndex: 10,
            width: TOP_RIGHT_CIRCLE_SIZE,
            height: TOP_RIGHT_CIRCLE_SIZE,
          }}
          onPressIn={() => { profilePillScale.value = withTiming(0.99, { duration: 100, easing: Easing.out(Easing.cubic) }); }}
          onPressOut={() => { profilePillScale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) }); }}
          onPress={() => emitProfileSheetState(true)}
        >
          <Animated.View style={[{ width: TOP_RIGHT_CIRCLE_SIZE, height: TOP_RIGHT_CIRCLE_SIZE }, profilePillScaleStyle]}>
            <View
              style={{
                width: TOP_RIGHT_CIRCLE_SIZE,
                height: TOP_RIGHT_CIRCLE_SIZE,
                borderRadius: TOP_RIGHT_CIRCLE_RADIUS,
                overflow: 'hidden',
              }}
            >
              {/* Border gradient (same as bottom pill) */}
              <LinearGradient
                colors={['#4E4F50', '#4A4B4C']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: TOP_RIGHT_CIRCLE_RADIUS }}
              />
              {/* Fill gradient */}
              <LinearGradient
                colors={['#363738', '#2E2F30']}
                style={{
                  position: 'absolute',
                  top: 1,
                  left: 1,
                  right: 1,
                  bottom: 1,
                  borderRadius: TOP_RIGHT_CIRCLE_RADIUS - 1,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Image
                  source={require('../../assets/profile-top-icon.png')}
                  style={{ width: TOP_RIGHT_CIRCLE_SIZE - 8, height: TOP_RIGHT_CIRCLE_SIZE - 8 }}
                  resizeMode="contain"
                />
              </View>
            </View>
          </Animated.View>
        </Pressable>

        {/* Date row — arrows 10px from date, centered */}
        <View
          style={{
            position: 'absolute',
            top: headerTop,
            left: calorieCardLeft + HEADER_PILL_SIZE + PILL_TO_DATE_GAP,
            right: calorieCardLeft + TOP_RIGHT_CIRCLE_SIZE + PILL_TO_DATE_GAP,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            zIndex: 10,
            height: HEADER_PILL_SIZE,
          }}
          pointerEvents="box-none"
        >
          <Pressable onPress={() => handleSelectDate(toDateString(prevDay))} style={{ padding: 1 }} hitSlop={8}>
            <Ionicons name="chevron-back" size={16} color={Colors.primaryLight} />
          </Pressable>
          <Pressable onPress={() => setShowCalendar(true)} style={{ padding: 4 }} hitSlop={8}>
            <Text style={{ fontSize: 14, color: Colors.primaryLight, fontWeight: '500' }}>
              {viewingDateAsDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </Pressable>
          <Pressable onPress={() => handleSelectDate(toDateString(nextDay))} style={{ padding: 1 }} hitSlop={8}>
            <Ionicons name="chevron-forward" size={16} color={Colors.primaryLight} />
          </Pressable>
        </View>
        <AnimatedFadeInUp
          delay={40}
          duration={200}
          trigger={animTrigger}
          style={{
            marginTop: Spacing.lg,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            ...(Platform.OS === 'android' && { elevation: 2 }),
          }}
        >
        {/* Fitness: heatmap only. Nutrition: scrollable carousel + Recently uploaded. Animated transition on segment change. */}
        {homeSegment === 'Fitness' ? (
          <Animated.View
            key="fitness-segment"
            entering={SlideInRight.withInitialValues({ transform: [{ translateX: 24 }] }).springify().damping(200).stiffness(3000)}
            exiting={FadeOut.duration(50)}
            style={{ width: CAROUSEL_WIDTH, alignSelf: 'center' }}
          >
            <Animated.View style={cardSlideStyle}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleFitnessCarouselScroll}
              scrollEventThrottle={16}
              style={{ width: CAROUSEL_WIDTH }}
              contentContainerStyle={{ width: CAROUSEL_WIDTH * 2 }}
              nestedScrollEnabled
              directionalLockEnabled
            >
              {/* Fitness page 0: heatmap — isolated (no card wrapper) */}
              <View style={{ width: CAROUSEL_WIDTH, marginBottom: Spacing.sm }}>
                {hasHeatmapSetRecords ? (
                  <HeatmapPreviewWidgetSideBySide heatmapData={weeklyHeatmap} cardWidth={CAROUSEL_WIDTH} bare />
                ) : (
                  <View style={styles.heatmapEmptyState}>
                    <Text style={styles.heatmapEmptyText}>No workout data for this week</Text>
                  </View>
                )}
              </View>
              {/* Fitness page 1: steps card only */}
              <View style={{ width: CAROUSEL_WIDTH, alignItems: 'center' }}>
                <Card
                  gradientFill
                  style={[styles.caloriesLeftCard, { width: CALORIES_CARD_WIDTH, height: CALORIES_CARD_HEIGHT, borderRadius: CALORIES_CARD_RADIUS }]}
                >
                  <View style={styles.caloriesLeftContent}>
                    <View style={styles.caloriesLeftTextWrap}>
                      <Text style={styles.caloriesLeftValue}>—</Text>
                      <Text style={styles.caloriesLeftLabel}>steps today</Text>
                    </View>
                    <View style={[styles.mainCardRing, { width: MAIN_CARD_RING_SIZE, height: MAIN_CARD_RING_SIZE, borderRadius: MAIN_CARD_RING_SIZE / 2, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={styles.stepRingValue}>—</Text>
                    </View>
                  </View>
                </Card>
              </View>
            </ScrollView>
            <View style={styles.paginationDots}>
              <View style={[styles.dot, fitnessCardPage === 0 ? styles.dotActive : undefined]} />
              <View style={[styles.dot, fitnessCardPage === 1 ? styles.dotActive : undefined]} />
            </View>
            <View style={{ paddingHorizontal: CONTENT_PADDING, marginTop: Spacing.sm, marginBottom: Spacing.sm, alignSelf: 'center' }}>
              <PillSegmentedControl value={homeSegment} onValueChange={(v) => setHomeSegment(v as SegmentValue)} width={160} />
            </View>
            {/* Recently uploaded – below toggle */}
            <Text style={styles.recentlyUploadedTitle}>Recently uploaded</Text>
            <Card
              gradientFill
              style={[
                styles.caloriesLeftCard,
                styles.recentlyUploadedCard,
                { width: CALORIES_CARD_WIDTH, minHeight: CARD_UNIFIED_HEIGHT, borderRadius: CALORIES_CARD_RADIUS, alignSelf: 'center' },
              ]}
            >
              {!todayLog?.meals?.filter((m) => !/juice/i.test(m.name)).length ? (
                <Text style={styles.recentlyUploadedPlaceholder}>tap + to add a workout</Text>
              ) : (
                <View style={styles.recentlyUploadedList}>
                  {todayLog.meals.filter((m) => !/juice/i.test(m.name)).map((meal) => (
                    <View key={meal.id} style={styles.recentlyUploadedMealRow}>
                      <Text style={styles.recentlyUploadedMealName} numberOfLines={1}>{meal.name}</Text>
                      <Text style={styles.recentlyUploadedMealCals}>{meal.calories} kcal</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
            </Animated.View>
          </Animated.View>
        ) : (
          <Animated.View
            key="nutrition-segment"
            entering={SlideInLeft.withInitialValues({ transform: [{ translateX: -2 }] }).springify().damping(200).stiffness(3000)}
            exiting={FadeOut.duration(50)}
          >
          <Animated.View style={cardSlideStyle}>
          <View style={{ position: 'relative' }}>
            <View>
        {settings && todayLog && (
          <View style={{ width: CAROUSEL_WIDTH }}>
            <ScrollView
              ref={nutritionScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleNutritionCarouselScroll}
              scrollEventThrottle={16}
              style={{ width: CAROUSEL_WIDTH }}
              contentContainerStyle={{ width: CAROUSEL_WIDTH * 2 }}
              nestedScrollEnabled
              directionalLockEnabled
            >
              {/* Nutrition page 0: macros (calories + protein/carbs/fat) */}
              <View style={{ width: CAROUSEL_WIDTH }}>
                <View>
                <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                  <Animated.View style={[cardScaleStyle, { width: CALORIES_CARD_WIDTH, alignSelf: 'center', paddingVertical: Spacing.md, paddingHorizontal: 22, marginBottom: Spacing.sm }]}>
                    <View style={styles.caloriesLeftContent}>
                      <View style={styles.caloriesLeftTextWrap}>
                        <BlurRollNumber
                          leftValue={String(Math.max(0, settings.dailyGoals.calories - todayLog.calories))}
                          eatenValue={String(todayLog.calories)}
                          eatenSuffix={`/${settings.dailyGoals.calories}`}
                          isEaten={isEaten}
                          trigger={rollTrigger}
                          textStyle={styles.caloriesLeftValue}
                          suffixStyle={styles.caloriesEatenGoal}
                          height={40}
                        />
                        <View>
                          <Animated.View style={leftLabelStyle}><Text style={styles.caloriesLeftLabel}>calories left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.caloriesEatenLabel}>calories eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.mainCardRing, { width: MAIN_CARD_RING_SIZE, height: MAIN_CARD_RING_SIZE, borderRadius: MAIN_CARD_RING_SIZE / 2, justifyContent: 'center', alignItems: 'center' }]}>
                        <Image
                          source={require('../../assets/calorie-ring-flame.png')}
                          style={{ width: MAIN_CARD_RING_SIZE * 0.45, height: MAIN_CARD_RING_SIZE * 0.45, tintColor: '#FFFFFF' }}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  </Animated.View>
                </Pressable>
                </View>
                <View>
                  <Animated.View style={[styles.threeCardsRow, cardScaleStyle]}>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <View style={{ width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, flex: 0, paddingTop: 17.5, paddingBottom: 17.5, paddingHorizontal: 11, justifyContent: 'space-between', alignItems: 'stretch' }}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber
                          leftValue={`${Math.max(0, settings.dailyGoals.protein - todayLog.protein)}g`}
                          eatenValue={String(todayLog.protein)}
                          eatenSuffix={`/${settings.dailyGoals.protein}g`}
                          isEaten={isEaten}
                          trigger={rollTrigger}
                          textStyle={styles.macroLeftValue}
                          suffixStyle={styles.macroEatenGoal}
                          height={20}
                        />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>protein left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>protein eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2, justifyContent: 'center', alignItems: 'center' }]}>
                        <Image
                          source={require('../../assets/protein-ring-icon.png')}
                          style={{ width: SMALL_CARD_RING_SIZE * 0.495, height: SMALL_CARD_RING_SIZE * 0.495, tintColor: '#FFFFFF', transform: [{ rotate: '325deg' }] }}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <View style={{ width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, flex: 0, paddingTop: 17.5, paddingBottom: 17.5, paddingHorizontal: 11, justifyContent: 'space-between', alignItems: 'stretch' }}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber
                          leftValue={`${Math.max(0, settings.dailyGoals.carbs - todayLog.carbs)}g`}
                          eatenValue={String(todayLog.carbs)}
                          eatenSuffix={`/${settings.dailyGoals.carbs}g`}
                          isEaten={isEaten}
                          trigger={rollTrigger}
                          textStyle={styles.macroLeftValue}
                          suffixStyle={styles.macroEatenGoal}
                          height={20}
                        />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>carbs left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>carbs eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2, justifyContent: 'center', alignItems: 'center' }]}>
                        <Image
                          source={require('../../assets/carbs-ring-icon.png')}
                          style={{ width: SMALL_CARD_RING_SIZE * 0.45, height: SMALL_CARD_RING_SIZE * 0.45, tintColor: '#FFFFFF', transform: [{ rotate: '-45deg' }] }}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <View style={{ width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, flex: 0, paddingTop: 17.5, paddingBottom: 17.5, paddingHorizontal: 11, justifyContent: 'space-between', alignItems: 'stretch' }}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber
                          leftValue={`${Math.max(0, settings.dailyGoals.fat - todayLog.fat)}g`}
                          eatenValue={String(todayLog.fat)}
                          eatenSuffix={`/${settings.dailyGoals.fat}g`}
                          isEaten={isEaten}
                          trigger={rollTrigger}
                          textStyle={styles.macroLeftValue}
                          suffixStyle={styles.macroEatenGoal}
                          height={20}
                        />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>fat left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>fat eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2, justifyContent: 'center', alignItems: 'center' }]}>
                        <Image
                          source={require('../../assets/fat-ring-icon.png')}
                          style={{ width: SMALL_CARD_RING_SIZE * 0.495, height: SMALL_CARD_RING_SIZE * 0.495, tintColor: '#FFFFFF' }}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  </Pressable>
                  </Animated.View>
                </View>
              </View>
              {/* Nutrition page 1: electrolytes + health score (bare, no card) */}
              <View style={{ width: CAROUSEL_WIDTH }}>
                <Animated.View style={[styles.threeCardsRow, cardScaleStyle]}>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <View style={{ width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, flex: 0, paddingTop: 17.5, paddingBottom: 17.5, paddingHorizontal: 11, justifyContent: 'space-between', alignItems: 'stretch' }}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber leftValue={'\u2014mg'} eatenValue={'0'} eatenSuffix={'/\u2014mg'}
                          isEaten={isEaten} trigger={rollTrigger}
                          textStyle={styles.macroLeftValue} suffixStyle={styles.macroEatenGoal} height={20} />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>sodium left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>sodium eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2, justifyContent: 'center', alignItems: 'center' }]} />
                    </View>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <View style={{ width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, flex: 0, paddingTop: 17.5, paddingBottom: 17.5, paddingHorizontal: 11, justifyContent: 'space-between', alignItems: 'stretch' }}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber leftValue={'\u2014mg'} eatenValue={'0'} eatenSuffix={'/\u2014mg'}
                          isEaten={isEaten} trigger={rollTrigger}
                          textStyle={styles.macroLeftValue} suffixStyle={styles.macroEatenGoal} height={20} />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>potassium left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>potassium eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2, justifyContent: 'center', alignItems: 'center' }]} />
                    </View>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <View style={{ width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, flex: 0, paddingTop: 17.5, paddingBottom: 17.5, paddingHorizontal: 11, justifyContent: 'space-between', alignItems: 'stretch' }}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber leftValue={'\u2014mg'} eatenValue={'0'} eatenSuffix={'/\u2014mg'}
                          isEaten={isEaten} trigger={rollTrigger}
                          textStyle={styles.macroLeftValue} suffixStyle={styles.macroEatenGoal} height={20} />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>magnesium left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>magnesium eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2, justifyContent: 'center', alignItems: 'center' }]} />
                    </View>
                  </Pressable>
                </Animated.View>
                <View style={{ marginTop: Spacing.sm }}>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOutScaleOnly}>
                    <Animated.View style={[cardScaleStyle, { width: CALORIES_CARD_WIDTH, alignSelf: 'center', position: 'relative', ...styles.healthScoreCard }]}>
                      <Text style={styles.healthScoreTitle}>health score</Text>
                      {(!todayLog?.meals?.length) && (
                        <View style={styles.healthScoreNaWrap} pointerEvents="none">
                          <Text style={styles.healthScoreNa} numberOfLines={1}>N/A</Text>
                        </View>
                      )}
                      <View style={styles.healthScoreBarTrack}>
                        <View style={styles.healthScoreBarFill} />
                      </View>
                    </Animated.View>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        )}

            {/* Nutrition carousel dots — macros | electrolytes+health score */}
            <View style={[styles.paginationDots, { marginBottom: Spacing.xs }]}>
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNutritionPage(0); }} style={{ padding: 12, margin: -12 }}>
                <View style={[styles.dot, nutritionPage === 0 ? styles.dotActive : undefined]} />
              </Pressable>
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNutritionPage(1); }} style={{ padding: 12, margin: -12 }}>
                <View style={[styles.dot, nutritionPage === 1 ? styles.dotActive : undefined]} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: CONTENT_PADDING, marginTop: Spacing.sm, marginBottom: Spacing.sm, alignSelf: 'center' }}>
              <PillSegmentedControl value={homeSegment} onValueChange={(v) => setHomeSegment(v as SegmentValue)} width={160} />
            </View>
            {/* Recently uploaded – below toggle */}
            <View>
              <Text style={styles.recentlyUploadedTitle}>Recently uploaded</Text>
              <Card
                gradientFill
                style={[
                  styles.caloriesLeftCard,
                  styles.recentlyUploadedCard,
                  {
                    width: CALORIES_CARD_WIDTH,
                    minHeight: CARD_UNIFIED_HEIGHT,
                    borderRadius: CALORIES_CARD_RADIUS,
                    alignSelf: 'center',
                  },
                ]}
              >
                {!todayLog?.meals?.filter((m) => !/juice/i.test(m.name)).length ? (
                  <Text style={styles.recentlyUploadedPlaceholder}>tap + to add your first meal of the day.</Text>
                ) : (
                  <View style={styles.recentlyUploadedList}>
                    {todayLog.meals.filter((m) => !/juice/i.test(m.name)).map((meal) => (
                      <View key={meal.id} style={styles.recentlyUploadedMealRow}>
                        <Text style={styles.recentlyUploadedMealName} numberOfLines={1}>{meal.name}</Text>
                        <Text style={styles.recentlyUploadedMealCals}>{meal.calories} kcal</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </View>
          </View>

            {/* Blur overlay hidden — was blocking background image on some platforms; blur-to-focus disabled */}
          </View>
          </Animated.View>
        </Animated.View>
        )}
        </AnimatedFadeInUp>
      </ScrollView>
      </RNAnimated.View>

      {/* Fire streak full-screen popup — slides in from left when pill is tapped */}
      <Modal
        visible={fireStreakPopupVisible}
        transparent
        animationType="none"
        onRequestClose={closeFireStreakPopup}
        statusBarTranslucent
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent', zIndex: 100000, elevation: 100000, overflow: 'visible' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeFireStreakPopup}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(47, 48, 49, 0.5)' }]} />
          </Pressable>
          <RNAnimated.View
            pointerEvents="box-none"
            collapsable={false}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT,
              zIndex: 1,
              elevation: 20,
              transform: [{ translateX: fireStreakSlideX }],
              overflow: 'visible',
            }}
          >
            <View style={{ flex: 1, overflow: 'visible' }}>
              <ScrollView
                style={{ flex: 1, overflow: 'visible' }}
                contentContainerStyle={{
                  paddingTop: insets.top + 16,
                  paddingBottom: 120 + insets.bottom,
                  paddingHorizontal: Spacing.lg,
                }}
                showsVerticalScrollIndicator={false}
              >
                {/* Milestones title — scrolls with content */}
                <Text
                  style={{
                    fontSize: Typography.h1,
                    fontWeight: '700',
                    letterSpacing: -0.11,
                    color: Colors.primaryLight,
                    marginBottom: Spacing.xl,
                    textAlign: 'center',
                    alignSelf: 'center',
                  }}
                >
                  milestones
                </Text>
                {/* Day Streak + Badges Earned row */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: Spacing.xl,
                    marginBottom: Spacing.xl,
                  }}
                >
                  {/* Day Streak: flame + number overlay + label */}
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ position: 'relative', width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="sparkles" size={12} color="#FFD700" style={{ position: 'absolute', top: -4, left: 0 }} />
                      <Ionicons name="sparkles" size={12} color="#FFD700" style={{ position: 'absolute', top: -4, right: 0 }} />
                      <Ionicons name="sparkles" size={12} color="#FFD700" style={{ position: 'absolute', top: 24, right: -8 }} />
                      <Image
                        source={require('../../assets/firestreakhomepage.png')}
                        style={{ width: 72, height: 72 }}
                        resizeMode="contain"
                      />
                      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.primaryLight }}>0</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.primaryLight, marginTop: 8 }}>Day Streak</Text>
                  </View>

                  {/* Badges earned */}
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: Colors.accentGold,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="medal-outline" size={24} color={Colors.primaryLight} />
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.primaryLight, marginTop: 4 }}>3</Text>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: Colors.primaryLight }}>Badges earned</Text>
                  </View>
                </View>

                {/* Summary cards: Longest Streak | Badges Progress */}
                <View
                  style={{
                    flexDirection: 'row',
                    gap: Spacing.md,
                    marginBottom: Spacing.xl,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: Colors.primaryDarkLighter,
                      borderRadius: BorderRadius.md,
                      padding: Spacing.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: Spacing.sm,
                    }}
                  >
                    <Image
                      source={require('../../assets/firestreakhomepage.png')}
                      style={{ width: 28, height: 28 }}
                      resizeMode="contain"
                    />
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.primaryLight }}>2 days</Text>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: Colors.primaryLight, opacity: 0.8 }}>longest streak</Text>
                    </View>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: Colors.primaryDarkLighter,
                      borderRadius: BorderRadius.md,
                      padding: Spacing.md,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 }}>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: 'rgba(255,255,255,0.15)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="ellipse-outline" size={12} color={Colors.primaryLight} />
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.primaryLight }}>3/30 badges</Text>
                    </View>
                    <View
                      style={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: '10%',
                          height: '100%',
                          backgroundColor: Colors.accentBlue,
                          borderRadius: 2,
                        }}
                      />
                    </View>
                  </View>
                </View>

                {/* Badge grid — full Milestones set */}
                <Text style={{ fontSize: Typography.h2, fontWeight: '600', color: Colors.primaryLight, marginBottom: Spacing.md }}>Badges</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: Spacing.md,
                  }}
                >
                  {[
                    { title: 'One Hit Wonder', desc: 'Hit daily calorie goal once', value: '1', earned: false },
                    { title: 'Loyalty III', desc: 'Hit calorie goal 7 days straight', value: '7X', earned: false },
                    { title: 'Bullseye', desc: 'Hit calorie goal 30 days straight', value: '30 Day', earned: false },
                    { title: 'Helping Hand', desc: 'Invited 1 friend', value: '1', earned: false },
                    { title: 'Peer Pressurer', desc: 'Invited 3 friends', value: '3', earned: false },
                    { title: 'Cult Leader', desc: 'Invited 10 friends', value: '10', earned: false },
                    { title: 'Hydrated', desc: 'Log water intake once', value: '1', earned: false },
                    { title: "Sippin'", desc: 'Log water 3 days in a row', value: '3', earned: false },
                    { title: 'Aquaholic', desc: 'Log water 10 days in a row', value: '10', earned: false },
                    { title: 'Clean Sweep', desc: 'Log 3 meals in a day', value: '3', earned: true },
                    { title: 'Sweat Equity', desc: 'Log 5 workouts', value: '5', earned: false },
                    { title: 'Speed logger', desc: 'Save 10 meals', value: '10', earned: false },
                    { title: 'Green Machine', desc: 'Eat leafy greens 5 days in a week', value: '5', earned: false },
                    { title: 'Nut Case', desc: 'Eat nuts 4 days in a week', value: '4', earned: false },
                    { title: 'Berry Suspicious', desc: 'Eat berries 3 days in a week', value: '3', earned: false },
                    { title: 'Time Traveler', desc: 'Log a meal past midnight', value: '1', earned: false },
                    { title: 'Gremlin', desc: 'Log a meal before 6am', value: '1', earned: true },
                    { title: 'Health Nut', desc: 'Hit all macros 5 days in a row', value: '5', earned: false },
                  ].map((b, i) => (
                    <View
                      key={i}
                      style={{
                        width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2) / 3,
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 8,
                          backgroundColor: b.earned ? 'rgba(100,80,200,0.4)' : Colors.primaryDarkLighter,
                          borderWidth: 1,
                          borderColor: b.earned ? Colors.accentBlue : 'rgba(255,255,255,0.1)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.primaryLight }}>{b.value}</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.primaryLight, textAlign: 'center' }}>{b.title}</Text>
                      <Text style={{ fontSize: 10, fontWeight: '500', color: Colors.primaryLight, opacity: 0.8, textAlign: 'center' }}>{b.desc}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
              {/* Back and share — fixed, overlap everything, always on top */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: Spacing.lg,
                  paddingTop: insets.top + 8,
                  zIndex: 100,
                  elevation: 100,
                  pointerEvents: 'box-none',
                }}
              >
                <TouchableOpacity
                  onPress={closeFireStreakPopup}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
                <View style={{ width: 32 }} />
                <TouchableOpacity
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="share-outline" size={18} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>
            </View>
          </RNAnimated.View>
        </View>
      </Modal>

      <CalendarOverlay
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        selectedDate={viewingDateAsDate}
        onSelectDate={(date) => {
          handleSelectDate(toDateString(date));
          setShowCalendar(false);
        }}
        workoutDateKeys={workoutDateKeys}
      />
      </>
      )}


      {/* FAB is now rendered in _layout.tsx (inside the pill). Press event arrives via fabBridge. */}

      {/* Popup is now rendered in _layout.tsx (always on top). Card selections arrive via onCardSelect bridge. */}

      {/* Unified Camera — AI / Barcode / Food Label */}
      <Modal visible={showCamera} animationType="slide" onRequestClose={() => { setShowCamera(false); setShowAiDescribe(false); asModal && onCloseModal?.(); }}>
        <View style={styles.scannerContainer}>
          {permission?.granted && !showAiDescribe && (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={
                cameraMode === 'barcode'
                  ? { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }
                  : { barcodeTypes: [] }
              }
              onBarcodeScanned={cameraMode === 'barcode' && !cameraLoading ? handleBarCodeScanned : undefined}
            />
          )}
          {showAiDescribe && (
            <View style={styles.aiDescribeOverlay}>
              <Text style={styles.aiDescribeTitle}>Describe your food</Text>
              <Text style={styles.aiDescribeHint}>Optional — helps the AI estimate better</Text>
              <TextInput
                style={styles.aiDescribeInput}
                placeholder="e.g. grilled chicken breast with rice"
                placeholderTextColor="#888"
                value={aiDescription}
                onChangeText={setAiDescription}
                multiline
              />
              <TouchableOpacity style={styles.aiDescribeButton} onPress={handleAiSubmit} disabled={cameraLoading}>
                {cameraLoading ? <ActivityIndicator color="#2F3031" /> : <Text style={styles.aiDescribeButtonText}>Analyze</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowAiDescribe(false); setAiPhotoBase64(null); }} style={{ marginTop: 12 }}>
                <Text style={{ color: '#C6C6C6', fontSize: 14 }}>Retake</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.cameraTopBar}>
            <TouchableOpacity onPress={() => { setShowCamera(false); setShowAiDescribe(false); asModal && onCloseModal?.(); }}>
              <Text style={styles.cameraCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          {!showAiDescribe && (
            <View style={styles.cameraModeRow}>
              {(['ai', 'barcode', 'label'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.cameraModeBubble, cameraMode === mode && styles.cameraModeBubbleActive]}
                  onPress={() => setCameraMode(mode)}
                >
                  <Text style={[styles.cameraModeBubbleText, cameraMode === mode && styles.cameraModeBubbleTextActive]}>
                    {mode === 'ai' ? 'Scan Food (AI)' : mode === 'barcode' ? 'Barcode' : 'Food Label'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {!showAiDescribe && cameraMode !== 'barcode' && (
            <View style={styles.cameraShutterRow}>
              {cameraLoading ? (
                <ActivityIndicator size="large" color="#C6C6C6" />
              ) : (
                <TouchableOpacity style={styles.shutterButton} onPress={handleCameraShutter}>
                  <View style={styles.shutterButtonInner} />
                </TouchableOpacity>
              )}
            </View>
          )}
          {!showAiDescribe && cameraMode === 'barcode' && cameraLoading && (
            <View style={styles.cameraShutterRow}>
              <ActivityIndicator size="large" color="#C6C6C6" />
            </View>
          )}
        </View>
      </Modal>

      {/* Saved Foods Modal */}
      <Modal visible={showSavedFoods} animationType="slide" transparent onRequestClose={() => { setShowSavedFoods(false); asModal && onCloseModal?.(); }}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Saved Foods</Text>
            {savedFoodsList.length === 0 ? (
              <Text style={styles.emptyText}>No saved foods yet. Foods you log will appear here.</Text>
            ) : (
              <FlatList
                data={savedFoodsList}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.foodSearchItem} onPress={() => handleSelectSavedFood(item)}>
                    <Text style={styles.foodSearchName}>{item.name}</Text>
                    {item.brand ? <Text style={styles.foodSearchBrand}>{item.brand}</Text> : null}
                    <Text style={styles.foodSearchMacros}>
                      {item.calories} cal · {item.protein}p · {item.carbs}c · {item.fat}f
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <Button title="Close" onPress={() => { setShowSavedFoods(false); asModal && onCloseModal?.(); }} variant="secondary" style={{ marginTop: Spacing.md }} textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }} />
          </View>
        </View>
      </Modal>

      {/* Food Database Search Modal */}
      <Modal visible={showFoodSearch} animationType="slide" transparent onRequestClose={() => { setShowFoodSearch(false); asModal && onCloseModal?.(); }}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Search food</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search foods…"
              placeholderTextColor="#888"
              value={foodSearchQuery}
              onChangeText={handleFoodSearch}
              autoFocus
            />
            {foodSearchLoading && <ActivityIndicator style={{ marginVertical: 12 }} color="#C6C6C6" />}
            <FlatList
              data={foodSearchResults}
              keyExtractor={(_, i) => String(i)}
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.foodSearchItem} onPress={() => handleSelectFood(item)}>
                  <View style={styles.foodSearchCardLeft}>
                    {(() => {
                      const isBasic =
                        item.source === 'usda' &&
                        (!item.brand || item.brand.trim() === '') &&
                        (item.dataType === 'Foundation' || item.dataType === 'SR Legacy');
                      const brandLabel = isBasic
                        ? 'TMLSN BASICS'
                        : (item.brand && item.brand.trim() !== '' ? item.brand : '');
                      if (brandLabel === 'TMLSN BASICS') {
                        const TMLSN_BASICS_BADGE_SIZE = 11;
                        return (
                          <View style={styles.foodSearchTmlsnBasicsRow}>
                            <MaskedView
                              maskElement={
                                <Text style={[styles.foodSearchBrand, styles.foodSearchBrandTmlsnBasics, { backgroundColor: 'transparent' }]}>
                                  tmlsn basics
                                </Text>
                              }
                            >
                              <LinearGradient
                                colors={['#D4B896', '#A8895E']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                              >
                                <Text style={[styles.foodSearchBrand, styles.foodSearchBrandTmlsnBasics, { opacity: 0 }]}>
                                  tmlsn basics
                                </Text>
                              </LinearGradient>
                            </MaskedView>
                            <View style={styles.foodSearchTmlsnBasicsCheckmarkWrap}>
                              <Image
                                source={require('../../assets/gold_checkmark_badge.png')}
                                style={{
                                  width: TMLSN_BASICS_BADGE_SIZE,
                                  height: TMLSN_BASICS_BADGE_SIZE,
                                  backgroundColor: 'transparent',
                                }}
                                resizeMode="contain"
                              />
                            </View>
                          </View>
                        );
                      }
                      if (brandLabel) {
                        return (
                          <Text style={styles.foodSearchBrand} numberOfLines={1} ellipsizeMode="tail">
                            {brandLabel}
                          </Text>
                        );
                      }
                      return null;
                    })()}
                    <Text style={styles.foodSearchName} numberOfLines={1} ellipsizeMode="tail">
                      {item.name}
                    </Text>
                    <View style={styles.foodSearchMacrosRow}>
                      <Text style={styles.foodSearchMacrosPrefix}>per 100{item.unit ?? 'g'}</Text>
                      <MaskedView
                        maskElement={
                          <Text style={{ fontSize: 12, fontWeight: '500', backgroundColor: 'transparent' }}>
                            {item.calories} cal · {item.protein}g P · {item.carbs}g C · {item.fat}g F
                          </Text>
                        }
                      >
                        <LinearGradient
                          colors={['#D4B896', '#A8895E']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '500', opacity: 0 }}>
                            {item.calories} cal · {item.protein}g P · {item.carbs}g C · {item.fat}g F
                          </Text>
                        </LinearGradient>
                      </MaskedView>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={!foodSearchLoading && foodSearchQuery.length > 0 ? <Text style={styles.emptyText}>No results found</Text> : null}
              onEndReached={loadMoreFoodSearch}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                foodSearchResults.length > 0 && !foodSearchLoading ? (
                  foodSearchLoadingMore ? (
                    <ActivityIndicator color="#ffffff" style={{ paddingVertical: 24 }} />
                  ) : foodSearchHasMore ? (
                    <TouchableOpacity
                      onPress={loadMoreFoodSearch}
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
            />
            <Button title="Close" onPress={() => { setShowFoodSearch(false); asModal && onCloseModal?.(); }} variant="secondary" style={{ marginTop: Spacing.md }} textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }} />
          </View>
        </View>
      </Modal>

      {/* Meal Form Modal (Add Meal) */}
      <Modal
        visible={showAddMeal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowAddMeal(false); asModal && onCloseModal?.(); }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Meal</Text>

            <Text style={styles.inputLabel}>Meal type</Text>
            <View style={styles.mealTypeRow}>
              {(MEAL_TYPE_ORDER as MealType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.mealTypeChip,
                    mealType === type && styles.mealTypeChipActive,
                  ]}
                  onPress={() => setMealType(type)}
                >
                  <Text
                    style={[
                      styles.mealTypeChipText,
                      mealType === type && styles.mealTypeChipTextActive,
                    ]}
                  >
                    {MEAL_TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Meal Name"
              value={mealName}
              onChangeText={setMealName}
              placeholder="e.g., Breakfast, Chicken Salad"
              fontFamily={Font.regular}
            />

            <View style={styles.photoButtons}>
              <Button
                title="📷 Take Photo"
                onPress={takePhoto}
                variant="secondary"
                style={styles.photoButton}
                textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
              />
              <Button
                title="🖼️ Choose Photo"
                onPress={pickImage}
                variant="secondary"
                style={styles.photoButton}
                textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
              />
            </View>

            <Input
              label="Calories"
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              placeholder="500"
              fontFamily={Font.regular}
            />

            <View style={styles.macroRow}>
              <Input
                label="Protein (g)"
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
                placeholder="30"
                containerStyle={styles.macroInput}
                fontFamily={Font.regular}
              />
              <Input
                label="Carbs (g)"
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="numeric"
                placeholder="40"
                containerStyle={styles.macroInput}
                fontFamily={Font.regular}
              />
              <Input
                label="Fat (g)"
                value={fat}
                onChangeText={setFat}
                keyboardType="numeric"
                placeholder="15"
                containerStyle={styles.macroInput}
                fontFamily={Font.regular}
              />
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => { setShowAddMeal(false); asModal && onCloseModal?.(); }}
                variant="secondary"
                style={styles.modalButton}
                textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
              />
              <Button
                title="Add Meal"
                onPress={handleAddMeal}
                style={styles.modalButton}
                textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Goals Modal */}
      <Modal
        visible={showEditGoals}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditGoals(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Daily goals</Text>
            <Input
              label="Calories"
              value={editCalories}
              onChangeText={setEditCalories}
              keyboardType="numeric"
              placeholder="2500"
              fontFamily={Font.regular}
            />
            <Input
              label="Protein (g)"
              value={editProtein}
              onChangeText={setEditProtein}
              keyboardType="numeric"
              placeholder="150"
              fontFamily={Font.regular}
            />
            <Input
              label="Carbs (g)"
              value={editCarbs}
              onChangeText={setEditCarbs}
              keyboardType="numeric"
              placeholder="250"
              fontFamily={Font.regular}
            />
            <Input
              label="Fat (g)"
              value={editFat}
              onChangeText={setEditFat}
              keyboardType="numeric"
              placeholder="80"
              fontFamily={Font.regular}
            />
            <Input
              label="Water (oz)"
              value={editWater}
              onChangeText={setEditWater}
              keyboardType="numeric"
              placeholder="128"
              fontFamily={Font.regular}
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setShowEditGoals(false)}
                variant="secondary"
                style={styles.modalButton}
                textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
              />
              <Button
                title="Save"
                onPress={handleSaveGoals}
                style={styles.modalButton}
                textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  homeBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  flywheelOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1, // behind scroll content so logo is always on top
  },
  scrollViewLayer: {
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  flywheelWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flywheelRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: 'rgba(198, 198, 198, 0.9)',
    borderTopColor: 'transparent',
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: Spacing.md,
  },
  pillStreakCount: {
    color: '#C6C6C6',
    fontSize: 13,
    fontWeight: '500',
  },
  pageHeading: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h2 * 1.2 * 1.1,
    color: Colors.primaryLight,
    letterSpacing: CardFont.letterSpacing * 0.95 * 0.95,
  },
  cardTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
    letterSpacing: HeadingLetterSpacing,
  },
  caloriesLeftCard: {
    paddingVertical: Spacing.md,
    paddingLeft: 22, // 22 from left edge of card to number
    paddingRight: 22, // 22 from circle right edge to card right edge
    marginBottom: Spacing.sm,
    justifyContent: 'center',
  },
  caloriesLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  caloriesLeftTextWrap: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    flex: 1,
    overflow: 'hidden',
  },
  caloriesLeftValue: {
    fontSize: 36,
    fontWeight: '500',
    color: CARD_NUMBER_COLOR,
    letterSpacing: 36 * -0.03, // -3% letter spacing (-1.08)
  },
  caloriesLeftLabel: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    marginTop: -3,
    letterSpacing: -0.11,
  },
  caloriesEatenLabel: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    marginTop: -3,
    letterSpacing: -0.11,
  },
  caloriesEatenGoal: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: -0.11,
  },
  mainCardRing: {
    borderWidth: 9,
    borderColor: 'rgba(198, 198, 198, 0.8)', // #C6C6C6, 80% opacity, ring stroke
    backgroundColor: 'transparent',
    marginLeft: Spacing.md,
    marginRight: 0,
  },
  stepRingValue: {
    fontSize: 18,
    fontWeight: '500',
    color: CARD_NUMBER_COLOR,
  },
  threeCardsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    alignSelf: 'center',
  },
  macroLeftCard: {
    flex: 1,
    paddingTop: 17.5,
    paddingBottom: 17.5,
    paddingHorizontal: 11,
    marginVertical: 0,
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  macroLeftTextWrap: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    overflow: 'visible',
  },
  macroLeftValue: {
    fontSize: 16,
    fontWeight: '500',
    color: CARD_NUMBER_COLOR,
    letterSpacing: CardFont.letterSpacing,
  },
  macroLeftLabel: {
    fontSize: 10,
    color: CARD_LABEL_COLOR,
    marginTop: -3,
    letterSpacing: -0.11,
  },
  macroEatenLabel: {
    fontSize: 10,
    color: CARD_LABEL_COLOR,
    marginTop: -3,
    letterSpacing: -0.11,
  },
  macroLabelRow: {
    minWidth: 72,
  },
  macroEatenGoal: {
    fontSize: 10,
    color: CARD_LABEL_COLOR,
    letterSpacing: -0.11,
  },
  smallCardRing: {
    borderWidth: 6 * 0.99, // 1% less stroke (~5.94)
    borderColor: 'rgba(198, 198, 198, 0.8)', // #C6C6C6, 80% opacity, inside stroke
    backgroundColor: 'transparent',
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
  healthScoreCard: {
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingLeft: 16,
    overflow: 'visible',
  },
  healthScoreHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  healthScoreTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: -0.11,
  },
  healthScoreNaWrap: {
    position: 'absolute',
    top: 24,
    right: 15, // matches bar right edge (349 - 15 - 319 = 15)
    alignItems: 'flex-end',
  },
  healthScoreNa: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0, // no negative spacing – prevents last-char clipping
  },
  healthScoreBarTrack: {
    position: 'absolute',
    top: 48,
    left: 15,
    right: 15,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(198, 198, 198, 0.2)', // darker uncomplete track
    overflow: 'hidden',
  },
  healthScoreBarFill: {
    width: '0%', // placeholder – 0% filled for now
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C6C6C6',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(198, 198, 198, 0.3)',
  },
  dotActive: {
    backgroundColor: 'rgba(198, 198, 198, 0.9)',
  },
  recentlyUploadedTitle: {
    fontSize: Typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: CardFont.letterSpacing,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  heatmapEmptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  heatmapEmptyText: {
    fontSize: Typography.body,
    color: Colors.primaryLight + '80',
  },
  recentlyUploadedCard: {
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
  },
  recentlyUploadedPlaceholder: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: -0.11,
    textAlign: 'center',
  },
  recentlyUploadedList: {
    gap: Spacing.sm,
  },
  recentlyUploadedMealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentlyUploadedMealName: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: -0.11,
    flex: 1,
    marginRight: Spacing.sm,
  },
  recentlyUploadedMealCals: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: -0.11,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  macrosContainer: {
    gap: Spacing.md,
  },
  macroItem: {
    marginBottom: Spacing.sm,
  },
  macroValue: {
    fontFamily: Font.bold,
    fontSize: Typography.dataValue,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryLight,
  },
  macroGoal: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  macroLabel: {
    fontFamily: Font.regular,
    fontSize: Typography.label,
    color: Colors.primaryLight,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.primaryLight + '30',
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.sm,
  },
  waterValue: {
    fontFamily: Font.bold,
    fontSize: Typography.dataValue,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryLight,
  },
  waterButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  waterButton: {
    flex: 1,
    backgroundColor: Colors.primaryLight + '20',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  waterButtonText: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
  },
  editGoalsLink: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
  },
  emptyText: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  mealSection: {
    marginBottom: Spacing.md,
  },
  mealSectionTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.label,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
    textTransform: 'capitalize',
    letterSpacing: HeadingLetterSpacing,
  },
  mealItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight + '20',
  },
  mealName: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
  },
  mealMacros: {
    fontFamily: Font.regular,
    fontSize: Typography.label,
    color: Colors.primaryLight,
  },
  // ── FAB ──
  fabTouchable: {
    position: 'absolute',
    alignSelf: 'center',
    width: 56,
    height: 56,
    zIndex: 100,
  },
  fab: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabStarWrap: {
    position: 'absolute',
    width: 58,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabStarImg: {
    width: '100%',
    height: '100%',
  },
  fabIconWrap: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabPlusH: {
    position: 'absolute',
    width: 24,
    height: 3.6,
    borderRadius: 1.8,
    backgroundColor: '#2F3031',
  },
  fabPlusV: {
    position: 'absolute',
    width: 3.6,
    height: 24,
    borderRadius: 1.8,
    backgroundColor: '#2F3031',
  },
  // ── Camera ──
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraTopBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  cameraCloseText: {
    fontSize: 16,
    color: '#C6C6C6',
  },
  cameraModeRow: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  cameraModeBubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  cameraModeBubbleActive: {
    backgroundColor: '#C6C6C6',
  },
  cameraModeBubbleText: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: CARD_LABEL_FONT_SIZE * -0.12,
  },
  cameraModeBubbleTextActive: {
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    letterSpacing: CARD_LABEL_FONT_SIZE * -0.12,
    color: '#2F3031',
  },
  cameraShutterRow: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#C6C6C6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#C6C6C6',
  },
  // ── AI Describe ──
  aiDescribeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2F3031',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 5,
  },
  aiDescribeTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  aiDescribeHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 20,
  },
  aiDescribeInput: {
    width: '100%',
    minHeight: 80,
    backgroundColor: '#3D3E3F',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  aiDescribeButton: {
    backgroundColor: '#C6C6C6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  aiDescribeButtonText: {
    fontSize: 16,
    color: '#2F3031',
  },
  // ── Food search items ──
  searchInput: {
    backgroundColor: '#3D3E3F',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 12,
  },
  foodSearchItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(198,198,198,0.15)',
  },
  foodSearchCardLeft: {
    flex: 1,
  },
  foodSearchBrand: {
    fontSize: 11,
    color: Colors.primaryLight,
    fontWeight: '400',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  foodSearchBrandTmlsnBasics: {
    color: Colors.accentChampagne,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  foodSearchTmlsnBasicsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 1,
  },
  foodSearchTmlsnBasicsCheckmarkWrap: {
    marginLeft: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    marginTop: -3,
  },
  foodSearchName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  foodSearchMacros: {
    fontSize: 12,
    color: Colors.primaryLight,
    marginTop: 2,
  },
  foodSearchMacrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  foodSearchMacrosPrefix: {
    fontSize: 10,
    color: Colors.primaryLight,
  },
  foodSearchMacrosValues: {
    fontSize: 12,
    color: Colors.accentChampagne,
    fontWeight: '500',
  },
  addButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.primaryDark,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  modalTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h1,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryLight,
    marginBottom: Spacing.lg,
    letterSpacing: HeadingLetterSpacing,
  },
  inputLabel: {
    fontFamily: Font.extraBold,
    fontSize: Typography.label,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
    letterSpacing: HeadingLetterSpacing,
  },
  mealTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  mealTypeChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight + '20',
  },
  mealTypeChipActive: {
    backgroundColor: Colors.accentBlue,
  },
  mealTypeChipText: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  mealTypeChipTextActive: {
    fontFamily: Font.semiBold,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  photoButton: {
    flex: 1,
  },
  macroRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  macroInput: {
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
  },
});
