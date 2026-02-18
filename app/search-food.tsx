import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { searchFoods, ParsedNutrition } from '../utils/foodApi';
import { Colors, Spacing, Font } from '../constants/theme';
import { BackButton } from '../components/BackButton';

const SEARCH_DEBOUNCE_MS = 500;

export default function SearchFoodScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ParsedNutrition[]>([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    searchFoods(q).then((list) => {
      setResults(list);
      setLoading(false);
    });
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => runSearch(text), SEARCH_DEBOUNCE_MS);
  };

  const handleSelect = (food: ParsedNutrition) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace({
      pathname: '/(tabs)/nutrition',
      params: {
        addFoodResult: JSON.stringify({
          name: food.name,
          brand: food.brand || '',
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          servingSize: food.servingSize || '',
        }),
      },
    });
  };

  return (
    <View style={styles.container}>
      <BackButton />
      <View style={styles.titleRow} pointerEvents="box-none">
        <Text style={styles.screenTitle}>Search Food</Text>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search foods…"
          placeholderTextColor="#888"
          value={query}
          onChangeText={handleChangeText}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={Colors.primaryLight} />
        </View>
      )}
      <FlatList
        data={results}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
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
              {item.servingSize ? ` · ${item.servingSize}` : ''}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && query.trim().length > 0 ? (
            <Text style={styles.emptyText}>No results found</Text>
          ) : null
        }
      />
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
    fontWeight: '600',
  },
  searchRow: {
    padding: Spacing.md,
    paddingTop: TITLE_ROW_TOP + TITLE_ROW_HEIGHT + Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(198,198,198,0.15)',
  },
  searchInput: {
    backgroundColor: '#3D3E3F',
    borderRadius: 10,
    padding: 12,
    color: Colors.white,
    fontSize: 15,
    fontFamily: Font.regular,
  },
  loadingRow: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.sm,
    paddingTop: Spacing.sm,
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
  emptyText: {
    fontFamily: Font.regular,
    fontSize: 15,
    color: Colors.primaryLight,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
