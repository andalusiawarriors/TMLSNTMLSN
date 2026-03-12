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
| | None | | | |
*Just finished: Person 1 merge — feature/calorie-heading: ARCH-REDESIGN (CalorieArch, AddFoodCard, FoodDeckCards, MealSections), ai-food-chat, FoodDeckOverlay, LoggedFoodCard, ActionSheet, NotebookDotGrid.*
*Just finished: Strength muscle spider/radar haptics audit — removed animation-based haptics from MuscleRadarChart; added haptic on muscle selection (body tap + MuscleRow tap) in DetailedBodyHeatmap and MuscleBodyHeatmap.*
*Just finished: getWorkoutContext audit — removed workout_schedule and weekly_volume_summary queries (tables not in production); schedule from TMLSN_PROTOCOL_SCHEDULE or user_settings.weekPlan; weeklyVolume degrades to []; week-builder no longer writes to workout_schedule.*
*Just finished: Streak sync verification — loadPersistedState now prefers newer of (remote, local) to prevent offline rollback; pushes local to remote when local is newer.*
*Just finished: tmlsnAI prescription explanation tightening — structured prescription with workingSetsAnalyzed/allSetsAtTopRange; strict EXERCISE_EXPLANATION_TEMPLATE for build_reps; precise wording rules; no single-set attribution.*
*Just finished: Progressive overload canonical engine — generateBriefing + tmlsnai now use decideNextPrescription; removed builder/ghost framework-specific logic from both.*
*Just finished: Workout navigation overhaul — eliminated router.back()+setTimeout race in fitness-hub flat routes (now use router.dismiss()+router.navigate); fixed "Go to home" flash by guarding startEmpty param; fixed fallback paths in workout/tmlsn-routines and workout/your-routines to use /(tabs)/workout; fixed FitnessGraphWidget and progress-graph "Start workout" to go to /(tabs)/nutrition instead of /(tabs)/workout.*
*Just finished: Workout home "Recent" screen removed — replaced with minimal "Go to home" redirect; removed exploreHeader, Recent list, settings/history links; unused imports (Gear, List, Clock, Database, ImageBackground) cleaned.*
*Just finished: FitnessHub wrong-page fix + polish — WorkoutPill: replaced TiltPressable with Pressable (fixes Your workouts → Empty bug); pass route explicitly to onPress; collapsable={false}; hitSlop; PILL_GAP 14, PILL_HEIGHT 76; overlay modal card styling; CaretRight on pills; pill icon/label polish.*
*Just finished: FitnessHub Back fix — use root-level modals (tmlsn-routines-modal, your-routines-modal, start-empty-workout-modal) instead of router.replace to workout tab; Back now returns to FitnessHub without crash.*
*Just finished: JARVIS ghost/rep range/weight increment/kg-lb — getWorkoutContext: TodayExerciseDetail, buildTodayExerciseDetails, weightUnit, todayExerciseDetails; useJarvis: formatTodayExerciseDetails, TMLSN progressive overload block, WEIGHT_UNIT rules, formatExerciseHistory/formatAllExerciseHistory/formatHistorySummary use toDisplayWeight+formatWeightDisplay for correct kg/lb.*
*Just finished: Finish workout hardening — finalizeWorkoutSession in utils/storage.ts (single canonical finalize: persist session+exercises+sets, prescriptions, mark complete, idempotent); workout-save calls it on Save and uses activeWorkout when sessionId matches; Finish on workout tab only navigates to workout-save (no persist); supabaseStorage idempotency comment.*
*Just finished: StickyGlassHeader + Progress Graph wiring — StickyGlassHeader.tsx (blur+gradient on scroll), progress-graph.tsx uses Animated.ScrollView + StickyGlassHeader (title, pills sticky; glass effect ramps 0→0.92 opacity as scrollY 0→140).*
*Just finished: Add Meal popup redesign — Calories 48px showcase, P/C/F read-only card, unit wheel picker, meal type at bottom; manual add shows editable calories + macros; main + obh synced (nutrition.tsx, search-food.tsx, UnitWheelPicker.tsx, package.json).*
*Just finished: Add Meal UI artist fix — BackButton asModal prop for 54px placement; Button gradient variant (FAB style); TMLSN label smaller than title (11px vs 20px); removed Cancel buttons; calories showcase (dataValue font, larger); meal type chip no blue; unit/amount controls (tbsp/tsp/cup/100g/1g + amount); main + obh synced (nutrition.tsx, search-food.tsx, BackButton, Button).*
*Just finished (Person 2): Progress graph liquid glass UI, sticky pills, whole-number formatting, animations.*
*Just finished (Person 2): Progress Fitness tiles v2, Apple Fitness layout, heatmaps, GlassCard/Pill/SegmentedControl.*
*Just finished: Add-meal pop-up ingredient title visible — removed style={StyleSheet.absoluteFill} from LinearGradient in MaskedView for Top 100 and Verified title in both add-meal blocks (Food DB overlay + Meal Form modal); gradient now sizes to text so title shows. Main + obh nutrition.tsx.*
*Just finished: List Food match fix v3 — exact-preload only in tryFirstMatchQuery (getPreloadedResultsExact); pickBestForListFood prefers zero contradiction then min penalty; sourdough vs any non-sourdough bread, chicken breast vs non-breast penalty; scoreResult breast-in-name +50, fortified milk (added+vitamin) −50; main + obh synced.*
*Just finished: Branded Top 100 gold gradient + tick — search cards: branded+Top100 = brand then gold gradient + gold tick; branded+Foundation = quicksilver gradient + tick; branded+neither = plain name; removed " · X cal" and "X cal/100g" subtitle; nutrition only in macros row. Main + obh: search-food.tsx, nutrition.tsx.*
*Just finished: Explore feed redesign — achievements card extracted to components/workout/AchievementsCard.tsx; Explore tab (workout index) now has homepage background image + gradient, header (Heart \| Explore \| Profile), FlatList feed with post cards and suggested-accounts blocks, infinite scroll, notifications modal (Likes/Follows/Mentions); main + obh synced.*
*Just finished: List Food v2 — oats vs oat milk, coconut vs dairy milk, rice protein powder vs fried rice; short-name preference; parseListFoodQuantity: dash (5ml), handful (20g), one apple (182g); main + obh synced.*
*Just finished: List Food correct-ingredient + quantity — getListFoodContradictionPenalty (breast vs drumstick, sourdough vs white, oats vs oat bread, milk vs ricotta, protein powder vs flour); scoreResult multi-word bonus; parseListFoodQuantity (250g, one cup, slice, scoop); items/rows with defaultAmount/defaultUnit; confirm pre-fill grams/ml; main + obh synced.*
*Just finished: List Food keyword fix — ingredient name carries weight: extractListFoodIngredientName ("with a dash of olive oil"→"olive oil", "1 apple"→"apple"); scoreResult composite penalty ("apple + mango" / "olive oil with a dash of basil" −80); variants try extracted ingredient first; isAmountOnlyVariant blocks "dash"/"200g"; main + obh synced.*
*Just finished: List Food — one ingredient→one row; multi-ingredient line→one row per ingredient (getListFoodSearchTokens); tryFirstMatchQuery preload-first + best by scoreResult; listFoodQueryVariants full line + tokens only (no per-word collapse); main + obh synced.*
*Just finished: List Food fix — Brother saw old "TMLSN Basics" label on top in search food. obh app/(tabs)/search-food.tsx was still old design. Updated obh to folding stripe + gradient name + gold/quicksilver tick (verifiedCardLeftStripe, verifiedNameRow, GOLD/QUICKSILVER_VERIFIED_BADGE). Main already had new design.*
*Just finished: Search food — instant first (USDA then OFF, partial preload), gold first, Show more always + onEndReached; main + obh.*
*Just finished: List Food modal — focus new row on Enter: listFoodFocusAfterAdd state, listFoodInputRefs, useEffect + requestAnimationFrame to focus; addListFoodLine(section, lines.length); main only (obh has different List Food UI).*
*Just finished: List Food — hint, headings, bullets, placeholders, Log Food button, conversion popup (search → confirm → log), searchFoodFirstMatch; fontFamily→fontWeight, listFoodInput white; main + obh synced.*
*Previously: Dedupe search results by USDA fdcId — ParsedNutrition.fdcId, dedupKey usda:fdcId so same food appears once; verified+rest and preload/nextPage dedupe by fdcId; main + obh synced.*
*Just finished: Quicksilver for all Foundation (not Top 100) — isFoundationVerified() in foodApi; solid QUICKSILVER_TEXT for nutrition on cards so it always shows; main + obh synced.*
*Just finished: Remove SR Legacy from USDA food API and UI — Foundation + Branded only; Verified = Foundation only; main + obh synced.*

