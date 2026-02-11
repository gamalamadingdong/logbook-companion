-- Update side constraint to include 'coxswain'
ALTER TABLE public.coaching_athletes DROP CONSTRAINT coaching_athletes_side_check;
ALTER TABLE public.coaching_athletes ADD CONSTRAINT coaching_athletes_side_check
  CHECK (side IS NULL OR side = ANY (ARRAY['port','starboard','coxswain','both']));

-- Update experience_level constraint: novice, freshman, jv, varsity
-- Migrate existing data
UPDATE public.coaching_athletes SET experience_level = 'freshman' WHERE experience_level = 'intermediate';
UPDATE public.coaching_athletes SET experience_level = 'varsity'  WHERE experience_level = 'experienced';

ALTER TABLE public.coaching_athletes DROP CONSTRAINT coaching_athletes_experience_level_check;
ALTER TABLE public.coaching_athletes ADD CONSTRAINT coaching_athletes_experience_level_check
  CHECK (experience_level IS NULL OR experience_level = ANY (ARRAY['novice','freshman','jv','varsity']));
