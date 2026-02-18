import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { getSavedFoods } from '../utils/storage';
import { SavedFood } from '../types';
import { Colors, Spacing, Font } from '../constants/theme';
import { BackButton } from '../components/BackButton';

export default function SavedFoodsScreen() {
  const router = useRouter();
  const [list, setList] = useState<SavedFood[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSavedFoods().then((foods) => {
      setList(foods);
      setLoading(false);
    });
  }, []);

  const handleSelect = (food: SavedFood) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace({
      pathname: '/(tabs)/nutrition',
      params: {
        addSavedFood: JSON.stringify({
          name: food.name,
          brand: food.brand || '',
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
        }),
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <BackButton />
        <View style={styles.titleRow} pointerEvents="box-none">
          <Text style={styles.screenTitle}>Saved Foods</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primaryLight} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton />
      <View style={styles.titleRow} pointerEvents="box-none">
        <Text style={styles.screenTitle}>Saved Foods</Text>
      </View>
      {list.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            No saved foods yet. Foods you log will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.itemName}>{item.name}</Text>
              {item.brand ? (
                <Text style={styles.itemBrand}>{item.brand}</Text>
              ) : null}
              <Text style={styles.itemMacros}>
                {item.calories} cal · {item.protein}p · {item.carbs}c · {item.fat}f
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const TITLE_ROW_TOP = 54;
const TITLE_ROW_HEIGHT = 40;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  titleRow: {
    position: 'absolute',
    top: TITLE_ROW_TOP,
    left: 0,
    right: 0,
    height: TITLE_ROW_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9,
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.11,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: TITLE_ROW_TOP + TITLE_ROW_HEIGHT + Spacing.lg,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.11,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  listContent: {
    padding: Spacing.md,
    paddingTop: TITLE_ROW_TOP + TITLE_ROW_HEIGHT + Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  item: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(198,198,198,0.15)',
  },
  itemName: {
    fontFamily: Font.semiBold,
    fontSize: 16,
    color: Colors.white,
  },
  itemBrand: {
    fontFamily: Font.regular,
    fontSize: 13,
    color: Colors.primaryLight,
    marginTop: 2,
  },
  itemMacros: {
    fontFamily: Font.regular,
    fontSize: 13,
    color: Colors.primaryLight,
    marginTop: 4,
  },
});
