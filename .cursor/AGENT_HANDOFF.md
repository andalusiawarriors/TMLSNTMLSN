# Agent handoff – single source of truth

**Purpose:** Keep agents coordinated so work is joined, not parallel. Every agent must **read this first** when starting work and **update it** when claiming or finishing work to avoid merge conflicts and overlapping edits.

---

## When agents are working at the same time (neither has finished)

- **Claim immediately:** As soon as you start, update **Current focus** *before* you make edits. That way any other agent that reads the handoff later will see you’re working and can avoid overlapping.
- **If Current focus is already set** and your task would touch the same area or files: **do not start.** Tell the user that another agent may still be working and suggest:
  - running agents **one after the other** (wait for the other to finish and update the handoff), or
  - giving each agent **non-overlapping** work (e.g. one nutrition, one prompt vault, one docs).
- **Prefer sequential runs** when two tasks might touch the same feature or shared files. Parallel is safer only when areas are clearly separate (e.g. only nutrition vs only workout, and no shared files).

---

## Instructions for agents

1. **Before editing:** Read this file. Check "Current focus" and "Recently touched."
2. **When you start work:** Update "Current focus" with your area and what you’re doing.
3. **When you finish (or pause):** Update "Recently touched" and clear or update "Current focus."
4. **Shared files:** If you must edit something in "Merge-sensitive / shared," note it under Current focus so other agents avoid the same files until you’re done.

---

## Current focus

| Area / agent | What’s being done | Files I’m editing (paths) | Branch (if any) | Updated |
|--------------|-------------------|---------------------------|-----------------|---------|
| *none*       | —                 | —                         | —               | —       |

*Claim a row when you start; list the main files you’re touching so other agents can avoid them. Clear or update when you finish.*

---

## Recently touched

*List files or areas you just changed so the next agent knows what’s fresh.*

- `components/BlurRollNumber.tsx` – restored full Skia version (Canvas, Group, Blur, matchFont, SkText); useDerivedValue from reanimated; lerp instead of Extrapolation
- `components/BlurTextAnimation.tsx` – new: RN-adapted blur-to-focus word animation (opacity + scale, Reanimated, loop after animationDelay)
- `app/(tabs)/nutrition.tsx` – top-left pill: added firestreakhomepage.png flame icon (26×26, contained)
- `assets/firestreakhomepage.png` – new asset (flame for homepage pill)
- `app/(tabs)/nutrition.tsx` – polished pull-to-refresh flywheel (RefreshControl + in-content flywheel, 200ms fade on complete)
- `app/(tabs)/nutrition.tsx` – card swipe day animation (slide/fade on day switch: 180ms exit, 220ms entry, 30% width); added TMLSN AI logo to scan food popup card; added FAB popup close sound (10%) when user clicks out
- `assets/tmlsn-ai-logo.png` – new logo asset
- `assets/sounds/popup-close.mp4` – FAB popup close sound (0213(7))
- `app/(tabs)/_layout.tsx` – Home tab in center pill (4 tabs: TMLSN CAL, Home, WORKOUT TRACKER, PROMPTS)
- `app/(tabs)/index.tsx` – Home page (TMLSN title + subtitle)

---

## Merge-sensitive / shared

These are used by more than one feature; coordinate before editing to avoid merge conflicts.

- `app/(tabs)/_layout.tsx` – tab layout
- `types/index.ts` – shared types (nutrition + workout)
- `app/(tabs)/index.tsx` – home/tab entry
- Themed components, design tokens, or shared UI used by both trackers

---

## Ownership (do not override)

- **Nutrition/calorie tracker:** Person 1. See `.cursor/rules/do-not-edit-nutrition-tracker.mdc`. Only edit when the user explicitly asks for nutrition changes.
- **Workout tracker:** Person 2. See `.cursor/rules/do-not-edit-workout-tracker.mdc`. Only edit when the user explicitly asks for workout changes.

Agents should still update "Current focus" and "Recently touched" when working in their owned area so others know what’s in progress.
