# TMLSNTMLSN — Cursor Handoff Context

## Project

React Native / Expo fitness app for iPhone 17 Pro. Path: `/Users/joaqui/TMLSNTMLSN`. Stack: Expo Router, Reanimated v2, Supabase, AsyncStorage, expo-live-activity (Dynamic Island). Main branch on GitHub: andalusiawarriors/TMLSNTMLSN.

## Architecture Overview

| Path | Purpose |
|------|---------|
| `app/(tabs)/nutrition.tsx` | Main Fitness Hub tab (home screen) |
| `app/(tabs)/workout/index.tsx` | Active workout execution (tabs version, 2725 lines) |
| `app/workout/index.tsx` | Active workout execution (standalone/modal version, 3047 lines) |
| `app/workout-save.tsx` | Post-session save flow (title, photo, stats) |
| `components/TodaysSessionCarousel.tsx` | Today's recommended session card |
| `components/ActiveWorkoutPill.tsx` | Floating pill shown when workout is minimized |
| `context/ActiveWorkoutContext.tsx` | Global active workout state (minimized, originRoute, etc.) |
| `lib/liveActivity.ts` | Dynamic Island / Live Activity state machine |
| `lib/getWorkoutContext.ts` | Fetches today's workout plan + exercise history from Supabase |
| `hooks/useJarvis.ts` | AI coach via Groq LLaMA 3.3 70B, builds context from workout history |
| `lib/progression/decideNextPrescription.ts` | Progression algorithm (band system) |
| `utils/storage.ts` | Supabase + AsyncStorage dual-backend storage layer |
| `constants/workoutSplits.ts` | TMLSN 4-day protocol definition |

## Active Workout Flow (end-to-end)

1. User opens Fitness Hub → TodaysSessionCarousel loads via useJarvis() → getTodayWorkoutContext() → Supabase queries → computeLiftRows() → shows today's exercises with progression targets
2. User taps "Start Push A" → router.replace('/(tabs)/workout', { startSplitId }) → setActiveWorkout(session) → startWorkoutActivity(name) (Dynamic Island appears)
3. User logs sets → rest timer fires → updateToRestTimer() → DI shows countdown ring → auto-reverts after duration → if RPE < 7 → updateToRPEWarning() → DI shows "Push Harder" for 8s → reverts to rest timer if still running, else to workout state
4. User presses chevron-down → minimizeWorkout() → navigates to /(tabs)/nutrition → pill appears at bottom
5. User taps pill → expandWorkout() + router.replace('/(tabs)/workout') → overlay re-shows
6. User finishes → navigates to workout-save.tsx → finalizeWorkoutSession() → AsyncStorage.setItem('TMLSN_session_completed_date', today) → setActiveWorkout(null) → pill disappears → carousel shows "all caught up / see you tomorrow"

## Recent Fixes (last session — all on main, pushed)

- **Live Activity rest timer / RPE sequencing** — added `pendingRestTimer` module-level variable in liveActivity.ts. When RPE warning fires while rest timer is running, after 8s it reverts to rest timer state (using remaining time) instead of jumping straight to workout state.
- **Background timer freeze** — added `restTimerEndRef = useRef<number | null>()` storing epoch-ms end time. AppState listener resyncs remaining time when app comes to foreground. Applied to both workout files.
- **Pill blank grey screen on expand** — decoupled expandWorkout() (just sets minimized=false) from navigation. ActiveWorkoutPill.handleExpand owns the router.replace. useFocusEffect in workout tab calls expandWorkout() when screen gains focus while minimized (with a ref to avoid re-triggering when minimized changes while screen is already focused).
- **Minimize not working** — minimizeWorkout() in ActiveWorkoutContext was not navigating away when originRoute === '/(tabs)/workout'. Fixed: always navigate away, fallback to /(tabs)/nutrition.
- **useFocusEffect fight with minimize** — useCallback had minimized in deps, causing it to re-run when minimize fired and immediately call expandWorkout(). Fixed: use minimizedRef (synced via useEffect) instead of minimized in deps.
- **Swipe-back disabled during workout** — `<Stack.Screen options={{ gestureEnabled: !activeWorkout }} />` inside workout tab render.
- **"All caught up" carousel** — after save, writes TMLSN_session_completed_date = YYYY-MM-DD to AsyncStorage. Carousel reads it on mount and on every animTrigger change (tab focus), shows "all caught up / see you tomorrow" shiny text state. Clears automatically next day.
- **Eyebrow text clipping** — removed hardcoded width: 96, height: 16 from S.eyebrow style.

## Known Bugs & Planned Work (priority order)

### 🔴 Critical

