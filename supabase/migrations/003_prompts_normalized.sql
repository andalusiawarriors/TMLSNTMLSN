-- Convert prompts from JSONB (one row per user) to normalized (one row per prompt)
-- Run in Supabase SQL Editor if prompts table has old schema (user_id PK, data JSONB)

-- Drop old table (only if it has old schema with data column)
-- Check: SELECT column_name FROM information_schema.columns WHERE table_name = 'prompts';
-- If you see 'data' column, run this migration.

DO $$
BEGIN
  -- Migrate data from old format if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prompts' AND column_name = 'data'
  ) THEN
    -- Create new normalized table
    CREATE TABLE IF NOT EXISTS prompts_new (
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      full_text TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      date_added TEXT NOT NULL DEFAULT '',
      category TEXT,
      PRIMARY KEY (user_id, id)
    );
    ALTER TABLE prompts_new ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can manage own prompts_new"
      ON prompts_new FOR ALL USING ((select auth.uid()) = user_id);

    -- Migrate from JSONB array to rows
    INSERT INTO prompts_new (user_id, id, title, summary, full_text, source, source_url, date_added, category)
    SELECT
      p.user_id,
      elem->>'id',
      COALESCE(elem->>'title', ''),
      COALESCE(elem->>'summary', ''),
      COALESCE(elem->>'fullText', elem->>'full_text', ''),
      COALESCE(elem->>'source', ''),
      COALESCE(elem->>'sourceUrl', elem->>'source_url', ''),
      COALESCE(elem->>'dateAdded', elem->>'date_added', NOW()::text),
      CASE WHEN elem->>'category' = '' THEN NULL ELSE elem->>'category' END
    FROM prompts p,
    LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(p.data) = 'array' THEN p.data
        ELSE '[]'::jsonb
      END
    ) AS elem;

    DROP POLICY IF EXISTS "Users can manage own prompts" ON prompts;
    DROP TABLE prompts;
    ALTER TABLE prompts_new RENAME TO prompts;
    DROP POLICY IF EXISTS "Users can manage own prompts_new" ON prompts;
    CREATE POLICY "Users can manage own prompts"
      ON prompts FOR ALL USING ((select auth.uid()) = user_id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prompts' AND column_name = 'full_text'
  ) THEN
    -- Table exists but not normalized: create from scratch
    DROP TABLE IF EXISTS prompts CASCADE;
    CREATE TABLE prompts (
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      full_text TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      date_added TEXT NOT NULL DEFAULT '',
      category TEXT,
      PRIMARY KEY (user_id, id)
    );
    ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can manage own prompts"
      ON prompts FOR ALL USING ((select auth.uid()) = user_id);
  END IF;
END $$;
