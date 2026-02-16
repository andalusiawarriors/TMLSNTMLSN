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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import { onCardSelect, emitStreakPopupState } from '../../utils/fabBridge';
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
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { BlurRollNumber } from '../../components/BlurRollNumber';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import {
  getNutritionLogByDate,
  saveNutritionLog,
  getUserSettings,
  saveUserSettings,
  getSavedFoods,
  saveSavedFood,
} from '../../utils/storage';
import { NutritionLog, Meal, MealType, UserSettings, SavedFood } from '../../types';
import { generateId, getTodayDateString, toDateString } from '../../utils/helpers';
import SwipeableWeekView from '../../components/SwipeableWeekView';
import { StreakWidget } from '../../components/StreakWidget';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchByBarcode, searchFoods, ParsedNutrition } from '../../utils/foodApi';
import { analyzeFood, readNutritionLabel, isGeminiConfigured } from '../../utils/geminiApi';

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

const WEEK_STRIP_PAGE_WIDTH = Dimensions.get('window').width - Spacing.md * 2;

export default function NutritionScreen() {
  const pathname = usePathname();
  const [viewingDate, setViewingDate] = useState<string>(() => getTodayDateString());
  const [todayLog, setTodayLog] = useState<NutritionLog | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [showEditGoals, setShowEditGoals] = useState(false);
  const [cardPage, setCardPage] = useState(0);

  const viewingDateAsDate = useMemo(() => new Date(viewingDate + 'T12:00:00'), [viewingDate]);

  const cardScale = useSharedValue(1);
  const cardScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  // Top pills: scale-in on press (same as calorie card, no sound)
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

  // ── Day-switch card slide animation ──
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
  const cardSlideX = useSharedValue(0);
  const cardSlideOpacity = useSharedValue(1);
  const prevDateRef = useRef<string>(viewingDate);
  const SLIDE_DISTANCE = SCREEN_WIDTH * 0.3;

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
  const clickSoundRef = useRef<Audio.Sound | null>(null);
  const tapSoundRef = useRef<Audio.Sound | null>(null);
  const cardPressInSoundRef = useRef<Audio.Sound | null>(null);
  const cardPressOutSoundRef = useRef<Audio.Sound | null>(null);
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
  }, [viewingDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const prevViewingDateRef = useRef(viewingDate);
  // Load the selected day's log when user taps a different date (not on initial mount)
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/24d86888-ef82-444e-aad8-90b62a37b0c8', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'nutrition.tsx:viewingDate', message: 'viewingDate effect', data: { hypothesisId: 'H4', viewingDate, prev: prevViewingDateRef.current }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
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

  const applyDateAndSlideIn = useCallback((dateString: string, forward: boolean) => {
    setViewingDate(dateString);
    prevDateRef.current = dateString;
    // Snap to entry position on the opposite side (forward = slid out left → enter from right)
    cardSlideX.value = forward ? SLIDE_DISTANCE : -SLIDE_DISTANCE;
    cardSlideOpacity.value = 0;
    cardTextReveal.value = 0;
    // Animate in: slide + fade + blur-to-focus text (~220ms easeOut)
    cardSlideX.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });
    cardSlideOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    cardTextReveal.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
  }, [cardSlideX, cardSlideOpacity, cardTextReveal, SLIDE_DISTANCE]);

  const handleSelectDate = useCallback((dateString: string) => {
    if (dateString === prevDateRef.current) return;
    const forward = dateString > prevDateRef.current;

    // Animate out: slide and fade — ~180ms easeIn
    const exitX = forward ? -SLIDE_DISTANCE : SLIDE_DISTANCE;
    cardSlideX.value = withTiming(exitX, { duration: 180, easing: Easing.in(Easing.quad) });
    cardSlideOpacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }, () => {
      runOnJS(applyDateAndSlideIn)(dateString, forward);
    });
  }, [cardSlideX, cardSlideOpacity, SLIDE_DISTANCE, applyDateAndSlideIn]);

  // Load sounds: tap, click, card in/out (popup sounds moved to _layout.tsx)
  useEffect(() => {
    let clickSound: Audio.Sound | null = null;
    let tapSound: Audio.Sound | null = null;
    let cardPressInSound: Audio.Sound | null = null;
    let cardPressOutSound: Audio.Sound | null = null;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true, // UI feedback sounds play even when device is muted
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound: sClick } = await Audio.Sound.createAsync(
          require('../../assets/sounds/click.mp4')
        );
        await sClick.setVolumeAsync(0.64);
        clickSound = sClick;
        clickSoundRef.current = sClick;

        const { sound: sTap } = await Audio.Sound.createAsync(
          require('../../assets/sounds/tap.mp4')
        );
        await sTap.setVolumeAsync(0.64);
        tapSound = sTap;
        tapSoundRef.current = sTap;

        const { sound: sCardIn } = await Audio.Sound.createAsync(
          require('../../assets/sounds/card-press-in.mp4')
        );
        await sCardIn.setVolumeAsync(0.2);
        cardPressInSound = sCardIn;
        cardPressInSoundRef.current = sCardIn;

        const { sound: sCardOut } = await Audio.Sound.createAsync(
          require('../../assets/sounds/card-press-out.mp4')
        );
        await sCardOut.setVolumeAsync(0.2);
        cardPressOutSound = sCardOut;
        cardPressOutSoundRef.current = sCardOut;
      } catch (_) {
        // Assets missing or load failed – sounds will be silent
      }
    })();
    return () => {
      clickSoundRef.current = null;
      tapSoundRef.current = null;
      cardPressInSoundRef.current = null;
      cardPressOutSoundRef.current = null;
      if (clickSound) clickSound.unloadAsync().catch(() => {});
      if (tapSound) tapSound.unloadAsync().catch(() => {});
      if (cardPressInSound) cardPressInSound.unloadAsync().catch(() => {});
      if (cardPressOutSound) cardPressOutSound.unloadAsync().catch(() => {});
    };
  }, []);

  // Fire-and-forget; replayAsync() starts from beginning immediately (better on iOS). Errors caught to avoid console noise.
  const playClickSound = useCallback(() => {
    const s = clickSoundRef.current;
    if (!s) return;
    s.replayAsync({}).catch(() => {});
  }, []);

  const playTapSound = useCallback(() => {
    const s = tapSoundRef.current;
    if (!s) return;
    s.replayAsync({}).catch(() => {});
  }, []);

  // Press = one sound, release = other sound (cards: 0213(5) in / 0213(6) out; FAB: 0213(3) in / 0213(4) out)
  const playCardPressInSound = useCallback(() => {
    const s = cardPressInSoundRef.current;
    if (!s) return;
    s.replayAsync({}).catch(() => {});
  }, []);
  const playCardPressOutSound = useCallback(() => {
    const s = cardPressOutSoundRef.current;
    if (!s) return;
    s.replayAsync({}).catch(() => {});
  }, []);


  // ── Form helpers ──
  const resetMealForm = () => {
    setMealName(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setMealImage(undefined);
  };

  const fillAndShowForm = (data: ParsedNutrition) => {
    setMealName(data.brand ? `${data.name} (${data.brand})` : data.name);
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

  const handleChoiceScanFood = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera Required', 'Camera permission is needed to scan food.');
        return;
      }
    }
    setCameraMode('ai');
    setCameraLoading(false);
    setShowAiDescribe(false);
    setAiPhotoBase64(null);
    setAiDescription('');
    setShowCamera(true);
  };

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
    searchTimeoutRef.current = setTimeout(async () => {
      setFoodSearchLoading(true);
      const results = await searchFoods(query);
      setFoodSearchResults(results);
      setFoodSearchLoading(false);
    }, 500);
  }, []);

  const handleSelectFood = (food: ParsedNutrition) => {
    setShowFoodSearch(false);
    fillAndShowForm(food);
  };

  const handleSelectSavedFood = (food: SavedFood) => {
    setShowSavedFoods(false);
    fillAndShowForm({
      name: food.name, brand: food.brand || '', calories: food.calories,
      protein: food.protein, carbs: food.carbs, fat: food.fat, servingSize: '',
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

    const result = await ImagePicker.launchImagePickerAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const insets = useSafeAreaInsets();
  const headerHeight = 44;

  // Calories left card: 349×136 dp, radius 16
  const CALORIES_CARD_WIDTH = 349;
  const CALORIES_CARD_HEIGHT = 136;
  const CALORIES_CARD_RADIUS = 16;

  // Macro cards (Protein, Carbs, Fat): 112×140 dp, radius 16
  const MACRO_CARD_WIDTH = 112;
  const MACRO_CARD_HEIGHT = 140;
  const MACRO_CARD_RADIUS = 16;

  // Carousel (horizontal paging between normal and flipped card layouts)
  const CAROUSEL_WIDTH = Dimensions.get('window').width - Spacing.md * 2;
  const handleCarouselScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / CAROUSEL_WIDTH);
    setCardPage(page);
  };

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

  const onCarouselScrollBeginDrag = () => {
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

  // Top pills: 54pt from screen top; horizontal padding = calorie card inset (Spacing.md + centering offset)
  const TOP_LEFT_PILL_TOP = 54;
  const calorieCardLeft = Spacing.md + (CAROUSEL_WIDTH - CALORIES_CARD_WIDTH) / 2;
  const TOP_RIGHT_CIRCLE_SIZE = 40; // circle, same stroke as pill
  const TOP_RIGHT_CIRCLE_RADIUS = TOP_RIGHT_CIRCLE_SIZE / 2; // 20

  return (
    <View style={styles.container}>
      <RNAnimated.View style={{ flex: 1, transform: [{ translateX: contentShiftX }] }}>
        {/* Circular gradient background at 0% 0%: #2f3031 → #1a1a1a */}
        <View style={styles.homeBackgroundImage} pointerEvents="none">
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="homeBgGrad" cx="0%" cy="0%" r="150%" fx="0%" fy="0%">
                <Stop offset="0" stopColor="#2f3031" />
                <Stop offset="1" stopColor="#1a1a1a" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeBgGrad)" />
          </Svg>
        </View>
        {/* Flywheel at fixed Y: reveals progressively on pull, spins on refresh, then rises with haptic */}
        <View
          style={[styles.flywheelOverlay, { top: TOP_LEFT_PILL_TOP + 12 }]}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="transparent"
          />
        }
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: TOP_LEFT_PILL_TOP },
        ]}
      >
        {/* Top-left pill — same as workout page: StreakWidget (liquid glass, enso, navigates to streak) */}
        <View
          style={{
            position: 'absolute',
            top: TOP_LEFT_PILL_TOP,
            left: calorieCardLeft,
            zIndex: 10,
          }}
        >
          <StreakWidget />
        </View>

        {/* Top-right circle — same stroke + slight gradient; scale animation like calorie card (no sound) */}
        <Pressable
          style={{
            position: 'absolute',
            top: TOP_LEFT_PILL_TOP,
            right: calorieCardLeft,
            zIndex: 10,
            width: TOP_RIGHT_CIRCLE_SIZE,
            height: TOP_RIGHT_CIRCLE_SIZE,
          }}
          onPressIn={() => { profilePillScale.value = withTiming(0.99, { duration: 100, easing: Easing.out(Easing.cubic) }); }}
          onPressOut={() => { profilePillScale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) }); }}
          onPress={() => {}}
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

        <View style={styles.pageHeaderRow}>
          <View style={styles.pageHeaderLogoPressable}>
            <Image
              source={require('../../assets/tmlsn-calories-logo.png')}
              style={styles.pageHeaderLogo}
              resizeMode="contain"
            />
          </View>
        </View>
        <SwipeableWeekView
          weekWidth={WEEK_STRIP_PAGE_WIDTH}
          selectedDate={viewingDateAsDate}
          onDaySelect={(date) => handleSelectDate(toDateString(date))}
          initialDate={viewingDateAsDate}
          showHeader={false}
        />
        {/* Animated wrapper for day-switch slide + real blur overlay (BlurView fades out → sharp) */}
        <Animated.View style={cardSlideStyle}>
          <View style={{ position: 'relative' }}>
            <View>
        {/* Macro cards carousel – swipe left to reveal flipped layout */}
        {settings && todayLog && (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleCarouselScroll}
              onScrollBeginDrag={onCarouselScrollBeginDrag}
              scrollEventThrottle={16}
              style={{ width: CAROUSEL_WIDTH }}
            >
              {/* Page 1: Big card top, 3 small cards bottom */}
              <View style={{ width: CAROUSEL_WIDTH }}>
                <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                  <Animated.View style={cardScaleStyle}>
                    <Card gradientFill style={[styles.caloriesLeftCard, { width: CALORIES_CARD_WIDTH, height: CALORIES_CARD_HEIGHT, borderRadius: CALORIES_CARD_RADIUS, alignSelf: 'center' }]}>
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
                    </Card>
                  </Animated.View>
                </Pressable>
                <Animated.View style={[styles.threeCardsRow, cardScaleStyle]}>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card gradientFill style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
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
                    </Card>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card gradientFill style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
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
                    </Card>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card gradientFill style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
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
                    </Card>
                  </Pressable>
                </Animated.View>
              </View>

              {/* Page 2: Electrolytes top, Health Score bottom (flipped layout) */}
              <View style={{ width: CAROUSEL_WIDTH }}>
                <Animated.View style={[styles.threeCardsRow, cardScaleStyle]}>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card gradientFill style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber leftValue={'\u2014mg'} eatenValue={'0'} eatenSuffix={'/\u2014mg'}
                          isEaten={isEaten} trigger={rollTrigger}
                          textStyle={styles.macroLeftValue} suffixStyle={styles.macroEatenGoal} height={20} />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>sodium left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>sodium eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card gradientFill style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber leftValue={'\u2014mg'} eatenValue={'0'} eatenSuffix={'/\u2014mg'}
                          isEaten={isEaten} trigger={rollTrigger}
                          textStyle={styles.macroLeftValue} suffixStyle={styles.macroEatenGoal} height={20} />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>potassium left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>potassium eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card gradientFill style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber leftValue={'\u2014mg'} eatenValue={'0'} eatenSuffix={'/\u2014mg'}
                          isEaten={isEaten} trigger={rollTrigger}
                          textStyle={styles.macroLeftValue} suffixStyle={styles.macroEatenGoal} height={20} />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>magnesium left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>magnesium eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </Pressable>
                </Animated.View>
                <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOutScaleOnly}>
                  <Animated.View style={cardScaleStyle}>
                    <Card gradientFill style={[styles.caloriesLeftCard, styles.healthScoreCard, { width: CALORIES_CARD_WIDTH, height: CALORIES_CARD_HEIGHT, borderRadius: CALORIES_CARD_RADIUS, alignSelf: 'center' }]}>
                      <View style={styles.healthScoreHeaderRow}>
                        <Text style={styles.healthScoreTitle}>health score</Text>
                      </View>
                      {(!todayLog?.meals?.length) && (
                        <View style={styles.healthScoreNaWrap} pointerEvents="none">
                          <Text style={styles.healthScoreNa} numberOfLines={1}>
                            N/A
                          </Text>
                        </View>
                      )}
                      <View style={styles.healthScoreBarTrack}>
                        <View style={styles.healthScoreBarFill} />
                      </View>
                    </Card>
                  </Animated.View>
                </Pressable>
              </View>
            </ScrollView>

            {/* Pagination dots */}
            <View style={styles.paginationDots}>
              <View style={[styles.dot, cardPage === 0 && styles.dotActive]} />
              <View style={[styles.dot, cardPage === 1 && styles.dotActive]} />
            </View>
          </>
        )}

        {/* Recently uploaded – title + card same width/alignment as calorie card above */}
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
        />
            </View>
            <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, blurOverlayStyle]} pointerEvents="none">
              <BlurView
                intensity={100}
                tint="dark"
                {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
                style={StyleSheet.absoluteFill}
              />
              {/* Strong frosted tint so diffuse/out-of-focus is visible even when native blur is subtle */}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(47, 48, 49, 0.72)' }]} />
            </Animated.View>
          </View>
        </Animated.View>
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
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}>
          <Pressable
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'transparent', zIndex: 0 }]}
            onPress={closeFireStreakPopup}
          />
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
              backgroundColor: Colors.primaryDark,
              transform: [{ translateX: fireStreakSlideX }],
            }}
          >
            <ImageBackground
              source={require('../../assets/streakbackground.png')}
              style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
              resizeMode="cover"
            >
              <View style={{ flex: 1, paddingTop: 60, paddingHorizontal: Spacing.lg }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
                  <Text style={{ fontFamily: Font.semiBold, fontSize: 22, color: Colors.primaryLight }}>Fire Streak</Text>
                  <Pressable onPress={closeFireStreakPopup} hitSlop={12}>
                    <Text style={{ fontSize: 28, color: Colors.primaryLight }}>×</Text>
                  </Pressable>
                </View>
                <Text style={{ fontFamily: Font.regular, fontSize: 17, color: Colors.primaryLight }}>
                  Your streak and fire stats will appear here.
                </Text>
              </View>
            </ImageBackground>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* FAB is now rendered in _layout.tsx (inside the pill). Press event arrives via fabBridge. */}

      {/* Popup is now rendered in _layout.tsx (always on top). Card selections arrive via onCardSelect bridge. */}

      {/* Unified Camera — AI / Barcode / Food Label */}
      <Modal visible={showCamera} animationType="slide" onRequestClose={() => { setShowCamera(false); setShowAiDescribe(false); }}>
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
            <TouchableOpacity onPress={() => { setShowCamera(false); setShowAiDescribe(false); }}>
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
      <Modal visible={showSavedFoods} animationType="slide" transparent onRequestClose={() => setShowSavedFoods(false)}>
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
            <Button title="Close" onPress={() => setShowSavedFoods(false)} variant="secondary" style={{ marginTop: Spacing.md }} textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }} />
          </View>
        </View>
      </Modal>

      {/* Food Database Search Modal */}
      <Modal visible={showFoodSearch} animationType="slide" transparent onRequestClose={() => setShowFoodSearch(false)}>
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
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.foodSearchItem} onPress={() => handleSelectFood(item)}>
                  <Text style={styles.foodSearchName}>{item.name}</Text>
                  {item.brand ? <Text style={styles.foodSearchBrand}>{item.brand}</Text> : null}
                  <Text style={styles.foodSearchMacros}>
                    {item.calories} cal · {item.protein}p · {item.carbs}c · {item.fat}f
                    {item.servingSize ? ` · ${item.servingSize}` : ''}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={!foodSearchLoading && foodSearchQuery.length > 0 ? <Text style={styles.emptyText}>No results found</Text> : null}
            />
            <Button title="Close" onPress={() => setShowFoodSearch(false)} variant="secondary" style={{ marginTop: Spacing.md }} textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }} />
          </View>
        </View>
      </Modal>

      {/* Meal Form Modal (Add Meal) */}
      <Modal
        visible={showAddMeal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddMeal(false)}
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
                onPress={() => setShowAddMeal(false)}
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
    zIndex: 2, // scroll content (including logo) always in front of flywheel
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  pillStreakCount: {
    color: '#C6C6C6',
    fontSize: 13,
    fontWeight: '500',
  },
  pageHeaderRow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  pageHeaderLogo: {
    height: (Typography.h2 + 10) * 1.2 * 1.1,
    width: (Typography.h2 + 10) * 1.2 * 1.1,
  },
  pageHeaderLogoPressable: {},
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
    left: 15, // center 319-wide bar in 349 card
    width: 319,
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
  recentlyUploadedCard: {
    marginBottom: Spacing.sm,
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
  foodSearchName: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  foodSearchBrand: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  foodSearchMacros: {
    fontSize: 12,
    color: '#C6C6C6',
    marginTop: 4,
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
