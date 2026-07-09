-- Tighten compatibility for explicitly weighted support exercises.
-- Weighted variants should require their load item in addition to bodyweight.

UPDATE public.support_exercises
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{support_work_required_equipment}',
    to_jsonb(ARRAY['bodyweight', 'weight']),
    true
)
WHERE name = 'Weighted Pull-Up'
  AND user_id IS NULL;
