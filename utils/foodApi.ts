// Dual-source food API: Open Food Facts (global branded) + USDA (US generic)
import { filterResults, filterSingleFood } from './foodFilters';
// OFF: 4M+ products, 150 countries, Lidl/Aldi/Carrefour/Mars/Twix etc. Free, 10 search/min, 100 product/min.
// USDA: https://fdc.nal.usda.gov/api-guide — Free, 1000 req/hour.
// Docs: https://wiki.openfoodfacts.org/API

const OFF_BASE = 'https://world.openfoodfacts.org';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

const USER_AGENT = 'TMLSN - Nutrition Tracker - iOS'; // Required by Open Food Facts
const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'DEMO_KEY'; // USDA FoodData Central — set in .env.local
const FETCH_TIMEOUT_MS = 90_000; // OFF often 50s+, can spike; USDA ~6s

/** fetch with timeout — prevents long hangs when USDA/OFF are slow */
async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FoodNutrient {
  nutrientId: number;
  nutrientName: string;
  nutrientNumber: string;
  value: number;
  unitName: string;
}

export interface USDAFoodItem {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients: FoodNutrient[];
  dataType: string;
}

export interface FoodSearchResult {
  totalHits: number;
  foods: USDAFoodItem[];
}

/** Parsed macros ready for the meal form */
export interface ParsedNutrition {
  name: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
}

/* ------------------------------------------------------------------ */
/*  Open Food Facts types & parser                                     */
/* ------------------------------------------------------------------ */

interface OFFNutriments {
  'energy-kcal_100g'?: number;
  'energy-kcal'?: number;
  'energy-kcal_serving'?: number;
  'energy-kj_100g'?: number;
  'energy-kj'?: number;
  'energy-kj_serving'?: number;
  proteins_100g?: number;
  proteins?: number;
  proteins_serving?: number;
  carbohydrates_100g?: number;
  carbohydrates?: number;
  carbohydrates_serving?: number;
  fat_100g?: number;
  fat?: number;
  fat_serving?: number;
}

interface OFFProduct {
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  serving_quantity?: number;
  serving_unit?: string;
  nutriments?: OFFNutriments;
}

interface OFFProductResponse {
  status: 0 | 1;
  product?: OFFProduct;
}

interface OFFSearchResponse {
  count?: number;
  products?: OFFProduct[];
}

function parseOFFProduct(p: OFFProduct): ParsedNutrition {
  const n = p.nutriments ?? {};
  // Use only per-100g values (standardized)
  const kcal = n['energy-kcal_100g'] ?? n['energy-kcal'];
  const kj = n['energy-kj_100g'] ?? n['energy-kj'];
  const calories = Math.round(kcal ?? (kj != null ? kj / 4.184 : 0));
  const protein = Math.round(n.proteins_100g ?? n.proteins ?? 0);
  const carbs = Math.round(n.carbohydrates_100g ?? n.carbohydrates ?? 0);
  const fat = Math.round(n.fat_100g ?? n.fat ?? 0);

  const rawName = (p.product_name ?? p.product_name_en ?? p.generic_name ?? 'unknown').trim();
  const rawBrand = (p.brands ?? '').trim();
  const name = rawName.toLowerCase();

  return {
    name,
    brand: rawBrand.toLowerCase(),
    calories,
    protein,
    carbs,
    fat,
    servingSize: '100g',
  };
}

/* ------------------------------------------------------------------ */
/*  USDA nutrient mapping                                              */
/* ------------------------------------------------------------------ */

const NUTRIENT_MAP: Record<string, keyof Pick<ParsedNutrition, 'calories' | 'protein' | 'carbs' | 'fat'>> = {
  '208': 'calories',
  '1008': 'calories',
  '203': 'protein',
  '1003': 'protein',
  '205': 'carbs',
  '1005': 'carbs',
  '204': 'fat',
  '1004': 'fat',
};

function naturalizeUSDAName(name: string): string {
  const parts = name.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) return name;
  const base = parts[0];
  const modifiers = parts.slice(1).reverse();
  return [...modifiers, base].join(' ');
}

function parseUSDAFood(food: USDAFoodItem): ParsedNutrition {
  const rawCalories = { value: 0 };
  const rawProtein = { value: 0 };
  const rawCarbs = { value: 0 };
  const rawFat = { value: 0 };

  for (const n of food.foodNutrients ?? []) {
    const key = NUTRIENT_MAP[String(n.nutrientNumber)] ?? NUTRIENT_MAP[String(n.nutrientId)];
    if (key === 'calories') rawCalories.value = n.value;
    else if (key === 'protein') rawProtein.value = n.value;
    else if (key === 'carbs') rawCarbs.value = n.value;
    else if (key === 'fat') rawFat.value = n.value;
  }

  // Foundation, SR Legacy, Survey = per 100g. Branded = often per serving — convert when servingSize in grams
  const unit = (food.servingSizeUnit ?? 'g').toLowerCase();
  const servingGrams = unit === 'g' && food.servingSize != null && food.servingSize > 0
    ? food.servingSize
    : null;

  const scale = servingGrams != null && food.dataType === 'Branded'
    ? 100 / servingGrams
    : 1;

  const calories = Math.round(rawCalories.value * scale);
  const protein = Math.round(rawProtein.value * scale);
  const carbs = Math.round(rawCarbs.value * scale);
  const fat = Math.round(rawFat.value * scale);

  const rawName = naturalizeUSDAName((food.description ?? 'unknown food').trim());
  const rawBrand = (food.brandOwner ?? food.brandName ?? '').trim();
  const name = rawName.toLowerCase();

  return {
    name,
    brand: rawBrand.toLowerCase(),
    calories,
    protein,
    carbs,
    fat,
    servingSize: '100g',
  };
}

