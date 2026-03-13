# Phase 2 Verification Report — Current State (Post-Guards)

**Date:** Verification of current codebase state. No code changes made.

---

## 1. Exact Current Adaptive Jump Logic

**File:** [lib/progression/decideNextPrescription.ts](lib/progression/decideNextPrescription.ts) (lines 126–160)

### +1 rule
- Default when no higher jump qualifies.
- Also forced when: `workSets.length < 3` (lines 136–137).
- Also when: avgReps or set-count guards fail for +2/+3.

### +2 rule
All of:
- `avgReps >= currentTargetReps + 1`
- `rangeWidth >= 4`
- `setsAtTargetPlus1 >= 2` (at least 2 sets with `reps >= currentTargetReps + 1`)
- `workSets.length >= 3`

### +3 rule
All of:
- `avgReps >= currentTargetReps + 2`
- `rangeWidth >= 6`
- `currentTargetReps <= repRangeLow + 2`
- `setsAtTargetPlus2 >= 3` (at least 3 sets with `reps >= currentTargetReps + 2`)
- `workSets.length >= 3`

### Range-width caps (getMaxJumpForRangeWidth, lines 115–119)
- `rangeWidth <= 3` → max jump = 1
- `rangeWidth <= 5` → max jump = 2
- `rangeWidth > 5` → max jump = 3

### Minimum set count
- `workSets.length < 3` → always +1 (lines 136–137)

---

## 2. atTopThreshold Priority

**Yes.** Evaluation order (lines 206–324):

1. Calibration  
2. Deload week  
3. **atTopThreshold** (Step 3, lines 279–306)  
4. **atTargetThreshold** (Step 4, lines 308–338)  
5. Hold  

`atTop` is checked before `atTarget`. When 70%+ of sets hit `repRangeHigh`, the engine adds weight and resets to `repRangeLow`; it never reaches `computeAdaptiveJump`.

---

## 3. Save Path vs Recompute Path

**Yes.** Both use the same logic.

- **Save:** [utils/supabaseStorage.ts](utils/supabaseStorage.ts) `supabaseSaveWorkoutSession` (lines 1184–1206) → `computeNextPrescription` → `decideNextPrescription`.
- **Recompute:** [utils/supabaseStorage.ts](utils/supabaseStorage.ts) `recomputeDerivedWorkoutState` (lines 429–436) → same `computeNextPrescription` → same `decideNextPrescription`.

Single `computeNextPrescription` (lines 219–257) calls `decideNextPrescription` with the same input shape. No duplicated logic.

---

## 4. Today’s Session Display

**Yes.** [lib/getWorkoutContext.ts](lib/getWorkoutContext.ts) `buildTodayExerciseDetails` (lines 329–361):

- Fetches `prescriptions` from `supabaseGetExercisePrescriptions`.
- Calls `buildDisplayPrescriptionSnapshot` with `prescription` and `recentSets`.
- When `hasPrescription`, `buildDisplayPrescriptionSnapshot` uses `prescription.nextTargetReps` for `ghostReps` (line 84).
- Returns `TodayExerciseDetail` with `ghostReps` from that snapshot.

Today’s Session shows persisted/recomputed `next_target_reps`.

---

## 5. Active Workout Seeding

**Yes.** [components/WorkoutCore.tsx](components/WorkoutCore.tsx) `getResolvedTargetReps` (lines 97–106):

- Prefers `detail?.ghostReps` from `todayContext.todayExerciseDetails`.
- `todayExerciseDetails` comes from `buildTodayExerciseDetails` → `buildDisplayPrescriptionSnapshot` → `prescription.nextTargetReps`.

Active workout initial reps use persisted/recomputed `next_target_reps`.

---

## 6. Active Workout Ghost Display

**Yes.** [utils/workoutSetTable.ts](utils/workoutSetTable.ts) `buildPrevSetsAndGhost` (lines 53–121):

- When `last` exists: calls `buildDisplayPrescriptionSnapshot` with `prescription` and `doneSets`.
- When `last` is null but `prescription` exists (lines 96–120): calls `buildDisplayPrescriptionSnapshot` with `prescription` and `recentSets: []`.
- In both cases, when prescription exists, `buildDisplayPrescriptionSnapshot` uses `prescription.nextTargetReps` for `ghostReps`.

