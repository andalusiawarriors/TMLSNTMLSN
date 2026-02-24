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

async function searchFoodsUSDA(query: string, pageSize: number, page = 1, signal?: AbortSignal): Promise<ParsedNutrition[]> {
  const q = query.trim();
  if (!q) return [];

  const url = `${USDA_BASE}/foods/search?api_key=${API_KEY}`;
  const body = { query: q, pageSize, pageNumber: page };

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

function sortBasicsFirst(items: ParsedNutrition[]): ParsedNutrition[] {
  return [...items].sort((a, b) => {
    const aIsBasic =
      a.source === 'usda' &&
      (!a.brand || a.brand.trim() === '') &&
      (a.dataType === 'Foundation' || a.dataType === 'SR Legacy' || a.dataType === 'Survey (FNDDS)');
    const bIsBasic =
      b.source === 'usda' &&
      (!b.brand || b.brand.trim() === '') &&
      (b.dataType === 'Foundation' || b.dataType === 'SR Legacy' || b.dataType === 'Survey (FNDDS)');
    if (aIsBasic && !bIsBasic) return -1;
    if (!aIsBasic && bIsBasic) return 1;
    return 0;
  });
}

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

  const half = Math.ceil(pageSize / 2);

  const usdaPromise = searchFoodsUSDA(query, half).catch(() => [] as ParsedNutrition[]);
  const offPromise = searchFoodsOFF(query, half, 1, signal).catch(() => [] as ParsedNutrition[]);

  // Emit USDA as soon as it arrives (don't wait for OFF)
  usdaPromise.then((results) => {
    const matched = results.filter((f) => nameMatchesQuery(f, query));
    if (matched.length > 0) {
      onResults(filterResults(sortBasicsFirst(matched)));
    }
  });

  // Wait for both to finish
  const [usdaRes, offRes] = await Promise.allSettled([usdaPromise, offPromise]);
  const usda = usdaRes.status === 'fulfilled' ? usdaRes.value : [];
  const off = offRes.status === 'fulfilled' ? offRes.value : [];

  // Filter OFF — must match query words in the name
  let offFiltered = off.filter((f) => nameMatchesQuery(f, query));

  // Merge + dedup
  const seen = new Set<string>();
  const merged: ParsedNutrition[] = [];
  for (const f of [...usda, ...offFiltered]) {
    const key = `${f.name}|${f.brand}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(f);
    }
  }

  const matched = merged.filter((f) => nameMatchesQuery(f, query));
  const final = filterResults(sortBasicsFirst(matched).slice(0, pageSize));
  if (__DEV__) console.log('[Search]', query, '→', { usda: usda.length, off: off.length, offFiltered: offFiltered.length, final: final.length });
  onResults(final);

  // Translation phase — only for non-English queries
  const translateResult = await translateToEnglish(query).catch(() => null);
  if (translateResult && translateResult.text !== query.toLowerCase().trim()) {
    try {
      const usdaTranslated = await searchFoodsUSDA(translateResult.text, half);
      const transMatched = usdaTranslated.filter((f) => nameMatchesQuery(f, translateResult.text));

      if (transMatched.length > 0 && translateResult.sourceLang && translateResult.sourceLang !== 'en') {
        const names = transMatched.map((f) => f.name);
        const translatedNames = await translateFoodNamesBatch(names, translateResult.sourceLang);
        transMatched.forEach((f, i) => {
          f.name = translatedNames[i];
        });
      }

      for (const f of transMatched) {
        const key = `${f.name}|${f.brand}`.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(f);
        }
      }

      const allMatched = merged.filter(
        (f) => nameMatchesQuery(f, query) || (translateResult.text && nameMatchesQuery(f, translateResult.text)),
      );
      onResults(filterResults(sortBasicsFirst(allMatched).slice(0, pageSize)));
    } catch {}
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
    const results = await searchFoodsUSDA(query, pageSize, page);
    const filtered = results.filter((f) => nameMatchesQuery(f, query));
    onResults(filterResults(filtered));
  } catch {
    onResults([]);
  }
}