/* ------------------------------------------------------------------ */
/*  Open Food Facts API                                                */
/* ------------------------------------------------------------------ */

async function offFetch(url: string): Promise<Response> {
  return fetchWithTimeout(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
}

async function searchByBarcodeOFF(barcode: string): Promise<ParsedNutrition | null> {
  const normalized = barcode.replace(/\D/g, '');
  if (!normalized) return null;
  try {
    const res = await offFetch(`${OFF_BASE}/api/v0/product/${normalized}.json`);
    if (!res.ok) return null;
    const data: OFFProductResponse = await res.json();
    if (data.status !== 1 || !data.product) return null;
    return parseOFFProduct(data.product);
  } catch (err) {
    console.warn('Open Food Facts barcode error:', err);
    return null;
  }
}

async function searchFoodsOFF(query: string, pageSize: number): Promise<ParsedNutrition[]> {
  if (!query.trim()) return [];
  try {
    const params = new URLSearchParams({
      search_terms: query.trim(),
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: String(pageSize),
    });
    const res = await offFetch(`${OFF_BASE}/cgi/search.pl?${params}`);
    if (!res.ok) return [];
    const data: OFFSearchResponse = await res.json();
    const products = data.products ?? [];
    return products
      .filter((p) => p.product_name ?? p.product_name_en ?? p.generic_name)
      .map(parseOFFProduct);
  } catch (err) {
    console.warn('Open Food Facts search error:', err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  USDA API                                                           */
/* ------------------------------------------------------------------ */

async function searchByBarcodeUSDA(barcode: string): Promise<ParsedNutrition | null> {
  try {
    const res = await fetchWithTimeout(`${USDA_BASE}/foods/search?api_key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: barcode, dataType: ['Branded'], pageSize: 5 }),
    });
    if (!res.ok) return null;
    const data: FoodSearchResult = await res.json();
    if (data.foods.length === 0) return null;
    const exact = data.foods.find(
      (f) => f.gtinUpc === barcode || f.gtinUpc === barcode.padStart(13, '0'),
    );
    return parseUSDAFood(exact ?? data.foods[0]);
  } catch (err) {
    console.warn('USDA barcode search error:', err);
    return null;
  }
}

async function searchFoodsUSDA(query: string, pageSize: number): Promise<ParsedNutrition[]> {
  try {
    const res = await fetchWithTimeout(`${USDA_BASE}/foods/search?api_key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.trim(),
        dataType: ['Branded', 'SR Legacy', 'Foundation', 'Survey (FNDDS)'],
        pageSize,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = (data as { error?: { message?: string } })?.error?.message || `API error ${res.status}`;
      throw new Error(msg);
    }
    const foods = (data as FoodSearchResult)?.foods ?? [];
    return foods.map(parseUSDAFood);
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Search failed');
  }
}

/* ------------------------------------------------------------------ */
/*  Public API — OFF first, USDA fallback                              */
/* ------------------------------------------------------------------ */

/** Barcode scan: Open Food Facts first (global branded), USDA fallback (US). */
export async function searchByBarcode(barcode: string): Promise<ParsedNutrition | null> {
  const off = await searchByBarcodeOFF(barcode);
  const result = off ?? (await searchByBarcodeUSDA(barcode));
  return filterSingleFood(result);
}

/** Text search: USDA + Open Food Facts in parallel, merged (USDA first, then OFF). */
export async function searchFoods(query: string, pageSize = 15): Promise<ParsedNutrition[]> {
  if (!query.trim()) return [];
  const half = Math.ceil(pageSize / 2);
  let usda: ParsedNutrition[] = [];
  let off: ParsedNutrition[] = [];
  let usdaErr: unknown = null;
  let offErr: unknown = null;
  const [usdaRes, offRes] = await Promise.allSettled([
    searchFoodsUSDA(query, half),
    searchFoodsOFF(query, half),
  ]);
  if (usdaRes.status === 'fulfilled') usda = usdaRes.value;
  else usdaErr = usdaRes.reason;
  if (offRes.status === 'fulfilled') off = offRes.value;
  else offErr = offRes.reason;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[foodApi] search:', query, '| USDA:', usda.length, usdaErr ? `(err: ${String(usdaErr)})` : '', '| OFF:', off.length, offErr ? `(err: ${String(offErr)})` : '');
  }
  const seen = new Set<string>();
  const merged: ParsedNutrition[] = [];
  for (const f of [...usda, ...off]) {
    const key = `${f.name}|${f.brand}`.toLowerCase();
    if (!seen.has(key) && merged.length < pageSize) {
      seen.add(key);
      merged.push(f);
    }
  }
  const filtered = filterResults(merged);
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (merged.length > 0 && filtered.length === 0) {
      console.warn('[foodApi] filter removed all', merged.length, 'results for query:', query);
    } else if (merged.length === 0) {
      console.warn('[foodApi] no results for query:', query, '| USDA err:', usdaErr ? String(usdaErr).slice(0, 80) : '-', '| OFF err:', offErr ? String(offErr).slice(0, 80) : '-');
    }
  }
  return filtered;
}
