# Phase 1 Progression — Manual QA Checklist

**Prerequisite:** If you see "all caught up" on the Fitness tab, tap **"Clear for QA"** (dev only) to reset and show today's session.

---

## 1. Today's Session

**Goal:** Verify the carousel shows ghost weight and reps from persisted prescription.

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Open Fitness tab, ensure today is not a rest day | Carousel shows today's plan (e.g. "TMLSN Upper Body A") |
| 1.2 | If you have prior workouts for today's exercises | Each exercise row shows: weight (e.g. 135 lb), reps (e.g. 10), and signal (e.g. "up" / "same") |
| 1.3 | If no prior workouts | Exercise rows show "—" for weight, reps from split (e.g. 10) |
| 1.4 | Tap "Start TMLSN Upper Body A" | Workout starts without crash; no "Rendered more hooks" error |

---

## 2. Active Workout Seeding

**Goal:** Verify workout sets are seeded with persisted `next_target_reps` and weight.

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Have a prescription for an exercise (e.g. Bench Press: 10 reps, 135 lb) | — |
| 2.2 | Start today's session from carousel | Bench Press sets show: reps = 10, weight = 135 lb (or your persisted values) |
| 2.2b | If prescription says 11 reps | Sets show 11 reps, not 10 |
| 2.3 | New exercise with no history | Uses split template (e.g. 10 reps, suggested weight from split) |

---

## 3. Active Workout Ghost Values

**Goal:** Verify ghost cells in WorkoutSetTable show persisted prescription.

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Start workout with exercise that has prescription | Ghost row (e.g. set 5) shows: weight + reps from prescription |
| 3.2 | Complete a set, check next ghost | Ghost updates to next set’s target from prescription |
| 3.3 | Exercise with no recent session but has prescription | Ghost still shows prescription values (if buildPrevSetsAndGhost fix is applied) |

---

## 4. Workout Save Path

**Goal:** Verify save writes `next_target_reps` and next weight correctly.

**Example flow (verified):** Start with target 8 → do 4×8 @ 135 lb → save → Today's Session shows 4×9 @ 135 lb. Progression works.

### Scenario A: +1 rep (build_reps)

Starting target can be 8, 10, or whatever your prescription says. After hitting target on 70%+ sets, next target = currentTargetReps + 1.

| Step | Action | Expected |
|------|--------|----------|
| 4A.1 | Start Bench Press (target from prescription, e.g. 8 or 10) | Sets show that target |
| 4A.2 | Log 4 sets at target (e.g. 8/8/8/8 or 10/10/10/10) | All at target |
| 4A.3 | Save workout | Success |
| 4A.4 | Pull to refresh or reopen; return to Fitness tab | Today's Session shows Bench Press: **+1 rep** (e.g. 9 if you did 8, or 11 if you did 10) |
| 4A.5 | Start workout again | Sets show new target |

### Scenario B: Load up (add_weight)

| Step | Action | Expected |
|------|--------|----------|
| 4B.1 | Start Bench Press, target 10, range 10–12 | Sets show 10 reps |
| 4B.2 | Log 4 sets: 12, 12, 12, 12 | All at top of range |
| 4B.3 | Save workout | Success |
| 4B.4 | Clear for QA, return to Fitness tab | Today's Session shows Bench Press: **weight increased** (e.g. +2.5 kg), **reps reset to 10** |
| 4B.5 | Start workout again | Sets show 10 reps, higher weight |

### Scenario C: Hold (miss)

| Step | Action | Expected |
|------|--------|----------|
| 4C.1 | Start Bench Press, target 10 | Sets show 10 reps |
| 4C.2 | Log 4 sets: 8, 8, 9, 9 | Below target (70%+) |
| 4C.3 | Save workout | Success |
| 4C.4 | Clear for QA, return to Fitness tab | Today's Session shows Bench Press: **same weight, same 10 reps** (hold) |
| 4C.5 | Start workout again | Sets show 10 reps, same weight |

### Scenario D: All caught up

