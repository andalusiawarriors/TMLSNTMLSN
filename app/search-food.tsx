import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { searchFoodsProgressive, searchFoodsNextPage, ParsedNutrition } from '../utils/foodApi';
import { addToFoodHistory } from '../utils/foodHistory';
import { Colors, Spacing } from '../constants/theme';
import { BackButton } from '../components/BackButton';

const SEARCH_DEBOUNCE_MS = 500;

type HistoryTab = 'all' | 'saved';

export default function SearchFoodScreen() {
  const router = useRouter();
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

    searchFoodsProgressive(trimmed, (results) => {
      if (trimmed === lastQueryRef.current) {
        setResults(results);
        if (results.length > 0) setLoading(false);
      }
    }, 25, signal)
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
      if (newResults.length === 0) {
        setHasMore(false);
      } else {
        const existingKeys = new Set(results.map((r) => `${r.name}|${r.brand}`.toLowerCase()));
        const fresh = newResults.filter((r) => !existingKeys.has(`${r.name}|${r.brand}`.toLowerCase()));
        if (fresh.length === 0) {
          // All duplicates — advance page, next tap will try page after
          setPage(nextPage);
        } else {
          setResults((prev) => [...prev, ...fresh]);
          setPage(nextPage);
        }
      }
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, [loadingMore, hasMore, query, page, results]);

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
          unit: food.unit ?? 'g',
          source: food.source ?? 'usda',
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
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      {query.trim().length > 0 ? (
      <FlatList
        data={results}
        keyExtractor={(_, i) => String(i)}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
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
                onPress={() => { setQuery(''); setResults([]); setSearchError(null); setPage(1); setHasMore(true); }}
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
            onPress={() => router.push({ pathname: '/scan-food-camera', params: { mode: 'barcode' } })}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="barcode-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionCardText}>barcode scan</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/scan-food-camera', params: { mode: 'ai' } })}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="restaurant-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionCardText}>meal scan</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/scan-food-camera', params: { mode: 'label' } })}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionCardText}>label scan</Text>
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

          {/* Cards area: preloaded placeholders OR loading when no results yet */}
          {loading && results.length === 0 && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.primaryLight} />
            </View>
          )}
          {!loading && searchError && (
            <Text style={styles.emptyText}>{searchError}</Text>
          )}
          {query.trim().length === 0 && (
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
          )}
        </View>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.historyCard}
            onPress={() => handleSelect(item)}
            activeOpacity={0.7}
          >
            <View style={styles.historyCardLeft}>
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
                    <View style={styles.tmlsnBasicsRow}>
                      <MaskedView
                        maskElement={
                          <Text style={[styles.resultBrand, styles.resultBrandTmlsnBasics, { backgroundColor: 'transparent' }]}>
                            tmlsn basics
                          </Text>
                        }
                      >
                        <LinearGradient
                          colors={['#D4B896', '#A8895E']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={[styles.resultBrand, styles.resultBrandTmlsnBasics, { opacity: 0 }]}>
                            tmlsn basics
                          </Text>
                        </LinearGradient>
                      </MaskedView>
                      <View style={styles.tmlsnBasicsCheckmarkWrap}>
                        <Image
                          source={require('../assets/gold_checkmark_badge.png')}
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
                    <Text style={styles.resultBrand} numberOfLines={1} ellipsizeMode="tail">
                      {brandLabel}
                    </Text>
                  );
                }
                return null;
              })()}
              <Text style={styles.resultName} numberOfLines={1} ellipsizeMode="tail">
                {item.name}
              </Text>
              <View style={styles.macrosRow}>
                <Text style={styles.macrosPrefix}>per 100{item.unit ?? 'g'}</Text>
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
            <TouchableOpacity
              style={styles.historyCardAddButton}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.trim().length > 0 && !loading && !searchError ? (
            <Text style={styles.emptyText}>No results found</Text>
          ) : null
        }
        ListFooterComponent={
          query.trim().length > 0 && results.length > 0 && !loading ? (
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
      ) : (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar */}
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
        {/* Action cards */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => router.push({ pathname: '/scan-food-camera', params: { mode: 'barcode' } })}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="barcode-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionCardText}>barcode scan</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/scan-food-camera', params: { mode: 'ai' } })}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="restaurant-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionCardText}>meal scan</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/scan-food-camera', params: { mode: 'label' } })}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionCardText}>label scan</Text>
          </Pressable>
        </View>
        {/* History section — placeholder cards */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>History</Text>
            <TouchableOpacity style={styles.mostFrequentButton}>
              <Text style={styles.mostFrequentText}>Most Frequent</Text>
              <Ionicons name="filter" size={16} color={Colors.primaryLight} />
            </TouchableOpacity>
          </View>
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
        </View>
      </ScrollView>
      )}
      </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
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
  resultBrand: {
    fontSize: 11,
    color: Colors.primaryLight,
    fontWeight: '400',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  resultBrandTmlsnBasics: {
    color: Colors.accentChampagne,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tmlsnBasicsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  tmlsnBasicsCheckmarkWrap: {
    marginLeft: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    marginTop: -3,
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
