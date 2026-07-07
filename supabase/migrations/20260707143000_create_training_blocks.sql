-- Training block plans, enrollment state, and per-log review overrides.
-- Actual completed training remains in public.workout_logs.

CREATE TABLE IF NOT EXISTS public.training_block_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  source text NOT NULL DEFAULT 'logbook_companion',
  duration_weeks integer NOT NULL CHECK (duration_weeks > 0),
  default_start_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.training_block_template_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.training_block_templates(id) ON DELETE CASCADE,
  week_number integer NOT NULL CHECK (week_number > 0),
  day_slot integer NOT NULL CHECK (day_slot BETWEEN 0 AND 6),
  day_of_week text NOT NULL,
  category text NOT NULL CHECK (category IN ('erg', 'cross_training', 'rest')),
  planned_distance_meters integer NOT NULL DEFAULT 0 CHECK (planned_distance_meters >= 0),
  target_distance_meters integer NOT NULL DEFAULT 0 CHECK (target_distance_meters >= 0),
  reference jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_block_template_days_unique_slot UNIQUE (template_id, week_number, day_slot)
);

CREATE TABLE IF NOT EXISTS public.training_block_template_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_day_id uuid NOT NULL REFERENCES public.training_block_template_days(id) ON DELETE CASCADE,
  session_key text NOT NULL,
  title text NOT NULL,
  planned_rwn text,
  workout_template_id uuid REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  support_prescription jsonb,
  family text NOT NULL,
  role text NOT NULL,
  source text NOT NULL CHECK (source IN ('erg', 'cross_training', 'strength', 'rest')),
  expected_distance_meters integer CHECK (expected_distance_meters IS NULL OR expected_distance_meters >= 0),
  expected_duration_minutes integer CHECK (expected_duration_minutes IS NULL OR expected_duration_minutes >= 0),
  target_split_seconds_per_500m numeric CHECK (target_split_seconds_per_500m IS NULL OR target_split_seconds_per_500m > 0),
  intervals jsonb,
  instructions text[],
  counts_toward_weekly_volume boolean NOT NULL DEFAULT true,
  is_key_session boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_block_template_sessions_unique_key UNIQUE (template_day_id, session_key)
);

