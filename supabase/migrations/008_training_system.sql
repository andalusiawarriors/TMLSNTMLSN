-- ============================================================
-- 008_training_system.sql
-- Training settings, schedule, logs, and weekly volume view
-- ============================================================

-- ─── ENUMS ───────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE volume_framework_enum AS ENUM ('builder', 'tmlsn_protocol', 'ghost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE day_of_week_enum AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. training_settings ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.training_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  volume_framework volume_framework_enum NOT NULL DEFAULT 'builder',
  schedule_mode    TEXT,
  current_week     INT NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.training_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own training_settings"
  ON public.training_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS training_settings_user_id_idx
  ON public.training_settings (user_id);

DROP TRIGGER IF EXISTS trg_training_settings_updated_at ON public.training_settings;
CREATE TRIGGER trg_training_settings_updated_at
  BEFORE UPDATE ON public.training_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. workout_schedule ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workout_schedule (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week  day_of_week_enum NOT NULL,
  workout_type TEXT,
  exercise_ids UUID[] NOT NULL DEFAULT '{}',
  is_rest_day  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_of_week)
);

ALTER TABLE public.workout_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout_schedule"
  ON public.workout_schedule
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS workout_schedule_user_id_idx
  ON public.workout_schedule (user_id);

DROP TRIGGER IF EXISTS trg_workout_schedule_updated_at ON public.workout_schedule;
CREATE TRIGGER trg_workout_schedule_updated_at
  BEFORE UPDATE ON public.workout_schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. workout_logs ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id    UUID NOT NULL,
  session_date   DATE NOT NULL,
  set_number     INT NOT NULL,
  weight         FLOAT,
  reps           INT,
  rpe            FLOAT CHECK (rpe IS NULL OR (rpe >= 6 AND rpe <= 10)),
  target_reps    INT,
  target_weight  FLOAT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout_logs"
  ON public.workout_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS workout_logs_user_id_idx
  ON public.workout_logs (user_id);

CREATE INDEX IF NOT EXISTS workout_logs_user_id_session_date_idx
  ON public.workout_logs (user_id, session_date);

CREATE INDEX IF NOT EXISTS workout_logs_exercise_id_idx
  ON public.workout_logs (exercise_id);

-- ─── 4. weekly_volume_summary (VIEW) ─────────────────────────
-- Aggregates workout_logs by user, muscle_group, and ISO week start (Monday).
-- mev / mav / mrv are read from a muscle_config table if it exists;
-- falls back to NULL so the view is safe to create even without that table.

CREATE OR REPLACE VIEW public.weekly_volume_summary AS
SELECT
  wl.user_id,
  ex.muscle_group,
  date_trunc('week', wl.session_date::TIMESTAMPTZ)::DATE AS week_start,
  COUNT(*) AS sets_done,
  mc.mev,
  mc.mav,
  mc.mrv
FROM public.workout_logs wl
-- Join to an exercises lookup if it exists; gracefully nullable
LEFT JOIN (
  SELECT id, muscle_group
  FROM public.exercises
) ex ON ex.id = wl.exercise_id
LEFT JOIN (
  SELECT muscle_group, mev, mav, mrv
  FROM public.muscle_config
) mc ON mc.muscle_group = ex.muscle_group
GROUP BY
  wl.user_id,
  ex.muscle_group,
  date_trunc('week', wl.session_date::TIMESTAMPTZ)::DATE,
  mc.mev,
  mc.mav,
  mc.mrv;
