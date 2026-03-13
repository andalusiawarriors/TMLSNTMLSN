# TMLSN + JARVIS Overview — For Prompt Generation

Use this document as context when talking to ChatGPT (or similar) to generate prompts. Copy the prompts you create and send them to your Cursor agent for implementation.

---

## What is TMLSN?

TMLSN is a React Native (Expo) fitness app with:
- **Nutrition tracker** — calories, P/C/F, electrolytes, meals, water
- **Workout tracker** — exercises, sets, reps, weight, RPE, rest timer, progressive overload
- **Prompt vault** — store prompts with source attribution, copy-to-clipboard
- **JARVIS** — AI workout coach that uses the user’s real data

Design: dark theme (#2F3031 bg, #C6C6C6 text), champagne gold accents (#D4B896), DM Mono + system fonts.

---

## JARVIS (Workout Coaching System)

JARVIS is the in-app AI coach. It:
1. Fetches **WorkoutContext** (today’s plan, history, volume, settings)
2. Generates a **pre-workout briefing** (no API call)
3. Answers follow-up questions via **Groq API** (llama-3.3-70b-versatile)

### WorkoutContext (what JARVIS sees)

```ts
{
  userId: string;
  fetchedAt: string;
  trainingSettings: { volumeFramework, scheduleMode, currentWeek } | null;
  todayPlan: { dayOfWeek, workoutType, exerciseIds, isRestDay } | null;
  exerciseHistory: [{ exerciseId, recentSets }] | null;  // last 3 sessions per exercise
  weeklyVolume: [{ muscleGroup, setsDone, mev, mav, mrv }];
  tmlsnProtocolSchedule?: [...];  // when TMLSN protocol selected
}
```

### TMLSN Protocol Schedule (when selected)

- Monday: TMLSN Upper Body A
- Tuesday: TMLSN Lower Body A
- Wednesday: Rest
- Thursday: TMLSN Upper Body B
- Friday: TMLSN Lower Body B
- Saturday, Sunday: Rest

### Volume Frameworks

- **builder** — hit target reps → +2.5kg; miss → same weight; RPE ≥ 9 → autoregulate
- **tmlsn_protocol** — compare sets_done to MEV/MAV/MRV; messages like “below MEV”, “approaching ceiling”, “deload incoming”
- **ghost** — RPE trend over last 3 sessions: up → reduce load; stable → add rep; down → add weight

### Briefing Output Format (plain text)

```
[WORKOUT TYPE] — Week [N] · [Protocol Name]

[Exercise Name]
Last: [weight]×[reps] (RPE [x])
Today: [target weight] × [target reps]
[optional note]

──────────
[Muscle group volume summary]
Session ready. Execute.
```

Tone: precise, direct, coach-like. No emojis. Under 200 words.

### JARVIS System Prompt (for Groq)

- Persona: TMLSN training intelligence, precise, data-driven
- Must reference user’s actual data
- Keep answers under 100 words, no bullet points
- Full WorkoutContext is JSON-stringified into the prompt

---

## Key Data Types

**WorkoutSession:** id, date, name, exercises, duration, isComplete  
**Exercise:** id, name, sets, restTimer, exerciseDbId, repRangeLow/High, smallestIncrement, defaultTargetRpe  
**Set:** id, weight, reps, completed, rpe, notes  
**ScheduledSet (for history):** weight, reps, rpe, targetReps, targetWeight, sessionDate  
**VolumeStatus:** muscleGroup, weekStart, setsDone, mev, mav, mrv  

---

## Training System Settings

- Volume framework: RP Landmarks / Target Range / Custom
- Schedule mode: **TMLSN Protocol only** (Builder and Ghost are disabled in UI)
- Week reset: Monday, Rolling, Custom
- Use RPE for progressive overload (toggle)

---

## Files to Know

| File | Purpose |
|------|---------|
| `lib/getWorkoutContext.ts` | Fetches context from Supabase (training_settings, workout_schedule, workout_logs, weekly_volume_summary) |
| `lib/generateBriefing.ts` | Generates pre-workout briefing from WorkoutContext |
| `hooks/useJarvis.ts` | Chat hook: briefing on init, sendMessage calls Groq |
| `components/JarvisCoach/JarvisSheet.tsx` | Bottom sheet UI for JARVIS |
| `components/FitnessHub.tsx` | JARVIS button + exercises tile |
| `components/TrainingSystemSettings.tsx` | Volume, schedule, week reset settings |

---

## Prompt Vault

- Stores prompts with: title, summary, fullText, source, sourceUrl, dateAdded, category
- Primary action: copy-to-clipboard
- Source link shown above prompt text

---

## How to Use This for Prompts

1. Paste this overview into ChatGPT.
2. Describe what you want (e.g. “Add a prompt that suggests deload when RPE has been ≥9 for 3 sessions in a row”).
3. ChatGPT helps you refine the prompt into a clear, implementable spec.
4. Copy that spec and send it to your Cursor agent for implementation.

Example prompt to Cursor: *“In generateBriefing, when framework is ghost and RPE has been ≥9 for the last 3 sessions on an exercise, add a note: ‘Consider deload. RPE consistently high.’”*
