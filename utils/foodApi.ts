// Dual-source food API: Open Food Facts (global branded) + USDA (US generic)
import { filterResults, filterSingleFood, isObviouslyBranded, KNOWN_BRAND_KEYWORDS, latinRatio } from './foodFilters';
import { translateFoodName, translateToEnglish } from './translateQuery';

// expo-localization requires a native rebuild (npx expo run:ios). Until then, skip
// translation to avoid "Cannot find native module 'ExpoLocalization'" in Expo Go.
async function getDeviceLanguage(): Promise<string> {
  return 'en';
  // To enable: run npx expo run:ios, then uncomment:
  // try {
  //   const { getLocales } = await import('expo-localization');
  //   return getLocales()[0]?.languageCode ?? 'en';
  // } catch {
  //   return 'en';
  // }
}
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

  const name = rawName.toLowerCase();

  if (__DEV__) {
    console.log('[parseUSDA]', {
      description: food.description,
      brandOwner: food.brandOwner,
      brandName: food.brandName,
      parsedBrand: rawBrand,
      parsedName: rawName,
    });
  }

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
/*  Dedup, scoring, and search internals                               */
/* ------------------------------------------------------------------ */

function scoreResult(item: ParsedNutrition, query: string): number {
  let score = 0;
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);

  // If query is a simple food word (no brand signals), prioritize unbranded
  const hasBrandSignal = words.some(
    (w) => w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase(),
  ) || q.includes("'s") || q.includes('brand');

  if (!hasBrandSignal && !item.brand) {
    score += 100; // push unbranded basics to top
  }

  if (hasBrandSignal && item.brand && item.brand.includes(q)) {
    score += 80; // brand match
  }

  // Exact name match
  if (item.name === q) score += 50;

  // Name starts with query
  if (item.name.startsWith(q)) score += 30;

  // Name contains query
  if (item.name.includes(q)) score += 10;

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

/** Text search: USDA + Open Food Facts in parallel, merged. Non-English queries show OFF (native names) first. */
export async function searchFoods(query: string, pageSize = 15): Promise<ParsedNutrition[]> {
  if (!query.trim()) return [];

  const half = Math.ceil(pageSize / 2);

  // Fire everything in parallel — no waiting
  const [translateRes, usdaOrigRes, offRes] = await Promise.allSettled([
    translateToEnglish(query),
    searchFoodsUSDA(query, half),
    searchFoodsOFF(query, half),
  ]);

  const translated = translateRes.status === 'fulfilled' ? translateRes.value : null;
  const usdaOrig = usdaOrigRes.status === 'fulfilled' ? usdaOrigRes.value : [];
  const off = offRes.status === 'fulfilled' ? offRes.value : [];

  // If translation returned something different, fire second USDA search
  let usdaTranslated: ParsedNutrition[] = [];
  if (translated && translated !== query.toLowerCase().trim()) {
    try {
      usdaTranslated = await searchFoodsUSDA(translated, half);
    } catch {}
  }

  // Merge: if non-English query detected, OFF first (native language names)
  // then USDA translated results, then USDA original
  const isNonEnglish = translated != null;
  const ordered = isNonEnglish
    ? [...off, ...usdaTranslated, ...usdaOrig]
    : [...usdaOrig, ...usdaTranslated, ...off];

  const seen = new Set<string>();
  const merged: ParsedNutrition[] = [];
  for (const f of ordered) {
    const key = `${f.name}|${f.brand}`.toLowerCase();
    if (!seen.has(key) && merged.length < pageSize) {
      seen.add(key);
      merged.push(f);
    }
  }

  merged.sort((a, b) => {
    const aUnbranded = !a.brand || a.brand.trim() === '';
    const bUnbranded = !b.brand || b.brand.trim() === '';
    if (aUnbranded && !bUnbranded) return -1;
    if (!aUnbranded && bUnbranded) return 1;
    return 0; // preserve existing language-priority order within each group
  });

  const filtered = filterResults(merged);

  // Translate USDA English names to user's language
  const lang = await getDeviceLanguage();
  if (lang !== 'en') {
    await Promise.all(
      filtered.map(async (item) => {
        const isLikelyEnglish = /^[a-z\s,'-]+$/.test(item.name);
        if (isLikelyEnglish) {
          item.name = await translateFoodName(item.name, lang);
        }
      }),
    );
  }

  return filtered;
}
