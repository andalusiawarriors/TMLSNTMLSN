-- ============================================================
-- 018_rpe_baseline.sql
-- Adds rpe_baseline to exercise_progress_state to support the
-- relative RPE delta feature (item #5).
--
-- rpe_baseline: personal rolling EMA (α=0.3) of session avg RPEs
-- per exercise. Used to compute rpeDelta = sessionAvg − baseline.
--   rpeDelta > +1 → user struggling → cap adaptive jump at +1
--   rpeDelta < -1 → user cruising  → +1 bonus to adaptive jump
-- NULL = no RPE history yet for this exercise.
-- ============================================================

ALTER TABLE public.exercise_progress_state
  ADD COLUMN IF NOT EXISTS rpe_baseline FLOAT;

COMMENT ON COLUMN public.exercise_progress_state.rpe_baseline
  IS 'Personal RPE baseline for this exercise — rolling EMA (α=0.3) of past session avg RPEs. NULL until first session with RPE data. Used to compute relative RPE delta for adaptive jump modulation.';
