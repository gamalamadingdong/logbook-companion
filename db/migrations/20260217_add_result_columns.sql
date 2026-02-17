-- Add lightweight result columns for coach quick-entry of workout data
-- Keeps time/distance/split at the assignment level, plus JSONB for interval breakdown

ALTER TABLE public.daily_workout_assignments
  ADD COLUMN IF NOT EXISTS result_time_seconds numeric,
  ADD COLUMN IF NOT EXISTS result_distance_meters numeric,
  ADD COLUMN IF NOT EXISTS result_split_seconds numeric,
  ADD COLUMN IF NOT EXISTS result_intervals jsonb;
-- result_intervals schema: [{ "rep": 1, "time_seconds": 240, "distance_meters": 1000, "split_seconds": 120 }, ...]

COMMENT ON COLUMN public.daily_workout_assignments.result_intervals IS
  'Array of interval results: [{ rep, time_seconds, distance_meters, split_seconds }]';
