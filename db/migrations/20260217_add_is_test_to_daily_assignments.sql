-- Add is_test flag to daily_workout_assignments
-- When true, the assignment result is treated as a formal test/baseline
-- and auto-synced to coaching_erg_scores for PR tracking + training zone calculation
ALTER TABLE daily_workout_assignments
ADD COLUMN is_test boolean NOT NULL DEFAULT false;
