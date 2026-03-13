# Phase 1 Verification Audit — Bodybuilding Progression

## 1. Does exercise_progress_state now persist next_target_reps?

**Yes.** Migration [supabase/migrations/016_bodybuilding_progression_state.sql](supabase/migrations/016_bodybuilding_progression_state.sql) adds `next_target_reps INTEGER`. Types in [types/supabase.ts](types/supabase.ts) include it. Both save and recompute paths write it.

---

## 2. Does the save path write next_target_reps after workout completion?

**Yes.** [utils/supabaseStorage.ts](utils/supabaseStorage.ts):
- `supabaseSaveWorkoutSession` fetches existing state (including `next_target_reps`), builds `currentTargetReps = existing?.nextTargetReps ?? repRangeLow`, calls `computeNextPrescription` → `decideNextPrescription`, then `saveExercisePrescription` with `nextTargetReps: prescription.nextTargetReps`.
- `saveExercisePrescription` upserts `next_target_reps: params.nextTargetReps` (line 292).

---

## 3. Does recomputeDerivedWorkoutState also write next_target_reps using the same logic?

**Yes.** [utils/supabaseStorage.ts](utils/supabaseStorage.ts) `recomputeDerivedWorkoutState`:
- Replays sessions chronologically, uses `currentTargetReps = existing?.nextTargetReps ?? repRangeLow`, calls `computeNextPrescription` → `decideNextPrescription`.
- Inserts rows with `next_target_reps: state.nextTargetReps` (line 468).
- Same `decideNextPrescription` as save path; no duplicated math.

---

## 4. Does supabaseGetExercisePrescriptions read next_target_reps?

**Yes.** [utils/supabaseStorage.ts](utils/supabaseStorage.ts):
- Select includes `next_target_reps` (line 1240).
- Maps to `nextTargetReps: row.next_target_reps != null ? Number(row.next_target_reps) : null` (line 1253).

---

## 5. Does Today's Session actually display next_target_reps from persisted/recomputed state?

**Yes.** [lib/getWorkoutContext.ts](lib/getWorkoutContext.ts) `buildTodayExerciseDetails`:
- Fetches `prescriptions` from `supabaseGetExercisePrescriptions`.
- Calls `buildDisplayPrescriptionSnapshot` with `prescription` and `recentSets`.
- `buildDisplayPrescriptionSnapshot` when `hasPrescription` uses `prescription.nextTargetReps ?? repRangeLow` for `ghostReps`.
- Returns `TodayExerciseDetail` with `ghostReps` from snapshot.
- [components/TodaysSessionCarousel.tsx](components/TodaysSessionCarousel.tsx) uses `displayReps = parseInt(exDetail.ghostReps, 10) || repRangeHigh` (line 126). So it displays `nextTargetReps` via `ghostReps`.

---

## 6. Does active workout seeding actually use next_target_reps from persisted/recomputed state?

**Yes, when todayExerciseDetails has ghostReps.** [components/WorkoutCore.tsx](components/WorkoutCore.tsx):
- `startWorkoutFromSplit` uses `getResolvedTargetReps(resolvedDetail, template.targetReps)` for each set’s `reps`.
- `getResolvedTargetReps` prefers `detail?.ghostReps` (line 98), then `repRangeLow`, then fallback.
- `resolvedDetail` comes from `todayContext.todayExerciseDetails` (from `getTodayWorkoutContext`).
- `ghostReps` in `todayExerciseDetails` comes from `buildDisplayPrescriptionSnapshot` → `prescription.nextTargetReps`.

**Gap:** Active workout ghost (in WorkoutSetTable) comes from `buildPrevSetsAndGhost`, not from `todayExerciseDetails`. See item 8.

---

## 7. Are there any remaining paths still deriving target reps from old binary logic instead of persisted currentTargetReps?

**No.** The old pattern `goal === 'add_load' ? repRangeLow : repRangeHigh` for next target appears only in:
- `prescriptionToDecision` in decideNextPrescription.ts — legacy helper, not used in main save/display flow.
- `buildDisplayPrescriptionSnapshot` — when prescription exists, uses `prescription.nextTargetReps ?? repRangeLow` directly, not goal-derived target.

