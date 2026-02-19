import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { searchFoods, ParsedNutrition } from '../utils/foodApi';
import { Colors, Spacing } from '../constants/theme';
import { BackButton } from '../components/BackButton';

const SEARCH_DEBOUNCE_MS = 500;

type HistoryTab = 'all' | 'saved';

export default function SearchFoodScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ParsedNutrition[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('all');
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

  const TABS: { key: HistoryTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'saved', label: 'Saved' },
  ];

  return (
    <View style={styles.container}>
      <BackButton />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar — full width, magnifying glass, placeholder, clear X */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
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
                onPress={() => { setQuery(''); setResults([]); }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color={Colors.primaryLight} />
              </TouchableOpacity>
            )}
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

        {/* Action cards — Barcode scan, Meal scan, Scan label — open camera with correct mode */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => router.replace({ pathname: '/(tabs)/nutrition', params: { openScan: 'barcode' } })}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="barcode-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionCardText}>Barcode scan</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace({ pathname: '/(tabs)/nutrition', params: { openScan: 'ai' } })}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="restaurant-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionCardText}>Meal scan</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace({ pathname: '/(tabs)/nutrition', params: { openScan: 'label' } })}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionCardText}>Scan label</Text>
          </Pressable>
        </View>

        {/* History section — cards only (no ingredient names) */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>History</Text>
            <TouchableOpacity style={styles.mostFrequentButton}>
              <Text style={styles.mostFrequentText}>Most Frequent</Text>
              <Ionicons name="filter" size={16} color={Colors.primaryLight} />
            </TouchableOpacity>
          </View>

          {/* Placeholder cards — layout only, no names */}
          <View style={styles.historyCards}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.historyCard}>
                <View style={styles.historyCardLeft} />
                <TouchableOpacity
                  style={styles.historyCardAddButton}
                  onPress={() => {}}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Search results — same card layout */}
          {query.trim().length > 0 && (
            <>
              {loading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.primaryLight} />
                </View>
              )}
              {!loading && results.length > 0 && (
                <View style={styles.resultsSection}>
                  {results.map((item, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.historyCard}
                      onPress={() => handleSelect(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.historyCardLeft}>
                        <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.resultMeta} numberOfLines={1}>
                          {item.calories} cal{item.servingSize ? ` · ${item.servingSize}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.historyCardAddButton}
                        onPress={() => handleSelect(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {!loading && query.trim().length > 0 && results.length === 0 && (
                <Text style={styles.emptyText}>No results found</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const BACK_BUTTON_TOP = 54;
const BACK_BUTTON_SIZE = 40;
const SEARCH_BAR_TOP = BACK_BUTTON_TOP + BACK_BUTTON_SIZE + Spacing.sm;
const SEARCH_BAR_HEIGHT = 44;
const ACTION_CARD_HEIGHT = 64;
const ACTION_CARD_RADIUS = 12;
const CARD_HEIGHT = 72;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
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
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: 12,
    height: SEARCH_BAR_HEIGHT,
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
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: ACTION_CARD_HEIGHT,
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: ACTION_CARD_RADIUS,
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
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: CARD_HEIGHT,
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
  },
  historyCardLeft: {
    flex: 1,
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  historyCardAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsSection: {
    gap: Spacing.sm,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    letterSpacing: -0.11,
  },
  resultMeta: {
    fontSize: 13,
    color: Colors.primaryLight,
    marginTop: 4,
    letterSpacing: -0.11,
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
