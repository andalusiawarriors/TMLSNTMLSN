# Unit conversion consistency – summary

## Files changed

| File | Changes |
|------|--------|
| **utils/units.ts** | **New.** Central conversion helpers and constants. |
| **app/(tabs)/workout/index.tsx** | Set weight: display via `toDisplayWeight`, save via `fromDisplayWeight`; summary volume via `toDisplayVolume`; `__DEV__` log on set weight update. |
| **components/FitnessGraphWidget.tsx** | Volume aggregation uses `KG_PER_LB` from units; display uses same constant; `__DEV__` log for graph volume (one sample). |
| **components/WorkoutProgressWidget.tsx** | Session volume display via `toDisplayVolume`. |
| **app/(tabs)/nutrition.tsx** | Goals modal: water display/save via `toDisplayFluid` / `fromDisplayFluid`; label/placeholder by `volumeUnit`; `handleAddWater` converts display amount to oz before adding; `__DEV__` logs on goal save, add water, and load (water summary). |

---

## Internal storage units

- **Workout set weight:** stored in **lb**.  
  Persisted and in-memory workout state keep `set.weight` in lb. Display uses `toDisplayWeight(storedLb, weightUnit)`; save uses `fromDisplayWeight(displayValue, weightUnit)`.

- **Nutrition water / fluid:** stored in **oz** (US fl oz).  
  `dailyGoals.water` and `NutritionLog.water` are in oz. Display uses `toDisplayFluid(storedOz, volumeUnit)`; save uses `fromDisplayFluid(displayValue, volumeUnit)`.

Supabase (and any existing schema) is unchanged; only the meaning and consistency of the stored numbers are standardized.

---

## Where the bug was

1. **Wrong direction / inconsistent interpretation**  
   - **Workout:** Set weight was saved as “whatever the user typed” (no conversion). The fitness graph treated raw volume as **lb** when `weightUnit === 'lb'` and as **kg** when `weightUnit === 'kg'`, so stored weight was effectively interpreted in the current preference. That could mix units (e.g. save 100 kg, later show as 100 lb) and mis-scale the volume chart.  
   - **Fix:** All workout weight is stored in lb. Display and chart use the shared helpers so one canonical storage unit (lb) is converted to/from display (kg or lb) only at the edges.

2. **Double conversion**  
   - Graph aggregated `volumeRaw` then converted with `weightUnit === 'lb' ? volumeRaw * LB_TO_KG : volumeRaw`, so volume was converted in the aggregation step. Elsewhere, values were converted again for display.  
   - **Fix:** Aggregation keeps volume in lb (`volumeRaw`), then converts once to kg for internal chart scale (`volumeKg = volumeRaw * KG_PER_LB`). Display uses that plus `weightUnit` so there is a single conversion to the user-visible number.

3. **Missing conversion at boundaries**  
   - Nutrition water had no conversion: goal and log water were shown and saved in a single unit (effectively oz in the UI). There was no support for displaying/editing in ml when `volumeUnit === 'ml'`.  
   - **Fix:** Goals and add-water use `toDisplayFluid` / `fromDisplayFluid` and `volumeUnit`, so the same stored oz value is shown and entered in either oz or ml.

---

## Conversion factors (utils/units.ts)

- lb per kg: **2.2046226218**
- kg per lb: **0.45359237**
- ml per US fl oz: **29.5735295625**
- US fl oz per ml: **0.0338140227**

---

## Display formatting

- **Weight:** `formatWeightDisplay(value, weightUnit)` – 0 or 1 decimal as appropriate.  
- **Fluid:** `formatFluidDisplay(value, volumeUnit)` – ml as integer, oz with 1 decimal.  
Stored values are not rounded before save (except water goal/add stored oz kept to 2 decimals to avoid floating-point noise).

---

## __DEV__ logs (temporary)

- **Workout set input/save:** `[units] set weight: weightUnit=… displayed=… stored(lb)=…`
- **Fitness graph volume:** `[units] fitness graph volume: weightUnit=… rawVolume(lb)=… displayVolume=…` (one sample when there is volume).
- **Water goal save:** `[units] water goal save: volumeUnit=… displayed=… stored(oz)=…`
- **Water add:** `[units] water add: volumeUnit=… displayedAmount=… stored(oz)=… -> …`
- **Water summary (on load):** `[units] water summary: volumeUnit=… stored(oz)=… display=…` when the day has water logged.

---

## Remaining notes

- **Routine / split suggested weight:** Template sets are still built with `suggestedWeight` as a raw number (e.g. from `buildTemplateSets`). That value is not converted; it is stored as-is in the new set. For consistency with “storage = lb”, suggested weights in routines/splits should be entered in **lb**, or a future change could convert at template-apply time using the current `weightUnit`.
- **Existing data:** Old workout sessions may have been saved when the app stored “display value” without conversion. Those are now treated as **lb**. If any legacy data was stored in kg, it will show and aggregate as if it were lb (e.g. 100 kg stored as 100 would appear as 100 lb). A one-time migration could be added later if needed.
- **No remaining inline conversion math:** All kg/lb and ml/oz conversion uses `utils/units.ts`; no 2.2, 0.45, 29.57, etc. in components.
