-- Phase 1 durable state for docs/c2-background-sync-plan.md.
CREATE TABLE IF NOT EXISTS public.c2_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN (
      'queued',
      'running',
      'completed',
      'failed',
      'partial_success',
      'cancelled'
    )
  ),
  range text NOT NULL,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_page integer CHECK (current_page IS NULL OR current_page >= 0),
  total_pages integer CHECK (total_pages IS NULL OR total_pages >= 0),
  total_workouts integer CHECK (total_workouts IS NULL OR total_workouts >= 0),
  processed_count integer NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
  saved_count integer NOT NULL DEFAULT 0 CHECK (saved_count >= 0),
  skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_c2_sync_jobs_user_created
  ON public.c2_sync_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_c2_sync_jobs_user_status
  ON public.c2_sync_jobs (user_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_c2_sync_jobs_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_c2_sync_jobs_updated_at ON public.c2_sync_jobs;
CREATE TRIGGER trg_c2_sync_jobs_updated_at
  BEFORE UPDATE ON public.c2_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_c2_sync_jobs_updated_at();

ALTER TABLE public.c2_sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own C2 sync jobs" ON public.c2_sync_jobs;
CREATE POLICY "Users can view their own C2 sync jobs"
  ON public.c2_sync_jobs
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage C2 sync jobs" ON public.c2_sync_jobs;
CREATE POLICY "Service role can manage C2 sync jobs"
  ON public.c2_sync_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
