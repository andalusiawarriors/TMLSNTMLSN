-- ============================================================
-- TMLSN FITNESS APP — Supabase Migration
-- Exercise database + workout tracking tables
-- ============================================================

-- ── Exercises master table ───────────────────────────────────

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'forearms', 'quads', 'hamstrings', 'glutes',
    'calves', 'abs', 'full_body', 'cardio', 'olympic'
  )),
  equipment TEXT[] NOT NULL DEFAULT '{}',
  movement_type TEXT NOT NULL CHECK (movement_type IN ('compound', 'isolation')),
  force_type TEXT NOT NULL CHECK (force_type IN ('push', 'pull', 'legs', 'static', 'hinge', 'rotation')),
  description TEXT,
  tips TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Muscle targeting per exercise ────────────────────────────

CREATE TABLE IF NOT EXISTS exercise_muscles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_id TEXT NOT NULL,
  activation_percent INTEGER NOT NULL CHECK (activation_percent BETWEEN 0 AND 100),
  UNIQUE(exercise_id, muscle_id)
);

CREATE INDEX idx_exercise_muscles_exercise ON exercise_muscles(exercise_id);
CREATE INDEX idx_exercise_muscles_muscle ON exercise_muscles(muscle_id);

-- ── User workout routines ────────────────────────────────────

CREATE TABLE IF NOT EXISTS routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  days_per_week INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routines_user ON routines(user_id);

-- ── Routine days (e.g., "Push Day", "Leg Day") ──────────────

CREATE TABLE IF NOT EXISTS routine_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Push Day A"
  day_order INTEGER NOT NULL, -- sort order
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routine_days_routine ON routine_days(routine_id);

-- ── Exercises within each routine day ────────────────────────

CREATE TABLE IF NOT EXISTS routine_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_day_id UUID NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  exercise_order INTEGER NOT NULL,
  target_sets INTEGER DEFAULT 3,
  target_reps_min INTEGER DEFAULT 8,
  target_reps_max INTEGER DEFAULT 12,
  rest_seconds INTEGER DEFAULT 120,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routine_exercises_day ON routine_exercises(routine_day_id);

-- ── Workout sessions (actual logged workouts) ────────────────

CREATE TABLE IF NOT EXISTS workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_day_id UUID REFERENCES routine_days(id), -- nullable for ad-hoc workouts
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes TEXT,
  is_completed BOOLEAN DEFAULT false
);

CREATE INDEX idx_sessions_user ON workout_sessions(user_id);
CREATE INDEX idx_sessions_user_date ON workout_sessions(user_id, started_at);

-- ── Individual set records ───────────────────────────────────

CREATE TABLE IF NOT EXISTS set_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight_kg DECIMAL(6,2), -- null for bodyweight
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  is_warmup BOOLEAN DEFAULT false,
  is_dropset BOOLEAN DEFAULT false,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sets_session ON set_records(session_id);
CREATE INDEX idx_sets_exercise ON set_records(exercise_id);

-- ── View: Weekly muscle volume (Mon-Sun) ─────────────────────
-- This view calculates sets per muscle group for the current week.

CREATE OR REPLACE VIEW weekly_muscle_volume AS
WITH current_week_sets AS (
  SELECT
    sr.exercise_id,
    sr.reps,
    sr.weight_kg,
    sr.recorded_at,
    EXTRACT(ISODOW FROM sr.recorded_at) - 1 AS day_of_week, -- 0=Mon, 6=Sun
    ws.user_id
  FROM set_records sr
  JOIN workout_sessions ws ON ws.id = sr.session_id
  WHERE sr.recorded_at >= date_trunc('week', CURRENT_DATE) -- ISO week starts Monday
    AND sr.is_warmup = false
),
expanded AS (
  SELECT
    cws.user_id,
    em.muscle_id,
    em.activation_percent,
    cws.day_of_week,
    cws.exercise_id
  FROM current_week_sets cws
  JOIN exercise_muscles em ON em.exercise_id = cws.exercise_id
  WHERE em.activation_percent >= 40 -- only count significant activation
)
SELECT
  user_id,
  muscle_id,
  COUNT(*) AS total_sets,
  SUM(activation_percent) AS total_activation,
  jsonb_object_agg(
    day_of_week::text,
    day_sets
  ) AS sets_by_day
FROM (
  SELECT
    user_id,
    muscle_id,
    day_of_week,
    activation_percent,
    COUNT(*) OVER (PARTITION BY user_id, muscle_id, day_of_week) AS day_sets
  FROM expanded
) sub
GROUP BY user_id, muscle_id;

-- ── RLS Policies ─────────────────────────────────────────────

ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_records ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own data
CREATE POLICY "Users own routines" ON routines
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own routine_days" ON routine_days
  FOR ALL USING (
    routine_id IN (SELECT id FROM routines WHERE user_id = auth.uid())
  );

CREATE POLICY "Users own routine_exercises" ON routine_exercises
  FOR ALL USING (
    routine_day_id IN (
      SELECT rd.id FROM routine_days rd
      JOIN routines r ON r.id = rd.routine_id
      WHERE r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users own sessions" ON workout_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own sets" ON set_records
  FOR ALL USING (
    session_id IN (SELECT id FROM workout_sessions WHERE user_id = auth.uid())
  );

-- Exercises table is public read
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exercises are public" ON exercises FOR SELECT USING (true);

ALTER TABLE exercise_muscles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exercise muscles are public" ON exercise_muscles FOR SELECT USING (true);