*Just finished: Home search ingredient card fix — pressing a FoodResultRow in the homeSearchActive Modal now closes the search first (pendingAddMealAfterHomeSearchRef), then opens AddMealSheet 320ms later once the first Modal is dismissed, preventing the iOS double-Modal stacking issue. Main + obh: app/(tabs)/nutrition.tsx.*

*Just finished: App sounds — set interruptionMode to mixWithOthers so taps/FAB/popup/card sounds don't pause or duck background music (nutrition.tsx, _layout.tsx, useButtonSound.ts; synced to obh).*

*Just finished: Search food page — same background as profile (HomeGradientBackground), content layer transparent so gradient shows through.*

*Just finished: Home page background — replaced assets/home-background.png with user’s dark gradient image; gradient overlay unchanged.*

*Just finished: List Food popup — full-screen blurred modal with back button; “type one food per line” + ListBullets icon; Breakfast/Lunch/Dinner/Snacks each with 2 editable bullet lines; synced to obh.*

*Previously: Profile Fitness – fixed layout shift when tapping pillar (VALUE_SECTION_HEIGHT, BUBBLES_ROW_HEIGHT)*

*Claim a row when you start; list the main files you’re touching so other agents can avoid them. Clear or update when you finish.*

---

## Recently touched

*List files or areas you just changed so the next agent knows what's fresh.*

