-- ============================================================
-- 020_multi_session_state.sql
-- Adds multi-session tracking columns to exercise_progress_state
-- to support items #8, #9, #10, #11, #12.
--
-- recent_session_scores (item #10):
--   Rolling window of the last ≤3 session hit-% scores (0.0–1.0).
--   Used to compute a rolling avg score (replacing the binary single-session
--   threshold for band decisions) and performance trend (#11).
--
-- sessions_without_progress (item #12):
--   Consecutive genuine misses (hold_cursor branch, not grace period, not at top).
--   ≥3 → plateau detected; ≥4 → volume suggestion (#8).
--
-- avg_sessions_per_weight_increase (item #9):
--   Rolling EMA (α=0.3) of how many sessions it took to earn each weight step.
--   Gives the algorithm a per-exercise velocity memory — fast progressors vs slow.
-- ============================================================

ALTER TABLE public.exercise_progress_state
  ADD COLUMN IF NOT EXISTS recent_session_scores   FLOAT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sessions_without_progress INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_sessions_per_weight_increase FLOAT;

COMMENT ON COLUMN public.exercise_progress_state.recent_session_scores
  IS 'Rolling window of the last ≤3 session hit-% scores (fraction of sets that met the rep target, 0.0–1.0). Used to compute rolling avg score and trend for smoother band decisions.';

COMMENT ON COLUMN public.exercise_progress_state.sessions_without_progress
  IS 'Consecutive sessions where the rep cursor did not advance (genuine misses, excluding grace period and confirm-top). ≥3 = plateau; ≥4 = trigger volume suggestion.';

COMMENT ON COLUMN public.exercise_progress_state.avg_sessions_per_weight_increase
  IS 'Per-exercise velocity memory — rolling EMA (α=0.3) of sessions needed per weight step. NULL until first weight increase. Faster progressors have lower values.';