1. **Progression band state never persisted** — decideNextPrescription() requires currentBand, consecutiveSuccess, consecutiveFailure but these are always passed as 'easy' / 0 / 0. The algorithm is fully built but never learns. Need to upsert these to Supabase exercise_progress_state table after each session save and read them back in buildTodayExerciseDetails() and TodaysSessionCarousel.

2. **Two near-identical 3000-line workout screens** — app/(tabs)/workout/index.tsx and app/workout/index.tsx are duplicates. Every bug fix must be applied twice. Need to extract shared logic into components/WorkoutCore.tsx.

### 🟠 High

3. **No caching on getTodayWorkoutContext()** — Called on every tab focus. Heavy Supabase query + progression calculations every time. Add 60-second in-memory cache keyed by userId + date.

4. **Form validation missing** — Set inputs accept weight=0, reps=-1, RPE=0 — all written to Supabase. Add validation before marking set complete.

5. **RPE threshold inconsistency** — WorkoutSetTable.tsx fires RPE warning at rpe < 7 (low effort). Some other places reference rpe >= 9. Should be unified: warn when RPE is low (push harder signal).

6. **Rest timer double-start** — No guard against tapping rest timer button while one is running. Fires updateToRestTimer() again, creating duplicate revert timers.

### 🟡 Medium

7. **originRoute tracking via event emitters is fragile** — Currently uses emitWorkoutOriginRoute / onWorkoutOriginRoute events. Should pass route directly as param to setActiveWorkout(session, originRoute).

8. **No auto-save draft** — If app crashes mid-workout, all data is lost. Should serialize activeWorkout to AsyncStorage every 30s. Restore prompt on next launch.

9. **resolveRepRangesForSession() called on every save** — Runs decideNextPrescription() for all exercises on every save — redundant and expensive.

### 🟢 Low

10. **Streak is local-only** — AsyncStorage key tmlsn_workout_streak_v2. No Supabase sync. Reinstall = gone. No timezone handling.

## Key Data Structures

```ts
// Active workout (context + both screens)
interface WorkoutSession {
  id: string
  name: string
  startTime: number  // epoch ms
  exercises: WorkoutExercise[]
}

interface WorkoutExercise {
  id: string
  name: string
  sets: WorkoutSet[]
  restTimer: number  // seconds
  notes?: string
}

interface WorkoutSet {
  id: string
  weight: number    // always stored in lbs
  reps: number
  rpe: number | null
  completed: boolean
}

// Progression engine input/output
interface ProgressionInput {
  sets: WorkingSet[]
  repRangeLow: number
  repRangeHigh: number
  overloadCategory: 'compound_big' | 'compound_small' | 'isolation'
  currentBand: 'easy' | 'medium' | 'hard' | 'extreme'  // ← always 'easy' right now (bug)
  consecutiveSuccess: number  // ← always 0 (bug)
  consecutiveFailure: number  // ← always 0 (bug)
  isCalibrating: boolean
  isDeloadWeek: boolean
  blitzMode: boolean
}

interface ProgressionDecision {
  action: 'calibrate' | 'deload' | 'add_weight' | 'build_reps'
  nextWeightKg: number
  nextWeightLb: number
  nextRepTarget: number
  nextBand: 'easy' | 'medium' | 'hard' | 'extreme'
  reason: string
}
```

## AsyncStorage Keys

| Key | Value | Purpose |
|-----|-------|---------|
| TMLSN_session_completed_date | YYYY-MM-DD | "All caught up" carousel state |
| workout_live_activity_id | string | Survives hot reloads |
| tmlsn_workout_streak_v2 | JSON | Streak data (local only) |
| userSettings | JSON | Weight unit, training prefs |

## Live Activity State Machine (lib/liveActivity.ts)

```
Idle
  → startWorkoutActivity(name)
Workout: "[name] · Workout in progress"
  → updateToRestTimer(exerciseName, setNum, durationSec)
Rest: "[exercise] · Rest · Set N complete" + DI countdown ring
  → updateToRPEWarning(rpe, exerciseName, 8000ms)  [can interrupt rest]
RPE: "Push Harder 💪 · [exercise] · RPE N" + 8s countdown
  → after 8s: if rest timer still has time remaining → revert to Rest
           else → revert to Workout
  → cancelRestTimerActivity()  [manual cancel]
Workout
  → stopWorkoutActivity()
Idle
```

Module-level vars: `workoutActivityId`, `pendingRestTimer { exerciseName, setNumber, endTimeMs }`, `revertTimer`.

## Environment Variables (.env.local)

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_USDA_API_KEY
- EXPO_PUBLIC_GEMINI_API_KEY
- EXPO_PUBLIC_GROQ_API_KEY

## Running the app

```bash
cd /Users/joaqui/TMLSNTMLSN
npx expo start --clear   # clears Metro cache, shows QR for Expo Go
# or
npm run reload           # kills ports 8081/8082 first, starts on 8082
```
