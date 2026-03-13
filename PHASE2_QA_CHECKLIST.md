# Phase 2 Manual QA Checklist

**Prerequisite:** If you see "all caught up" on the Fitness tab, tap **"Clear for QA"** (dev only) to reset and show today's session.

---

## 1. 10–12 Range

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Use exercise with 10–12 range (e.g. Dumbbell Flyes, or set custom 10–12) | — |
| 1.2 | Ensure current target is 10 (may need prior session at 10 or Clear for QA + fresh) | — |
| 1.3 | Log 4 sets: 10, 10, 10, 10. Save. | Success |
| 1.4 | Pull to refresh; return to Fitness tab | Next target **11** (Phase 2: width 2 caps at +1) |
| 1.5 | Ensure target 10; log 4 sets: 11, 11, 11, 11. Save. | Success |
| 1.6 | Pull to refresh | Next target **11** (width 2 caps at +1; no +2 in 10–12) |
| 1.7 | Ensure target 10; log 4 sets: 12, 12, 12, 12. Save. | Success |
| 1.8 | Pull to refresh | **Load increase**, target reset to **10** |

---

## 2. 8–12 Range

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Use exercise with 8–12 range (e.g. Bench Press) | — |
| 2.2 | **+1 case:** Target 8; log 8, 8, 8, 8. Save. Refresh. | Next target **9** |
| 2.3 | **+2 case:** Target 8; log 9, 9, 9, 10. Save. Refresh. | Next target **10** |
| 2.4 | **Miss → hold:** Target 10; log 8, 8, 8, 8. Save. Refresh. | Same target **10**, same weight |
| 2.5 | **Mixed-set:** Target 10; log 10, 10, 8, 8. Save. Refresh. | Next target **11** (avg 9, sets@9+ = 2 → +1; avg < 11 so no +2) |

---

## 3. 6–12 Range

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Use exercise with 6–12 range (e.g. set custom 6–12, or Deadlift if configured) | — |
| 3.2 | **+1 case:** Target 6; log 6, 6, 6, 6. Save. Refresh. | Next target **7** |
| 3.3 | **+2 case:** Target 6; log 7, 7, 8, 8. Save. Refresh. | Next target **8** |
| 3.4 | **+3 case:** Target 6; log 8, 8, 8, 9. Save. Refresh. | Next target **9** |
| 3.5 | **Outlier blocked:** Target 6; log 6, 6, 6, 12. Save. Refresh. | Next target **7** (not 8; +2 guard blocks) |
| 3.6 | **Only 2 sets:** Target 6; log 8, 8 (2 sets only). Save. Refresh. | Next target **7** (min-set guard: +1 only) |
| 3.7 | **3-set outlier:** Target 6; log 6, 6, 12. Save. Refresh. | Next target **7** (not 8; +2 guard blocks) |

---

## 4. Today's Session Correctness

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Open Fitness tab; today is not rest day | Carousel shows today's plan |
| 4.2 | With prior workouts for today's exercises | Each row shows weight, reps (from prescription), signal |
| 4.3 | After a +1, +2, or +3 progression save | Carousel shows updated next_target_reps |
| 4.4 | Tap "Start" | Workout starts without crash |

---

## 5. Active Workout Seeding Correctness

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | Have prescription (e.g. Bench Press: 11 reps, 135 lb) | — |
| 5.2 | Start today's session from carousel | Sets show 11 reps, 135 lb |
| 5.3 | After +2 progression (e.g. 8→10) | Next start shows 10 reps |
| 5.4 | New exercise, no history | Uses split template |

---

## 6. Active Workout Ghost Correctness

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | Start workout with exercise that has prescription | Ghost row shows prescription weight + reps |
| 6.2 | Complete a set; check next ghost | Ghost updates to next set target |
| 6.3 | Exercise with no recent session but has prescription | Ghost still shows prescription values |

---

## 7. Save Path Correctness

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | Log workout; tap Save | "Session saved" |
| 7.2 | Pull to refresh or reopen app | Today's Session reflects new prescription |
| 7.3 | Verify +1, +2, +3, hold, add_weight per sections 1–3 | All match expected |

---

## 8. Delete/Recompute Correctness

| Step | Action | Expected |
|------|--------|----------|
| 8.1 | Have workout saved with Bench Press target 11 | Today's Session shows 11 |
| 8.2 | Delete that workout (workout history → delete) | Workout removed |
| 8.3 | Return to Fitness tab | Today's Session shows recomputed target (e.g. 10 from prior session) |
| 8.4 | Start workout | Sets show recomputed target |

---

## 9. Legacy Prescription Fallback

| Step | Action | Expected |
|------|--------|----------|
| 9.1 | Simulate legacy: DB row with `next_target_reps = null` | — |
| 9.2 | Display / Today's Session | Uses `repRangeLow` as target |
| 9.3 | Save path | `currentTargetReps = existing?.nextTargetReps ?? repRangeLow` |

---

## 10. Manual/Custom Rep Range Protection

| Step | Action | Expected |
|------|--------|----------|
| 10.1 | Set custom rep range (e.g. 8–10) in exercise settings | — |
| 10.2 | Today's Session | Shows target within 8–10 |
| 10.3 | Start workout | Sets use 8–10 range |
| 10.4 | Log 8, 8, 8, 8. Save. | Next target 9 (or 8 if at top) |
| 10.5 | Log 10, 10, 10, 10. Save. | Load up, reset to 8 |

---

## 11. Deadlift / Explicit Low-Rep Protection

| Step | Action | Expected |
|------|--------|----------|
| 11.1 | Start TMLSN Lower Body B (Deadlift: 6 reps) | Deadlift uses 6 reps |
| 11.2 | Log 6, 6, 6, 6. Save. | Next target 7 (or 6 if 6–6 range) |
| 11.3 | Log 6, 6, 6, 6 at top of range. Save. | Load up, reset to 6 |
| 11.4 | If Deadlift has 6–12 range | +1/+2/+3 rules apply; low end (6) protected by target ≤ repRangeLow+2 for +3 |

---

## Quick Reference: Phase 2 Decision Rules

| Condition | Action | Next weight | Next reps |
|-----------|--------|-------------|-----------|
| Calibrating | calibrate | base | repRangeLow |
| Deload week | deload | 50% base | repRangeLow |
| 70%+ sets ≥ repRangeHigh | add_weight | base + increment | repRangeLow |
| 70%+ sets ≥ currentTargetReps | build_reps | base | min(currentTargetReps + jump, repRangeHigh) |
| Else (miss) | hold | base | currentTargetReps |

**Jump rules (when at target):** width ≤3 → max +1; width 4–5 → max +2; width ≥6 → max +3. Guards: workSets ≥ 3 for +2/+3; +2 needs ≥2 sets at target+1; +3 needs ≥3 sets at target+2.

---

## Pass/Fail

- [ ] 1. 10–12 range
- [ ] 2. 8–12 range
- [ ] 3. 6–12 range
- [ ] 4. Today's Session
- [ ] 5. Active Workout Seeding
- [ ] 6. Active Workout Ghost
- [ ] 7. Save Path
- [ ] 8. Delete/Recompute
- [ ] 9. Legacy Prescription Fallback
- [ ] 10. Manual Rep Range
- [ ] 11. Deadlift / Low-Rep
