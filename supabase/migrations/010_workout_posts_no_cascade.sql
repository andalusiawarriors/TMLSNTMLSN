-- Prevent workout_posts from being deleted when workout_sessions are deleted.
-- Posts should persist even if the user deletes the underlying workout.
-- Drop the CASCADE FK. Posts will remain with session_id pointing to deleted session;
-- the app handles orphaned posts by showing post content without workout breakdown.
ALTER TABLE public.workout_posts
  DROP CONSTRAINT IF EXISTS workout_posts_user_id_session_id_fkey;
