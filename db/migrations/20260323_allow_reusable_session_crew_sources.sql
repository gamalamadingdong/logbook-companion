ALTER TABLE public.coaching_session_crews
  DROP CONSTRAINT IF EXISTS coaching_session_crews_source_boating_id_key;

CREATE INDEX IF NOT EXISTS idx_coaching_session_crews_source_boating_id
  ON public.coaching_session_crews (source_boating_id)
  WHERE source_boating_id IS NOT NULL;
