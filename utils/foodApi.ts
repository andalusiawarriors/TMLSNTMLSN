// Dual-source food API: Open Food Facts (global branded) + USDA (US generic)
import { filterResults, filterSingleFood, isObviouslyBranded, isBrandBlocked, KNOWN_BRAND_KEYWORDS, latinRatio } from './foodFilters';
import { translateFoodNamesBatch, translateToEnglish } from './translateQuery';

// OFF: 4M+ products, 150 countries, Lidl/Aldi/Carrefour/Mars/Twix etc. Free, 10 search/min, 100 product/min.
// USDA: https://fdc.nal.usda.gov/api-guide — Free, 1000 req/hour.
// Docs: https://wiki.openfoodfacts.org/API

const OFF_BASE = 'https://world.openfoodfacts.org';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

const USER_AGENT = 'TMLSN - Nutrition Tracker - iOS'; // Required by Open Food Facts
const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'DEMO_KEY'; // USDA FoodData Central — set in .env.local
const USDA_FETCH_TIMEOUT_MS = 15_000;
const OFF_FETCH_TIMEOUT_MS = 15_000;

/** USDA data types we request; Survey (FNDDS) and SR Legacy are excluded. */
const USDA_DATA_TYPES = ['Foundation', 'Branded'] as const;

/** Common queries to preload Foundation (TMLSN Verified) foods for instant display. */
const PRELOAD_QUERIES = [
  'chicken', 'rice', 'egg', 'bread', 'milk', 'banana', 'oats',
  'potato', 'beef', 'salmon', 'yogurt', 'cheese', 'pasta', 'apple',
  'butter', 'avocado', 'broccoli', 'turkey', 'tuna', 'spinach',
];
const preloadCache = new Map<string, ParsedNutrition[]>();

/** Exact key first; else best partial match so "white bread" can show preloaded "bread" instantly. */
function getPreloadedResults(query: string): ParsedNutrition[] {
  const key = query.trim().toLowerCase();
  const exact = preloadCache.get(key);
  if (exact && exact.length > 0) return exact;
  for (const preloadKey of PRELOAD_QUERIES.map((q) => q.trim().toLowerCase()).sort((a, b) => b.length - a.length)) {
    if (key.includes(preloadKey) || preloadKey.includes(key)) {
      const hit = preloadCache.get(preloadKey);
      if (hit && hit.length > 0) return hit;
    }
  }
  return [];
}

/** List Food first-match only: use preload only when cache has exact key. Avoids "chicken breast" using "chicken" preload. */
function getPreloadedResultsExact(query: string): ParsedNutrition[] {
  const key = query.trim().toLowerCase();
  const exact = preloadCache.get(key);
  return exact && exact.length > 0 ? exact : [];
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
  unit: 'g' | 'ml';
  source: 'usda' | 'off';
  originalDescription?: string;
  dataType?: string;
  /** USDA FoodData Central id — use for deduping so same food appears once */
  fdcId?: number;
}

/** TMLSN TOP 100: ingredients that get gold styling when the product is primarily that ingredient (not a composite meal). */
const TMLSN_TOP_100_NAMES: string[] = [
  'kiwis', 'coffee', 'pineapple', 'apple cider vinegar', 'natural orange juice',
  'oysters', 'mince beef', 'eggs', 'salmon', 'sardines', 'sourdough bread',
  'olive oil', 'butter', 'avocado oil', 'coconut oil', 'honey', 'carrot', 'blueberries',
].map((s) => s.toLowerCase().trim());
const TMLSN_TOP_100_SORTED = [...TMLSN_TOP_100_NAMES].sort((a, b) => b.length - a.length);

/** Words that can appear between entry tokens and still count as "same ingredient" (e.g. sourdough [round artisan style] bread). */
const TOP_100_MODIFIER_WORDS = new Set([
  'round', 'artisan', 'style', 'organic', 'whole', 'grain', 'fresh', 'plain', 'classic', 'traditional',
  'stone', 'baked', 'soft', 'crusty', 'sliced', 'unsliced', 'extra', 'virgin', 'cold', 'pressed', 'raw',
  'natural', 'pure', 'refined', 'unrefined', 'white', 'natural', 'liquid', 'filtered', 'unfiltered',
]);

/** True if name suggests a composite dish/meal (multiple components), so we do not gold it. */
function isCompositeMealName(name: string): boolean {
  const n = name.toLowerCase().trim().replace(/\s+/g, ' ');
  const patterns = [
    ' on ', ' with ', ' and ', ' & ',
    ' sandwich ', ' wrap ', ' salad ', ' burger ', ' blt ', ' sub ', ' pizza ', ' bowl ', ' platter ', ' combo ', ' meal ',
  ];
  return patterns.some((p) => n.includes(p));
}

/** True if name contains entry's words in order with only modifier words between them (e.g. "sourdough round artisan style bread" for entry "sourdough bread"). */
function nameMatchesEntryWithModifiers(name: string, entry: string): boolean {
  const entryWords = entry.split(/\s+/).filter(Boolean);
  const nameWords = name.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let entryIdx = 0;
  for (const w of nameWords) {
    if (entryIdx < entryWords.length && w === entryWords[entryIdx]) {
      entryIdx++;
    } else if (!TOP_100_MODIFIER_WORDS.has(w)) {
      return false;
    }
  }
  return entryIdx === entryWords.length;
}

