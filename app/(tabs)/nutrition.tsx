import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import {
  getTodayNutritionLog,
  saveNutritionLog,
  getUserSettings,
  saveUserSettings,
} from '../../utils/storage';
import { NutritionLog, Meal, MealType, UserSettings } from '../../types';
import { generateId, getTodayDateString } from '../../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
const CARD_LABEL_COLOR = '#C6C6C6';
const CARD_NUMBER_COLOR = '#FFFFFF';
const CARD_UNIFIED_HEIGHT = Math.round(100 * 1.2); // 20% taller, all cards same height (120)
const MAIN_CARD_RING_SIZE = 100;
const SMALL_CARD_RING_SIZE = Math.round(61 * 0.95); // 5% smaller (58)
// Card fonts: 50% of base; macro labels (Calories left, Protein left, etc.) another 10% smaller (45% total)
const CARD_VALUE_FONT_SIZE = Math.round((Typography.h1 + 8) * 0.5); // 20
const CARD_LABEL_FONT_SIZE = Math.round(Typography.body * 0.45);   // 8 (Calories left)
const MACRO_VALUE_FONT_SIZE = Math.round(Typography.dataValue * 0.5); // 10
const MACRO_LABEL_FONT_SIZE = Math.round(Typography.label * 0.45);   // 6 (Protein left, etc.)

