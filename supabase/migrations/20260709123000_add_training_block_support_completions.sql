-- Store planned support-work completion state separately from workout_logs.

CREATE TABLE IF NOT EXISTS public.training_block_support_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.training_block_enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_session_id uuid REFERENCES public.training_block_template_sessions(id) ON DELETE SET NULL,
  planned_week_number integer NOT NULL CHECK (planned_week_number > 0),
  planned_day_slot integer NOT NULL CHECK (planned_day_slot BETWEEN 0 AND 6),
  planned_session_key text NOT NULL,
  scheduled_date date NOT NULL,
  support_session_template_id uuid REFERENCES public.support_session_templates(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('completed', 'modified', 'partial', 'skipped')),
  minutes_completed integer CHECK (minutes_completed IS NULL OR minutes_completed >= 0),
  perceived_exertion integer CHECK (perceived_exertion IS NULL OR perceived_exertion BETWEEN 1 AND 10),
  pain_flag boolean NOT NULL DEFAULT false,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_block_support_completions_unique_session UNIQUE (enrollment_id, planned_week_number, planned_day_slot, planned_session_key)
);

CREATE INDEX IF NOT EXISTS idx_training_block_support_completions_user_date
  ON public.training_block_support_completions (user_id, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_training_block_support_completions_enrollment
  ON public.training_block_support_completions (enrollment_id, planned_week_number, planned_day_slot);

DROP TRIGGER IF EXISTS trg_training_block_support_completions_updated_at ON public.training_block_support_completions;
CREATE TRIGGER trg_training_block_support_completions_updated_at
BEFORE UPDATE ON public.training_block_support_completions
FOR EACH ROW
EXECUTE FUNCTION public.update_training_block_updated_at();

ALTER TABLE public.training_block_support_completions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_block_support_completions TO authenticated;
GRANT ALL ON public.training_block_support_completions TO service_role;

DROP POLICY IF EXISTS "Users can manage their own training block support completions" ON public.training_block_support_completions;
CREATE POLICY "Users can manage their own training block support completions"
  ON public.training_block_support_completions
  FOR ALL TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.training_block_enrollments e
      WHERE e.id = enrollment_id
        AND e.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.training_block_enrollments e
      WHERE e.id = enrollment_id
        AND e.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Service role can manage training block support completions" ON public.training_block_support_completions;
CREATE POLICY "Service role can manage training block support completions"
  ON public.training_block_support_completions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
