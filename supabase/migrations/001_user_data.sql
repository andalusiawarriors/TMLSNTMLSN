-- TMLSN user-scoped data tables
-- Run this in Supabase SQL Editor after creating your project

-- nutrition_logs: one row per user per date
CREATE TABLE IF NOT EXISTS nutrition_logs (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (user_id, date)
);

-- workout_sessions: one row per session
CREATE TABLE IF NOT EXISTS workout_sessions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  date TEXT NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (user_id, id)
);

-- prompts: one row per user (array in data)
CREATE TABLE IF NOT EXISTS prompts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- user_settings: one row per user
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  data JSONB NOT NULL
);

-- saved_routines: one row per user (array in data)
CREATE TABLE IF NOT EXISTS saved_routines (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- saved_foods: one row per user (array in data)
CREATE TABLE IF NOT EXISTS saved_foods (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Row Level Security: users can only access their own data
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own nutrition_logs"
  ON nutrition_logs FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own workout_sessions"
  ON workout_sessions FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own prompts"
  ON prompts FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own user_settings"
  ON user_settings FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own saved_routines"
  ON saved_routines FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own saved_foods"
  ON saved_foods FOR ALL USING ((select auth.uid()) = user_id);