export default function NutritionScreen() {
  const [todayLog, setTodayLog] = useState<NutritionLog | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [showEditGoals, setShowEditGoals] = useState(false);
  const [cardPage, setCardPage] = useState(0);
  const [showEaten, setShowEaten] = useState(false);
  const cardScaleAnim = useRef(new Animated.Value(1)).current;
  // Per-card text animations (0=cal, 1=protein, 2=carbs, 3=fat, 4=sodium, 5=potassium, 6=magnesium)
  const textAnims = useRef(
    Array.from({ length: 7 }, () => new Animated.Value(0))
  ).current;
  const STAGGER_DELAY = 25; // ms between each card

  // Per-digit scroll-wheel: quick blur then new numbers float in from above
  const getDigitAnimStyle = (cardIndex: number, charIndex: number) => {
    const anim = textAnims[cardIndex];
    const o = Math.min(charIndex * 0.15, 0.48);
    // Enter: float down from -1.5dp above into place
    const eStart = -1 + o + 0.001;
    const eEnd = Math.min(-1 + o + 0.5, -0.005);
    // Exit: drift down 1.5dp while blurring out
    const xStart = Math.max(o + 0.005, 0.005);
    const xEnd = Math.min(o + 0.5, 0.995);
    return {
      transform: [
        { translateY: anim.interpolate({
          inputRange: [-1, eStart, eEnd, 0, xStart, xEnd, 1],
          outputRange: [-1.5, -1.5, 0, 0, 0, 1.5, 1.5],
          extrapolate: 'clamp' as const,
        }) },
      ],
      opacity: anim.interpolate({
        inputRange: [-1, eStart, eEnd, 0, xStart, xEnd, 1],
        outputRange: [0.35, 0.35, 1, 1, 1, 0.35, 0.35],
        extrapolate: 'clamp' as const,
      }),
    };
  };

  // Ghost opacity: invisible at rest, appears during quick blur phase
  const getGhostOpacity = (cardIndex: number, charIndex: number, peak: number) => {
    const anim = textAnims[cardIndex];
    const o = Math.min(charIndex * 0.15, 0.48);
    const eStart = -1 + o + 0.001;
    const eEnd = Math.min(-1 + o + 0.5, -0.005);
    const xStart = Math.max(o + 0.005, 0.005);
    const xEnd = Math.min(o + 0.5, 0.995);
    return anim.interpolate({
      inputRange: [-1, eStart, eEnd, 0, xStart, xEnd, 1],
      outputRange: [peak, peak, 0, 0, 0, peak, peak],
      extrapolate: 'clamp' as const,
    });
  };

  // Render value text as individually animated characters with soft gaussian blur ghosts
  const renderScrollDigits = (
    text: string,
    cardIndex: number,
    mainStyle: any,
    goalText?: string,
    goalStyle?: any,
  ) => {
    const chars: { char: string; cStyle: any; idx: number }[] = [];
    let idx = 0;
    text.split('').forEach(c => chars.push({ char: c, cStyle: mainStyle, idx: idx++ }));
    if (goalText && goalStyle) {
      goalText.split('').forEach(c => chars.push({ char: c, cStyle: goalStyle, idx: idx++ }));
    }
    return (
      <View style={{ flexDirection: 'row' }}>
        {chars.map(({ char, cStyle, idx: i }) => (
          <Animated.View key={i} style={getDigitAnimStyle(cardIndex, i)}>
            {/* Soft blur: ghost copies at different offsets, only visible during transition */}
            <Animated.View style={{ position: 'absolute', top: -3.5, left: 0, right: 0, opacity: getGhostOpacity(cardIndex, i, 0.1) }} pointerEvents="none">
              <Text style={cStyle}>{char}</Text>
            </Animated.View>
            <Animated.View style={{ position: 'absolute', top: -1.5, left: 0, right: 0, opacity: getGhostOpacity(cardIndex, i, 0.22) }} pointerEvents="none">
              <Text style={cStyle}>{char}</Text>
            </Animated.View>
            {/* Main character */}
            <Text style={cStyle}>{char}</Text>
            <Animated.View style={{ position: 'absolute', top: 1.5, left: 0, right: 0, opacity: getGhostOpacity(cardIndex, i, 0.22) }} pointerEvents="none">
              <Text style={cStyle}>{char}</Text>
            </Animated.View>
            <Animated.View style={{ position: 'absolute', top: 3.5, left: 0, right: 0, opacity: getGhostOpacity(cardIndex, i, 0.1) }} pointerEvents="none">
              <Text style={cStyle}>{char}</Text>
            </Animated.View>
          </Animated.View>
        ))}
      </View>
    );
  };

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const log = await getTodayNutritionLog();
    const userSettings = await getUserSettings();
    
    if (!log) {
      // Create today's log
      const newLog: NutritionLog = {
        id: generateId(),
        date: getTodayDateString(),
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        water: 0,
        meals: [],
      };
      await saveNutritionLog(newLog);
      setTodayLog(newLog);
    } else {
      setTodayLog(log);
    }
    
    setSettings(userSettings);
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

    // Reset form
    setMealType('breakfast');
    setMealName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setMealImage(undefined);
    setShowAddMeal(false);
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
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / CAROUSEL_WIDTH);
    setCardPage(page);
  };

  const onCardPressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(cardScaleAnim, {
      toValue: 0.99,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const onCardPressOut = () => {
    Animated.spring(cardScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
    // Staggered scroll: each card exits one after another, then enters
    textAnims.forEach(a => a.stopAnimation());
    const exitAnims = textAnims.map((anim, i) =>
      Animated.sequence([
        Animated.delay(i * STAGGER_DELAY),
        Animated.timing(anim, {
          toValue: 1,
          duration: 20,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(exitAnims).start(() => {
      setShowEaten(prev => !prev);
      textAnims.forEach(a => a.setValue(-1));
      const enterAnims = textAnims.map((anim, i) =>
        Animated.sequence([
          Animated.delay(i * STAGGER_DELAY),
          Animated.timing(anim, {
            toValue: 0,
            duration: 20,
            useNativeDriver: true,
          }),
        ])
      );
      Animated.parallel(enterAnims).start();
    });
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
          <Image
            source={require('../../assets/tmlsn-calories-logo.png')}
            style={styles.pageHeaderLogo}
            resizeMode="contain"
          />
          <Text style={styles.pageHeading}>
            TMLSN CAL
          </Text>
        </View>
        {/* Macro cards carousel – swipe left to reveal flipped layout */}
        {settings && todayLog && (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleCarouselScroll}
              scrollEventThrottle={16}
              style={{ width: CAROUSEL_WIDTH }}
            >
              {/* Page 1: Big card top, 3 small cards bottom */}
              <View style={{ width: CAROUSEL_WIDTH }}>
                <TouchableOpacity onPressIn={onCardPressIn} onPressOut={onCardPressOut} activeOpacity={1}>
                  <Animated.View style={{ transform: [{ scale: cardScaleAnim }] }}>
                    <Card style={[styles.caloriesLeftCard, { width: CALORIES_CARD_WIDTH, height: CALORIES_CARD_HEIGHT, borderRadius: CALORIES_CARD_RADIUS, alignSelf: 'center' }]}>
                      <View style={styles.caloriesLeftContent}>
                        <View style={styles.caloriesLeftTextWrap}>
                          {showEaten
                            ? renderScrollDigits(String(todayLog.calories), 0, styles.caloriesLeftValue, `/${settings.dailyGoals.calories}`, styles.caloriesEatenGoal)
                            : renderScrollDigits(String(Math.max(0, settings.dailyGoals.calories - todayLog.calories)), 0, styles.caloriesLeftValue)
                          }
                          <Animated.View style={getDigitAnimStyle(0, 7)}>
                            <Text style={styles.caloriesLeftLabel}>{showEaten ? 'calories eaten' : 'calories left'}</Text>
                          </Animated.View>
                        </View>
                        <View style={[styles.mainCardRing, { width: MAIN_CARD_RING_SIZE, height: MAIN_CARD_RING_SIZE, borderRadius: MAIN_CARD_RING_SIZE / 2 }]} />
                      </View>
                    </Card>
                  </Animated.View>
                </TouchableOpacity>
                <Animated.View style={[styles.threeCardsRow, { transform: [{ scale: cardScaleAnim }] }]}>
                  <TouchableOpacity onPressIn={onCardPressIn} onPressOut={onCardPressOut} activeOpacity={1}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        {showEaten
                          ? renderScrollDigits(String(todayLog.protein), 1, styles.macroLeftValue, `/${settings.dailyGoals.protein}g`, styles.macroEatenGoal)
                          : renderScrollDigits(`${Math.max(0, settings.dailyGoals.protein - todayLog.protein)}g`, 1, styles.macroLeftValue)
                        }
                        <Animated.View style={getDigitAnimStyle(1, 7)}>
                          <Text style={styles.macroLeftLabel}>{showEaten ? 'protein eaten' : 'protein left'}</Text>
                        </Animated.View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </TouchableOpacity>
                  <TouchableOpacity onPressIn={onCardPressIn} onPressOut={onCardPressOut} activeOpacity={1}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        {showEaten
                          ? renderScrollDigits(String(todayLog.carbs), 2, styles.macroLeftValue, `/${settings.dailyGoals.carbs}g`, styles.macroEatenGoal)
                          : renderScrollDigits(`${Math.max(0, settings.dailyGoals.carbs - todayLog.carbs)}g`, 2, styles.macroLeftValue)
                        }
                        <Animated.View style={getDigitAnimStyle(2, 7)}>
                          <Text style={styles.macroLeftLabel}>{showEaten ? 'carbs eaten' : 'carbs left'}</Text>
                        </Animated.View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </TouchableOpacity>
                  <TouchableOpacity onPressIn={onCardPressIn} onPressOut={onCardPressOut} activeOpacity={1}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        {showEaten
                          ? renderScrollDigits(String(todayLog.fat), 3, styles.macroLeftValue, `/${settings.dailyGoals.fat}g`, styles.macroEatenGoal)
                          : renderScrollDigits(`${Math.max(0, settings.dailyGoals.fat - todayLog.fat)}g`, 3, styles.macroLeftValue)
                        }
                        <Animated.View style={getDigitAnimStyle(3, 7)}>
                          <Text style={styles.macroLeftLabel}>{showEaten ? 'fat eaten' : 'fat left'}</Text>
                        </Animated.View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Page 2: Electrolytes top, Health Score bottom (flipped layout) */}
              <View style={{ width: CAROUSEL_WIDTH }}>
                <Animated.View style={[styles.threeCardsRow, { transform: [{ scale: cardScaleAnim }] }]}>
                  <TouchableOpacity onPressIn={onCardPressIn} onPressOut={onCardPressOut} activeOpacity={1}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        {showEaten
                          ? renderScrollDigits('0', 4, styles.macroLeftValue, '/—mg', styles.macroEatenGoal)
                          : renderScrollDigits('—mg', 4, styles.macroLeftValue)
                        }
                        <Animated.View style={getDigitAnimStyle(4, 7)}>
                          <Text style={styles.macroLeftLabel}>{showEaten ? 'sodium eaten' : 'sodium left'}</Text>
                        </Animated.View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </TouchableOpacity>
                  <TouchableOpacity onPressIn={onCardPressIn} onPressOut={onCardPressOut} activeOpacity={1}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        {showEaten
                          ? renderScrollDigits('0', 5, styles.macroLeftValue, '/—mg', styles.macroEatenGoal)
                          : renderScrollDigits('—mg', 5, styles.macroLeftValue)
                        }
                        <Animated.View style={getDigitAnimStyle(5, 7)}>
                          <Text style={styles.macroLeftLabel}>{showEaten ? 'potassium eaten' : 'potassium left'}</Text>
                        </Animated.View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </TouchableOpacity>
                  <TouchableOpacity onPressIn={onCardPressIn} onPressOut={onCardPressOut} activeOpacity={1}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        {showEaten
                          ? renderScrollDigits('0', 6, styles.macroLeftValue, '/—mg', styles.macroEatenGoal)
                          : renderScrollDigits('—mg', 6, styles.macroLeftValue)
                        }
                        <Animated.View style={getDigitAnimStyle(6, 7)}>
                          <Text style={styles.macroLeftLabel}>{showEaten ? 'magnesium eaten' : 'magnesium left'}</Text>
                        </Animated.View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </TouchableOpacity>
                </Animated.View>
                <TouchableOpacity onPressIn={onCardPressIn} onPressOut={() => {
                  Animated.spring(cardScaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }).start();
                }} activeOpacity={1}>
                  <Animated.View style={{ transform: [{ scale: cardScaleAnim }] }}>
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
                </TouchableOpacity>
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

        <Button
          title="+ Add Meal"
          onPress={() => setShowAddMeal(true)}
          style={styles.addButton}
          textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
        />
      </ScrollView>

      {/* Add Meal Modal */}
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  pageHeaderLogo: {
    height: (Typography.h2 + 10) * 1.2 * 1.1,
    width: (Typography.h2 + 10) * 1.2 * 1.1,
  },
  pageHeading: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h2 * 1.2 * 1.1,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
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
    marginTop: -3, // raised by 10 more (7 - 10)
    letterSpacing: CARD_LABEL_FONT_SIZE * -0.12, // -12% letter spacing
  },
  caloriesEatenGoal: {
    fontFamily: CardFont.family,
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: CARD_LABEL_FONT_SIZE * -0.12,
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
    overflow: 'hidden',
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
    letterSpacing: 10 * -0.12, // -12%
  },
  macroEatenGoal: {
    fontFamily: CardFont.family,
    fontSize: 10,
    color: CARD_LABEL_COLOR,
    letterSpacing: 10 * -0.12,
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
    letterSpacing: 15 * -0.12, // -12%
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
