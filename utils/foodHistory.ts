import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ParsedNutrition } from './foodApi';

const HISTORY_KEY = 'food_search_history';
const MAX_HISTORY = 100;

interface FoodHistoryEntry {
  food: ParsedNutrition;
  count: number;
  lastUsed: number;
}

export async function getFoodHistory(): Promise<FoodHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addToFoodHistory(food: ParsedNutrition): Promise<void> {
  try {
    const history = await getFoodHistory();
    const key = `${food.name}|${food.brand}`.toLowerCase();
    const existing = history.find(
      (h) => `${h.food.name}|${h.food.brand}`.toLowerCase() === key,
    );
    if (existing) {
      existing.count += 1;
      existing.lastUsed = Date.now();
    } else {
      history.push({ food, count: 1, lastUsed: Date.now() });
    }
    // Keep most frequent/recent, trim to max
    history.sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);
    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(0, MAX_HISTORY)),
    );
  } catch {
    // Ignore storage errors
  }
}

export async function searchFoodHistory(query: string): Promise<ParsedNutrition[]> {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const history = await getFoodHistory();
  return history
    .filter((h) => h.food.name.includes(q) || (h.food.brand && h.food.brand.includes(q)))
    .sort((a, b) => b.count - a.count)
    .map((h) => h.food);
}
