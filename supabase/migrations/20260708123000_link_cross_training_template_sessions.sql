-- Repair the 12-week rowing block cross-training template anchor and links.
-- This is intentionally forward-only because earlier seed migrations may already be applied.

WITH updated_existing_template AS (
  UPDATE public.workout_templates wt
  SET
    name = COALESCE(NULLIF(wt.name, ''), 'Cross-training 60 min'),
    description = COALESCE(NULLIF(wt.description, ''), 'Sixty-minute aerobic cross-training prescription used in the 12-week rowing block.'),
    workout_type = COALESCE(NULLIF(wt.workout_type, ''), 'cross_training'),
    technique_focus = COALESCE(wt.technique_focus, ARRAY['training block']::text[]),
    coaching_points = COALESCE(wt.coaching_points, ARRAY['Use the block-specific instructions on the scheduled training-block session.']::text[]),
    pacing_guidance = COALESCE(NULLIF(wt.pacing_guidance, ''), 'Follow the scheduled training-block target for pacing and intensity.'),
    estimated_duration = COALESCE(wt.estimated_duration, 60),
    difficulty_level = COALESCE(NULLIF(wt.difficulty_level, ''), 'intermediate'),
    is_steady_state = true,
    is_test = false,
    is_interval = false,
    status = 'published',
    validated = true,
    training_zone = COALESCE(NULLIF(wt.training_zone, ''), 'UT2'),
    workout_category = COALESCE(NULLIF(wt.workout_category, ''), 'cross_training'),
    tags = COALESCE(wt.tags, ARRAY[]::text[]) || ARRAY['training-block', 'rowing-12-week-2026']::text[],
    workout_structure = COALESCE(wt.workout_structure, '{}'::jsonb) || jsonb_build_object('source', 'training_block_seed', 'rwn', 'Cross: 60:00'),
    rwn = COALESCE(NULLIF(wt.rwn, ''), 'Cross: 60:00'),
    canonical_name = COALESCE(NULLIF(wt.canonical_name, ''), 'Cross: 60:00'),
    updated_at = now()
  WHERE wt.canonical_name = 'Cross: 60:00'
    OR wt.rwn = 'Cross: 60:00'
  RETURNING id
),
inserted_template AS (
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
    'Cross-training 60 min',
    'Sixty-minute aerobic cross-training prescription used in the 12-week rowing block.',
    'cross_training',
    ARRAY['training block']::text[],
    ARRAY['Use the block-specific instructions on the scheduled training-block session.']::text[],
    'Follow the scheduled training-block target for pacing and intensity.',
    60,
    NULL::integer,
    'intermediate',
    true,
    false,
    false,
    'published',
    true,
    'UT2',
    'cross_training',
    ARRAY['training-block', 'rowing-12-week-2026']::text[],
    jsonb_build_object('source', 'training_block_seed', 'rwn', 'Cross: 60:00'),
    'Cross: 60:00',
    'Cross: 60:00'
  WHERE NOT EXISTS (
    SELECT 1
    FROM updated_existing_template
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.workout_templates existing
    WHERE existing.canonical_name = 'Cross: 60:00'
       OR existing.rwn = 'Cross: 60:00'
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
  WHERE s.source = 'cross_training'
    AND s.planned_rwn = 'Cross: 60:00'
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
  metadata = COALESCE(s.metadata, '{}'::jsonb) || jsonb_build_object('library_match', 'seeded_cross_training_template_anchor'),
  updated_at = now()
FROM best_template
WHERE s.id = best_template.session_id;
