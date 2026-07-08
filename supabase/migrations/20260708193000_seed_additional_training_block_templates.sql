-- Seed additional published training-block templates from the local KB training plans.
-- These remain template-first enrollment options, not custom block editor data.

WITH template_seed(template_key, name, description, duration_weeks, kb_source) AS (
  VALUES
    ('beginner_2k_8_week_v1', 'Beginner 2k 8-week', 'KB-backed beginner indoor rowing progression for confidently completing a 2000m row.', 8, 'kb/training-plans/2km-Beginner-training-plan.optimized.md'),
    ('intermediate_2k_8_week_v1', 'Intermediate 2k 8-week', 'KB-backed intermediate indoor rowing progression for improving 2000m performance with three weekly sessions.', 8, 'kb/training-plans/2km-Intermediate-training-plan.optimized.md')
)
INSERT INTO public.training_block_templates (
  template_key, name, description, version, status, source, duration_weeks, default_start_date, metadata
)
SELECT
  template_key, name, description, 1, 'published', 'logbook_companion', duration_weeks, '2026-07-06'::date,
  jsonb_build_object('seed', 'additional_blocks_v1', 'kb_source', kb_source, 'content_standard', 'persisted_days_sessions_workout_template_anchors')
FROM template_seed
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  duration_weeks = EXCLUDED.duration_weeks,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  default_start_date = EXCLUDED.default_start_date,
  metadata = COALESCE(training_block_templates.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();

WITH target_templates AS (
  SELECT id FROM public.training_block_templates WHERE template_key IN ('beginner_2k_8_week_v1', 'intermediate_2k_8_week_v1')
)
DELETE FROM public.training_block_template_days d
USING target_templates t
WHERE d.template_id = t.id;

WITH day_seed(template_key, week_number, day_slot, day_of_week, category, planned_distance_meters, target_distance_meters) AS (
  VALUES
    ('beginner_2k_8_week_v1', 1, 0, 'Monday', 'erg', 0, 0),
    ('beginner_2k_8_week_v1', 1, 1, 'Tuesday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 1, 2, 'Wednesday', 'erg', 0, 0),
    ('beginner_2k_8_week_v1', 1, 3, 'Thursday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 1, 4, 'Friday', 'cross_training', 0, 0),
    ('beginner_2k_8_week_v1', 1, 5, 'Saturday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 1, 6, 'Sunday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 2, 0, 'Monday', 'erg', 0, 0),
    ('beginner_2k_8_week_v1', 2, 1, 'Tuesday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 2, 2, 'Wednesday', 'erg', 0, 0),
    ('beginner_2k_8_week_v1', 2, 3, 'Thursday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 2, 4, 'Friday', 'cross_training', 0, 0),
    ('beginner_2k_8_week_v1', 2, 5, 'Saturday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 2, 6, 'Sunday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 3, 0, 'Monday', 'erg', 2000, 2000),
    ('beginner_2k_8_week_v1', 3, 1, 'Tuesday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 3, 2, 'Wednesday', 'erg', 0, 0),
    ('beginner_2k_8_week_v1', 3, 3, 'Thursday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 3, 4, 'Friday', 'cross_training', 0, 0),
    ('beginner_2k_8_week_v1', 3, 5, 'Saturday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 3, 6, 'Sunday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 4, 0, 'Monday', 'erg', 2000, 2000),
    ('beginner_2k_8_week_v1', 4, 1, 'Tuesday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 4, 2, 'Wednesday', 'erg', 0, 0),
    ('beginner_2k_8_week_v1', 4, 3, 'Thursday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 4, 4, 'Friday', 'cross_training', 0, 0),
    ('beginner_2k_8_week_v1', 4, 5, 'Saturday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 4, 6, 'Sunday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 5, 0, 'Monday', 'erg', 0, 0),
    ('beginner_2k_8_week_v1', 5, 1, 'Tuesday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 5, 2, 'Wednesday', 'erg', 2000, 2000),
    ('beginner_2k_8_week_v1', 5, 3, 'Thursday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 5, 4, 'Friday', 'cross_training', 0, 0),
    ('beginner_2k_8_week_v1', 5, 5, 'Saturday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 5, 6, 'Sunday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 6, 0, 'Monday', 'erg', 0, 0),
    ('beginner_2k_8_week_v1', 6, 1, 'Tuesday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 6, 2, 'Wednesday', 'erg', 2000, 2000),
    ('beginner_2k_8_week_v1', 6, 3, 'Thursday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 6, 4, 'Friday', 'cross_training', 0, 0),
    ('beginner_2k_8_week_v1', 6, 5, 'Saturday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 6, 6, 'Sunday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 7, 0, 'Monday', 'erg', 2000, 2000),
    ('beginner_2k_8_week_v1', 7, 1, 'Tuesday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 7, 2, 'Wednesday', 'erg', 0, 0),
    ('beginner_2k_8_week_v1', 7, 3, 'Thursday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 7, 4, 'Friday', 'cross_training', 0, 0),
    ('beginner_2k_8_week_v1', 7, 5, 'Saturday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 7, 6, 'Sunday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 8, 0, 'Monday', 'erg', 0, 0),
    ('beginner_2k_8_week_v1', 8, 1, 'Tuesday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 8, 2, 'Wednesday', 'erg', 2000, 2000),
    ('beginner_2k_8_week_v1', 8, 3, 'Thursday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 8, 4, 'Friday', 'cross_training', 0, 0),
    ('beginner_2k_8_week_v1', 8, 5, 'Saturday', 'rest', 0, 0),
    ('beginner_2k_8_week_v1', 8, 6, 'Sunday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 1, 0, 'Monday', 'erg', 0, 0),
    ('intermediate_2k_8_week_v1', 1, 1, 'Tuesday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 1, 2, 'Wednesday', 'erg', 0, 0),
    ('intermediate_2k_8_week_v1', 1, 3, 'Thursday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 1, 4, 'Friday', 'cross_training', 0, 0),
    ('intermediate_2k_8_week_v1', 1, 5, 'Saturday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 1, 6, 'Sunday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 2, 0, 'Monday', 'erg', 0, 0),
    ('intermediate_2k_8_week_v1', 2, 1, 'Tuesday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 2, 2, 'Wednesday', 'erg', 0, 0),
    ('intermediate_2k_8_week_v1', 2, 3, 'Thursday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 2, 4, 'Friday', 'cross_training', 0, 0),
    ('intermediate_2k_8_week_v1', 2, 5, 'Saturday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 2, 6, 'Sunday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 3, 0, 'Monday', 'erg', 0, 0),
    ('intermediate_2k_8_week_v1', 3, 1, 'Tuesday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 3, 2, 'Wednesday', 'erg', 0, 0),
    ('intermediate_2k_8_week_v1', 3, 3, 'Thursday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 3, 4, 'Friday', 'cross_training', 0, 0),
    ('intermediate_2k_8_week_v1', 3, 5, 'Saturday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 3, 6, 'Sunday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 4, 0, 'Monday', 'erg', 0, 0),
    ('intermediate_2k_8_week_v1', 4, 1, 'Tuesday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 4, 2, 'Wednesday', 'erg', 0, 0),
    ('intermediate_2k_8_week_v1', 4, 3, 'Thursday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 4, 4, 'Friday', 'cross_training', 0, 0),
    ('intermediate_2k_8_week_v1', 4, 5, 'Saturday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 4, 6, 'Sunday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 5, 0, 'Monday', 'erg', 0, 0),
    ('intermediate_2k_8_week_v1', 5, 1, 'Tuesday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 5, 2, 'Wednesday', 'erg', 2000, 2000),
    ('intermediate_2k_8_week_v1', 5, 3, 'Thursday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 5, 4, 'Friday', 'cross_training', 0, 0),
    ('intermediate_2k_8_week_v1', 5, 5, 'Saturday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 5, 6, 'Sunday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 6, 0, 'Monday', 'erg', 0, 0),
    ('intermediate_2k_8_week_v1', 6, 1, 'Tuesday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 6, 2, 'Wednesday', 'erg', 0, 0),
    ('intermediate_2k_8_week_v1', 6, 3, 'Thursday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 6, 4, 'Friday', 'cross_training', 0, 0),
    ('intermediate_2k_8_week_v1', 6, 5, 'Saturday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 6, 6, 'Sunday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 7, 0, 'Monday', 'erg', 0, 0),
    ('intermediate_2k_8_week_v1', 7, 1, 'Tuesday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 7, 2, 'Wednesday', 'erg', 2000, 2000),
    ('intermediate_2k_8_week_v1', 7, 3, 'Thursday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 7, 4, 'Friday', 'cross_training', 0, 0),
    ('intermediate_2k_8_week_v1', 7, 5, 'Saturday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 7, 6, 'Sunday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 8, 0, 'Monday', 'erg', 2000, 2000),
    ('intermediate_2k_8_week_v1', 8, 1, 'Tuesday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 8, 2, 'Wednesday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 8, 3, 'Thursday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 8, 4, 'Friday', 'cross_training', 0, 0),
    ('intermediate_2k_8_week_v1', 8, 5, 'Saturday', 'rest', 0, 0),
    ('intermediate_2k_8_week_v1', 8, 6, 'Sunday', 'rest', 0, 0)
)
INSERT INTO public.training_block_template_days (
  template_id, week_number, day_slot, day_of_week, category, planned_distance_meters, target_distance_meters, reference, metadata
)
SELECT
  t.id, d.week_number, d.day_slot, d.day_of_week, d.category, d.planned_distance_meters, d.target_distance_meters,
  jsonb_build_object('template_key', d.template_key, 'week', d.week_number, 'day_slot', d.day_slot),
  jsonb_build_object('seed', 'additional_blocks_v1')
FROM day_seed d
JOIN public.training_block_templates t ON t.template_key = d.template_key;

WITH anchor_seed(canonical_name, name, description, workout_type, training_zone, workout_category, distance, estimated_duration, is_interval, is_test) AS (
  VALUES
    ('1 min @ 26-28, 1 min rest x 3; 3 min rest; 1 min @ 24-26, 1 min rest x 3', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'TR', 'interval_mixed', NULL, 6, true, false),
    ('1 min high, 1 min rest x 6', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'TR', 'interval_mixed', NULL, 6, true, false),
    ('1 min low, 1 min rest x 5', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT2', 'interval_mixed', NULL, 5, true, false),
    ('1 min row, 1 min rest x 3; 2 min rest; 1 min row, 1 min rest x 3', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'UT1', 'interval_mixed', NULL, 6, true, false),
    ('1 min row, 1 min rest x 3; 3 min rest; 1 min row, 1 min rest x 3', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'TR', 'interval_mixed', NULL, 6, true, false),
    ('1 min row, 90s rest x 3; 2 min rest; 1 min row, 90s rest x 3', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'TR', 'interval_mixed', NULL, 6, true, false),
    ('1 min row, 90s rest x 3; 3 min rest; 1 min row, 90s rest x 3', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'TR', 'interval_mixed', NULL, 6, true, false),
    ('10 min jog/walk, 1 min on/off', 'Fitness boost', 'Fitness boost anchor from KB training plan seed.', 'cross_training', 'UT2', 'cross_training', NULL, 10, false, false),
    ('10 min row: 2 low / 2 medium / 1 high / 2 medium / 3 low, 5 min rest x 2', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'UT1', 'steady_state', NULL, 20, false, false),
    ('10 min row: 5 min low, 5 min medium', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'UT2', 'steady_state', NULL, 10, false, false),
    ('1000m medium with 10-stroke high burst every other minute, 5 min rest x 2', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'TR', 'interval_mixed', 2000, NULL, true, false),
    ('1000m medium, 5 min rest x 2', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT2', 'interval_mixed', 2000, NULL, true, false),
    ('1000m row, 2.5 min rest, 1000m row', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'UT1', 'test', 2000, NULL, false, true),
    ('1000m row, 4 min rest, 1000m row', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'UT1', 'test', 2000, NULL, false, true),
    ('15 min jog/walk, 1 min on/off', 'Fitness boost', 'Fitness boost anchor from KB training plan seed.', 'cross_training', 'UT2', 'cross_training', NULL, 15, false, false),
    ('15 min row: 3 low / 3 medium / 3 low / 3 medium / 3 low', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'UT2', 'steady_state', NULL, 15, false, false),
    ('2 min @ 20 SPM, 2 min @ 22, 2 min @ 24, 2 min @ 22, 2 min @ 20', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT1', 'low_rate_progression', NULL, 10, false, false),
    ('2 min @ 20, 2 min @ 22, 2 min @ 24, 1 min @ 26, 2 min @ 24, 2 min @ 22, 2 min @ 20', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT1', 'low_rate_progression', NULL, 13, false, false),
    ('2 min @ 20, 2 min @ 22, 2 min @ 24, 2 min @ 24, 2 min @ 22, 2 min @ 20', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT1', 'low_rate_progression', NULL, 12, false, false),
    ('2 min @ 20, 2 min @ 22, 2 min @ 24, 2 min @ 26, 2 min @ 24, 2 min @ 22, 2 min @ 20', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT1', 'low_rate_progression', NULL, 14, false, false),
    ('2 min low, 1 min rest x 5', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT2', 'interval_mixed', NULL, 10, true, false),
    ('20 min jog/walk, 1 min on/off', 'Fitness boost', 'Fitness boost anchor from KB training plan seed.', 'cross_training', 'UT2', 'cross_training', NULL, 20, false, false),
    ('20 min jog/walk, 2 min on / 1 min off', 'Fitness boost', 'Fitness boost anchor from KB training plan seed.', 'cross_training', 'UT2', 'cross_training', NULL, 20, false, false),
    ('20 min jog/walk, 3 min on / 1 min off', 'Fitness boost', 'Fitness boost anchor from KB training plan seed.', 'cross_training', 'UT2', 'cross_training', NULL, 20, false, false),
    ('2000m row', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT1', 'test', 2000, NULL, false, true),
    ('2000m row - note time', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'UT1', 'test', 2000, NULL, false, true),
    ('25 min jog/walk, 3 min on / 1 min off', 'Fitness boost', 'Fitness boost anchor from KB training plan seed.', 'cross_training', 'UT2', 'cross_training', NULL, 25, false, false),
    ('25 min jog/walk, 4 min on / 1 min off', 'Fitness boost', 'Fitness boost anchor from KB training plan seed.', 'cross_training', 'UT2', 'cross_training', NULL, 25, false, false),
    ('3 min @ 20, 2 min @ 22, 1 min @ 24, 1 min @ 26, 1 min @ 24, 2 min @ 22, 3 min @ 20', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT1', 'low_rate_progression', NULL, 13, false, false),
    ('3 min @ 20, 3 min @ 22, 2 min @ 24, 3 min @ 22, 3 min @ 20', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT1', 'low_rate_progression', NULL, 14, false, false),
    ('3 min @ 20, 3 min @ 22, 3 min @ 24, 3 min @ 22, 3 min @ 20', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT1', 'low_rate_progression', NULL, 15, false, false),
    ('30 min jog/walk, 4 min on / 1 min off', 'Fitness boost', 'Fitness boost anchor from KB training plan seed.', 'cross_training', 'UT2', 'cross_training', NULL, 30, false, false),
    ('30 strokes low + 10 strokes medium burst x 5', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT2', 'interval_mixed', NULL, 12, true, false),
    ('5 min low, 3 min rest x 2', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'UT2', 'steady_state', NULL, 10, false, false),
    ('5 min low, 3 min rest x 3', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'UT2', 'steady_state', NULL, 15, false, false),
    ('5 min medium, 3 min rest x 4', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'TR', 'interval_mixed', NULL, 20, true, false),
    ('500m medium, 1000m medium, 500m high, 2 min rest between', 'Session 2', 'Session 2 anchor from KB training plan seed.', 'erg', 'UT1', 'steady_state', 2000, NULL, false, false),
    ('500m medium, 2 min rest x 4', 'Session 1', 'Session 1 anchor from KB training plan seed.', 'erg', 'UT2', 'interval_mixed', 2000, NULL, true, false),
    ('Cross: 15:00', 'Cross-training', 'Cross-training anchor from KB training plan seed.', 'cross_training', 'UT2', 'cross_training', NULL, 15, false, false)
)
INSERT INTO public.workout_templates (
  name, description, workout_type, technique_focus, coaching_points, pacing_guidance, estimated_duration, distance,
  difficulty_level, is_steady_state, is_test, is_interval, status, validated, training_zone, workout_category,
  tags, workout_structure, rwn, canonical_name
)
SELECT
  a.name, a.description, a.workout_type,
  ARRAY['training block']::text[],
  ARRAY['Use the block-specific instructions on the scheduled training-block session.']::text[],
  'Follow the scheduled training-block target for pacing and intensity.',
  a.estimated_duration, a.distance,
  'beginner',
  a.workout_category IN ('steady_state', 'cross_training', 'low_rate_progression'),
  a.is_test, a.is_interval,
  'published', true, a.training_zone, a.workout_category,
  ARRAY['training-block', 'kb-training-plan']::text[],
  jsonb_build_object('source', 'kb_training_plan_seed', 'rwn', a.canonical_name),
  a.canonical_name, a.canonical_name
FROM anchor_seed a
WHERE NOT EXISTS (
  SELECT 1 FROM public.workout_templates existing
  WHERE existing.canonical_name = a.canonical_name
    AND COALESCE(existing.validated, false) = true
    AND existing.status = 'published'
);

WITH session_seed(
  template_key, week_number, day_slot, session_key, title, planned_rwn, support_prescription, family, role, source,
  expected_distance_meters, expected_duration_minutes, instructions, counts_toward_weekly_volume, is_key_session, sort_order, metadata
) AS (
  VALUES
    ('beginner_2k_8_week_v1', 1, 0, 'session_1', 'Session 1', '1 min low, 1 min rest x 5', NULL::jsonb, 'beginner_2k_progression', 'primary_row', 'erg', NULL, 5, ARRAY['Keep intensity low and technique clean.', 'Rest fully between one-minute rows.']::text[], true, true, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 1, 2, 'session_2', 'Session 2', '5 min low, 3 min rest x 2', NULL::jsonb, 'beginner_2k_progression', 'secondary_row', 'erg', NULL, 10, ARRAY['Low intensity only.', 'Focus on stroke sequence and relaxed recovery.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 1, 4, 'fitness_boost', 'Fitness boost', '10 min jog/walk, 1 min on/off', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 10, ARRAY['Use jog/walk or equivalent low-impact cardio.', 'Keep this supplemental and sustainable.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 1, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 1, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 1, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 1, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 2, 0, 'session_1', 'Session 1', '2 min low, 1 min rest x 5', NULL::jsonb, 'beginner_2k_progression', 'primary_row', 'erg', NULL, 10, ARRAY['Smooth rowing with powerful drive and slow recovery.', 'Keep every piece low intensity.']::text[], true, true, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 2, 2, 'session_2', 'Session 2', '5 min low, 3 min rest x 3', NULL::jsonb, 'beginner_2k_progression', 'secondary_row', 'erg', NULL, 15, ARRAY['Build duration without chasing speed.', 'Maintain consistent stroke shape.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 2, 4, 'fitness_boost', 'Fitness boost', '15 min jog/walk, 1 min on/off', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 15, ARRAY['Use jog/walk or equivalent low-impact cardio.', 'Keep this supplemental and sustainable.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 2, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 2, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 2, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 2, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 3, 0, 'session_1', 'Session 1', '500m medium, 2 min rest x 4', NULL::jsonb, 'beginner_2k_progression', 'primary_row', 'erg', 2000, NULL, ARRAY['Medium intensity.', 'Record all 500m times for later pacing.']::text[], true, true, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 3, 2, 'session_2', 'Session 2', '10 min row: 5 min low, 5 min medium', NULL::jsonb, 'beginner_2k_progression', 'secondary_row', 'erg', NULL, 10, ARRAY['First half low, second half medium.', 'Keep rate and split consistent.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 3, 4, 'fitness_boost', 'Fitness boost', '20 min jog/walk, 1 min on/off', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 20, ARRAY['Use jog/walk or equivalent low-impact cardio.', 'Keep this supplemental and sustainable.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 3, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 3, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 3, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 3, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 4, 0, 'session_1', 'Session 1', '1000m medium, 5 min rest x 2', NULL::jsonb, 'beginner_2k_progression', 'primary_row', 'erg', 2000, NULL, ARRAY['Medium intensity distance work.', 'Keep technique controlled as fatigue builds.']::text[], true, true, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 4, 2, 'session_2', 'Session 2', '15 min row: 3 low / 3 medium / 3 low / 3 medium / 3 low', NULL::jsonb, 'beginner_2k_progression', 'secondary_row', 'erg', NULL, 15, ARRAY['Alternate low and medium work as prescribed.', 'Stay relaxed on the recovery.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 4, 4, 'fitness_boost', 'Fitness boost', '20 min jog/walk, 2 min on / 1 min off', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 20, ARRAY['Use jog/walk or equivalent low-impact cardio.', 'Keep this supplemental and sustainable.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 4, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 4, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 4, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 4, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 5, 0, 'session_1', 'Session 1', '30 strokes low + 10 strokes medium burst x 5', NULL::jsonb, 'beginner_2k_progression', 'primary_row', 'erg', NULL, 12, ARRAY['Keep low strokes technically clean.', 'Medium bursts should be controlled, not maximal.']::text[], true, true, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 5, 2, 'session_2', 'Session 2', '2000m row - note time', NULL::jsonb, 'beginner_2k_progression', 'secondary_row', 'erg', 2000, NULL, ARRAY['First complete 2k at medium intensity.', 'Use Week 3 500m times plus 20 seconds total to estimate target pace.']::text[], true, true, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 5, 4, 'fitness_boost', 'Fitness boost', '20 min jog/walk, 3 min on / 1 min off', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 20, ARRAY['Use jog/walk or equivalent low-impact cardio.', 'Keep this supplemental and sustainable.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 5, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 5, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 5, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 5, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 6, 0, 'session_1', 'Session 1', '1 min high, 1 min rest x 6', NULL::jsonb, 'beginner_2k_progression', 'primary_row', 'erg', NULL, 6, ARRAY['High-intensity introduction.', 'Stop chasing split if technique falls apart.']::text[], true, true, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 6, 2, 'session_2', 'Session 2', '500m medium, 2 min rest x 4', NULL::jsonb, 'beginner_2k_progression', 'secondary_row', 'erg', 2000, NULL, ARRAY['Compare times to Week 3.', 'Aim for consistent splits across all four reps.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 6, 4, 'fitness_boost', 'Fitness boost', '25 min jog/walk, 3 min on / 1 min off', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 25, ARRAY['Use jog/walk or equivalent low-impact cardio.', 'Keep this supplemental and sustainable.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 6, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 6, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 6, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 6, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 7, 0, 'session_1', 'Session 1', '1000m medium with 10-stroke high burst every other minute, 5 min rest x 2', NULL::jsonb, 'beginner_2k_progression', 'primary_row', 'erg', 2000, NULL, ARRAY['Medium base effort with short high bursts.', 'Maintain form when tired.']::text[], true, true, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 7, 2, 'session_2', 'Session 2', '10 min row: 2 low / 2 medium / 1 high / 2 medium / 3 low, 5 min rest x 2', NULL::jsonb, 'beginner_2k_progression', 'secondary_row', 'erg', NULL, 20, ARRAY['Execute the full varied pattern twice.', 'Control technique when intensity changes.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 7, 4, 'fitness_boost', 'Fitness boost', '25 min jog/walk, 4 min on / 1 min off', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 25, ARRAY['Use jog/walk or equivalent low-impact cardio.', 'Keep this supplemental and sustainable.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 7, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 7, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 7, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 7, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 8, 0, 'session_1', 'Session 1', '5 min medium, 3 min rest x 4', NULL::jsonb, 'beginner_2k_progression', 'primary_row', 'erg', NULL, 20, ARRAY['Medium intensity repeat work.', 'Compare control and consistency to earlier weeks.']::text[], true, true, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 8, 2, 'session_2', 'Session 2', '500m medium, 1000m medium, 500m high, 2 min rest between', NULL::jsonb, 'beginner_2k_progression', 'secondary_row', 'erg', 2000, NULL, ARRAY['Final test-style broken 2k.', 'Finish the last 500m high while preserving technique.']::text[], true, true, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 8, 4, 'fitness_boost', 'Fitness boost', '30 min jog/walk, 4 min on / 1 min off', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 30, ARRAY['Use jog/walk or equivalent low-impact cardio.', 'Keep this supplemental and sustainable.']::text[], true, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 8, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 8, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 8, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('beginner_2k_8_week_v1', 8, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Beginner-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 1, 0, 'session_1', 'Session 1', '2 min @ 20 SPM, 2 min @ 22, 2 min @ 24, 2 min @ 22, 2 min @ 20', NULL::jsonb, 'intermediate_rate_control', 'rate_control', 'erg', NULL, 10, ARRAY['Control stroke rate while maintaining strong leg drive.', 'Keep splits consistent through rate changes.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 1, 2, 'session_2', 'Session 2', '1 min row, 90s rest x 3; 3 min rest; 1 min row, 90s rest x 3', NULL::jsonb, 'intermediate_2k_work', 'interval_or_test', 'erg', NULL, 6, ARRAY['Keep technique at higher rates.', 'Use consistent splits across intervals or pieces.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 1, 4, 'cross_training', 'Cross-training', 'Cross: 15:00', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 15, ARRAY['Use any cardio equipment.', 'Keep effort aerobic and supplemental.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 1, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 1, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 1, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 1, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 2, 0, 'session_1', 'Session 1', '2 min @ 20, 2 min @ 22, 2 min @ 24, 2 min @ 24, 2 min @ 22, 2 min @ 20', NULL::jsonb, 'intermediate_rate_control', 'rate_control', 'erg', NULL, 12, ARRAY['Control stroke rate while maintaining strong leg drive.', 'Keep splits consistent through rate changes.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 2, 2, 'session_2', 'Session 2', '1 min row, 90s rest x 3; 2 min rest; 1 min row, 90s rest x 3', NULL::jsonb, 'intermediate_2k_work', 'interval_or_test', 'erg', NULL, 6, ARRAY['Keep technique at higher rates.', 'Use consistent splits across intervals or pieces.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 2, 4, 'cross_training', 'Cross-training', 'Cross: 15:00', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 15, ARRAY['Use any cardio equipment.', 'Keep effort aerobic and supplemental.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 2, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 2, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 2, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 2, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 3, 0, 'session_1', 'Session 1', '2 min @ 20, 2 min @ 22, 2 min @ 24, 1 min @ 26, 2 min @ 24, 2 min @ 22, 2 min @ 20', NULL::jsonb, 'intermediate_rate_control', 'rate_control', 'erg', NULL, 13, ARRAY['Control stroke rate while maintaining strong leg drive.', 'Keep splits consistent through rate changes.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 3, 2, 'session_2', 'Session 2', '1 min row, 1 min rest x 3; 3 min rest; 1 min row, 1 min rest x 3', NULL::jsonb, 'intermediate_2k_work', 'interval_or_test', 'erg', NULL, 6, ARRAY['Keep technique at higher rates.', 'Use consistent splits across intervals or pieces.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 3, 4, 'cross_training', 'Cross-training', 'Cross: 15:00', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 15, ARRAY['Use any cardio equipment.', 'Keep effort aerobic and supplemental.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 3, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 3, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 3, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 3, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 4, 0, 'session_1', 'Session 1', '2 min @ 20, 2 min @ 22, 2 min @ 24, 2 min @ 26, 2 min @ 24, 2 min @ 22, 2 min @ 20', NULL::jsonb, 'intermediate_rate_control', 'rate_control', 'erg', NULL, 14, ARRAY['Control stroke rate while maintaining strong leg drive.', 'Keep splits consistent through rate changes.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 4, 2, 'session_2', 'Session 2', '1 min @ 26-28, 1 min rest x 3; 3 min rest; 1 min @ 24-26, 1 min rest x 3', NULL::jsonb, 'intermediate_2k_work', 'interval_or_test', 'erg', NULL, 6, ARRAY['Keep technique at higher rates.', 'Use consistent splits across intervals or pieces.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 4, 4, 'cross_training', 'Cross-training', 'Cross: 15:00', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 15, ARRAY['Use any cardio equipment.', 'Keep effort aerobic and supplemental.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 4, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 4, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 4, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 4, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 5, 0, 'session_1', 'Session 1', '3 min @ 20, 3 min @ 22, 2 min @ 24, 3 min @ 22, 3 min @ 20', NULL::jsonb, 'intermediate_rate_control', 'rate_control', 'erg', NULL, 14, ARRAY['Control stroke rate while maintaining strong leg drive.', 'Keep splits consistent through rate changes.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 5, 2, 'session_2', 'Session 2', '1000m row, 4 min rest, 1000m row', NULL::jsonb, 'intermediate_2k_work', 'interval_or_test', 'erg', 2000, NULL, ARRAY['Keep technique at higher rates.', 'Use consistent splits across intervals or pieces.']::text[], true, true, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 5, 4, 'cross_training', 'Cross-training', 'Cross: 15:00', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 15, ARRAY['Use any cardio equipment.', 'Keep effort aerobic and supplemental.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 5, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 5, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 5, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 5, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 6, 0, 'session_1', 'Session 1', '3 min @ 20, 3 min @ 22, 3 min @ 24, 3 min @ 22, 3 min @ 20', NULL::jsonb, 'intermediate_rate_control', 'rate_control', 'erg', NULL, 15, ARRAY['Control stroke rate while maintaining strong leg drive.', 'Keep splits consistent through rate changes.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 6, 2, 'session_2', 'Session 2', '1 min row, 1 min rest x 3; 2 min rest; 1 min row, 1 min rest x 3', NULL::jsonb, 'intermediate_2k_work', 'interval_or_test', 'erg', NULL, 6, ARRAY['Keep technique at higher rates.', 'Use consistent splits across intervals or pieces.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 6, 4, 'cross_training', 'Cross-training', 'Cross: 15:00', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 15, ARRAY['Use any cardio equipment.', 'Keep effort aerobic and supplemental.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 6, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 6, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 6, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 6, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 7, 0, 'session_1', 'Session 1', '3 min @ 20, 2 min @ 22, 1 min @ 24, 1 min @ 26, 1 min @ 24, 2 min @ 22, 3 min @ 20', NULL::jsonb, 'intermediate_rate_control', 'rate_control', 'erg', NULL, 13, ARRAY['Control stroke rate while maintaining strong leg drive.', 'Keep splits consistent through rate changes.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 7, 2, 'session_2', 'Session 2', '1000m row, 2.5 min rest, 1000m row', NULL::jsonb, 'intermediate_2k_work', 'interval_or_test', 'erg', 2000, NULL, ARRAY['Keep technique at higher rates.', 'Use consistent splits across intervals or pieces.']::text[], true, true, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 7, 4, 'cross_training', 'Cross-training', 'Cross: 15:00', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 15, ARRAY['Use any cardio equipment.', 'Keep effort aerobic and supplemental.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 7, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 7, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 7, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 7, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 8, 0, 'session_1', 'Session 1', '2000m row', NULL::jsonb, 'intermediate_rate_control', 'rate_control', 'erg', 2000, NULL, ARRAY['Control stroke rate while maintaining strong leg drive.', 'Keep splits consistent through rate changes.']::text[], true, true, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 8, 2, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No second row scheduled in final test week.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 8, 4, 'cross_training', 'Cross-training', 'Cross: 15:00', NULL::jsonb, 'cross_training', 'aerobic_support', 'cross_training', NULL, 15, ARRAY['Use any cardio equipment.', 'Keep effort aerobic and supplemental.']::text[], true, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 8, 1, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 8, 3, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 8, 5, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb),
    ('intermediate_2k_8_week_v1', 8, 6, 'rest', 'Rest day', NULL, NULL::jsonb, 'rest', 'recovery', 'rest', NULL, NULL, ARRAY['No scheduled training.']::text[], false, false, 0, '{"kb_source":"2km-Intermediate-training-plan.optimized.md"}'::jsonb)
)
INSERT INTO public.training_block_template_sessions (
  template_day_id, session_key, title, planned_rwn, workout_template_id, support_prescription, family, role, source,
  expected_distance_meters, expected_duration_minutes, instructions, counts_toward_weekly_volume, is_key_session, sort_order, metadata
)
SELECT
  d.id, s.session_key, s.title, s.planned_rwn, wt.id, s.support_prescription, s.family, s.role, s.source,
  s.expected_distance_meters, s.expected_duration_minutes, s.instructions, s.counts_toward_weekly_volume, s.is_key_session, s.sort_order,
  jsonb_build_object('seed', 'additional_blocks_v1') || s.metadata
FROM session_seed s
JOIN public.training_block_templates t ON t.template_key = s.template_key
JOIN public.training_block_template_days d
  ON d.template_id = t.id
 AND d.week_number = s.week_number
 AND d.day_slot = s.day_slot
LEFT JOIN LATERAL (
  SELECT candidate.id
  FROM public.workout_templates candidate
  WHERE s.planned_rwn IS NOT NULL
    AND (candidate.canonical_name = s.planned_rwn OR candidate.rwn = s.planned_rwn)
  ORDER BY COALESCE(candidate.validated, false) DESC, CASE WHEN candidate.status = 'published' THEN 1 ELSE 0 END DESC, COALESCE(candidate.usage_count, 0) DESC, candidate.name ASC
  LIMIT 1
) wt ON true;

