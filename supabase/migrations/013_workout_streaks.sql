-- Persist workout streak state per user so streak survives reinstall/device changes.

CREATE TABLE IF NOT EXISTS public.workout_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_start_ymd DATE,
  last_workout_ymd DATE,
  last_workout_at TIMESTAMPTZ,
  streak_dead BOOLEAN NOT NULL DEFAULT FALSE,
  exempt_week TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_streaks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own workout_streaks"
    ON public.workout_streaks
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_workout_streaks_updated_at ON public.workout_streaks;
CREATE TRIGGER trg_workout_streaks_updated_at
  BEFORE UPDATE ON public.workout_streaks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
