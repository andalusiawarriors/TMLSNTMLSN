# TMLSN App — Devlog Content Report
## Product Strategy, Technical Audit & Content Planning for TikTok / Instagram

---

## 1. CURRENT APP SNAPSHOT

### What the app already does

**TMLSN** is a React Native / Expo fitness and nutrition app that combines:

- **Calorie & nutrition tracking** — Daily goals, macros (P/C/F), electrolytes, water, meal structure (B/L/D/Snacks)
- **Workout tracking** — Sets, reps, weight, RPE, rest timers, TMLSN 4-day split (Upper A/B, Lower A/B)
- **Progressive overload engine** — Band-based algorithm (easy → medium → hard → extreme), 70% rule, deload weeks
- **AI features** — TMLSN AI coach (Groq LLaMA 3.3 70B), food photo recognition (Gemini 2.0 Flash), nutrition label reader
- **Prompt vault** — Copy-to-clipboard prompts with source attribution
- **Explore feed** — Instagram-style workout posts from Supabase
- **Social / profile** — Auth (Supabase), per-account cloud sync, workout posting with photos

### Key screens and user flows

| Screen | Path | Purpose |
|--------|------|---------|
| **Home (Nutrition)** | `app/(tabs)/nutrition.tsx` | Calorie ring, macro cards, week swipe, Fitness Hub, Progress Hub |
| **Fitness Hub** | `components/FitnessHub.tsx` | Today’s session carousel, TMLSN routines, Your Routines, Start Empty |
| **Workout execution** | `components/WorkoutCore.tsx` | Active workout overlay, set table, rest timer, RPE, minimize/expand |
| **Workout save** | `app/workout-save.tsx` | Title, photo, description, public post, finalize |
| **Search food** | `app/search-food.tsx` | USDA + Open Food Facts, TMLSN Verified badges, List Food |
| **Scan food** | `app/scan-food-camera.tsx` | AI photo, barcode, nutrition label (Gemini) |
| **Add Meal** | `components/AddMealSheet.tsx` | Quantity, unit wheel, meal type, animated ring |
| **Explore** | `app/(tabs)/explore/index.tsx` | Feed of workout posts, profile modal |
| **Prompts** | `app/(tabs)/prompts.tsx` | Category filter, copy prompt, source link |
| **Profile** | `app/(tabs)/(profile)/index.tsx` | Auth, settings, Fitness pillar |
| **Progress Graph** | `app/progress-graph.tsx` | Sticky glass header, period picker, chart |
| **TMLSN AI** | `app/tmlsnai.tsx` | Chat with workout context, typing animation |

**Main flows:**

1. **Log food:** FAB → List Food / Search / Scan → Add Meal sheet → log
2. **Start workout:** Home → Fitness Hub → TodaysSessionCarousel → Start Push A → WorkoutCore
3. **Minimize workout:** Chevron down → pill at bottom → tap to expand
4. **Finish workout:** Finish → workout-save → photo, title, post → finalize

### Key working features

- **Nutrition:** Swipeable week view, calorie/macro/electrolyte cards, health score, pull-to-refresh, day navigation
- **Food search:** USDA + OFF, progressive search, preload TMLSN Basics, gold/quicksilver verified badges, dedupe by fdcId
- **List Food:** One ingredient per line, Breakfast/Lunch/Dinner/Snacks, best-effort matching, quantity parsing (250g, one cup, slice, scoop)
- **Add Meal:** Unit wheel (tbsp/tsp/cup/100g/1g), animated ring number, meal type chips, TMLSN Verified label
- **Workout:** WorkoutCore (shared), set table with PREVIOUS | KG/LB | REPS | RPE | ✓, ghost sets, swipe-to-delete, rest timer
- **Dynamic Island:** Workout state, rest countdown ring, RPE “Push Harder” warning (8s), background timer sync
- **Active workout pill:** Minimize/expand, persists across tabs
- **Progressive overload:** `decideNextPrescription` (calibrate, deload, add_weight, build_reps), band increments
- **TodaysSessionCarousel:** Today’s plan, ghost weight×reps, “All caught up” state
- **TMLSN AI:** useJarvis, workout context, exercise history, prescription formatting
- **Explore:** Feed from `workout_posts`, signed image URLs, profile modal
- **Auth:** Supabase, per-user storage, login/create account
- **Progress Hub:** 6-tile grid, reorder (jiggle, long-press drag), FitnessGraphWidget, heatmap, statistics

