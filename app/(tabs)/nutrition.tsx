import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
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
const CARD_UNIFIED_HEIGHT = 100;
const MAIN_CARD_RING_SIZE = 56;
const SMALL_CARD_RING_SIZE = 28;

export default function NutritionScreen() {
  const [todayLog, setTodayLog] = useState<NutritionLog | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [showEditGoals, setShowEditGoals] = useState(false);

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
        {/* Calories left – big card: text left (centered vertically), ring right */}
        {settings && todayLog && (
          <>
            <Card style={[styles.caloriesLeftCard, { minHeight: CARD_UNIFIED_HEIGHT }]}>
              <View style={styles.caloriesLeftContent}>
                <View style={styles.caloriesLeftTextWrap}>
                  <Text style={styles.caloriesLeftValue}>
                    {Math.max(0, settings.dailyGoals.calories - todayLog.calories)}
                  </Text>
                  <Text style={styles.caloriesLeftLabel}>Calories left</Text>
                </View>
                <View style={[styles.mainCardRing, { width: MAIN_CARD_RING_SIZE, height: MAIN_CARD_RING_SIZE, borderRadius: MAIN_CARD_RING_SIZE / 2 }]} />
              </View>
            </Card>

            {/* Protein, Carbs, Fat left – three cards: same height, text top-left, ring bottom center */}
            <View style={styles.threeCardsRow}>
              <Card style={[styles.macroLeftCard, { minHeight: CARD_UNIFIED_HEIGHT }]}>
                <View style={styles.macroLeftTextWrap}>
                  <Text style={styles.macroLeftValue}>
                    {Math.max(0, settings.dailyGoals.protein - todayLog.protein)}g
                  </Text>
                  <Text style={styles.macroLeftLabel}>Protein left</Text>
                </View>
                <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
              </Card>
              <Card style={[styles.macroLeftCard, { minHeight: CARD_UNIFIED_HEIGHT }]}>
                <View style={styles.macroLeftTextWrap}>
                  <Text style={styles.macroLeftValue}>
                    {Math.max(0, settings.dailyGoals.carbs - todayLog.carbs)}g
                  </Text>
                  <Text style={styles.macroLeftLabel}>Carbs left</Text>
                </View>
                <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
              </Card>
              <Card style={[styles.macroLeftCard, { minHeight: CARD_UNIFIED_HEIGHT }]}>
                <View style={styles.macroLeftTextWrap}>
                  <Text style={styles.macroLeftValue}>
                    {Math.max(0, settings.dailyGoals.fat - todayLog.fat)}g
                  </Text>
                  <Text style={styles.macroLeftLabel}>Fat left</Text>
                </View>
                <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
              </Card>
            </View>
          </>
        )}

        {/* Meals List */}
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Today's Meals</Text>
            <TouchableOpacity onPress={openEditGoals}>
              <Text style={styles.editGoalsLink}>Edit goals</Text>
            </TouchableOpacity>
          </View>
          {todayLog?.meals.length === 0 ? (
            <Text style={styles.emptyText}>No meals logged yet</Text>
          ) : (
            MEAL_TYPE_ORDER.map((type) => {
              const list = mealsByType[type];
              if (!list.length) return null;
              return (
                <View key={type} style={styles.mealSection}>
                  <Text style={styles.mealSectionTitle}>{MEAL_TYPE_LABELS[type]}</Text>
                  {list.map((meal) => (
                    <View key={meal.id} style={styles.mealItem}>
                      <Text style={styles.mealName}>{meal.name}</Text>
                      <Text style={styles.mealMacros}>
                        {meal.calories} cal • {meal.protein}g P • {meal.carbs}g C • {meal.fat}g F
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })
          )}
        </Card>

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
    paddingHorizontal: Spacing.lg,
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
    flex: 1,
  },
  caloriesLeftValue: {
    fontFamily: CardFont.family,
    fontSize: Typography.h1 + 8,
    fontWeight: '500',
    color: CARD_NUMBER_COLOR,
    letterSpacing: CardFont.letterSpacing,
  },
  caloriesLeftLabel: {
    fontFamily: CardFont.family,
    fontSize: Typography.body,
    color: CARD_LABEL_COLOR,
    marginTop: Spacing.xs,
    letterSpacing: CardFont.letterSpacing,
  },
  mainCardRing: {
    borderWidth: 2,
    borderColor: CARD_LABEL_COLOR,
    backgroundColor: Colors.primaryDark,
    marginLeft: Spacing.md,
  },
  threeCardsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  macroLeftCard: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginVertical: 0,
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  macroLeftTextWrap: {
    alignSelf: 'flex-start',
  },
  macroLeftValue: {
    fontFamily: CardFont.family,
    fontSize: Typography.dataValue,
    fontWeight: '500',
    color: CARD_NUMBER_COLOR,
    letterSpacing: CardFont.letterSpacing,
  },
  macroLeftLabel: {
    fontFamily: CardFont.family,
    fontSize: Typography.label,
    color: CARD_LABEL_COLOR,
    marginTop: Spacing.xs,
    letterSpacing: CardFont.letterSpacing,
  },
  smallCardRing: {
    borderWidth: 2,
    borderColor: CARD_LABEL_COLOR,
    backgroundColor: Colors.primaryDark,
    alignSelf: 'center',
    marginTop: Spacing.sm,
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
