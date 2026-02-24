-- Fix RLS Auth Initialization Plan warnings
-- Run in Supabase SQL Editor to update existing policies
-- Uses (select auth.uid()) instead of auth.uid() for better performance at scale

DROP POLICY IF EXISTS "Users can manage own nutrition_logs" ON nutrition_logs;
CREATE POLICY "Users can manage own nutrition_logs"
  ON nutrition_logs FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own workout_sessions" ON workout_sessions;
CREATE POLICY "Users can manage own workout_sessions"
  ON workout_sessions FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own prompts" ON prompts;
CREATE POLICY "Users can manage own prompts"
  ON prompts FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own user_settings" ON user_settings;
CREATE POLICY "Users can manage own user_settings"
  ON user_settings FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own saved_routines" ON saved_routines;
CREATE POLICY "Users can manage own saved_routines"
  ON saved_routines FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own saved_foods" ON saved_foods;
CREATE POLICY "Users can manage own saved_foods"
  ON saved_foods FOR ALL USING ((select auth.uid()) = user_id);