### Backend / services / tools

| Service | Purpose |
|---------|---------|
| **Supabase** | Auth, workout_sessions, workout_posts, exercise_progress_state, prompts, user_settings |
| **AsyncStorage** | Nutrition logs (temp), session completed date, active workout draft, streak |
| **USDA FoodData Central** | Foundation + Branded foods, 1000 req/hr |
| **Open Food Facts** | 4M+ products, barcode search |
| **Gemini 2.0 Flash** | Food photo analysis, nutrition label OCR |
| **Groq LLaMA 3.3 70B** | TMLSN AI coach |
| **expo-live-activity** | Dynamic Island (iOS 14 Pro+) |
| **expo-camera** | Barcode, AI photo, label scan |
| **expo-notifications** | Rest timer push, FCM/APNS |

### What looks polished vs incomplete vs planned

**Polished:**

- Tab bar (gradient pill, FAB, sliding selection)
- Nutrition hero arc (bronze/silver/gold states, glimmer)
- Add Meal sheet (unit wheel, ring animation, TMLSN Verified)
- Search food (verified badges, preload, progressive results)
- Workout set table (Hevy-style, ghost, RPE popup)
- Dynamic Island states (workout, rest, RPE warning)
- Progress Hub (reorder, glass tiles)
- Sticky glass header (progress-graph)
- Explore feed (glass cards, profile modal)
- Prompts (copy, source link, category filter)

**Incomplete:**

- Progression band state not persisted (always easy/0/0)
- WorkoutCore extracted but `app/workout/index.tsx` still exists (duplication risk)
- No caching on `getTodayWorkoutContext()`
- Set validation (weight=0, reps=-1 allowed)
- Rest timer double-start possible
- No auto-save workout draft (crash = data loss)
- Streak local-only (no Supabase sync)

**Planned (from HANDOFF_CONTEXT):**

- Persist progression bands to `exercise_progress_state`
- Consolidate workout screens into WorkoutCore
- 60s cache for getTodayWorkoutContext
- Form validation for sets
- Auto-save draft every 30s

---

## 2. BUILD TIMELINE RECONSTRUCTION

Inferred major milestones (from handoff, migrations, and code structure):

### Chapter 1: Foundation
- Expo + React Native setup, tab layout, theme (duo-tone)
- Basic nutrition log (calories, macros), AsyncStorage
- Swipeable week view, day navigation

### Chapter 2: Nutrition MVP
- USDA + OFF food API, search, progressive loading
- Add Meal sheet, unit picker, meal types
- Saved foods, List Food (one line per ingredient)
- TMLSN Verified (Foundation), gold/quicksilver badges

### Chapter 3: Workout Tracker
- TMLSN splits (Upper A/B, Lower A/B), `constants/workoutSplits.ts`
- WorkoutCore, set table, rest timer
- Supabase workout_sessions, exercise_progress_state migrations
- RPE, ghost sets, swipe-to-delete

### Chapter 4: Dynamic Island & Active Workout
- expo-live-activity integration
- Workout / Rest / RPE warning states
- ActiveWorkoutPill, minimize/expand
- Background timer sync, pendingRestTimer sequencing

### Chapter 5: AI & Smart Features
- TMLSN AI (useJarvis, Groq LLaMA)
- Gemini food photo + label reader
- getWorkoutContext, decideNextPrescription
- TodaysSessionCarousel with prescription targets

### Chapter 6: Progress & Analytics
- Progress Hub, reorder tiles
- FitnessGraphWidget, heatmap, radar
- progress-graph, StickyGlassHeader
- Weekly muscle volume, date bins

### Chapter 7: Social & Auth
- Supabase auth, AuthModal
- workout_posts, Explore feed
- Profile, per-account storage
- Workout save with photo, public post

### Chapter 8: Polish & UX
- FAB popup (list food, search, scan, TMLSN AI)
- Haptics, button sounds, mixWithOthers
- List Food best-effort matching, quantity parsing
- Add Meal redesign, unit wheel, TMLSN Verified

### Chapter 9: Explore & Profile
- Explore feed redesign, post cards
- ExploreProfileModal, notifications modal
- FitnessHub v4, ZoneOneCard, TodaysSessionCarousel polish

### Chapter 10: Refinement
- WorkoutCore extraction
- Progression algorithm tightening
- Navigation fixes (Back, Go to home)
- Live Activity RPE/rest sequencing

---

