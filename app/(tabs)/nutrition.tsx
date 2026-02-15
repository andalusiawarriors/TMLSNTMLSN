import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ActivityIndicator,
  FlatList,
  TextInput,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import { onCardSelect } from '../../utils/fabBridge';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
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

// DM Mono for calories/macro cards (as in tab bar)
const CardFont = {
  family: 'DMMono_500Medium',
  letterSpacing: -0.1,
} as const;

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
  const cardSlideX = useSharedValue(0);
  const cardSlideOpacity = useSharedValue(1);
  const cardSlideScale = useSharedValue(1);
  const prevDateRef = useRef<string>(viewingDate);
  const SLIDE_DISTANCE = Dimensions.get('window').width * 0.25;

  const cardSlideStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cardSlideX.value },
      { scale: cardSlideScale.value },
    ],
    opacity: cardSlideOpacity.value,
  }));

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

  const [showFlickerLogo, setShowFlickerLogo] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const lastFlickerRef = useRef(0);
  const flickerTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const darkLogoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IDLE_MS = 10000; // flicker after 10s idle
  const DARK_LOGO_HOLD_MS = 10000; // after flickers, hold dark logo for 10s then back to main
  const FLICKER_COOLDOWN_MS = 8000;
  const LOGO_RAPID_PRESS_COUNT = 10;
  const LOGO_RAPID_WINDOW_MS = 2500;
  const logoRapidPressCountRef = useRef(0);
  const logoRapidWindowStartRef = useRef(0);
  // Quick flickers: [showAltMs, showMainMs] pairs; then we hold alt for 10s
  const FLICKER_SEQUENCE: [number, number][] = [[100, 70], [180, 90], [120, 80]];
  const reportActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (darkLogoTimeoutRef.current) {
      clearTimeout(darkLogoTimeoutRef.current);
      darkLogoTimeoutRef.current = null;
    }
    setShowFlickerLogo(false);
  }, []);

  const runFlickerThenHold = useCallback(() => {
    flickerTimeoutsRef.current.forEach(clearTimeout);
    flickerTimeoutsRef.current = [];
    if (darkLogoTimeoutRef.current) clearTimeout(darkLogoTimeoutRef.current);
    let delay = 0;
    FLICKER_SEQUENCE.forEach(([onMs, offMs]) => {
      flickerTimeoutsRef.current.push(setTimeout(() => setShowFlickerLogo(true), delay));
      delay += onMs;
      flickerTimeoutsRef.current.push(setTimeout(() => setShowFlickerLogo(false), delay));
      delay += offMs;
    });
    // After the flickers, show dark logo for 10s then revert to main without flickering
    flickerTimeoutsRef.current.push(setTimeout(() => {
      setShowFlickerLogo(true);
      darkLogoTimeoutRef.current = setTimeout(() => {
        setShowFlickerLogo(false);
        darkLogoTimeoutRef.current = null;
        lastFlickerRef.current = Date.now(); // so idle doesn't re-trigger flicker right after revert
      }, DARK_LOGO_HOLD_MS);
    }, delay));
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      const idleLongEnough = now - lastActivityRef.current >= IDLE_MS;
      const cooldownPassed = now - lastFlickerRef.current >= FLICKER_COOLDOWN_MS;
      const notInDarkHold = darkLogoTimeoutRef.current == null; // don't interrupt 10s revert
      if (idleLongEnough && cooldownPassed && notInDarkHold) {
        lastFlickerRef.current = now;
        runFlickerThenHold();
      }
    }, 600);
    return () => {
      clearInterval(t);
      flickerTimeoutsRef.current.forEach(clearTimeout);
      if (darkLogoTimeoutRef.current) clearTimeout(darkLogoTimeoutRef.current);
    };
  }, [runFlickerThenHold]);

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
    // Snap to entry position on the opposite side
    cardSlideX.value = forward ? SLIDE_DISTANCE * 0.6 : -SLIDE_DISTANCE * 0.6;
    cardSlideScale.value = 0.97;
    cardSlideOpacity.value = 0;
    // Spring in — organic, slightly bouncy settle
    const springConfig = { damping: 22, stiffness: 280, mass: 0.8 };
    cardSlideX.value = withSpring(0, springConfig);
    cardSlideScale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.7 });
    cardSlideOpacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [cardSlideX, cardSlideOpacity, cardSlideScale, SLIDE_DISTANCE]);

  const handleSelectDate = useCallback((dateString: string) => {
    if (dateString === prevDateRef.current) return;
    const forward = dateString > prevDateRef.current;
    prevDateRef.current = dateString;

    // Quick exit — scale down slightly, slide and fade out
    const exitX = forward ? -SLIDE_DISTANCE : SLIDE_DISTANCE;
    cardSlideX.value = withTiming(exitX, { duration: 140, easing: Easing.in(Easing.quad) });
    cardSlideScale.value = withTiming(0.96, { duration: 140, easing: Easing.in(Easing.quad) });
    cardSlideOpacity.value = withTiming(0, { duration: 120, easing: Easing.in(Easing.quad) }, () => {
      // Once exit completes, update data and spring in from the other side
      runOnJS(applyDateAndSlideIn)(dateString, forward);
    });
  }, [cardSlideX, cardSlideOpacity, cardSlideScale, SLIDE_DISTANCE, applyDateAndSlideIn]);

  // Load sounds: tap, click, card in/out (popup sounds moved to _layout.tsx)
  useEffect(() => {
    let clickSound: Audio.Sound | null = null;
    let tapSound: Audio.Sound | null = null;
    let cardPressInSound: Audio.Sound | null = null;
    let cardPressOutSound: Audio.Sound | null = null;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: false, // respect silent mode – no sounds when muted
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
      if (clickSound) clickSound.unloadAsync();
      if (tapSound) tapSound.unloadAsync();
      if (cardPressInSound) cardPressInSound.unloadAsync();
      if (cardPressOutSound) cardPressOutSound.unloadAsync();
      clickSoundRef.current = null;
      tapSoundRef.current = null;
      cardPressInSoundRef.current = null;
      cardPressOutSoundRef.current = null;
    };
  }, []);

  const playClickSound = useCallback(() => {
    const s = clickSoundRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
  }, []);

  const playTapSound = useCallback(() => {
    const s = tapSoundRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
  }, []);

  // Press = one sound, release = other sound (cards: 0213(5) in / 0213(6) out; FAB: 0213(3) in / 0213(4) out)
  const playCardPressInSound = useCallback(() => {
    const s = cardPressInSoundRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
  }, []);
  const playCardPressOutSound = useCallback(() => {
    const s = cardPressOutSoundRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
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
      reportActivity();
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
  const contentTopPadding = ((insets.top + headerHeight) / 2 + Spacing.md) * 1.2;

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
    reportActivity();
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / CAROUSEL_WIDTH);
    setCardPage(page);
  };

  const TAP_SLOP = 20; // px – only commit toggle on release when finger moved less than this (larger for Mac/simulator)
  const cardTouchStart = useRef({ x: 0, y: 0 });
  const carouselDraggedRef = useRef(false); // set true when carousel scroll starts – prevents toggle on release

  const onCardPressIn = (e: { nativeEvent: { pageX: number; pageY: number } }) => {
    reportActivity();
    cardTouchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    carouselDraggedRef.current = false;
    playCardPressInSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cardScale.value = withTiming(0.99, { duration: 100, easing: Easing.out(Easing.cubic) });
  };

  const onCardPressOut = (e: { nativeEvent: { pageX: number; pageY: number } }) => {
    const { x, y } = cardTouchStart.current;
    const dx = e.nativeEvent.pageX - x;
    const dy = e.nativeEvent.pageY - y;
    const moved = Math.sqrt(dx * dx + dy * dy);
    const wasDrag = carouselDraggedRef.current || moved >= TAP_SLOP;
    if (!wasDrag) {
      playCardPressOutSound();
      isEaten.value = isEaten.value === 0 ? 1 : 0;
      rollTrigger.value = rollTrigger.value + 1;
    }
    carouselDraggedRef.current = false;
    cardScale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) });
  };

  const onCarouselScrollBeginDrag = () => {
    reportActivity();
    carouselDraggedRef.current = true; // user is dragging carousel – don’t count release as tap
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: contentTopPadding },
        ]}
      >
        <View style={styles.pageHeaderRow}>
          <Pressable
            onPress={() => {
              const now = Date.now();
              if (now - logoRapidWindowStartRef.current > LOGO_RAPID_WINDOW_MS) {
                logoRapidPressCountRef.current = 0;
                logoRapidWindowStartRef.current = now;
              }
              logoRapidPressCountRef.current += 1;
              if (logoRapidPressCountRef.current >= LOGO_RAPID_PRESS_COUNT) {
                logoRapidPressCountRef.current = 0;
                logoRapidWindowStartRef.current = 0;
                lastFlickerRef.current = Date.now();
                runFlickerThenHold();
              }
            }}
            style={styles.pageHeaderLogoPressable}
          >
            <Image
              source={showFlickerLogo ? require('../../assets/logo-flicker.png') : require('../../assets/tmlsn-calories-logo.png')}
              style={styles.pageHeaderLogo}
              resizeMode="contain"
            />
          </Pressable>
        </View>
        <SwipeableWeekView
          weekWidth={WEEK_STRIP_PAGE_WIDTH}
          selectedDate={viewingDateAsDate}
          onDaySelect={(date) => handleSelectDate(toDateString(date))}
          initialDate={viewingDateAsDate}
          showHeader={false}
        />
        {/* Animated wrapper for day-switch slide */}
        <Animated.View style={cardSlideStyle}>
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
                    <Card style={[styles.caloriesLeftCard, { width: CALORIES_CARD_WIDTH, height: CALORIES_CARD_HEIGHT, borderRadius: CALORIES_CARD_RADIUS, alignSelf: 'center' }]}>
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
                        <View style={[styles.mainCardRing, { width: MAIN_CARD_RING_SIZE, height: MAIN_CARD_RING_SIZE, borderRadius: MAIN_CARD_RING_SIZE / 2 }]} />
                      </View>
                    </Card>
                  </Animated.View>
                </Pressable>
                <Animated.View style={[styles.threeCardsRow, cardScaleStyle]}>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
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
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
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
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
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
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </Pressable>
                </Animated.View>
              </View>

              {/* Page 2: Electrolytes top, Health Score bottom (flipped layout) */}
              <View style={{ width: CAROUSEL_WIDTH }}>
                <Animated.View style={[styles.threeCardsRow, cardScaleStyle]}>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
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
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
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
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
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
                <Pressable onPressIn={onCardPressIn} onPressOut={() => {
                  playCardPressOutSound();
                  cardScale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) });
                }}>
                  <Animated.View style={cardScaleStyle}>
                    <Card style={[styles.caloriesLeftCard, styles.healthScoreCard, { width: CALORIES_CARD_WIDTH, height: CALORIES_CARD_HEIGHT, borderRadius: CALORIES_CARD_RADIUS, alignSelf: 'center' }]}>
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

        {/* Recently uploaded – title + card same size as calories left */}
        <Text style={styles.recentlyUploadedTitle}>Recently uploaded</Text>
        <Card style={[styles.caloriesLeftCard, styles.recentlyUploadedCard, { minHeight: CARD_UNIFIED_HEIGHT }]} />
        </Animated.View>
      </ScrollView>

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
                <Text style={{ color: '#C6C6C6', fontFamily: CardFont.family, fontSize: 14 }}>Retake</Text>
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
  contentContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
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
    fontFamily: CardFont.family,
    fontSize: 36,
    fontWeight: '500',
    color: CARD_NUMBER_COLOR,
    letterSpacing: 36 * -0.03, // -3% letter spacing (-1.08)
  },
  caloriesLeftLabel: {
    fontFamily: CardFont.family,
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    marginTop: -3,
    letterSpacing: -0.11,
  },
  caloriesEatenLabel: {
    fontFamily: CardFont.family,
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    marginTop: -3,
    letterSpacing: -0.11,
  },
  caloriesEatenGoal: {
    fontFamily: CardFont.family,
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
    fontFamily: CardFont.family,
    fontSize: 16,
    fontWeight: '500',
    color: CARD_NUMBER_COLOR,
    letterSpacing: CardFont.letterSpacing,
  },
  macroLeftLabel: {
    fontFamily: CardFont.family,
    fontSize: 10,
    color: CARD_LABEL_COLOR,
    marginTop: Spacing.xs,
    letterSpacing: -0.11,
  },
  macroEatenLabel: {
    fontFamily: CardFont.family,
    fontSize: 10,
    color: CARD_LABEL_COLOR,
    marginTop: Spacing.xs,
    letterSpacing: -0.11,
  },
  macroLabelRow: {
    minWidth: 72,
  },
  macroEatenGoal: {
    fontFamily: CardFont.family,
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
    fontFamily: CardFont.family,
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
    fontFamily: CardFont.family,
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
    fontFamily: CardFont.family,
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
    fontFamily: 'DMMono_500Medium',
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
    fontFamily: CardFont.family,
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: CARD_LABEL_FONT_SIZE * -0.12,
  },
  cameraModeBubbleTextActive: {
    fontFamily: CardFont.family,
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
    fontFamily: 'DMMono_500Medium',
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  aiDescribeHint: {
    fontFamily: 'DMMono_400Regular',
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
    fontFamily: 'DMMono_400Regular',
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
    fontFamily: 'DMMono_500Medium',
    fontSize: 16,
    color: '#2F3031',
  },
  // ── Food search items ──
  searchInput: {
    backgroundColor: '#3D3E3F',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontFamily: 'DMMono_400Regular',
    fontSize: 15,
    marginBottom: 12,
  },
  foodSearchItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(198,198,198,0.15)',
  },
  foodSearchName: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 14,
    color: '#FFFFFF',
  },
  foodSearchBrand: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  foodSearchMacros: {
    fontFamily: 'DMMono_400Regular',
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
