-- ============================================================
-- 012_deload_counter_tracking.sql
-- Adds last_workout_date to training_settings so the deload
-- week counter can detect new weeks and natural rest breaks.
-- ============================================================

ALTER TABLE public.training_settings
  ADD COLUMN IF NOT EXISTS last_workout_date DATE;

COMMENT ON COLUMN public.training_settings.last_workout_date
  IS 'Date of the most recent workout session. Used to detect new calendar weeks (increments deload_week_counter) and natural rest breaks of 7+ days (resets counter to 0).';
