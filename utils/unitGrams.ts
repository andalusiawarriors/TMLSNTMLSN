// Shared unit/grams logic so AddMealSheet and others can use resolveGrams
// without depending on UnitWheelPicker (avoids load-order issues).

export const ADD_MEAL_UNITS = ['tbsp', 'tsp', 'cup', '2cup', 'halfCup', 'quarterCup', '100g', '1g', 'ml', '100ml', 'oz'] as const;
export type AddMealUnit = (typeof ADD_MEAL_UNITS)[number];

export const UNIT_TO_GRAMS: Record<AddMealUnit, number> = {
  tbsp: 15,
  tsp: 5,
  cup: 240,
  '2cup': 480,
  halfCup: 120,
  quarterCup: 60,
  '100g': 100,
  '1g': 1,
  ml: 1,
  '100ml': 100,
  oz: 28.35,
};

/** Grams per 1 unit. Uses UNIT_TO_GRAMS; if portions are provided and unit matches a portion label, returns that portion's gramWeight. Accepts string for units not in AddMealUnit (e.g. portion labels). */
export function resolveGrams(
  unit: AddMealUnit | string,
  portions?: Array<{ label: string; gramWeight: number }> | undefined
): number {
  if (unit in UNIT_TO_GRAMS) return UNIT_TO_GRAMS[unit as AddMealUnit];
  if (portions?.length) {
    const match = portions.find((p) => p.label === unit);
    if (match) return match.gramWeight;
  }
  if (__DEV__) console.warn(`resolveGrams: unknown unit "${unit}", falling back to 100g`);
  return 100;
}