## 3. MOST FILMABLE / VISUAL FEATURES

### High-impact screen recordings

| Feature | Why it works |
|---------|--------------|
| **Nutrition hero arc** | Bronze → silver → gold glow as macros hit goals; glimmer animation |
| **Add Meal** | Unit wheel spin, ring number animation, quantity change |
| **FAB popup** | Star rotates, cards stagger in, bar recedes |
| **Tab bar** | Sliding pill, gradient border, FAB press |
| **Swipeable week** | Day cards slide, week strip animates |
| **List Food → Add Meal** | Type “chicken rice egg” → instant matches → confirm → log |
| **Search food** | TMLSN Verified gold tick, progressive results, “Show more” |
| **Workout set table** | Ghost apply, RPE popup, checkmark, rest timer |
| **Dynamic Island** | Workout → Rest (countdown ring) → RPE “Push Harder” → revert |
| **Active workout pill** | Minimize → pill at bottom → tap to expand |
| **Progress Hub reorder** | Blur overlay, jiggle, long-press drag, snap |
| **TodaysSessionCarousel** | “Start Push A”, ghost weight×reps, “All caught up” ShinyText |
| **Scan food** | AI photo → Gemini → JSON → Add Meal |
| **TMLSN AI** | Typing animation, context-aware answers |
| **Explore feed** | Glass cards, profile modal, post detail |

### Best interaction moments

1. **FAB → List Food → type “chicken breast 200g” → confirm → log** — fast, satisfying
2. **Start workout → complete set → rest timer → Dynamic Island countdown** — clear flow
3. **Minimize workout → pill → switch tabs → tap pill → back in workout** — “it just works”
4. **Add Meal → spin unit wheel → calories update** — tactile
5. **Progress Hub → long-press tile → jiggle → drag → drop** — iOS-style reorder

---

## 4. BEST STORY ANGLES

### Problems solved

1. **Dual food API** — USDA (generic) + OFF (branded) with dedupe, preload, and verified badges
2. **List Food parsing** — “one apple”, “250g rice”, “handful of oats” → structured rows
3. **Progressive overload** — 70% rule, bands, deload, calibration, category-based increments
4. **Dynamic Island sequencing** — Rest timer + RPE warning without state corruption
5. **Minimize/expand workout** — Pill + navigation without losing context
6. **Background timer** — Rest timer survives app background via epoch end time
7. **Verified food curation** — Foundation foods, Top 100, gold vs quicksilver badges

### UX wins

- **FAB as hub** — One tap → list food, search, scan, AI
- **Tab bar hides during workout** — Full-screen focus
- **“Minimize to switch tabs”** — Clear constraint, no accidental loss
- **Sticky glass header** — Stoic-style progress graph
- **Progress Hub reorder** — Familiar iOS pattern
- **TMLSN Verified** — Trust signal without clutter

### Technical wins

- **WorkoutCore extraction** — Shared logic, single source of truth for set table
- **decideNextPrescription** — Full algorithm from spec doc
- **getWorkoutContext** — Today’s plan + history + prescriptions in one
- **Supabase + AsyncStorage** — Dual backend, per-user isolation
- **Live Activity state machine** — Workout → Rest → RPE → revert

### Before vs after contrast

| Before | After |
|--------|-------|
| Search returns 100+ generic results | TMLSN Verified first, preload, gold tick |
| “Type food, hope it matches” | List Food: one line per ingredient, quantity parsing |
| Rest timer only in app | Dynamic Island countdown on Lock Screen |
| Workout = full screen or nothing | Minimize → pill → switch tabs → expand |
| Manual progression | Ghost weight×reps, prescription targets |
| Static progress view | Reorderable tiles, heatmap, radar |

---

## 5. OPEN LOOPS / FUTURE EPISODES

### Unfinished systems

1. **Progression band persistence** — Algorithm works, state never saved
2. **Workout screen consolidation** — WorkoutCore exists, duplicate route remains
3. **getTodayWorkoutContext cache** — Heavy on every tab focus
4. **Set validation** — weight=0, reps=-1 accepted
5. **Auto-save workout draft** — Crash = lost workout
6. **Streak Supabase sync** — Local only, reinstall = gone
7. **Nutrition Supabase** — Still AsyncStorage, schema pending

### Next steps (from HANDOFF_CONTEXT)

