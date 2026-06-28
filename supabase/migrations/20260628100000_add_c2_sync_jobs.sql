-- Durable Concept2 sync job tracking.
-- Adds c2_sync_jobs and optional c2_sync_job_items for parser-safe monitoring and resumable background sync.
CREATE TABLE IF NOT EXISTS public.c2_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (
    status IN ('queued', 'running', 'completed', 'failed', 'partial_success', 'cancelled')
  ),
  range text NOT NULL CHECK (range IN ('30days', 'season', 'all', 'custom')),
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_page integer NOT NULL DEFAULT 0,
  total_pages integer,
  total_workouts integer,
  processed_count integer NOT NULL DEFAULT 0,
  saved_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_c2_sync_jobs_user_created
  ON public.c2_sync_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_c2_sync_jobs_user_status
  ON public.c2_sync_jobs (user_id, status);

ALTER TABLE public.c2_sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own C2 sync jobs" ON public.c2_sync_jobs;
CREATE POLICY "Users can view their own C2 sync jobs"
  ON public.c2_sync_jobs
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage C2 sync jobs" ON public.c2_sync_jobs;
CREATE POLICY "Service role can manage C2 sync jobs"
  ON public.c2_sync_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_c2_sync_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_c2_sync_jobs_updated_at ON public.c2_sync_jobs;
CREATE TRIGGER trg_c2_sync_jobs_updated_at
  BEFORE UPDATE ON public.c2_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_c2_sync_jobs_updated_at();

-- Optional per-result-item progress tracking for diagnostics and partial-failure reporting.
CREATE TABLE IF NOT EXISTS public.c2_sync_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.c2_sync_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  status text NOT NULL CHECK (
    status IN ('queued', 'processing', 'saved', 'skipped', 'failed')
  ),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_c2_sync_job_items_job_created
  ON public.c2_sync_job_items (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_c2_sync_job_items_user_status
  ON public.c2_sync_job_items (user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_c2_sync_job_items_job_external
  ON public.c2_sync_job_items (job_id, external_id);

ALTER TABLE public.c2_sync_job_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own C2 sync job items" ON public.c2_sync_job_items;
CREATE POLICY "Users can view their own C2 sync job items"
  ON public.c2_sync_job_items
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage C2 sync job items" ON public.c2_sync_job_items;
CREATE POLICY "Service role can manage C2 sync job items"
  ON public.c2_sync_job_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_c2_sync_job_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_c2_sync_job_items_updated_at ON public.c2_sync_job_items;
CREATE TRIGGER trg_c2_sync_job_items_updated_at
  BEFORE UPDATE ON public.c2_sync_job_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_c2_sync_job_items_updated_at();
