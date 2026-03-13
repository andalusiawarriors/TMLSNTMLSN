# PROGRESSION SYSTEM AUDIT

## 1. Files that define the system

| File | Role |
|------|------|
| `lib/progression/decideNextPrescription.ts` | **Canonical engine.** Implements the 70% rule, 4-band difficulty system, category-based increments, calibration, deload, blitz mode. Single source of truth for progression decisions. |
| `lib/progression/resolveRepRange.ts` | **Rep range resolution.** Priority: 1) manual (AsyncStorage), 2) history (past sessions), 3) default 10–12. Treats legacy 8–8/8–12 as 10–12. |
| `lib/progression/buildDisplayPrescriptionSnapshot.ts` | **Display-side snapshot.** Takes last session sets + prescription (band, consecutiveSuccess, etc.) and runs `decideNextPrescription` to produce ghost weight/reps for UI. Falls back to prescription.nextWeight when no working sets. |
| `lib/getWorkoutContext.ts` | **Today's session context.** Fetches sessions, prescriptions, builds `todayExerciseDetails` via `buildTodayExerciseDetails` → `buildDisplayPrescriptionSnapshot`. Rep range from `resolveRepRangesForExercises`. |
| `utils/supabaseStorage.ts` | **Persistence.** `supabaseSaveWorkoutSession` persists session, runs `computeNextPrescription` (calls `decideNextPrescription`), upserts `exercise_progress_state`. `supabaseGetExercisePrescriptions` reads band, consecutiveSuccess, etc. |
| `utils/storage.ts` | **Orchestration.** `saveWorkoutSession` sanitizes, runs `resolveRepRangesForSession`, then delegates to supabaseStorage. `finalizeWorkoutSession` saves + marks complete. |
| `utils/workoutSetTable.ts` | **Active workout ghost.** `buildPrevSetsAndGhost` uses `buildDisplayPrescriptionSnapshot` with exercise.repRangeLow/High, last session doneSets, prescriptions. Produces prevSets + ghost weight/reps. |
| `components/WorkoutCore.tsx` | **Workout UI.** Seeds workout from split via `startWorkoutFromSplit`: repRangeLow/High from `todayExerciseDetails` → manual → split.targetReps. Fetches prescriptions, passes to `buildPrevSetsAndGhost`. |
| `components/TodaysSessionCarousel.tsx` | **Today's session preview.** Uses `context.todayExerciseDetails` and `context.exerciseHistory`. Rep display: `exDetail?.ghostReps` or `repRangeLow`; weight: `exDetail.ghostWeight` / `nextWeightLb`. |
| `components/WorkoutSetTable.tsx` | **Set table.** Receives ghostWeight, ghostReps, prevSets from parent. Shows ghost as placeholder; on check, applies ghost to empty cells. |
| `context/ActiveWorkoutContext.tsx` | **Active workout state.** Holds `activeWorkout` (WorkoutSession). No progression logic. |
| `constants/workoutSplits.ts` | **Split templates.** Defines targetSets, targetReps per exercise (e.g. Bench 10, Deadlift 6). |

---

## 2. Real progression flow

### Step 1: Split/template definition
- `constants/workoutSplits.ts`: `TMLSN_SPLITS` with `targetSets`, `targetReps` per exercise.
- Example: Bench Press `targetReps: 10`, Deadlift `targetReps: 6`.

### Step 2: Workout start seeding
- User taps "Start TMLSN Upper Body A" → `WorkoutCore.startWorkoutFromSplit(split)`.
- For each exercise:
  - `getTodayWorkoutContext(user.id)` → `todayExerciseDetails` (from `buildTodayExerciseDetails`).
  - `resolvedDetail` = todayExerciseDetails for that exercise.
  - `repRangeLow` = `resolvedDetail?.repRangeLow ?? manual?.repRangeLow ?? template.targetReps`.
  - `repRangeHigh` = `resolvedDetail?.repRangeHigh ?? manual?.repRangeHigh ?? template.targetReps`.
  - `resolvedTargetReps` = `getResolvedTargetReps(resolvedDetail, template.targetReps)` → `ghostReps` if present, else `repRangeLow`, else `template.targetReps`.
  - Sets are pre-filled with `reps: resolvedTargetReps`, `weight: resolvedTargetWeightLb ?? 0`.