---

## 8. Which exact files currently implement Phase 1?

| File | Role |
|------|------|
| [lib/progression/decideNextPrescription.ts](lib/progression/decideNextPrescription.ts) | Decision engine: atTopThreshold first, atTargetThreshold second, hold. currentBand only for incrementKg. |
| [lib/progression/buildDisplayPrescriptionSnapshot.ts](lib/progression/buildDisplayPrescriptionSnapshot.ts) | Display: reads prescription only, no decideNextPrescription. |
| [utils/supabaseStorage.ts](utils/supabaseStorage.ts) | PrescriptionMeta with currentTargetReps, currentBand; save/recompute use computeNextPrescription; persist next_target_reps, rep_range_low, rep_range_high, difficulty_band. |
| [lib/getWorkoutContext.ts](lib/getWorkoutContext.ts) | buildTodayExerciseDetails calls buildDisplayPrescriptionSnapshot with prescription. |
| [utils/workoutSetTable.ts](utils/workoutSetTable.ts) | buildPrevSetsAndGhost calls buildDisplayPrescriptionSnapshot when last session exists. |
| [components/WorkoutCore.tsx](components/WorkoutCore.tsx) | Uses getResolvedTargetReps(ghostReps) for seeding; buildPrevSetsAndGhost for ghost. |
| [components/TodaysSessionCarousel.tsx](components/TodaysSessionCarousel.tsx) | Uses exDetail.ghostReps for display. |
| [supabase/migrations/016_bodybuilding_progression_state.sql](supabase/migrations/016_bodybuilding_progression_state.sql) | Adds next_target_reps, rep_range_low, rep_range_high. |
| [types/supabase.ts](types/supabase.ts) | exercise_progress_state includes next_target_reps. |

---

## 9. Is Phase 1 fully complete, partially complete, or only display-safe?

**Partially complete.** One gap remains.

### Gap: buildPrevSetsAndGhost ignores prescription when there is no last session

**Location:** [utils/workoutSetTable.ts](utils/workoutSetTable.ts)

**Behavior:** `buildPrevSetsAndGhost` only calls `buildDisplayPrescriptionSnapshot` when `findLastSessionWithExercise` returns a match (`last` is truthy). When `last` is null, it returns `ghostWeight: null`, `ghostReps: null` and never uses `prescription`.

**Impact:** If a user has a persisted prescription (e.g. from a session 15+ workouts ago) but that session is not in `recentSessions` (e.g. last 10 sessions), the active workout ghost will be empty instead of showing `prescription.nextTargetReps` and `prescription.nextWeight`.

**Fix:** When `last` is null but `prescription` exists, call `buildDisplayPrescriptionSnapshot` with `prescription` and `recentSets: []`. That will use the prescription path and return ghost from persisted state.

---

## Summary

| Question | Answer |
|----------|--------|
| 1. exercise_progress_state persists next_target_reps | Yes |
| 2. Save path writes next_target_reps | Yes |
| 3. Recompute writes next_target_reps (same logic) | Yes |
| 4. supabaseGetExercisePrescriptions reads next_target_reps | Yes |
| 5. Today's Session displays next_target_reps | Yes |
| 6. Active workout seeding uses next_target_reps | Yes (via todayExerciseDetails.ghostReps for initial reps) |
| 7. Old binary logic removed | Yes |
| 8. Files implementing Phase 1 | Listed above |
| 9. Phase 1 status | **Partially complete** — one gap in buildPrevSetsAndGhost |

### Exact missing work

**File:** [utils/workoutSetTable.ts](utils/workoutSetTable.ts)

**Change:** Add an `else` branch when `last` is null: if `prescription` exists, call `buildDisplayPrescriptionSnapshot` with `prescription`, `recentSets: []`, and exercise rep range; use the returned ghostWeight/ghostReps/ghostReason/fromProgressionEngine.
