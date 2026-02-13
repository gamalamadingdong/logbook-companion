-- Add athlete_id to daily_workout_assignments for coach-managed athletes (who may not have user accounts)
-- The existing user_id references user_profiles; athlete_id references the athletes table directly.

-- 1. Add athlete_id column
ALTER TABLE public.daily_workout_assignments
  ADD COLUMN IF NOT EXISTS athlete_id uuid REFERENCES public.athletes(id);

-- 2. Make user_id nullable (group assignments may have athletes without user accounts)
ALTER TABLE public.daily_workout_assignments
  ALTER COLUMN user_id DROP NOT NULL;

-- 3. Make day_of_week, week_number, and scheduled_workout nullable for group-assignment usage
--    (These are only meaningful for training-plan-driven assignments)
ALTER TABLE public.daily_workout_assignments
  ALTER COLUMN day_of_week DROP NOT NULL;

ALTER TABLE public.daily_workout_assignments
  ALTER COLUMN week_number DROP NOT NULL;

ALTER TABLE public.daily_workout_assignments
  ALTER COLUMN scheduled_workout DROP NOT NULL;

-- 4. Index for efficient lookups by athlete_id + group_assignment_id
CREATE INDEX IF NOT EXISTS idx_daily_workout_assignments_athlete_id
  ON public.daily_workout_assignments(athlete_id);

CREATE INDEX IF NOT EXISTS idx_daily_workout_assignments_group_assignment
  ON public.daily_workout_assignments(group_assignment_id);
