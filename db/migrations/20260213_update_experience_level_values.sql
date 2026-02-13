-- Update experience_level from program-tier labels to skill-based labels
-- Old: novice, freshman, jv, varsity
-- New: beginner, intermediate, experienced, advanced

-- 1. Drop old constraint first (can't UPDATE while it's enforcing old values)
ALTER TABLE public.athletes DROP CONSTRAINT IF EXISTS athletes_experience_level_check;

-- 2. Migrate existing data
UPDATE public.athletes SET experience_level = 'beginner'     WHERE experience_level = 'novice';
UPDATE public.athletes SET experience_level = 'intermediate' WHERE experience_level = 'freshman';
UPDATE public.athletes SET experience_level = 'experienced'  WHERE experience_level = 'jv';
UPDATE public.athletes SET experience_level = 'advanced'     WHERE experience_level = 'varsity';

-- 3. Add new constraint
ALTER TABLE public.athletes ADD CONSTRAINT athletes_experience_level_check
  CHECK (experience_level IS NULL OR experience_level = ANY (ARRAY['beginner','intermediate','experienced','advanced']));
