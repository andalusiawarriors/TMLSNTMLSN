-- ============================================================
-- 009_tmlsn_protocol_templates.sql
-- TMLSN Protocol day → exercise mapping per user
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tmlsn_protocol_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  protocol_day  TEXT NOT NULL CHECK (protocol_day IN ('Upper A', 'Lower A', 'Upper B', 'Lower B')),
  workout_type  TEXT NOT NULL,
  exercise_ids   UUID[] NOT NULL DEFAULT '{}'::uuid[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, protocol_day)
);

ALTER TABLE public.tmlsn_protocol_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tmlsn_protocol_templates"
  ON public.tmlsn_protocol_templates
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS tmlsn_protocol_templates_user_id_idx
  ON public.tmlsn_protocol_templates (user_id);

DROP TRIGGER IF EXISTS trg_tmlsn_protocol_templates_updated_at ON public.tmlsn_protocol_templates;
CREATE TRIGGER trg_tmlsn_protocol_templates_updated_at
  BEFORE UPDATE ON public.tmlsn_protocol_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
