-- Allow users to save a future training block without replacing the current active block.
ALTER TABLE public.training_block_enrollments
DROP CONSTRAINT IF EXISTS training_block_enrollments_status_check;

ALTER TABLE public.training_block_enrollments
ADD CONSTRAINT training_block_enrollments_status_check
CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived'));

CREATE INDEX IF NOT EXISTS idx_training_block_enrollments_user_status_start
  ON public.training_block_enrollments (user_id, status, start_date)
  WHERE team_id IS NULL AND org_id IS NULL;