| Step | Action | Expected |
|------|--------|----------|
| 4D.1 | After saving, go back to Fitness tab | Carousel shows "all caught up." / "see you tomorrow" |
| 4D.2 | Next day | Carousel shows new session again |

---

## 5. Delete + Recompute Path

**Goal:** Verify deleting last workout triggers recompute and correct target.

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | Have a workout saved with Bench Press target 11 | Today's Session shows 11 reps |
| 5.2 | Delete that workout (e.g. workout history → delete) | Workout removed |
| 5.3 | Return to Fitness tab | Today's Session shows Bench Press: **10 reps** (recomputed from prior session) |
| 5.4 | Start workout | Sets show 10 reps |

---

## 6. Legacy Prescription Fallback

**Goal:** Verify old prescriptions without `next_target_reps` still work.

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | Simulate legacy: DB has prescription with `next_target_reps = null` | — |
| 6.2 | Display / Today's Session | Uses `repRangeLow` as target reps |
| 6.3 | Save path | `currentTargetReps = existing?.nextTargetReps ?? repRangeLow` |

---

## 7. Old History Compatibility

**Goal:** Verify sessions from before Phase 1 are handled correctly.

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | Have old sessions (no exercise_progress_state rows) | — |
| 7.2 | Start today's session | Seeding uses split template or last set from history |
| 7.3 | Save workout | New prescription rows created with next_target_reps |
| 7.4 | Next session | Today's Session shows new values from prescription |

---

## 8. Manual / Custom Rep Range Protection

**Goal:** Verify user-set rep ranges (e.g. 8–10) are respected.

| Step | Action | Expected |
|------|--------|----------|
| 8.1 | Set custom rep range for an exercise (e.g. 8–10) | — |
| 8.2 | Today's Session | Shows target within 8–10 |
| 8.3 | Start workout | Sets use 8–10 range |
| 8.4 | Log 8, 8, 8, 8, save | Next target stays 8 (or +1 to 9) |
| 8.5 | Log 10, 10, 10, 10, save | Load up, reset to 8 |

---

## 9. Deadlift / Explicit Low-Rep Protection

**Goal:** Verify low-rep exercises (e.g. Deadlift 6) keep their range.

| Step | Action | Expected |
|------|--------|----------|
| 9.1 | Start TMLSN Lower Body A (or split with Deadlift) | Deadlift uses 6 reps if split defines 6 |
| 9.2 | Log 6, 6, 6, 6, save | Next target 6 or +1 to 7 (within range) |
| 9.3 | Log 6, 6, 6, 6 at top of range, save | Load up, reset to 6 |

---

## 10. No-Recent-Session but Persisted-Prescription

**Goal:** Verify ghost uses prescription when last session is outside recentSessions.

| Step | Action | Expected |
|------|--------|----------|
| 10.1 | Have 15+ workouts in history; last Bench Press was 10 sessions ago | Prescription exists for Bench Press |
| 10.2 | Start today's session | Bench Press sets show prescription values (10 reps, weight) |
| 10.3 | In WorkoutSetTable | Ghost row shows prescription values (not empty) |

---

## Quick Reference: Decision Rules

| Condition | Action | Next weight | Next reps |
|-----------|--------|------------|-----------|
| Calibrating | calibrate | base | repRangeLow |
| Deload week | deload | 50% base | repRangeLow |
| 70%+ sets ≥ repRangeHigh | add_weight | base + increment | repRangeLow |
| 70%+ sets ≥ currentTargetReps | build_reps | base | min(currentTargetReps + 1, repRangeHigh) |
| Else (miss) | hold | base | currentTargetReps |

---

## Pass/Fail

- [ ] 1. Today's Session
- [ ] 2. Active Workout Seeding
- [ ] 3. Active Workout Ghost Values
- [ ] 4. Workout Save Path (A, B, C, D)
- [ ] 5. Delete + Recompute
- [ ] 6. Legacy Prescription Fallback
- [ ] 7. Old History Compatibility
- [ ] 8. Manual Rep Range
- [ ] 9. Deadlift / Low-Rep
- [ ] 10. No-Recent-Session + Prescription
