// USDA FoodData Central API — barcode & text search for branded foods
// Free API key: sign up at https://api.data.gov/signup/
// Docs: https://fdc.nal.usda.gov/api-guide

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

// DEMO_KEY works out-of-the-box (30 req/hour, 50/day).
// Replace with your own key from https://api.data.gov/signup/ for production.
const API_KEY = 'DEMO_KEY';

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
/*  Nutrient ID → macro mapping                                        */
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

function parseNutrients(food: USDAFoodItem): ParsedNutrition {
  const macros: ParsedNutrition = {
    name: food.description ?? 'Unknown Food',
    brand: food.brandOwner ?? food.brandName ?? '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    servingSize: food.servingSize
      ? `${food.servingSize}${food.servingSizeUnit ?? 'g'}`
      : '',
  };

  for (const n of food.foodNutrients) {
    const key = NUTRIENT_MAP[String(n.nutrientNumber)] ?? NUTRIENT_MAP[String(n.nutrientId)];
    if (key && macros[key] === 0) {
      macros[key] = Math.round(n.value);
    }
  }

  return macros;
}

/* ------------------------------------------------------------------ */
/*  API calls                                                          */
/* ------------------------------------------------------------------ */

export async function searchByBarcode(barcode: string): Promise<ParsedNutrition | null> {
  try {
    const res = await fetch(`${USDA_BASE}/foods/search?api_key=${API_KEY}`, {
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
    return parseNutrients(exact ?? data.foods[0]);
  } catch (err) {
    console.warn('USDA barcode search error:', err);
    return null;
  }
}

export async function searchFoods(query: string, pageSize = 15): Promise<ParsedNutrition[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(`${USDA_BASE}/foods/search?api_key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.trim(), dataType: ['Branded', 'SR Legacy', 'Foundation'], pageSize }),
    });
    if (!res.ok) return [];
    const data: FoodSearchResult = await res.json();
    return data.foods.map(parseNutrients);
  } catch (err) {
    console.warn('USDA food search error:', err);
    return [];
  }
}