- **Source of truth for rep range at start:** `todayExerciseDetails` (from getWorkoutContext) > manual > split.

### Step 3: Set completion
- User edits weight/reps in `WorkoutSetTable`. On check, if empty and ghost exists, ghost is applied.
- No progression logic runs during the session.

### Step 4: Workout save
- User taps Save on workout-save screen → `finalizeWorkoutSession` → `saveWorkoutSession`.
- `saveWorkoutSession`:
  1. `sanitizeWorkoutSessionForSave`
  2. `resolveRepRangesForSession` (manual > history > default; legacy 8→10/12)
  3. `supabaseSaveWorkoutSession`
- `supabaseSaveWorkoutSession`:
  1. Upsert session, delete+reinsert exercises/sets.
  2. For each exercise with sets: fetch `exercise_progress_state` (band, consecutiveSuccess, consecutiveFailure, isCalibrating).
  3. `computeNextPrescription` → `decideNextPrescription` with session sets, exercise repRangeLow/High, band, etc.
  4. `saveExercisePrescription` → upsert `exercise_progress_state` (next_target_weight, next_goal_type, difficulty_band, consecutive_success, consecutive_failure, is_calibrating).
  5. `updateDeloadWeekCounter`.

### Step 5: Progression state update
- `exercise_progress_state` row per (user_id, exercise_id, variant_key):
  - `next_target_weight`, `next_goal_type` ('add_load' | 'add_reps' | 'reduce_load')
  - `difficulty_band`, `consecutive_success`, `consecutive_failure`, `is_calibrating`

### Step 6: Next workout display (Today's Session)
- `getTodayWorkoutContext` → `buildTodayExerciseDetails`.
- For each exercise: `resolveRepRangesForExercises` (rep range), then find last session with done sets.
- `buildDisplayPrescriptionSnapshot` with last session sets + prescription from DB → ghost weight/reps.
- **Source of truth:** `buildDisplayPrescriptionSnapshot` output (which runs `decideNextPrescription`).

### Step 7: Today's Session display (TodaysSessionCarousel)
- `computeLiftRows(context)`:
  - `repRangeLow` = `exDetail?.repRangeLow ?? splitEx?.targetReps ?? lastSets.targetReps ?? 10`.
  - When `exDetail?.ghostWeight` and `exDetail.ghostReps` exist: display those as target.
  - Else: fallback to last session weight, `repRangeLow` for reps.

### Step 8: Active workout ghost/goal display
- `WorkoutCore` fetches `prescriptions` via `supabaseGetExercisePrescriptions(user.id, canonicalIds)`.
- `recentSessions` = `getWorkoutSessions()` (last 10), excluding current session.
- `buildPrevSetsAndGhost(exercise, prescriptions, recentSessions, weightUnit)`:
  - Finds last session with this exercise and done sets.
  - `buildDisplayPrescriptionSnapshot` with `exercise.repRangeLow ?? 10`, `exercise.repRangeHigh ?? 12`, doneSets, prescription.
  - Returns prevSets + ghostWeight + ghostReps.
- **Source of truth:** `buildDisplayPrescriptionSnapshot` (re-runs engine with last session data).

---

## 3. Current success/failure rules

### Success (hit threshold)
- `didHitRepThreshold(sets, repRangeHigh)`: ≥70% of completed working sets have `reps >= repRangeHigh`.
- Working set = `completed && weight > 0 && reps > 0`.

### Failure (no threshold)
- `!hitThreshold` → `consecutiveFailure += 1`, `consecutiveSuccess = 0`.

