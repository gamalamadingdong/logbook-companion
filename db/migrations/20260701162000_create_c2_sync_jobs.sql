-- Durable Concept2 background sync jobs.

CREATE TABLE IF NOT EXISTS public.c2_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'running', 'succeeded', 'failed', 'canceled')
  ),
  source text NOT NULL DEFAULT 'concept2' CHECK (source = 'concept2'),
  requested_from date,
  requested_to date,
  started_at timestamptz,
  finished_at timestamptz,
  last_processed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT c2_sync_jobs_requested_range_check
    CHECK (requested_from IS NULL OR requested_to IS NULL OR requested_from <= requested_to),
  CONSTRAINT c2_sync_jobs_finished_terminal_check
    CHECK (finished_at IS NULL OR status IN ('succeeded', 'failed', 'canceled'))
);

CREATE INDEX IF NOT EXISTS idx_c2_sync_jobs_user_created
  ON public.c2_sync_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_c2_sync_jobs_user_status
  ON public.c2_sync_jobs (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_c2_sync_jobs_queue
  ON public.c2_sync_jobs (status, created_at)
  WHERE status IN ('queued', 'running');

CREATE OR REPLACE FUNCTION public.update_c2_sync_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_c2_sync_jobs_updated_at ON public.c2_sync_jobs;
CREATE TRIGGER trg_c2_sync_jobs_updated_at
BEFORE UPDATE ON public.c2_sync_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_c2_sync_jobs_updated_at();

ALTER TABLE public.c2_sync_jobs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.c2_sync_jobs TO authenticated;
GRANT ALL ON public.c2_sync_jobs TO service_role;

DROP POLICY IF EXISTS "Users can view their own C2 sync jobs" ON public.c2_sync_jobs;
CREATE POLICY "Users can view their own C2 sync jobs"
  ON public.c2_sync_jobs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage C2 sync jobs" ON public.c2_sync_jobs;
CREATE POLICY "Service role can manage C2 sync jobs"
  ON public.c2_sync_jobs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.c2_sync_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.c2_sync_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'processing', 'succeeded', 'skipped_existing', 'skipped_filtered', 'failed')
  ),
  error_code text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT c2_sync_job_items_unique_workout UNIQUE (job_id, external_id),
  CONSTRAINT c2_sync_job_items_finished_terminal_check
    CHECK (
      finished_at IS NULL
      OR status IN ('succeeded', 'skipped_existing', 'skipped_filtered', 'failed')
    )
);

CREATE INDEX IF NOT EXISTS idx_c2_sync_job_items_job_status
  ON public.c2_sync_job_items (job_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_c2_sync_job_items_user_created
  ON public.c2_sync_job_items (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_c2_sync_job_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_c2_sync_job_items_updated_at ON public.c2_sync_job_items;
CREATE TRIGGER trg_c2_sync_job_items_updated_at
BEFORE UPDATE ON public.c2_sync_job_items
FOR EACH ROW
EXECUTE FUNCTION public.update_c2_sync_job_items_updated_at();

ALTER TABLE public.c2_sync_job_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.c2_sync_job_items TO authenticated;
GRANT ALL ON public.c2_sync_job_items TO service_role;

DROP POLICY IF EXISTS "Users can view their own C2 sync job items" ON public.c2_sync_job_items;
CREATE POLICY "Users can view their own C2 sync job items"
  ON public.c2_sync_job_items
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage C2 sync job items" ON public.c2_sync_job_items;
CREATE POLICY "Service role can manage C2 sync job items"
  ON public.c2_sync_job_items
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
