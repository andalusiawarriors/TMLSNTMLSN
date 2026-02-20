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
| *(none)*     | —                 | —                         | —               | —       |

*Previously: tab layout — pill labels swapped (workout→explore, explore→TMLSN); synced to obh*

*Claim a row when you start; list the main files you’re touching so other agents can avoid them. Clear or update when you finish.*

---

## Recently touched

*List files or areas you just changed so the next agent knows what’s fresh.*

- `app/(tabs)/_layout.tsx` – theme: container bg, tab PNG tintColor (getTabMeta), popup pills icon/label colors, BlurView tint
- `app/(tabs)/index.tsx`, `profile.tsx`, `prompts.tsx` – theme: backgrounds, text colors, modal content
- `app/(tabs)/workout/index.tsx` – theme: container, settings pill, progress modal, exercise menu
- `app/search-food.tsx` – layout from reference: search bar (magnifying glass, clear X), History tabs (All/My Meals/My Recipes/My Foods), action buttons (Barcode scan, Meal scan only), History cards (layout only, no ingredient names); background Colors.primaryDark to match workout full screen; synced to obh worktree
- `components/PillSegmentedControl.tsx` – toggle thumb: calorie-card-style gradient (border + fill) tinted Nutrition=red, Fitness=blue
- `components/ProfileSheet.tsx` – title "profile" (lowercase), Typography.h2/fontWeight 600/letterSpacing -0.11; full-screen overlay (no Modal, no bottom barrier); scroll bottom padding so content scrolls above tab bar; synced to obh
- `app/(tabs)/_layout.tsx` – ProfileSheet rendered here; custom tab bar extracted (tabBar returns null, tab bar rendered with zIndex 99999 above sheet); showProfile + onProfileSheetState bridge; BackHandler for Android; **pill position derived from visual slot in visibleRoutes** so workout tab (and all tabs) align correctly; synced to obh
- `app/(tabs)/nutrition.tsx` – Firestreak popup: Milestones layout (Day Streak flame, Badges earned, summary cards, badge grid); firestreakhomepage.png; system font; synced to obh; profile pill opens sheet via emitProfileSheetState(true)
- `app/(tabs)/workout/index.tsx` – Workout carousel: two slides (progress | steps + recently uploaded), step card with calorie-style ring, placeholder steps, “Recently uploaded” block; synced to obh worktree
- `app/(tabs)/prompts.tsx` – AnimatedFadeInUp on all elements (explore page): header, category filter, prompt cards with stagger
- `app/(tabs)/profile.tsx` – AnimatedFadeInUp on all elements (progress page): title, subtitle, progress section; useFocusEffect for animTrigger
- `app/(tabs)/workout/index.tsx` – already had AnimatedFadeInUp on header, swipe widget, achievements (no change)
- `constants/theme.ts` – added Font, HeadingLetterSpacing (shared with home)
- `app/(tabs)/workout/` – full home font system: EB Garamond (extraBold/bold/semiBold/regular) for headings/body, DMMono for data/numbers; Typography constants throughout
- `components/Card.tsx` – added borderRadius prop for gradientFill
- `components/HeatmapPreviewWidget.tsx`, `StatisticsButtonWidget.tsx` – Card gradientFill
- `app/(tabs)/workout/index.tsx`, `tmlsn-routines.tsx`, `your-routines.tsx` – Hevy-style workout redesign (Person 1): exercise cards, numbered set dots, weight×reps, rest timer, collapsible routine cards, session history
- `app/(tabs)/workout/` – StreakWidget, MuscleBodyHeatmap, button sound on tappable elements
- `components/BlurRollNumber.tsx` – restored full Skia version; lerp instead of Extrapolation
- `app/(tabs)/nutrition.tsx` – top-left pill flame icon, pull-to-refresh flywheel, card swipe day animation, TMLSN AI logo, FAB popup close sound (Person 2)
- `app/(tabs)/_layout.tsx` – Home tab in center pill (4 tabs: TMLSN CAL, Home, WORKOUT TRACKER, PROMPTS)
- `app/(tabs)/index.tsx` – Home page (TMLSN title + subtitle)
- `app/(tabs)/nutrition.tsx` – Edit Goals modal: theme-aware modalContent bg, modalTitle; StyleSheet colors reverted to Colors (inline overrides handle theme)
- `components/Input.tsx` – theme-aware: label, input bg/border/text, placeholder use useTheme colors
- `app/(tabs)/workout/index.tsx` – Explore: pageHeading, progress/achievements cards (cardIconTint), Progress modal (stats pills, session cards, empty state), swipe dot
- `app/(tabs)/workout/statistics.tsx` – container bg theme-aware; MuscleBodyHeatmap already themed
- `app/(tabs)/workout/tmlsn-routines.tsx` – full theme: screen title, routine cards (cardIcon/cardTitle/cardStat/chevron), exercise rows, start button
- `app/(tabs)/workout/your-routines.tsx` – full theme: container, screen title, new routine button, empty state, routine cards, builder overlay (top bar, exercise blocks, add button)
- `app/(tabs)/workout/settings.tsx` – full theme: container, loading, labels, hints, segment buttons, option chips, switches
- `app/(tabs)/workout/index.tsx` – exercise overlay: overlay bg, top bar, summary stats, rest timer panel, exercise blocks, set rows, add set/add exercise buttons
- `components/ExercisePickerModal.tsx` – full theme: modal, title, close, search, chips, rows, empty
- `components/BackButton.tsx` – theme: pill gradients, icon color
- `app/tmlsn-routines-modal.tsx` – wrapper bg theme-aware

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