### Band update (getNextBand)
- `consecutiveSuccess >= 1` → move up one band (easy→medium→hard→extreme).
- `consecutiveFailure >= 2` → move down one band.
- `avgRpeLast3Sessions < 6` → move up one band (RPE accelerator). **Note:** `avgRpeLast3Sessions` is never passed from callers; this path is never used in practice.
- Otherwise → stay.

### Calibration
- First session for an exercise (`isCalibrating === true`): no increment, no band change. `nextRepTarget = repRangeLow`, `goal = 'add_reps'`.

### Deload
- `isDeloadWeek(weekCounter)` = `weekCounter > 0 && weekCounter % 4 === 0`.
- Deload week: weight = 50% of base, `goal = 'reduce_load'`, band unchanged.
- Disabled when `blitzMode` is true.

### Blitz mode
- Forces band = `extreme`.
- Caps weekly weight increase at 10% of current working weight.
- Disables deload.

---

## 4. What "build reps" actually means in this codebase

- **Condition:** `!hitThreshold` (fewer than 70% of sets at `repRangeHigh`).
- **Action:** `action = 'build_reps'`, `nextWeightKg = baseWeightKg` (no change), `nextRepTarget = repRangeHigh`.
- **Meaning:** Keep the same weight; next session target reps = `repRangeHigh` (e.g. 12).
- **Band:** `consecutiveFailure += 1`; if ≥2, band drops.

---

## 5. What happens in concrete examples

**Setup:** Bench Press, 40 kg, 4 sets, rep range 10–12.

### Example A: 10/10/10/10
- Sets at top (≥12): 0. `hitPercent = 0`, `hitThreshold = false`.
- **Action:** build_reps.
- **Next session:** weight 40 kg, target reps **12** (repRangeHigh).
- `consecutiveFailure = 1`, band unchanged (need 2 to drop).

### Example B: 10/10/10/9
- Sets at top: 0. `hitThreshold = false`.
- **Action:** build_reps.
- **Next session:** weight 40 kg, target reps **12**.
- Same as A.

### Example C: 12/12/12/12
- Sets at top: 4. `hitPercent = 1`, `hitThreshold = true`.
- **Action:** add_weight.
- **Next session:** weight = 40 + increment (e.g. 2.5 kg easy = 42.5 kg), target reps **10** (repRangeLow).
- `consecutiveSuccess = 1`, band may move up.

### Example D: 12/12/12/10 (3 of 4 at top)
- `hitPercent = 0.75` ≥ 0.70 → `hitThreshold = true`.
- **Action:** add_weight.
- **Next session:** weight increases, target reps 10.

### Example E: 12/12/10/10 (2 of 4 at top)
- `hitPercent = 0.5` < 0.70 → `hitThreshold = false`.
- **Action:** build_reps.
- **Next session:** weight 40 kg, target reps 12.

---

## 6. UI vs engine mismatch

| Aspect | UI implies | Engine actually does |
|--------|------------|----------------------|
| Rep target | "Do 10 reps" or "Do 12 reps" | Target is `repRangeLow` (add_weight) or `repRangeHigh` (build_reps). Matches. |
| Ghost weight/reps | Suggestion for next set | Comes from `decideNextPrescription`; matches engine. |
| Success | Hitting target | 70% of sets must hit **top** of range (repRangeHigh). Hitting 10 when range is 10–12 does NOT count as success. |
| Build reps | "Build to 12" | Correct: next target = repRangeHigh. |
| Add weight | After hitting top | Correct: after 70%+ at repRangeHigh. |
| RPE accelerator | (Not shown) | Implemented but `avgRpeLast3Sessions` never passed; never runs. |
| splitTargetReps | Deadlift 6 from split | `resolveRepRange` does NOT use `splitTargetReps`. Rep range comes from manual > history > default. For Deadlift, history from last session (6–6 or 6–8) is used; if no history, default 10–12. **Mismatch:** New exercise with split 6 would show 10–12 until first session is saved. |

