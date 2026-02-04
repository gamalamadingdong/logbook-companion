-- Remove unique constraint on signature_workout
-- Multiple templates can have the same canonical structure but serve different purposes
-- (e.g., "2000m" as a test workout vs as part of training)

ALTER TABLE workout_templates
DROP CONSTRAINT IF EXISTS unique_signature_workout;
