-- Add stroke rate to assignment results
ALTER TABLE public.daily_workout_assignments
  ADD COLUMN IF NOT EXISTS result_stroke_rate integer;