/** True if food is primarily a Top 100 ingredient (USDA or OFF). Excludes composite meals (e.g. "Turkey BLT on sourdough bread"). */
export function isTmlsnTop100(food: ParsedNutrition): boolean {
  const name = food.name.toLowerCase().trim().replace(/\s+/g, ' ');
  if (isCompositeMealName(name)) return false;
  return TMLSN_TOP_100_SORTED.some((entry) => {
    if (name === entry || name.startsWith(entry + ',') || name.startsWith(entry + ' ')) return true;
    if (name.includes(entry)) return true;
    return nameMatchesEntryWithModifiers(name, entry);
  });
}

/** True if food is USDA Foundation (quicksilver styling). Defensive on dataType. */
export function isFoundationVerified(food: ParsedNutrition): boolean {
  if (food.source !== 'usda') return false;
  const dt = food.dataType ?? '';
  return dt === 'Foundation' || (dt.length > 0 && dt.toLowerCase().includes('foundation'));
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
  serving_size?: string;
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

  const rawBrandField = (p.brands ?? '').trim();
  const rawDescription = (p.product_name ?? p.product_name_en ?? p.generic_name ?? 'unknown').trim();

  let rawBrand: string;
  let rawName: string;

  if (rawBrandField) {
    rawBrand = rawBrandField;
    rawName = rawDescription;
  } else {
    const extracted = extractBrandFromDescription(rawDescription);
    rawBrand = extracted.brand;
    rawName = extracted.cleanName;
  }
  if (!rawBrand && isObviouslyBranded(rawName)) {
    const lower = rawName.toLowerCase();
    for (const keyword of KNOWN_BRAND_KEYWORDS) {
      if (lower.includes(keyword)) {
        rawBrand = keyword;
        break;
      }
    }
  }

  const quantity = (p.quantity ?? '').toLowerCase();
  const servingSizeStr = (p.serving_size ?? '').toLowerCase();
  const isLiquid =
    /\d\s*(ml|l|cl|dl|fl\s*oz)\b/.test(quantity) ||
    /\d\s*(ml|l|cl|dl|fl\s*oz)\b/.test(servingSizeStr) ||
    /milk|juice|water|soda|beer|wine|oil|vinegar|broth|stock|sauce|syrup|honey|cream|yogurt|kefir/i.test(p.product_name ?? '');

  const name = rawName.toLowerCase();

  return {
    name,
    brand: rawBrand.toLowerCase(),
    calories,
    protein,
    carbs,
    fat,
    servingSize: '100g',
    unit: isLiquid ? 'ml' : 'g',
    source: 'off',
  };
}

/* ------------------------------------------------------------------ */
/*  USDA nutrient mapping                                              */
/* ------------------------------------------------------------------ */

/**
 * Extract brand from food description if not provided in dedicated fields.
 * Catches patterns like:
 *   "(Archway)" — brand in parentheses
 *   "ARCHWAY Cookies" — brand as uppercase prefix
 *   "Brand Name, Food Item" — brand before comma when description has ALL-CAPS brand
 */
function extractBrandFromDescription(description: string): { brand: string; cleanName: string } {
  // 1. Check for brand in parentheses: "Cookies, Oatmeal, (Archway)"
  const parenMatch = description.match(/\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const brand = parenMatch[1].trim();
    const cleanName = description.replace(/\s*\([^)]+\)\s*$/, '').trim();
    return { brand, cleanName };
  }

  // 2. Check for brand in parentheses anywhere: "(Archway) Cookies, Oatmeal"
  const parenAnyMatch = description.match(/^\(([^)]+)\)\s*/);
  if (parenAnyMatch) {
    const brand = parenAnyMatch[1].trim();
    const cleanName = description.replace(/^\([^)]+\)\s*/, '').trim();
    return { brand, cleanName };
  }

  // 3. Check for ALL-CAPS prefix brand: "ARCHWAY Cookies, Oatmeal"
  const capsMatch = description.match(/^([A-Z][A-Z\s&'./-]{1,30}?)\s+(?=[A-Z][a-z])/);
  if (capsMatch) {
    const brand = capsMatch[1].trim();
    const cleanName = description.slice(brand.length).trim().replace(/^,\s*/, '');
    return { brand, cleanName };
  }

  return { brand: '', cleanName: description };
}

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

function naturalizeUSDAName(desc: string): string {
  const parts = desc.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return desc;
  const base = parts[0];
  const modifiers = parts.slice(1).reverse();
  const result = [...modifiers, base].join(' ');
  const words = result.split(/\s+/);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      deduped.push(w);
    }
  }
  return deduped.join(' ');
}

function parseUSDAFood(food: USDAFoodItem): ParsedNutrition | null {
  const rawBrandName = (food.brandName || '').trim();
  const rawBrandOwner = (food.brandOwner || '').trim();

  if (isBrandBlocked(rawBrandName.toLowerCase()) || isBrandBlocked(rawBrandOwner.toLowerCase())) {
    return null;
  }

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

  const rawBrandField = (food.brandOwner ?? food.brandName ?? '').trim();
  const rawDescription = (food.description ?? 'unknown food').trim();

  let rawBrand: string;
  let rawName: string;

  if (rawBrandField) {
    rawBrand = rawBrandField;
    rawName = naturalizeUSDAName(rawDescription);
  } else {
    const extracted = extractBrandFromDescription(rawDescription);
    rawBrand = extracted.brand;
    rawName = naturalizeUSDAName(extracted.cleanName);
  }
  if (!rawBrand && isObviouslyBranded(rawName)) {
    const lower = rawName.toLowerCase();
    for (const keyword of KNOWN_BRAND_KEYWORDS) {
      if (lower.includes(keyword)) {
        rawBrand = keyword;
        break;
      }
    }
  }

  const servingUnit = (food.servingSizeUnit ?? '').toLowerCase();
  const description = (food.description ?? '').toLowerCase();
  const isLiquid =
    servingUnit === 'ml' ||
    servingUnit === 'l' ||
    /milk|juice|water|soda|beer|wine|oil|vinegar|broth|stock|sauce|syrup|honey|cream|yogurt|kefir|beverage|drink/i.test(description);

  const name = rawName.toLowerCase();

  return {
    name,
    brand: rawBrand.toLowerCase(),
    calories,
    protein,
    carbs,
    fat,
    servingSize: '100g',
    unit: isLiquid ? 'ml' : 'g',
    source: 'usda',
    originalDescription: (food.description ?? '').toLowerCase(),
    dataType: food.dataType ?? '',
    fdcId: food.fdcId,
  };
}