CREATE TABLE IF NOT EXISTS public.training_block_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.training_block_templates(id) ON DELETE SET NULL,
  template_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_block_enrollments_date_range CHECK (start_date <= end_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_block_enrollments_user_active
  ON public.training_block_enrollments (user_id)
  WHERE is_active AND team_id IS NULL AND org_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_training_block_enrollments_user_template
  ON public.training_block_enrollments (user_id, template_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_block_enrollments_team_active
  ON public.training_block_enrollments (team_id)
  WHERE is_active AND team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_training_block_enrollments_org_active
  ON public.training_block_enrollments (org_id)
  WHERE is_active AND org_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.training_block_log_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.training_block_enrollments(id) ON DELETE CASCADE,
  workout_log_id uuid NOT NULL REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  planned_week_number integer CHECK (planned_week_number IS NULL OR planned_week_number > 0),
  planned_day_slot integer CHECK (planned_day_slot IS NULL OR planned_day_slot BETWEEN 0 AND 6),
  planned_session_key text,
  planned_template_session_id uuid REFERENCES public.training_block_template_sessions(id) ON DELETE SET NULL,
  status text CHECK (status IS NULL OR status IN ('as_written', 'modified', 'swapped', 'partial', 'skipped')),
  key_session_credit text CHECK (key_session_credit IS NULL OR key_session_credit IN ('yes', 'partial', 'no', 'n_a')),
  strength_status text CHECK (strength_status IS NULL OR strength_status IN ('completed', 'modified', 'partial', 'skipped', 'not_scheduled', 'not_started')),
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_block_log_reviews_unique_log UNIQUE (enrollment_id, workout_log_id)
);

CREATE INDEX IF NOT EXISTS idx_training_block_log_reviews_user_created
  ON public.training_block_log_reviews (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_block_log_reviews_enrollment
  ON public.training_block_log_reviews (enrollment_id, planned_week_number, planned_day_slot);

CREATE OR REPLACE FUNCTION public.update_training_block_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_block_templates_updated_at ON public.training_block_templates;
CREATE TRIGGER trg_training_block_templates_updated_at
BEFORE UPDATE ON public.training_block_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_training_block_updated_at();

DROP TRIGGER IF EXISTS trg_training_block_template_days_updated_at ON public.training_block_template_days;
CREATE TRIGGER trg_training_block_template_days_updated_at
BEFORE UPDATE ON public.training_block_template_days
FOR EACH ROW
EXECUTE FUNCTION public.update_training_block_updated_at();

DROP TRIGGER IF EXISTS trg_training_block_template_sessions_updated_at ON public.training_block_template_sessions;
CREATE TRIGGER trg_training_block_template_sessions_updated_at
BEFORE UPDATE ON public.training_block_template_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_training_block_updated_at();

DROP TRIGGER IF EXISTS trg_training_block_enrollments_updated_at ON public.training_block_enrollments;
CREATE TRIGGER trg_training_block_enrollments_updated_at
BEFORE UPDATE ON public.training_block_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.update_training_block_updated_at();

DROP TRIGGER IF EXISTS trg_training_block_log_reviews_updated_at ON public.training_block_log_reviews;
CREATE TRIGGER trg_training_block_log_reviews_updated_at
BEFORE UPDATE ON public.training_block_log_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_training_block_updated_at();

ALTER TABLE public.training_block_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_block_template_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_block_template_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_block_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_block_log_reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.training_block_templates TO authenticated;
GRANT SELECT ON public.training_block_template_days TO authenticated;
GRANT SELECT ON public.training_block_template_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.training_block_enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_block_log_reviews TO authenticated;
GRANT ALL ON public.training_block_templates TO service_role;
GRANT ALL ON public.training_block_template_days TO service_role;
GRANT ALL ON public.training_block_template_sessions TO service_role;
GRANT ALL ON public.training_block_enrollments TO service_role;
GRANT ALL ON public.training_block_log_reviews TO service_role;

DROP POLICY IF EXISTS "Authenticated users can view published training block templates" ON public.training_block_templates;
CREATE POLICY "Authenticated users can view published training block templates"
  ON public.training_block_templates
  FOR SELECT TO authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "Authenticated users can view training block template days" ON public.training_block_template_days;
CREATE POLICY "Authenticated users can view training block template days"
  ON public.training_block_template_days
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.training_block_templates t
      WHERE t.id = template_id
        AND t.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view training block template sessions" ON public.training_block_template_sessions;
CREATE POLICY "Authenticated users can view training block template sessions"
  ON public.training_block_template_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.training_block_template_days d
      JOIN public.training_block_templates t ON t.id = d.template_id
      WHERE d.id = template_day_id
        AND t.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Users can manage their own training block enrollments" ON public.training_block_enrollments;
CREATE POLICY "Users can manage their own training block enrollments"
  ON public.training_block_enrollments
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own training block log reviews" ON public.training_block_log_reviews;
CREATE POLICY "Users can manage their own training block log reviews"
  ON public.training_block_log_reviews
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

DROP POLICY IF EXISTS "Service role can manage training block templates" ON public.training_block_templates;
CREATE POLICY "Service role can manage training block templates"
  ON public.training_block_templates
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage training block template days" ON public.training_block_template_days;
CREATE POLICY "Service role can manage training block template days"
  ON public.training_block_template_days
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage training block template sessions" ON public.training_block_template_sessions;
CREATE POLICY "Service role can manage training block template sessions"
  ON public.training_block_template_sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage training block enrollments" ON public.training_block_enrollments;
CREATE POLICY "Service role can manage training block enrollments"
  ON public.training_block_enrollments
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage training block log reviews" ON public.training_block_log_reviews;
CREATE POLICY "Service role can manage training block log reviews"
  ON public.training_block_log_reviews
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.training_block_templates (
  template_key,
  name,
  description,
  version,
  status,
  source,
  duration_weeks,
  default_start_date,
  metadata
)
VALUES (
  'rowing_12_week_2026_v1',
  '12-week Pete Block',
  'Local 12-week rowing block template used by Logbook Companion.',
  1,
  'published',
  'logbook_companion',
  12,
  '2026-07-06',
  '{"canonical_source":"src/data/rowingTrainingBlockTemplate.ts","template_storage":"static_snapshot"}'::jsonb
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  duration_weeks = EXCLUDED.duration_weeks,
  default_start_date = EXCLUDED.default_start_date,
  metadata = EXCLUDED.metadata,
  updated_at = now();
