-- Revert unmerged `create_c2_sync_jobs` migration from PR #40.
-- This removes only the database objects added in that migration.

DROP POLICY IF EXISTS "Service role can manage C2 sync jobs" ON public.c2_sync_jobs;
DROP POLICY IF EXISTS "Users can view their own C2 sync jobs" ON public.c2_sync_jobs;

DROP INDEX IF EXISTS public.idx_c2_sync_jobs_user_created;
DROP INDEX IF EXISTS public.idx_c2_sync_jobs_user_status;

DROP TRIGGER IF EXISTS trg_c2_sync_jobs_updated_at ON public.c2_sync_jobs;
DROP FUNCTION IF EXISTS public.update_c2_sync_jobs_updated_at();

DROP TABLE IF EXISTS public.c2_sync_jobs CASCADE;
