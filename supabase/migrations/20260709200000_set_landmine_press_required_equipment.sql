-- Mark canonical Landmine Press as strict equipment dependent.
-- This makes support-work compatibility checks require both:
--  - barbell
--  - landmine

UPDATE public.support_exercises
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{support_work_required_equipment}',
    to_jsonb(ARRAY['barbell', 'landmine']),
    true
)
WHERE name = 'Landmine Press'
  AND user_id IS NULL;