Ghost display matches persisted/recomputed `next_target_reps`.

---

## 7. Delete/Recompute vs Save Path

**Yes.** Both paths use `computeNextPrescription` → `decideNextPrescription` with the same inputs (session sets, meta). Delete + recompute yields the same `next_target_reps` as the save path for the same history.

---

## 8. Edge Case Analysis (Current Logic)

| Example | Range | Target | atTarget? | workSets | avgReps | sets@+2 | sets@+1 | Jump | nextTarget |
|---------|-------|--------|-----------|----------|---------|---------|---------|------|------------|
| 12/12/6/6 | 8–12 | 10 | No (2/4 &lt; 70%) | 4 | 9 | — | — | — | Hold (10) |
| 10/10/8/8 | 8–12 | 10 | Yes | 4 | 9 | 0 | 2 | +1 | 11 |
| 11/11/9/9 | 8–12 | 10 | Yes | 4 | 10 | 0 | 4 | +1 | 11 |
| 9/9/9/8 | 6–12 | 6 | Yes | 4 | 8.75 | 4 | 4 | +3 | 9 |
| 6/6/6/12 | 6–12 | 6 | Yes | 4 | 7.5 | 1 | 1 | +1 | 7 |
| 8/8/8/12 | 6–12 | 6 | Yes | 4 | 9 | 4 | 4 | +3 | 9 |
| 10/10 (2 sets) | 8–12 | 10 | Yes | 2 | 10 | — | — | +1 (min sets) | 11 |
| 6/6/12 (3 sets) | 6–12 | 6 | Yes | 3 | 8 | 1 | 1 | +1 | 7 |

### Notes

- **6/6/6/12:** +2 guard blocks (only 1 set at 7+). Result: +1, next 7. ✓
- **Only 2 work sets:** +2/+3 blocked by `workSets.length < 3`. Result: +1. ✓
- **3 sets with outlier (6/6/12):** +2 guard blocks (only 1 set at 7+). Result: +1. ✓
- **8/8/8/12:** All 4 sets ≥ 8, so `setsAtTargetPlus2 >= 3`. +3 still triggers. Borderline: one high set (12) inflates avg, but all sets meet the +2 threshold.
- **9/9/9/8:** All 4 sets ≥ 8. +3 triggers. Tight cluster; behavior is consistent with the rules.

---

## 9. Files Involved

| File | Role |
|------|------|
| [lib/progression/decideNextPrescription.ts](lib/progression/decideNextPrescription.ts) | Phase 2 engine: atTop, atTarget, computeAdaptiveJump, guards |
| [lib/progression/buildDisplayPrescriptionSnapshot.ts](lib/progression/buildDisplayPrescriptionSnapshot.ts) | Display: uses prescription, no re-run of engine |
| [utils/supabaseStorage.ts](utils/supabaseStorage.ts) | computeNextPrescription, save, recompute, getExercisePrescriptions |
| [lib/getWorkoutContext.ts](lib/getWorkoutContext.ts) | buildTodayExerciseDetails → buildDisplayPrescriptionSnapshot |
| [utils/workoutSetTable.ts](utils/workoutSetTable.ts) | buildPrevSetsAndGhost → buildDisplayPrescriptionSnapshot |
| [components/WorkoutCore.tsx](components/WorkoutCore.tsx) | getResolvedTargetReps for active workout seeding |

---

## 10. Remaining Risks

| Risk | Severity | Description |
|------|----------|-------------|
| 8/8/8/12 @ 6–12, target 6 | Low | One set at 12; all sets ≥ 8 so +3 still triggers. Could be mis-log or real. |
| 9/9/9/8 @ 6–12, target 6 | Low | +3 (6→9) is a large jump; all sets support it. Acceptable per current rules. |

No other notable risks identified. Guards address the main outlier cases (6/6/6/12, 6/6/12, 2 sets).

---

## 11. Final Recommendation

**Safe to manually QA.**

- Top-threshold priority preserved.
- Save and recompute use the same logic.
- Today’s Session, active workout seeding, and ghost display use persisted `next_target_reps`.
- Delete/recompute matches save path.
- Guards block outlier-driven +2/+3 (6/6/6/12, 6/6/12, 2 sets).
- 8/8/8/12 and 9/9/9/8 are borderline but consistent with the current rules.

No further tightening or rollback recommended before QA.