---

## 7. Problems / contradictions / confusion points

1. **splitTargetReps never used in resolveRepRange.** `getWorkoutContext` passes it but `resolveRepRangesForExercises` ignores it. Deadlift 6 from split only appears after the first session is saved with 6 (from WorkoutCore seeding via todayExerciseDetails, which for a new exercise has no history → default 10–12). WorkoutCore seeds from `todayDetailsByName` which comes from `buildTodayExerciseDetails`; for a brand-new exercise with no history, `todayExerciseDetails` has no entry, so `resolvedDetail` is undefined and `repRangeLow = template.targetReps` (6). So at **start** from split, template wins. But `buildTodayExerciseDetails` uses `resolveRepRangesForExercises` which doesn't use splitTargetReps; for exercises with no history it gets 10–12. So Today's Session for a new Deadlift would show 10, while starting the workout would use template 6. **Inconsistent.**

2. **RPE band accelerator is dead code.** `avgRpeLast3Sessions` is never computed or passed. `buildDisplayPrescriptionSnapshot` and `computeNextPrescription` never supply it.

3. **Two code paths for prescription.** On save: `computeNextPrescription` in supabaseStorage. On display: `buildDisplayPrescriptionSnapshot` → `decideNextPrescription`. Both use the same engine, but display re-runs with last session sets. If DB prescription is stale (e.g. from a different session), display could differ. In practice they should align because display uses last session + DB band state.

4. **Prescription key mismatch risk.** WorkoutCore uses `exercise.exerciseDbId ?? exercise.name` for prescriptions. getWorkoutContext uses `todayPlan.exerciseIds` (UUIDs from getTmlsnTemplate). `toExerciseProgressId` normalizes both; if UUID and exerciseDbId map to different progress IDs, lookup could fail.

5. **buildDisplayPrescriptionSnapshot fallback when decision is null.** If `decideNextPrescription` returns null (e.g. no working sets after filter), it uses last set as ghost. The filter requires `weight > 0 && reps > 0`; if all sets are zeros, workingSets is empty and we fall to `prescription?.nextWeight` or null.

6. **repRangeHigh when repRangeLow === repRangeHigh.** For Deadlift 6–6, `repRangeHigh = 6`. Success = 70%+ of sets at 6. Correct.

7. **Saved routine vs split.** `startWorkoutFromSavedRoutine` uses `manual?.repRangeLow ?? ex.targetReps` for repRangeHigh too (bug: both low and high set to same value when no manual).

---

## 8. Final plain-English explanation

**What the app does:**

1. **Rep range** (e.g. 10–12) comes from: your manual settings > last session’s saved range > default 10–12. Old 8–8/8–12 is treated as 10–12.

2. **Success** = at least 70% of your working sets hit the **top** of the range (e.g. 12 when range is 10–12). Hitting 10 on every set is **not** success.

3. **Build reps:** If you don’t hit 70%, you keep the weight and next time the target is the top of the range (e.g. 12).

4. **Add weight:** If you hit 70%+ at the top, weight goes up next session and the target resets to the bottom of the range (e.g. 10).

5. **Flow:** Start workout → do sets → save → engine decides add_weight or build_reps → next session shows ghost weight/reps from that decision.

6. **Bands** (easy/medium/hard/extreme) control how much weight increases. One success moves up; two failures move down. (RPE-based band bump exists in code but is never used.)

7. **Calibration:** First time you do an exercise, it only records a baseline; no progression that session.

8. **Deload:** Every 4th week, weight is cut to 50%. Disabled in Blitz Mode.

9. **Blitz Mode:** Uses the highest band and caps weekly increase at 10%.

**What the UI shows:** The ghost weight and reps are the real progression targets. They come from the same engine that runs on save. The "reps" number you see is the target for that session.