- `utils/exerciseDb/exerciseDatabase.ts`, `app/exercises/index.tsx`, `app/exercises/[id].tsx`, `components/ExercisePickerModal.tsx` – Exercise system polish: search normalization (tricep/triceps, bicep/biceps, lat/lateral, db/dumbbell, bb/barbell); built-in vs custom indicator on ExerciseRow, FavoritesSection, ExercisePickerModal; detail page loadEntryMode badge + Custom label
- `app/exercises/index.tsx`, `app/exercises/[id].tsx` – Create Exercise in Fitness Hub: user exercises merged with built-in, alphabetical sort, searchExercises for search, CreateExerciseSheet + Create exercise row; detail page fallback to user exercises when id not in EXERCISE_MAP
- `constants/typography.ts`, `components/ui/TmlsnText.tsx`, `components/AppSettingsScreen.tsx`, `components/StatisticsButtonWidget.tsx`, `components/StreakWidget.tsx`, `.cursor/rules/system-default-font.mdc` – Added SF/system typography foundation (`SystemTypography`, `TypographyFamilies`, `TmlsnText`) and migrated 3 shared components to default system font usage
<<<<<<< Updated upstream
=======
- `components/MuscleRadarChart.tsx`, `components/DetailedBodyHeatmap.tsx`, `components/MuscleBodyHeatmap.tsx` – Strength muscle haptics: removed animation-based haptics from radar; added haptic on muscle selection (body tap + MuscleRow tap)
- `lib/getWorkoutContext.ts`, `app/week-builder.tsx` – Removed workout_schedule and weekly_volume_summary dependencies (tables not in production)
- `utils/streak.ts` – Streak sync: preferNewer merge in loadPersistedState to prevent offline rollback
- `app/_layout.tsx`, `app/fitness-hub-tmlsn-routines.tsx`, `app/fitness-hub-your-routines.tsx`, `app/fitness-hub-start-empty.tsx` – Workout screen regression fix: root Stack gestureEnabled: !activeWorkout; fitness-hub flows use router.dismiss()+router.navigate to land on (tabs)/workout with params
- `hooks/useJarvis.ts` – tmlsnAI prescription: formatExercisePrescriptionForQuestion (workingSetsAnalyzed, allSetsAtTopRange, lastSessionDate); EXERCISE_EXPLANATION_TEMPLATE; strict build_reps wording
- `supabase/migrations/010_workout_posts_no_cascade.sql`, `components/explore/ExplorePostDetailModal.tsx` – Deleting workouts no longer deletes posts: migration drops CASCADE FK; modal shows "Workout no longer available" when post has session_id but workout data is gone
- `components/ShinyText.tsx`, `components/TodaysSessionCarousel.tsx` – ShinyText: Customize settings (speed 5s, delay 0s, spread 120°, #b5b5b5/#ffffff, left, no yoyo) + silver-gradient style
- `components/FitnessHub.tsx` – FitnessHub Back fix: use root modals instead of workout tab nav
- `lib/getWorkoutContext.ts`, `hooks/useJarvis.ts` – JARVIS: ghost reps/sets, rep range low/high, weight increment (lb+kg), TMLSN progressive overload algorithm, WEIGHT_UNIT, todayExerciseDetails
- `utils/rpe.ts`, `utils/workoutSetTable.ts`, `components/WorkoutSetTable.tsx`, `app/(tabs)/workout/index.tsx`, `app/workout-edit.tsx` – Zero-divergence set table: shared WorkoutSetTable (SET|PREVIOUS|KG/LB|REPS|RPE|✓), editing/RPE popup/ghost apply/swipe-to-delete inside component; buildPrevSetsAndGhost helper; active workout and edit past workout both use same component; no UI/design changes.
- `utils/storage.ts`, `utils/supabaseStorage.ts`, `app/workout-save.tsx`, `app/(tabs)/workout/index.tsx` – Finish workout hardening: finalizeWorkoutSession, workout-save uses it + activeWorkout, Finish only navigates
>>>>>>> Stashed changes
- `components/ProgressHub.tsx` – Reorder UX: blur+dark overlay, jiggle, long-press-to-drag (activateAfterLongPress), floating tile position, snap-into-place; fixed lint
- `app/(tabs)/nutrition.tsx`, `components/ProgressHub.tsx` – Scroll fix: scrollViewLayer flex:1 so main ScrollView gets bounded height; ProgressHub root View no flex:1 so content sizes naturally
- `components/ui/StickyGlassHeader.tsx`, `app/progress-graph.tsx` – Sticky filter header (Stoic-style): liquid glass on scroll, pills sticky, Animated.ScrollView
- `app/(tabs)/nutrition.tsx`, `app/search-food.tsx`, `components/UnitWheelPicker.tsx`, `package.json` (main + obh) – Add Meal popup redesign: calories showcase, P/C/F card, unit wheel, meal type at bottom
- `app/(tabs)/nutrition.tsx`, `app/search-food.tsx`, `components/BackButton.tsx`, `components/Button.tsx` (main + obh) – Add Meal UI artist fix: back 54px, gradient Add Meal button, TMLSN label size, unit/amount controls
- `app/(tabs)/workout/index.tsx` (main + obh), `components/explore/ExploreProfileModal.tsx` (main + obh) – Notifications & profile revamp: modal-level back row at 54px + BackButton style override (position relative 0,0); notifications Instagram layout (Today/This week/Earlier, avatar + text + time + optional thumb per row); card height + flex scroll to fix clipping; profile BackButton override, scrollContent alignItems center, inner width 100%, grid width 100%; synced to obh
- `app/(tabs)/workout/index.tsx` (main + obh), `components/explore/ExploreProfileModal.tsx` (main + obh) – Notifications + Explore profile polish: back at 54px in both; notifications card top: 54, back row, scroll content padding; Explore profile absolute back row, paddingTop 54+48, centered stats (statsRowWrap + gap), spacing
- `app/(tabs)/workout/index.tsx` (main), `.cursor/worktrees/tmlsn-app_2/obh/app/(tabs)/workout/index.tsx` (obh) – Explore feed fixes: no title, header 54px from top + absolute overlay, Instagram-style post cards (media first), FlatList full screen, Explore profile modal (avatar/followers/posts grid); profile icon opens ExploreProfileModal only
- `components/explore/ExploreProfileModal.tsx` (main + obh) – new Instagram-style profile modal
- `components/workout/AchievementsCard.tsx` (main + obh) – extracted achievements card
- `app/search-food.tsx`, `app/(tabs)/nutrition.tsx` (main + obh) – Search: disambiguate same-name rows (calorie subtitle for verified when no brand, "name · X cal" for non-verified)
- `utils/foodApi.ts`, `app/(tabs)/nutrition.tsx` (main + obh) – List Food: one row per ingredient (getListFoodSearchTokens), preload-first + best-by-scoreResult in tryFirstMatchQuery, variants = full line + tokens only
- (Search final pass: no code edits — confirmed multiple "sourdough bread" rows expected; UX recommendation + slop check in foodApi/search-food.tsx)
- `.cursor/worktrees/tmlsn-app_2/obh/app/(tabs)/search-food.tsx` – Search label: old "TMLSN Basics" on top replaced with folding stripe + gradient name + gold/quicksilver tick (verifiedCardLeftStripe, verifiedNameRow, badge images)
- `app/search-food.tsx`, `app/(tabs)/nutrition.tsx`, `utils/foodApi.ts` (main + obh) – Search: instant first (USDA first then OFF, partial preload 400+i*300ms), gold-first sort, Show more always (hasMore only when 0 new results), onEndReached load more
- `app/search-food.tsx`, `app/(tabs)/nutrition.tsx`, `utils/foodApi.ts` (main + obh) – Search food: fixed over-deduping (was using query as dedupe key so “white bread” showed 1 result); dedupe now by contentKey + fdcId; hasMore set in callback from result length; OFF verified in flow; __DEV__ logs for translation/next-page failures – List Food matching patch: word-level typo (applyWordLevelTypos), multi-food tokenization (getListFoodSearchTokens), expanded listFoodQueryVariants; searchFoodFirstMatch single try per variant
- `app/(tabs)/nutrition.tsx` – List Food: backspace on empty line removes line (removeListFoodLine)
- `utils/foodApi.ts`, `app/(tabs)/nutrition.tsx` – List Food best-effort matching: searchFoodFirstMatchBestEffort (fallbacks + synthetic), no "No match found" in confirm list; obh synced
- `app/(tabs)/nutrition.tsx` – List Food modal: focus new row on Enter (listFoodFocusAfterAdd, listFoodInputRefs, useEffect)
- `utils/foodApi.ts`, `app/(tabs)/nutrition.tsx`, `app/search-food.tsx` – quicksilver for all Foundation (not Top 100): isFoundationVerified(), solid quicksilver nutrition text on cards; obh synced
- `utils/foodApi.ts`, `app/(tabs)/nutrition.tsx`, `app/search-food.tsx` – removed SR Legacy: USDA_DATA_TYPES = Foundation + Branded only; Verified = Foundation only; obh synced
- `app/(tabs)/nutrition.tsx`, `app/(tabs)/_layout.tsx`, `hooks/useButtonSound.ts` – audio: interruptionMode `mixWithOthers` (no pause/duck of background music); obh synced
- `app/search-food.tsx` – background: HomeGradientBackground (same as profile); wrapper + transparent content layer
- `assets/home-background.png` – replaced with user’s dark abstract gradient image (home page background); gradient overlay in nutrition.tsx unchanged
- `app/search-food.tsx`, `app/(tabs)/nutrition.tsx` – TMLSN Basics → TMLSN VERIFIED: Foundation + SR Legacy foods use quicksilver gradient on food name + quicksilver badge tick inline; add-meal popup shows “TMLSN VERIFIED” label and title with gradient + tick; synced to obh
- `app/(tabs)/nutrition.tsx` – List Food modal: full-screen blur, BackButton, “type one food per line” + ListBullets icon, Breakfast/Lunch/Dinner/Snacks with 2 editable lines each; pill “list food” opens this modal; synced to obh
- `app/(tabs)/nutrition.tsx` – Add Meal title: show food name when opened from selected food (mealName or "Add Meal"); synced to obh
- `app/search-food.tsx` – Add Meal overlay title: same
- `app/(tabs)/nutrition.tsx` – Saved Foods + Food Search modals: full-screen blur (intensity 50 + tint like ProfileSheet), BackButton closes modal and calls onCloseModal when asModal
- `components/NutritionHero.tsx` – Arc: solid dark stroke (no static gradient); moving rect uses glimmer-only gradient (dark–light–dark narrow band). Bars: narrow-band gradient (dark–dark–light–dark–dark with locations) so the only light is the moving strip. Removed unused getArcStops.
- `app/search-food.tsx` – TMLSN Basics tick: replaced Text "✓" with `gold_checkmark_badge.png`; placement from obh: marginLeft 1, marginTop -3 on wrap
- `app/(tabs)/nutrition.tsx` – Food DB modal: same gold tick PNG + placement for TMLSN Basics badge
- `app/(tabs)/nutrition.tsx` – fixed crash after logging food: health score card used `log` (out of scope); changed to `viewingDateLog`; synced to obh
- `.env.local.example` – added with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY so the other person can copy to .env.local and fix “Supabase not configured”; README setup step updated to mention Supabase
- `app/(tabs)/workout/your-routines.tsx` – Save Routine: template targets, delete, UI polish
- `app/search-food.tsx` – fixed keyboard dip on first character: use single FlatList always (no ScrollView/FlatList swap), TextInput stays mounted; synced to obh
- Supabase auth: `lib/supabase.ts`, `context/AuthContext.tsx`, `components/AuthModal.tsx`, `components/ProfileSheet.tsx`, `utils/storage.ts`, `utils/supabaseStorage.ts`, `constants/storageDefaults.ts`, `supabase/migrations/001_user_data.sql`, `app/_layout.tsx`, `.env.local.example` – login/create account in profile, per-account cloud storage
- `components/FitnessGraphWidget.tsx` – fixed layout shift: valueSection minHeight 48px, bubblesRow minHeight 52px so chart stays fixed when tapping pillar or switching metric
- `app/(tabs)/(profile)/index.tsx` – Fitness: hide title/subtitle when Fitness selected; reduced top padding; FitnessGraphWidget first, then progress + statistics cards
- `components/FitnessGraphWidget.tsx` – Month/Year/All time buttons with down arrow; Month = daily bars for selected month (dropdown: Jan–Dec); Year = 12 months for selected year (dropdown: years that have started only); All time; animated dropdowns (FadeInDown/FadeOutUp)
- `app/(tabs)/workout/index.tsx` – Rest pill: wider/higher, bigger font, centered, pressable; rest time edit modal with minutes/seconds sliders
- `components/ActiveWorkoutPill.tsx` – display workout name (TMLSN split / My Routines / empty → "Workout")
- `app/start-empty-workout-modal.tsx`, `app/(tabs)/workout/index.tsx` – empty workout name: "Workout"
- `utils/foodApi.ts` – removed likelyEnglish filter on OFF results; added [fetchUSDA] abort logging (external signal / timeout); synced to obh
- `utils/foodApi.ts` – ParsedNutrition.source ('usda'|'off'); parseUSDAFood/parseOFFProduct set source; searchFoodsProgressive single USDA call + local basics/branded split; parseUSDA dataType log; synced to obh
- `app/(tabs)/nutrition.tsx` – hasPreloaded guard for preloadCommonSearches; synced to obh
- `utils/geminiApi.ts` – extractJSON sets source: 'usda'; synced to obh
- `app/search-food.tsx` – brandLabel: source-based (TMLSN BASICS for USDA, Unknown Brand for OFF); addFoodResult includes source; removed isObviouslyBranded; synced to obh
- `app/(tabs)/nutrition.tsx` – Food DB modal brandLabel same logic; handleSelectSavedFood adds source; removed isObviouslyBranded; synced to obh
- `utils/foodApi.ts` – searchFoodsProgressive (callback-based progressive search, TMLSN Basics first); searchFoods deprecated; synced to obh
- `app/search-food.tsx` – runSearch uses searchFoodsProgressive + cached merge; synced to obh
- `app/(tabs)/nutrition.tsx` – handleFoodSearch uses searchFoodsProgressive + cached merge; synced to obh
- `app/_layout.tsx` – ActiveWorkoutProvider wrap
- `app/(tabs)/_layout.tsx` – ActiveWorkoutPill above tab bar; theme: container bg, tab PNG tintColor, popup pills
- `app/(tabs)/workout/index.tsx` – useActiveWorkout(), sync initialActiveWorkout to context
- `context/ActiveWorkoutContext.tsx`, `components/ActiveWorkoutPill.tsx` – persistent workout pill
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