- Persist `currentBand`, `consecutiveSuccess`, `consecutiveFailure` to Supabase
- Add 60s cache for getTodayWorkoutContext
- Validate sets before marking complete
- Unify RPE threshold (low = push harder)
- Guard rest timer double-start
- Serialize activeWorkout to AsyncStorage every 30s
- Migrate nutrition to Supabase

### Content hooks

- “We built a progressive overload engine — but it never learns (yet)”
- “Two 3000-line files doing the same thing”
- “What happens when your app crashes mid-workout?”
- “Dynamic Island: the state machine that took 3 tries to get right”

---

## 6. CONTENT ASSETS

### 10 possible first-video angles

1. **“I built a fitness app that tracks food AND workouts — here’s the home screen”** — Nutrition hero, FAB, tabs
2. **“Logging food in 3 taps: List Food → type ingredients → done”** — List Food flow
3. **“The Dynamic Island shows my rest timer while I’m on my phone”** — Live Activity demo
4. **“I minimized my workout to check my calories — tap the pill to come back”** — Active workout pill
5. **“AI reads my food photo and fills in the macros”** — Gemini scan → Add Meal
6. **“This calorie ring turns gold when I hit my goals”** — NutritionHero states
7. **“I built a progressive overload engine — ghost sets tell me what to lift”** — TodaysSessionCarousel
8. **“One FAB, four actions: list food, search, scan, AI coach”** — FAB popup
9. **“I can reorder my progress widgets like iOS”** — Progress Hub jiggle
10. **“TMLSN AI knows my workout history and tells me what to do next”** — tmlsnai + useJarvis

### 20 future episode ideas (by retention potential)

1. **“Fixing the Dynamic Island bug that broke rest timer → RPE”** — Technical deep dive
2. **“Why we use USDA + Open Food Facts (and how we dedupe)”** — Architecture
3. **“Building the progressive overload algorithm from a spec doc”** — decideNextPrescription
4. **“The minimize/expand workout pill took 4 tries to get right”** — Navigation + state
5. **“List Food: parsing ‘one apple’ and ‘250g rice’ into structured rows”** — Parsing + UX
6. **“TMLSN Verified: gold vs quicksilver badges”** — Curation + trust
7. **“Extracting 3000 lines into WorkoutCore”** — Refactor story
8. **“Why our AI coach needs your workout history”** — useJarvis context
9. **“Background timer freeze: how we fixed it with epoch end time”** — AppState + refs
10. **“Supabase + AsyncStorage: dual backend for auth and offline”** — Storage layer
11. **“The unit wheel that made Add Meal feel tactile”** — useAnimatedRingNumber
12. **“Sticky glass header: Stoic-style progress graph”** — StickyGlassHeader
13. **“Explore feed: from workout_posts to signed URLs”** — Social + storage
14. **“Progress Hub: jiggle, blur, long-press drag”** — Reorder UX
15. **“Progression bands: the algorithm works, but we never persisted it”** — Open loop
16. **“RPE warning: when to tell the user to push harder”** — Threshold logic
17. **“Gemini 2.0 Flash: food photo → JSON in one call”** — AI integration
18. **“Tab bar gradient pill: 1px outline, transparent fill”** — Design tokens
19. **“All caught up: the carousel state after you finish today’s workout”** — UX detail
20. **“Why we have two workout screens (and how we’re fixing it)”** — Tech debt

---

## File reference (for filming / screenshots)

| Area | Key files |
|------|-----------|
| Home | `app/(tabs)/nutrition.tsx`, `components/NutritionHero.tsx`, `components/FitnessHub.tsx` |
| Add Meal | `components/AddMealSheet.tsx`, `components/UnitWheelPicker.tsx` |
| Search | `app/search-food.tsx`, `utils/foodApi.ts` |
| Workout | `components/WorkoutCore.tsx`, `components/WorkoutSetTable.tsx` |
| Dynamic Island | `lib/liveActivity.ts` |
| Progression | `lib/progression/decideNextPrescription.ts`, `lib/getWorkoutContext.ts` |
| AI | `hooks/useJarvis.ts`, `utils/geminiApi.ts`, `app/tmlsnai.tsx` |
| Progress | `components/ProgressHub.tsx`, `app/progress-graph.tsx` |
| Explore | `app/(tabs)/explore/index.tsx`, `components/explore/ExplorePostDetailModal.tsx` |
| Tabs | `app/(tabs)/_layout.tsx` |

---

*Generated from codebase analysis. Use for TikTok/Instagram devlog planning.*
