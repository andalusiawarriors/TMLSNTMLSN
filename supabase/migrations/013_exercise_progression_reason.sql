-- ============================================================
-- 013_exercise_progression_reason.sql
-- Adds progression_reason to exercise_progress_state so the
-- post-session summary can display human-readable explanations
-- for each weight/rep decision.
-- ============================================================

ALTER TABLE public.exercise_progress_state
  ADD COLUMN IF NOT EXISTS progression_reason TEXT;

COMMENT ON COLUMN public.exercise_progress_state.progression_reason
  IS 'Human-readable explanation of the last progression decision (e.g. "Hit 70%+ of sets at top rep range — weight increases").';