/* ------------------------------------------------------------------ */
/*  Open Food Facts API                                                */
/* ------------------------------------------------------------------ */

async function offFetch(url: string, externalSignal?: AbortSignal): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), OFF_FETCH_TIMEOUT_MS);
  if (externalSignal) {
    if (externalSignal.aborted) {
      ctrl.abort();
      clearTimeout(id);
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    return await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
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

async function searchFoodsOFF(query: string, pageSize: number, page = 1, signal?: AbortSignal): Promise<ParsedNutrition[]> {
  if (!query.trim()) return [];
  const url = `${OFF_BASE}/cgi/search.pl?${new URLSearchParams({
    search_terms: query.trim(),
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(pageSize),
    page: String(page),
  })}`;
  try {
    const res = await offFetch(url, signal);
    if (__DEV__) {
      console.log('[OFF]', { query: query.trim(), status: res.status, ok: res.ok });
    }
    if (!res.ok) {
      console.warn('[OFF]', { query: query.trim(), status: res.status, url });
      return [];
    }
    const rawText = await res.text();
    let data: OFFSearchResponse;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.warn('[OFF] JSON parse failed:', { query: query.trim(), status: res.status, snippet: rawText.slice(0, 200) });
      return [];
    }
    const products = data.products ?? [];
    const results = products
      .filter((p) => p.product_name ?? p.product_name_en ?? p.generic_name)
      .map(parseOFFProduct);
    if (__DEV__) console.log('[OFF]', { query: query.trim(), products: products.length, parsed: results.length });
    return results;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[OFF]', { query: query.trim(), url, error: msg });
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  USDA API                                                           */
/* ------------------------------------------------------------------ */

async function searchByBarcodeUSDA(barcode: string): Promise<ParsedNutrition | null> {
  try {
    const res = await fetchUSDA(`${USDA_BASE}/foods/search?api_key=${API_KEY}`, {
      query: barcode,
      dataType: ['Branded'],
      pageSize: 5,
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

async function fetchUSDA(url: string, body: object, externalSignal?: AbortSignal): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => {
    console.log('[fetchUSDA] timeout abort fired');
    ctrl.abort();
  }, USDA_FETCH_TIMEOUT_MS);
  if (externalSignal) {
    if (externalSignal.aborted) {
      console.log('[fetchUSDA] external signal already aborted');
      ctrl.abort();
      clearTimeout(id);
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', () => {
      console.log('[fetchUSDA] external signal fired abort');
      ctrl.abort();
    }, { once: true });
  }
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(id);
  }
}

async function searchFoodsUSDA(
  query: string,
  pageSize: number,
  page = 1,
  signal?: AbortSignal,
  dataType?: string[],
): Promise<ParsedNutrition[]> {
  const q = query.trim();
  if (!q) return [];

  const url = `${USDA_BASE}/foods/search?api_key=${API_KEY}`;
  const body: { query: string; pageSize: number; pageNumber: number; dataType?: string[] } = {
    query: q,
    pageSize,
    pageNumber: page,
  };
  if (dataType && dataType.length > 0) body.dataType = dataType;

  try {
    const res = await fetchUSDA(url, body, signal);
    if (!res.ok) {
      if (__DEV__) console.warn('[USDA] HTTP', res.status, q);
      return [];
    }
    const data = await res.json();
    if (!data.foods || !Array.isArray(data.foods)) {
      if (__DEV__) console.log('[USDA] no foods', q);
      return [];
    }
    const parsed = (data.foods as USDAFoodItem[]).map(parseUSDAFood).filter((f): f is ParsedNutrition => f !== null);
    if (__DEV__) console.log('[USDA]', q, '→', parsed.length, 'results');
    return parsed;
  } catch (err) {
    if (__DEV__) console.warn('[USDA]', q, err instanceof Error ? err.message : err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Dedup, scoring, and search internals                               */
/* ------------------------------------------------------------------ */

function nameMatchesQuery(item: ParsedNutrition, query: string): boolean {
  const q = query.toLowerCase().trim();
  const queryWords = q.split(/\s+/).filter(Boolean);
  const name = item.name.toLowerCase();
  const desc = (item.originalDescription ?? '').toLowerCase();
  const combined = `${name} ${desc}`;

  return queryWords.every((w) => {
    if (combined.includes(w)) return true;
    if (w.endsWith('s') && combined.includes(w.slice(0, -1))) return true;
    if (!w.endsWith('s') && combined.includes(w + 's')) return true;
    if (w.endsWith('y') && w.length > 2 && combined.includes(w.slice(0, -1) + 'ies')) return true;
    if (combined.includes(w + 'es')) return true;
    return false;
  });
}

/** TMLSN TOP 100 first, then other Verified (Foundation), then rest. */
function sortVerifiedFirst(items: ParsedNutrition[]): ParsedNutrition[] {
  return [...items].sort((a, b) => {
    const aTop = isTmlsnTop100(a);
    const bTop = isTmlsnTop100(b);
    if (aTop && !bTop) return -1;
    if (!aTop && bTop) return 1;
    const aVerified = a.source === 'usda' && a.dataType === 'Foundation';
    const bVerified = b.source === 'usda' && b.dataType === 'Foundation';
    if (aVerified && !bVerified) return -1;
    if (!aVerified && bVerified) return 1;
    return 0;
  });
}

/** List Food only: penalty when result name indicates a different product than the query. */
function getListFoodContradictionPenalty(query: string, resultName: string): number {
  const q = query.toLowerCase().trim();
  const name = resultName.toLowerCase().trim();
  let penalty = 0;

  // Chicken cuts: query says breast → penalize drumstick, thigh, wing, leg
  if (/\bbreast\b/.test(q) && /\b(drumstick|thigh|wing|leg)\b/.test(name)) penalty += 100;
  if (/\b(drumstick|thigh|wing|leg)\b/.test(q) && /\bbreast\b/.test(name)) penalty += 100;

  // Bread: query says sourdough → penalize any bread that does not contain sourdough (white, whole wheat, commercially prepared, etc.)
  if (/\bsourdough\b/.test(q) && /\bbread\b/.test(name) && !/\bsourdough\b/.test(name)) penalty += 100;

  // Chicken: query says breast → penalize chicken/poultry result that does not contain breast (drumstick, thigh, or generic "meat only")
  if (/\bbreast\b/.test(q) && /\b(chicken|poultry)\b/.test(name) && !/\bbreast\b/.test(name)) penalty += 100;

  // Grain vs baked: query is oats (grain) → penalize "bread" (oat bread)
  if (/\boats?\b/.test(q) && /\bbread\b/.test(name)) penalty += 100;

  // Oats (grain) vs oat milk / beverage: query is oats → penalize oat milk, barista blend, beverage
  if (/\boats?\b/.test(q) && !/\b(rolled|whole\s+grain|oat,)\b/.test(name) && /\b(milk|barista|blend|beverage)\b/.test(name)) penalty += 100;

  // Coconut milk vs dairy milk: query has coconut → penalize dairy milk (whole milk, milk without coconut)
  if (/\bcoconut\b/.test(q) && /\bmilk\b/.test(name) && !/\bcoconut\b/.test(name)) penalty += 100;

  // Milk vs dairy products: query is milk (dairy) → penalize cheese, ricotta, yogurt, butter
  if (/\bmilk\b/.test(q) && !/\bcoconut\b/.test(q) && /\b(ricotta|cheese|yogurt|yoghurt|butter)\b/.test(name)) penalty += 100;

  // Powder vs flour: query says protein powder → penalize flour when protein not in result
  if (/\bprotein\s+powder\b/.test(q) && /\bflour\b/.test(name) && !/\bprotein\b/.test(name)) penalty += 100;

  // Rice protein powder vs prepared rice dishes: query has protein powder → penalize fried rice, restaurant, chinese
  if (/\bprotein\s+powder\b/.test(q) && (/\b(fried|restaurant|chinese)\b/.test(name)) && !(/\bprotein\b/.test(name) && /\bpowder\b/.test(name))) penalty += 100;

  return penalty;
}

/** List Food only: true if result is the same ingredient type as the query (no contradiction). Used as hard filter before ranking. */
function listFoodCorresponds(canonicalQuery: string, resultName: string): boolean {
  return getListFoodContradictionPenalty(canonicalQuery.trim().toLowerCase(), resultName.trim()) === 0;
}

function scoreResult(item: ParsedNutrition, query: string): number {
  let score = 0;
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);
  const name = item.name.toLowerCase();

  // Contradiction penalty: wrong product (drumstick vs breast, oat bread vs oats, ricotta vs milk, flour vs powder)
  score -= getListFoodContradictionPenalty(q, item.name);

  // Query says breast → strong bonus when result name contains breast (so "Chicken breast" beats long USDA "Chicken, meat only, boneless, skinless")
  if (/\bbreast\b/.test(q) && /\bbreast\b/.test(name)) score += 50;

  // Composite product penalty: when user types a simple ingredient (e.g. "apple", "olive oil"),
  // prefer the actual ingredient over "apple + mango 1 fruit bar" or "olive oil with a dash of basil"
  const isSimpleIngredientQuery = words.length <= 2 && !q.includes(' of ');
  const hasPlusComposite = /\s+\+\s+/.test(item.name);
  const hasExtraIngredient = /\s+with\s+a\s+(dash|splash|bit)\s+of\s+\w+/i.test(item.name);
  if (isSimpleIngredientQuery && (hasPlusComposite || hasExtraIngredient)) {
    score -= 80;
  }

  // If query is a simple food word (no brand signals), prioritize unbranded
  const hasBrandSignal = words.some(
    (w) => w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase(),
  ) || q.includes("'s") || q.includes('brand');

  if (!hasBrandSignal && !item.brand) {
    score += 100;
  }

  if (hasBrandSignal && item.brand && item.brand.includes(q)) {
    score += 80;
  }

  // Prefer short / canonical names when no brand (e.g. "Chicken breast" over long USDA description)
  if (!hasBrandSignal && item.name.length <= 40) {
    score += 15; // short name bonus
  }
  if (!hasBrandSignal && (/\b(added|vitamin\s+d|%\s*milk|boneless|skinless|,\s*meat\s+only)\b/i.test(item.name))) {
    score -= 25; // long/fortified descriptor penalty
  }
  // Stronger penalty for fortified milk (e.g. "with added vitamin D 3.25%") so plain "Whole milk" wins when available
  if (!hasBrandSignal && /\bmilk\b/.test(q) && /\badded\b/i.test(item.name) && /\bvitamin\b/i.test(item.name)) {
    score -= 50;
  }

  // Exact name match
  if (item.name === q) score += 50;

  // Multi-word: large bonus when name starts with full query (e.g. "Chicken, breast" for "chicken breast")
  if (words.length >= 2 && name.startsWith(q)) score += 40;
  // Name starts with query (e.g. "Apples, raw" for "apple")
  if (name.startsWith(q)) score += 30;

  // Name is exactly the query plus common suffix
  if (name === q || name === q + 's' || name.startsWith(q + ',') || name.startsWith(q + ' ')) {
    score += 25;
  }

  // Name contains query
  if (name.includes(q)) score += 10;

  // Latin ratio as secondary sort factor
  score += Math.round(latinRatio(item.name) * 5);

  return score;
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

export async function searchFoodsProgressive(
  query: string,
  onResults: (results: ParsedNutrition[]) => void,
  pageSize = 25,
  signal?: AbortSignal,
): Promise<void> {
  if (!query.trim()) {
    onResults([]);
    return;
  }

  const trimmed = query.trim();
  const half = Math.ceil(pageSize / 2);

  // Show preloaded Verified (Foundation) immediately if we have them
  const preloaded = getPreloadedResults(trimmed);
  if (preloaded.length > 0) {
    onResults(filterResults(sortVerifiedFirst(preloaded)));
  }

  // Fetch Foundation first, then rest of USDA (Foundation, Branded — no Survey, no SR Legacy)
  const usdaVerifiedPromise = searchFoodsUSDA(trimmed, half, 1, signal, ['Foundation']).catch(() => [] as ParsedNutrition[]);
  const usdaAllPromise = searchFoodsUSDA(trimmed, half, 1, signal, [...USDA_DATA_TYPES]).catch(() => [] as ParsedNutrition[]);
  const offPromise = searchFoodsOFF(trimmed, half, 1, signal).catch(() => [] as ParsedNutrition[]);

  const [usdaVerified, usdaAll] = await Promise.all([usdaVerifiedPromise, usdaAllPromise]);

  const verifiedMatched = usdaVerified.filter((f) => nameMatchesQuery(f, trimmed));
  const verifiedFdcIds = new Set(verifiedMatched.map((f) => f.fdcId).filter((id): id is number => id != null));
  const usdaRest = usdaAll.filter(
    (f) =>
      nameMatchesQuery(f, trimmed) &&
      (f.fdcId == null || !verifiedFdcIds.has(f.fdcId)) &&
      !verifiedMatched.some((b) => (b.fdcId != null && f.fdcId != null ? b.fdcId === f.fdcId : `${b.name}|${b.brand}`.toLowerCase() === `${f.name}|${f.brand}`.toLowerCase())),
  );
  const usda = [...verifiedMatched, ...usdaRest];

  // Emit USDA immediately (gold/verified first) so first results show in ~1–2s
  if (usda.length > 0) {
    onResults(filterResults(sortVerifiedFirst(usda)));
  }

  const off = await offPromise;
  const offFiltered = off.filter((f) => nameMatchesQuery(f, trimmed));

  const seenById = new Set<string>();
  const seenByContent = new Set<string>();
  const merged: ParsedNutrition[] = [];
  const contentKey = (f: ParsedNutrition): string =>
    `${(f.name ?? '').trim().toLowerCase()}|${(f.brand ?? '').trim().toLowerCase()}|${f.calories}|${f.protein}|${f.carbs}|${f.fat}`;
  const dedupKey = (f: ParsedNutrition): string => {
    if (f.source === 'usda' && f.fdcId != null) return `usda:${f.fdcId}`;
    const n = (f.name ?? '').trim().toLowerCase();
    const b = (f.brand ?? '').trim().toLowerCase();
    return `${f.source}:${n}|${b}`;
  };
  for (const f of [...preloaded, ...usda, ...offFiltered]) {
    const idKey = dedupKey(f);
    const cKey = contentKey(f);
    if (seenByContent.has(cKey)) continue;
    if (f.source === 'usda' && f.fdcId != null && seenById.has(idKey)) continue;
    seenById.add(idKey);
    seenByContent.add(cKey);
    merged.push(f);
  }

  const matched = merged.filter((f) => nameMatchesQuery(f, trimmed));
  const final = filterResults(sortVerifiedFirst(matched).slice(0, pageSize));
  if (__DEV__) console.log('[Search]', trimmed, '→', { preloaded: preloaded.length, verified: verifiedMatched.length, usdaAll: usdaAll.length, off: off.length, final: final.length });
  onResults(final);

  // Translation phase — only for non-English queries
  const translateResult = await translateToEnglish(query).catch(() => null);
  if (translateResult && translateResult.text !== query.toLowerCase().trim()) {
    try {
      const [verifiedTrans, usdaTranslated] = await Promise.all([
        searchFoodsUSDA(translateResult.text, half, 1, undefined, ['Foundation']),
        searchFoodsUSDA(translateResult.text, half, 1, undefined, [...USDA_DATA_TYPES]),
      ]);
      const verifiedTransMatched = verifiedTrans.filter((f) => nameMatchesQuery(f, translateResult.text));
      const transVerifiedFdcIds = new Set(verifiedTransMatched.map((f) => f.fdcId).filter((id): id is number => id != null));
      const restTrans = usdaTranslated.filter(
        (f) =>
          nameMatchesQuery(f, translateResult.text) &&
          (f.fdcId == null || !transVerifiedFdcIds.has(f.fdcId)) &&
          !verifiedTransMatched.some((b) => (b.fdcId != null && f.fdcId != null ? b.fdcId === f.fdcId : `${b.name}|${b.brand}`.toLowerCase() === `${f.name}|${f.brand}`.toLowerCase())),
      );
      const transMatched = [...verifiedTransMatched, ...restTrans];

      if (transMatched.length > 0 && translateResult.sourceLang && translateResult.sourceLang !== 'en') {
        const names = transMatched.map((f) => f.name);
        const translatedNames = await translateFoodNamesBatch(names, translateResult.sourceLang);
        transMatched.forEach((f, i) => {
          f.name = translatedNames[i];
        });
      }

      for (const f of transMatched) {
        const idKey = dedupKey(f);
        const cKey = contentKey(f);
        if (seenByContent.has(cKey)) continue;
        if (f.source === 'usda' && f.fdcId != null && seenById.has(idKey)) continue;
        seenById.add(idKey);
        seenByContent.add(cKey);
        merged.push(f);
      }

      const allMatched = merged.filter(
        (f) => nameMatchesQuery(f, query) || (translateResult.text && nameMatchesQuery(f, translateResult.text)),
      );
      onResults(filterResults(sortVerifiedFirst(allMatched).slice(0, pageSize)));
    } catch (err) {
      if (__DEV__) console.warn('[Search] translation phase failed:', err instanceof Error ? err.message : err);
    }
  }
}

/** Fetch next page of results. Use after searchFoodsProgressive for page 1. USDA only — fast and reliable. */
export async function searchFoodsNextPage(
  query: string,
  page: number,
  onResults: (results: ParsedNutrition[]) => void,
  pageSize = 25,
): Promise<void> {
  if (!query.trim() || page < 2) return;

  try {
    const results = await searchFoodsUSDA(query, pageSize, page, undefined, [...USDA_DATA_TYPES]);
    const filtered = results.filter((f) => nameMatchesQuery(f, query));
    const byFdcId = new Set<number>();
    const byContent = new Set<string>();
    const deduped = filtered.filter((f) => {
      if (f.source === 'usda' && f.fdcId != null && byFdcId.has(f.fdcId)) return false;
      const cKey = `${(f.name ?? '').trim().toLowerCase()}|${(f.brand ?? '').trim().toLowerCase()}|${f.calories}|${f.protein}|${f.carbs}|${f.fat}`;
      if (byContent.has(cKey)) return false;
      if (f.source === 'usda' && f.fdcId != null) byFdcId.add(f.fdcId);
      byContent.add(cKey);
      return true;
    });
    onResults(filterResults(sortVerifiedFirst(deduped)));
  } catch (err) {
    if (__DEV__) console.warn('[Search] next page failed:', err instanceof Error ? err.message : err);
    onResults([]);
  }
}

/** Typo corrections used only for List Food first-match. Applied per word so "chiken saled" → "chicken salad". */
const FIRST_MATCH_TYPO_MAP: Record<string, string> = {
  chiken: 'chicken',
  egs: 'eggs', egg: 'eggs',
  cheeze: 'cheese', chese: 'cheese',
  tomatos: 'tomatoes',
  brocoli: 'broccoli', brocolli: 'broccoli',
  saled: 'salad', lettus: 'lettuce',
  spinnach: 'spinach', spinich: 'spinach',
  yogert: 'yogurt', yougurt: 'yogurt', yogourt: 'yogurt',
  avacado: 'avocado',
  potatos: 'potatoes',
  pastsa: 'pasta',
  bannana: 'banana',
  oates: 'oats', otas: 'oats',
  salamon: 'salmon', salomn: 'salmon',
  turky: 'turkey',
  beaf: 'beef', beff: 'beef',
  ric: 'rice',
  carots: 'carrots', carrotts: 'carrots',
  onoin: 'onion', onoins: 'onions',
  lettace: 'lettuce',
  cabage: 'cabbage',
  stawberry: 'strawberry', stawberries: 'strawberries',
  bluberry: 'blueberry', bluberries: 'blueberries',
  rasberry: 'raspberry', rasberries: 'raspberries',
  bred: 'bread',
  buter: 'butter',
  hone: 'honey',
};

/** Applies word-level typo correction for List Food. "chiken saled" → "chicken salad". */
function applyWordLevelTypos(line: string): string {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return line.trim();
  const corrected = words.map((w) => {
    const lower = w.toLowerCase();
    return FIRST_MATCH_TYPO_MAP[lower] ?? w;
  });
  return corrected.join(' ').toLowerCase();
}

/** Prefixes that describe amount/serving, not the ingredient name. Strip so "with a dash of olive oil" → "olive oil". */
const LIST_FOOD_AMOUNT_PREFIXES = [
  /^\s*with\s+a\s+(dash|splash|bit|little)\s+of\s+/i,
  /^\s*(?:a\s+)?(dash|splash|bit)\s+of\s+/i,
  /^\s*\d+(\.\d+)?\s*(g|ml|oz|cup|cups|tbsp|tsp|scoop|scoops|slice|slices|serving|servings)?\s*(?:of\s+)?/i,
];

/** Single-word variants that are amount/serving only — never use as search query so "dash" doesn't drive the match. */
const LIST_FOOD_AMOUNT_ONLY_WORDS = new Set(['dash', 'splash', 'bit', 'scoops', 'scoop', 'cups', 'cup', 'slices', 'slice', 'servings', 'serving']);
function isAmountOnlyVariant(q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  if (LIST_FOOD_AMOUNT_ONLY_WORDS.has(t)) return true;
  if (/^\d+$/.test(t)) return true; // "1", "4"
  if (/^\d+(\.\d+)?\s*(g|ml|oz|tbsp|tsp)$/.test(t)) return true; // "200g", "250ml"
  return false;
}

/**
 * Extracts the main ingredient name from a List Food phrase so the ingredient carries the weight, not "dash", "1", or "200g of".
 * e.g. "with a dash of olive oil" → "olive oil", "1 apple" → "apple", "4 scoops of rice protein powder" → "rice protein powder".
 */
function extractListFoodIngredientName(phrase: string): string {
  let s = phrase.trim();
  if (!s) return s;
  for (const re of LIST_FOOD_AMOUNT_PREFIXES) {
    s = s.replace(re, '').trim();
  }
  return s || phrase.trim();
}

/** Word to number for quantity parsing (one, two, ... twenty, etc.). */
const LIST_FOOD_NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
};
const ML_PER_CUP = 240;
const G_PER_SLICE_BREAD = 30;
const G_PER_SCOOP = 30;
const ML_PER_TBSP = 15;
const ML_PER_TSP = 5;
const ML_PER_DASH = 5;   // "a dash of" olive oil, etc. (liquid)
const G_PER_HANDFUL = 20; // "a handful of" arugula, greens
const G_MEDIUM_APPLE = 182; // one apple (unspecified size → medium)

/** Words that indicate a liquid for "dash of" → ml */
const LIST_FOOD_LIQUID_WORDS = new Set(['oil', 'olive', 'milk', 'vinegar', 'juice', 'water', 'sauce', 'syrup']);

/**
 * Parses quantity from a List Food phrase (e.g. "250 grams of chicken breast", "one cup of milk").
 * Returns amount and unit for pre-filling the confirm row; null when no quantity found.
 */
export function parseListFoodQuantity(phrase: string): { amount: number; unit: 'g' | 'ml' } | null {
  const s = phrase.trim().toLowerCase();
  if (!s) return null;

  // "a dash of" / "dash of" + liquid (olive oil, oil, milk, etc.) → ml
  const dashMatch = s.match(/^\s*(?:a\s+)?dash\s+of\s+(.+)$/);
  if (dashMatch) {
    const rest = dashMatch[1].trim().split(/\s+/);
    if (rest.some((w) => LIST_FOOD_LIQUID_WORDS.has(w.replace(/,/g, '')))) return { amount: ML_PER_DASH, unit: 'ml' };
  }

  // "a handful of" / "handful of" / "one handful" → g
  if (/^\s*(?:a\s+)?handful\s+of\s+\w+/i.test(s) || /^\s*(?:one|1)\s+handful\b/i.test(s)) {
    return { amount: G_PER_HANDFUL, unit: 'g' };
  }

  // "one apple" / "1 apple" (no size) → medium apple in g
  if (/^\s*(?:one|1)\s+apple\b(?!\s+(?:small|medium|large))/i.test(s)) return { amount: G_MEDIUM_APPLE, unit: 'g' };

  // Numeric + unit at start: 250g, 250 g, 250 grams, 350ml, 350 ml, 350 milliliters
  const numUnitMatch = s.match(/^\s*(\d+(?:\.\d+)?)\s*(g|gram|grams|ml|milliliter|milliliters)\b/i);
  if (numUnitMatch) {
    const amount = parseFloat(numUnitMatch[1]);
    const u = numUnitMatch[2].toLowerCase();
    if (u === 'g' || u.startsWith('gram')) return { amount: Math.round(amount), unit: 'g' };
    if (u === 'ml' || u.startsWith('milliliter')) return { amount: Math.round(amount), unit: 'ml' };
  }

  // Word number + unit: one cup, 2 cups, one slice, 4 scoops, 1 tbsp, 2 tsp
  const wordNumMatch = s.match(/^\s*(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(cup|cups|slice|slices|scoop|scoops|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons)\b/i);
  if (wordNumMatch) {
    const numStr = wordNumMatch[1].toLowerCase();
    const n = LIST_FOOD_NUMBER_WORDS[numStr] ?? (parseInt(numStr, 10) || 1);
    const unitWord = wordNumMatch[2].toLowerCase();
    if (unitWord === 'cup' || unitWord === 'cups') return { amount: n * ML_PER_CUP, unit: 'ml' };
    if (unitWord === 'slice' || unitWord === 'slices') return { amount: n * G_PER_SLICE_BREAD, unit: 'g' };
    if (unitWord === 'scoop' || unitWord === 'scoops') return { amount: n * G_PER_SCOOP, unit: 'g' };
    if (unitWord === 'tbsp' || unitWord === 'tablespoon' || unitWord === 'tablespoons') return { amount: n * ML_PER_TBSP, unit: 'ml' };
    if (unitWord === 'tsp' || unitWord === 'teaspoon' || unitWord === 'teaspoons') return { amount: n * ML_PER_TSP, unit: 'ml' };
  }

  return null;
}

/** Picks best match: only candidates that correspond to the canonical ingredient (hard filter); then rank by score. Returns null if none correspond. */
function pickBestForListFood(items: ParsedNutrition[], canonicalQuery: string): ParsedNutrition | null {
  if (items.length === 0) return null;
  const q = canonicalQuery.trim().toLowerCase();
  const corresponding = items.filter((item) => listFoodCorresponds(q, item.name));
  if (corresponding.length === 0) return null;
  const byScore = (a: ParsedNutrition, b: ParsedNutrition) => scoreResult(a, canonicalQuery) - scoreResult(b, canonicalQuery);
  const sorted = [...corresponding].sort((a, b) => byScore(b, a));
  return sorted[0] ?? null;
}

/** Runs one search and returns the best match or null. Waits for full merged pool (USDA+OFF) before selecting. Uses canonicalForSelection for correspondence filter when provided (so variant "milk" does not accept dairy when user said "coconut milk"). */
function tryFirstMatchQuery(query: string, canonicalForSelection?: string): Promise<ParsedNutrition | null> {
  const trimmed = query.trim();
  if (!trimmed) return Promise.resolve(null);
  const canonical = (canonicalForSelection ?? trimmed).trim().toLowerCase();

  const preloaded = getPreloadedResultsExact(trimmed);
  if (preloaded.length > 0) {
    const best = pickBestForListFood(preloaded, canonical);
    if (best) return Promise.resolve(best);
  }

  return new Promise((resolve) => {
    let fullPool: ParsedNutrition[] = [];
    searchFoodsProgressive(trimmed, (results) => {
      fullPool = results;
    }, 40).then(() => {
      const best = pickBestForListFood(fullPool, canonical);
      resolve(best);
    });
  });
}

/** Returns the first search result for a query. For List Food use canonicalForSelection so selection respects the user's ingredient (e.g. "coconut milk") not the variant used to fetch (e.g. "milk"). */
export async function searchFoodFirstMatch(query: string, canonicalForSelection?: string): Promise<ParsedNutrition | null> {
  const q = query.trim();
  if (!q) return null;
  return tryFirstMatchQuery(q, canonicalForSelection);
}

/** Splits a List Food line into ingredients (e.g. "eggs and toast" → ["eggs", "toast"]). Splits on " and ", " with ", ", ", " & " only; filters empty and numbers-only. Export for nutrition screen so one line → one row per ingredient. */
export function getListFoodSearchTokens(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/\s+(?:and|with|,|&)\s+|\s*,\s*/i).map((p) => p.trim()).filter(Boolean);
  return parts.filter((p) => !/^\d+$/.test(p));
}

/**
 * Builds query variants for List Food. The ingredient name always carries the most weight:
 * we try the extracted ingredient first (e.g. "olive oil" from "with a dash of olive oil"),
 * then full line, typo-corrected, then tokens. We do NOT add each word so phrases like
 * "one cup of milk" don't collapse to "milk" only.
 */
function listFoodQueryVariants(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed || /^\d+$/.test(trimmed)) return [];
  const ingredientFirst = extractListFoodIngredientName(trimmed);
  const fullTypoCorrected = applyWordLevelTypos(trimmed);
  const tokens = getListFoodSearchTokens(trimmed);
  const tokensCorrected = tokens.map((t) => applyWordLevelTypos(extractListFoodIngredientName(t))).filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  const add = (q: string) => {
    const qq = q.trim().toLowerCase();
    if (!qq || seen.has(qq) || isAmountOnlyVariant(qq)) return;
    seen.add(qq);
    out.push(qq);
  };

  // Ingredient name first so "dash" / "1" don't drive the match
  add(ingredientFirst);
  add(applyWordLevelTypos(ingredientFirst));
  add(trimmed);
  add(fullTypoCorrected);
  for (const t of tokensCorrected) add(t);

  return out;
}

/**
 * Best-effort first match for List Food. Uses canonical ingredient (extracted + typo-corrected) for correspondence:
 * we try each variant to fetch a pool but only accept results that correspond to the canonical (e.g. "coconut milk" not "milk").
 * Never returns null: synthetic row (user text, 0 macros) if no corresponding match.
 */
export async function searchFoodFirstMatchBestEffort(query: string): Promise<ParsedNutrition> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      name: 'Unknown',
      brand: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      servingSize: '100',
      unit: 'g',
      source: 'usda',
    };
  }
  const canonicalIngredient = applyWordLevelTypos(extractListFoodIngredientName(trimmed)).trim().toLowerCase();
  const variants = listFoodQueryVariants(query);
  for (const variant of variants) {
    const match = await searchFoodFirstMatch(variant, canonicalIngredient);
    if (match) return match;
  }
  return {
    name: trimmed,
    brand: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    servingSize: '100',
    unit: 'g',
    source: 'usda',
  };
}

/** Preload Foundation (TMLSN Verified) results for common queries so they show instantly when user searches. Call once on app/screen load. */
export function preloadCommonSearches(): void {
  PRELOAD_QUERIES.forEach((q, i) => {
    const key = q.trim().toLowerCase();
    if (preloadCache.has(key)) return;
    setTimeout(() => {
      searchFoodsUSDA(q, 10, 1, undefined, ['Foundation'])
        .then((results) => {
          const matched = results.filter((f) => nameMatchesQuery(f, q));
          const byFdcId = new Set<number>();
          const byContent = new Set<string>();
          const deduped = matched.filter((f) => {
            if (f.source === 'usda' && f.fdcId != null && byFdcId.has(f.fdcId)) return false;
            const cKey = `${(f.name ?? '').trim().toLowerCase()}|${(f.brand ?? '').trim().toLowerCase()}|${f.calories}|${f.protein}|${f.carbs}|${f.fat}`;
            if (byContent.has(cKey)) return false;
            if (f.source === 'usda' && f.fdcId != null) byFdcId.add(f.fdcId);
            byContent.add(cKey);
            return true;
          });
          if (deduped.length > 0) {
            const filtered = filterResults(deduped);
            preloadCache.set(key, filtered);
            if (__DEV__) console.log('[Preload]', q, '→', filtered.length, 'Verified');
          }
        })
        .catch(() => {});
    }, 400 + i * 300);
  });
}