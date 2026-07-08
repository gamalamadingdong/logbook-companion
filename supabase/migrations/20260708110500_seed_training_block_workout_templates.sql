-- Ensure the 12-week rowing training block has reusable workout-template anchors.
-- Training block sessions remain scheduled prescriptions; these templates provide identity/matching links.

WITH seed AS (
  SELECT *
  FROM (VALUES
    ('8x500m/3:30r', '8 x 500m / 3:30r', 'VO2 interval anchor used in the 12-week rowing block.', 'erg', 'TR', 'interval_vo2max', 4000, true, false),
    ('250m + 500m + 750m + 1000m + 750m + 500m + 250m', '250-500-750-1000 Pyramid', 'Pyramid interval anchor used in the 12-week rowing block.', 'erg', 'TR', 'interval_mixed', 4000, true, false),
    ('4x1000m/5:00r', '4 x 1000m / 5:00r', 'One-kilometer interval anchor used in the 12-week rowing block.', 'erg', 'AT', 'interval_threshold', 4000, true, false),
    ('30:00@r20', '30 min rate 20', 'Low-rate steady pressure row used in the 12-week rowing block.', 'erg', 'UT1', 'low_rate_progression', 3000, false, false),
    ('60:00', '60 min row', 'Hour-of-power rowing prescription used in the 12-week rowing block.', 'erg', 'UT1', 'steady_state', 12000, false, false),
    ('3000m + 2000m + 1000m', '3000m / 2000m / 1000m cascade', 'Descending distance endurance interval used in the 12-week rowing block.', 'erg', 'AT', 'interval_threshold', 6000, true, false),
    ('2x5000m/6:00r', '2 x 5000m / 6:00r', 'Long endurance interval used late in the 12-week rowing block.', 'erg', 'UT1', 'interval_threshold', 10000, true, false),
    ('6000m', '6000m row', 'Six-kilometer rowing prescription used for flush and final benchmark options.', 'erg', 'UT1', 'steady_state', 6000, false, false),
    ('5x1500m/5:00r', '5 x 1500m / 5:00r', 'Thursday benchmark interval used in the 12-week rowing block.', 'erg', 'AT', 'interval_threshold', 7500, true, false),
    ('4x2000m/5:00r', '4 x 2000m / 5:00r', 'Two-kilometer interval benchmark used in the 12-week rowing block.', 'erg', 'AT', 'interval_threshold', 8000, true, false),
    ('3000m + 2500m + 2000m', '3000m / 2500m / 2000m', 'Endurance ladder benchmark used in the 12-week rowing block.', 'erg', 'AT', 'interval_threshold', 7500, true, false),
    ('3x2000m/5:00r', '3 x 2000m / 5:00r', 'Controlled two-kilometer repeat session used in the 12-week rowing block.', 'erg', 'AT', 'interval_threshold', 6000, true, false),
    ('3000m', '3000m row', 'Three-kilometer rowing prescription used as a light flush option.', 'erg', 'UT2', 'steady_state', 3000, false, false),
    ('4500m', '4500m row', 'Standard four-and-a-half-kilometer flush prescription.', 'erg', 'UT2', 'steady_state', 4500, false, false),
    ('8000m', '8000m steady row', 'Eight-kilometer steady row used in the 12-week rowing block.', 'erg', 'UT2', 'steady_state', 8000, false, false),
    ('10000m', '10000m steady row', 'Ten-kilometer steady row used in the 12-week rowing block.', 'erg', 'UT2', 'steady_state', 10000, false, false),
    ('Cross: 60:00', 'Cross-training 60 min', 'Sixty-minute aerobic cross-training prescription used in the 12-week rowing block.', 'cross_training', 'UT2', 'cross_training', NULL, false, false)
  ) AS s(canonical_name, name, description, workout_type, training_zone, workout_category, distance, is_interval, is_test)
),
inserted AS (
  INSERT INTO public.workout_templates (
    name,
    description,
    workout_type,
    technique_focus,
    coaching_points,
    pacing_guidance,
    estimated_duration,
    distance,
    difficulty_level,
    is_steady_state,
    is_test,
    is_interval,
    status,
    validated,
    training_zone,
    workout_category,
    tags,
    workout_structure,
    rwn,
    canonical_name
  )
  SELECT
    seed.name,
    seed.description,
    seed.workout_type,
    ARRAY['training block']::text[],
    ARRAY['Use the block-specific instructions on the scheduled training-block session.']::text[],
    'Follow the scheduled training-block target for pacing and intensity.',
    NULL::integer,
    seed.distance,
    'intermediate',
    seed.workout_category IN ('steady_state', 'low_rate_progression', 'cross_training'),
    seed.is_test,
    seed.is_interval,
    'published',
    true,
    seed.training_zone,
    seed.workout_category,
    ARRAY['training-block', 'rowing-12-week-2026']::text[],
    jsonb_build_object('source', 'training_block_seed', 'rwn', seed.canonical_name),
    seed.canonical_name,
    seed.canonical_name
  FROM seed
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.workout_templates existing
    WHERE existing.canonical_name = seed.canonical_name
      AND COALESCE(existing.validated, false) = true
      AND existing.status = 'published'
  )
  RETURNING id
),
target_template AS (
  SELECT id
  FROM public.training_block_templates
  WHERE template_key = 'rowing_12_week_2026_v1'
),
target_sessions AS (
  SELECT s.id, s.planned_rwn
  FROM public.training_block_template_sessions s
  JOIN public.training_block_template_days d ON d.id = s.template_day_id
  JOIN target_template t ON t.id = d.template_id
  WHERE s.source IN ('erg', 'cross_training')
    AND s.planned_rwn IS NOT NULL
),
best_template AS (
  SELECT DISTINCT ON (target_sessions.id)
    target_sessions.id AS session_id,
    wt.id AS workout_template_id
  FROM target_sessions
  JOIN public.workout_templates wt
    ON wt.canonical_name = target_sessions.planned_rwn
    OR wt.rwn = target_sessions.planned_rwn
  ORDER BY
    target_sessions.id,
    COALESCE(wt.validated, false) DESC,
    CASE WHEN wt.status = 'published' THEN 1 ELSE 0 END DESC,
    COALESCE(wt.usage_count, 0) DESC,
    wt.name ASC
)
UPDATE public.training_block_template_sessions s
SET
  workout_template_id = best_template.workout_template_id,
  metadata = COALESCE(s.metadata, '{}'::jsonb) || jsonb_build_object('library_match', 'seeded_template_anchor'),
  updated_at = now()
FROM best_template
WHERE s.id = best_template.session_id;
