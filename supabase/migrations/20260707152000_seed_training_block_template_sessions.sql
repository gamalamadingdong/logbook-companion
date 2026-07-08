-- Seed the persisted schedule snapshots for the 12-week rowing training block.
-- Completed training remains in public.workout_logs; these rows are planned prescriptions only.

WITH template_row AS (
  SELECT id
  FROM public.training_block_templates
  WHERE template_key = 'rowing_12_week_2026_v1'
)
DELETE FROM public.training_block_template_days d
USING template_row t
WHERE d.template_id = t.id;

WITH template_row AS (
  SELECT id
  FROM public.training_block_templates
  WHERE template_key = 'rowing_12_week_2026_v1'
),
week_targets AS (
  SELECT *
  FROM (VALUES
    (1, 50000), (2, 55000), (3, 60000), (4, 55000),
    (5, 65000), (6, 70000), (7, 75000), (8, 65000),
    (9, 78000), (10, 82000), (11, 85000), (12, 70000)
  ) AS w(week_number, target_distance_meters)
),
week_families AS (
  SELECT *
  FROM (VALUES
    (1, 'mon_8x500', '8x500m/3:30r', 4000, 'thu_5x1500', '5x1500m/5:00r', 7500),
    (2, 'mon_pyramid_250_500_750_1000_750_500_250', '250m + 500m + 750m + 1000m + 750m + 500m + 250m', 4000, 'thu_4x2000', '4x2000m/5:00r', 8000),
    (3, 'mon_4x1000', '4x1000m/5:00r', 4000, 'thu_3000_2500_2000', '3000m + 2500m + 2000m', 7500),
    (4, 'mon_30r20', '30:00@r20', 3000, 'thu_3x2000_controlled', '3x2000m/5:00r', 6000),
    (5, 'mon_8x500', '8x500m/3:30r', 4000, 'thu_5x1500', '5x1500m/5:00r', 7500),
    (6, 'mon_pyramid_250_500_750_1000_750_500_250', '250m + 500m + 750m + 1000m + 750m + 500m + 250m', 4000, 'thu_4x2000', '4x2000m/5:00r', 8000),
    (7, 'mon_4x1000', '4x1000m/5:00r', 4000, 'thu_3000_2500_2000', '3000m + 2500m + 2000m', 7500),
    (8, 'mon_hour_of_power', '60:00', 12000, 'thu_cascading_pyramid_3000_2000_1000', '3000m + 2000m + 1000m', 6000),
    (9, 'mon_8x500', '8x500m/3:30r', 4000, 'thu_5x1500', '5x1500m/5:00r', 7500),
    (10, 'mon_pyramid_250_500_750_1000_750_500_250', '250m + 500m + 750m + 1000m + 750m + 500m + 250m', 4000, 'thu_4x2000', '4x2000m/5:00r', 8000),
    (11, 'mon_4x1000', '4x1000m/5:00r', 4000, 'thu_3000_2500_2000', '3000m + 2500m + 2000m', 7500),
    (12, 'mon_2x5000', '2x5000m/6:00r', 10000, 'thu_final_5000_or_6000', '6000m', 6000)
  ) AS f(week_number, mon_family, mon_rwn, mon_meters, thu_family, thu_rwn, thu_meters)
),
day_seed AS (
  SELECT
    t.id AS template_id,
    w.week_number,
    slot.day_slot,
    ('Day ' || (slot.day_slot + 1)) AS day_of_week,
    CASE
      WHEN slot.day_slot IN (2, 5) THEN 'cross_training'
      WHEN slot.day_slot = 6 THEN 'rest'
      ELSE 'erg'
    END AS category,
    CASE
      WHEN slot.day_slot = 0 THEN f.mon_meters + CASE WHEN w.week_number = 4 THEN 3000 WHEN w.week_number = 12 THEN 6000 ELSE 4500 END
      WHEN slot.day_slot = 1 THEN 8000
      WHEN slot.day_slot = 3 THEN f.thu_meters + CASE WHEN w.week_number = 4 THEN 3000 WHEN w.week_number = 12 THEN 6000 ELSE 4500 END
      WHEN slot.day_slot = 4 THEN 10000
      ELSE 0
    END AS planned_distance_meters,
    w.target_distance_meters,
    CASE
      WHEN slot.day_slot IN (0, 3) THEN jsonb_build_object(
        'warmup', jsonb_build_array('5 min easy row or bike spin', 'Dynamic shoulder circles', 'Banded pull-aparts x2 sets'),
        'core', jsonb_build_array('Pallof press', 'Side plank', 'Dead bug'),
        'stretching', jsonb_build_array('Lat stretch', 'Hip flexor stretch'),
        'routines', jsonb_build_array(jsonb_build_object(
          'kind', 'pull',
          'focus', jsonb_build_array('Back', 'Grip', 'Posterior chain'),
          'exercises', jsonb_build_array(
            jsonb_build_object('name', 'Deadlift or Romanian Deadlift', 'sets', 4, 'reps', '6-8', 'notes', 'Quality hinge pattern; stop 1-2 reps before failure.'),
            jsonb_build_object('name', 'Pendlay Row or Bench Pull', 'sets', 4, 'reps', '8', 'notes', 'Brace hard and keep the pull controlled.'),
            jsonb_build_object('name', 'Weighted Pull-ups or Lat Pulldown', 'sets', 3, 'reps', '8-10', 'notes', 'Full range without grinding.'),
            jsonb_build_object('name', 'Face Pulls', 'sets', 3, 'reps', '15', 'notes', 'Light, clean scapular control.')
          )
        ))
      )
      WHEN slot.day_slot IN (2, 5) THEN jsonb_build_object(
        'warmup', jsonb_build_array('5 min easy spin', 'Shoulder prep', 'Scap retractions'),
        'core', jsonb_build_array('Anti-rotation press', 'Bird-dog', 'Hollow hold'),
        'stretching', jsonb_build_array('Doorway pec stretch', 'Chest opener'),
        'routines', jsonb_build_array(jsonb_build_object(
          'kind', 'push',
          'focus', jsonb_build_array('Upper back', 'Chest', 'Triceps'),
          'exercises', jsonb_build_array(
            jsonb_build_object('name', 'Front Squat or Back Squat', 'sets', 4, 'reps', '6-8', 'notes', 'Smooth reps; no failed attempts.'),
            jsonb_build_object('name', 'Overhead Press or Flat Bench Press', 'sets', 4, 'reps', '8', 'notes', 'Controlled eccentric on each rep.'),
            jsonb_build_object('name', 'Walking Lunges', 'sets', 3, 'reps', '10 steps per leg', 'notes', 'Stay tall and balanced.'),
            jsonb_build_object('name', 'Ab Wheel Rollouts', 'sets', 3, 'reps', '10-12', 'notes', 'Brace through the trunk; shorten range if needed.')
          )
        ))
      )
      ELSE NULL
    END AS reference
  FROM template_row t
  CROSS JOIN week_targets w
  JOIN week_families f ON f.week_number = w.week_number
  CROSS JOIN generate_series(0, 6) AS slot(day_slot)
)
INSERT INTO public.training_block_template_days (
  template_id,
  week_number,
  day_slot,
  day_of_week,
  category,
  planned_distance_meters,
  target_distance_meters,
  reference,
  metadata
)
SELECT
  template_id,
  week_number,
  day_slot,
  day_of_week,
  category,
  planned_distance_meters,
  target_distance_meters,
  reference,
  jsonb_build_object('source', 'rowingTrainingBlockTemplate.ts')
FROM day_seed;

WITH template_row AS (
  SELECT id
  FROM public.training_block_templates
  WHERE template_key = 'rowing_12_week_2026_v1'
),
week_families AS (
  SELECT *
  FROM (VALUES
    (1, 'mon_8x500', '8x500m/3:30r', 4000, 'thu_5x1500', '5x1500m/5:00r', 7500),
    (2, 'mon_pyramid_250_500_750_1000_750_500_250', '250m + 500m + 750m + 1000m + 750m + 500m + 250m', 4000, 'thu_4x2000', '4x2000m/5:00r', 8000),
    (3, 'mon_4x1000', '4x1000m/5:00r', 4000, 'thu_3000_2500_2000', '3000m + 2500m + 2000m', 7500),
    (4, 'mon_30r20', '30:00@r20', 3000, 'thu_3x2000_controlled', '3x2000m/5:00r', 6000),
    (5, 'mon_8x500', '8x500m/3:30r', 4000, 'thu_5x1500', '5x1500m/5:00r', 7500),
    (6, 'mon_pyramid_250_500_750_1000_750_500_250', '250m + 500m + 750m + 1000m + 750m + 500m + 250m', 4000, 'thu_4x2000', '4x2000m/5:00r', 8000),
    (7, 'mon_4x1000', '4x1000m/5:00r', 4000, 'thu_3000_2500_2000', '3000m + 2500m + 2000m', 7500),
    (8, 'mon_hour_of_power', '60:00', 12000, 'thu_cascading_pyramid_3000_2000_1000', '3000m + 2000m + 1000m', 6000),
    (9, 'mon_8x500', '8x500m/3:30r', 4000, 'thu_5x1500', '5x1500m/5:00r', 7500),
    (10, 'mon_pyramid_250_500_750_1000_750_500_250', '250m + 500m + 750m + 1000m + 750m + 500m + 250m', 4000, 'thu_4x2000', '4x2000m/5:00r', 8000),
    (11, 'mon_4x1000', '4x1000m/5:00r', 4000, 'thu_3000_2500_2000', '3000m + 2500m + 2000m', 7500),
    (12, 'mon_2x5000', '2x5000m/6:00r', 10000, 'thu_final_5000_or_6000', '6000m', 6000)
  ) AS f(week_number, mon_family, mon_rwn, mon_meters, thu_family, thu_rwn, thu_meters)
),
days AS (
  SELECT d.*
  FROM public.training_block_template_days d
  JOIN template_row t ON t.id = d.template_id
),
session_seed AS (
  SELECT d.id AS template_day_id, 1 AS sort_order, (f.mon_family || '-primary') AS session_key,
    ('Row anchor: ' || replace(f.mon_family, '_', ' ')) AS title,
    f.mon_rwn AS planned_rwn, NULL::jsonb AS support_prescription, f.mon_family AS family, 'primary' AS role, 'erg' AS source,
    f.mon_meters AS expected_distance_meters, NULL::integer AS expected_duration_minutes, NULL::numeric AS target_split_seconds_per_500m,
    jsonb_build_array('Use this as the anchor session for the day.', 'Keep intervals controlled and repeatable.') AS instructions,
    true AS counts_toward_weekly_volume, true AS is_key_session,
    f.mon_rwn AS canonical_name
  FROM days d
  JOIN week_families f ON f.week_number = d.week_number
  WHERE d.day_slot = 0

  UNION ALL

  SELECT d.id, 2, ('flush-' || d.week_number),
    CASE
      WHEN d.week_number = 4 THEN 'Flush 3 km'
      WHEN d.week_number = 12 THEN 'Flush 6 km'
      ELSE 'Flush 4.5 km'
    END,
    CASE WHEN d.week_number = 4 THEN '3000m' WHEN d.week_number = 12 THEN '6000m' ELSE '4500m' END,
    NULL::jsonb,
    CASE WHEN d.week_number = 4 THEN 'flush_min_3k' WHEN d.week_number = 12 THEN 'flush_full_6k' ELSE 'flush_standard_4to5k' END,
    'supplemental', 'erg',
    CASE WHEN d.week_number = 4 THEN 3000 WHEN d.week_number = 12 THEN 6000 ELSE 4500 END,
    NULL::integer, NULL::numeric,
    jsonb_build_array('No sprinting; keep the pacing conversational.'),
    true, false,
    CASE WHEN d.week_number = 4 THEN '3000m' WHEN d.week_number = 12 THEN '6000m' ELSE '4500m' END
  FROM days d
  WHERE d.day_slot IN (0, 3)

  UNION ALL

  SELECT d.id, 3, 'strength-pull', 'Strength (pull)', NULL,
    jsonb_build_object(
      'kind', 'strength',
      'title', 'Strength (pull)',
      'focus', jsonb_build_array('Back', 'Grip', 'Posterior chain'),
      'exercises', jsonb_build_array(
        jsonb_build_object('name', 'Deadlift or Romanian Deadlift', 'sets', 4, 'reps', '6-8', 'notes', 'Quality hinge pattern; stop 1-2 reps before failure.'),
        jsonb_build_object('name', 'Pendlay Row or Bench Pull', 'sets', 4, 'reps', '8', 'notes', 'Brace hard and keep the pull controlled.'),
        jsonb_build_object('name', 'Weighted Pull-ups or Lat Pulldown', 'sets', 3, 'reps', '8-10', 'notes', 'Full range without grinding.'),
        jsonb_build_object('name', 'Face Pulls', 'sets', 3, 'reps', '15', 'notes', 'Light, clean scapular control.')
      ),
      'notes', jsonb_build_array('1-2 reps in reserve.', 'No failed reps or grindy reps.', 'Quality and consistency over load chasing.')
    ),
    'strength_pull', 'strength', 'strength', NULL::integer, NULL::integer, NULL::numeric,
    jsonb_build_array('Keep low to moderate load'),
    false, false, NULL
  FROM days d
  WHERE d.day_slot IN (0, 3)

  UNION ALL

  SELECT d.id, 1, ('steady-' || CASE WHEN d.day_slot = 1 THEN 8000 ELSE 10000 END),
    ('Steady ' || CASE WHEN d.day_slot = 1 THEN '8' ELSE '10' END || 'k'),
    CASE WHEN d.day_slot = 1 THEN '8000m' ELSE '10000m' END,
    NULL::jsonb,
    'steady_45_75min', 'primary', 'erg',
    CASE WHEN d.day_slot = 1 THEN 8000 ELSE 10000 END,
    50, 130,
    jsonb_build_array('Zone 2 focus.', 'Keep transitions calm and smooth.', 'No hard finish unless energy allows.'),
    true, false,
    CASE WHEN d.day_slot = 1 THEN '8000m' ELSE '10000m' END
  FROM days d
  WHERE d.day_slot IN (1, 4)

  UNION ALL

  SELECT d.id, 1, 'cross-60min', 'Cross-training 60 min', 'Cross: 60:00', NULL::jsonb,
    'cross_training', 'primary', 'cross_training', NULL::integer, 60, NULL::numeric,
    jsonb_build_array('Bike, ski, run, or general aerobic conditioning.'),
    false, false, NULL
  FROM days d
  WHERE d.day_slot IN (2, 5)

  UNION ALL

  SELECT d.id, 2, 'strength-push', 'Strength (push)', NULL,
    jsonb_build_object(
      'kind', 'strength',
      'title', 'Strength (push)',
      'focus', jsonb_build_array('Upper back', 'Chest', 'Triceps'),
      'exercises', jsonb_build_array(
        jsonb_build_object('name', 'Front Squat or Back Squat', 'sets', 4, 'reps', '6-8', 'notes', 'Smooth reps; no failed attempts.'),
        jsonb_build_object('name', 'Overhead Press or Flat Bench Press', 'sets', 4, 'reps', '8', 'notes', 'Controlled eccentric on each rep.'),
        jsonb_build_object('name', 'Walking Lunges', 'sets', 3, 'reps', '10 steps per leg', 'notes', 'Stay tall and balanced.'),
        jsonb_build_object('name', 'Ab Wheel Rollouts', 'sets', 3, 'reps', '10-12', 'notes', 'Brace through the trunk; shorten range if needed.')
      ),
      'notes', jsonb_build_array('1-2 reps in reserve.', 'No failed reps or grindy reps.', 'Quality and consistency over load chasing.')
    ),
    'strength_push', 'strength', 'strength', NULL::integer, NULL::integer, NULL::numeric,
    jsonb_build_array('Keep movement quality high'),
    false, false, NULL
  FROM days d
  WHERE d.day_slot IN (2, 5)

  UNION ALL

  SELECT d.id, 1, (f.thu_family || '-primary'),
    ('Benchmark focus: ' || replace(f.thu_family, '_', ' ')),
    f.thu_rwn, NULL::jsonb, f.thu_family, 'primary', 'erg',
    f.thu_meters, NULL::integer, NULL::numeric,
    jsonb_build_array('This is the weekly endurance benchmark slot.', 'Use race-pace discipline and avoid blowups.'),
    true, true,
    f.thu_rwn
  FROM days d
  JOIN week_families f ON f.week_number = d.week_number
  WHERE d.day_slot = 3
)
INSERT INTO public.training_block_template_sessions (
  template_day_id,
  session_key,
  title,
  planned_rwn,
  workout_template_id,
  support_prescription,
  family,
  role,
  source,
  expected_distance_meters,
  expected_duration_minutes,
  target_split_seconds_per_500m,
  instructions,
  counts_toward_weekly_volume,
  is_key_session,
  sort_order,
  metadata
)
SELECT
  s.template_day_id,
  s.session_key,
  s.title,
  s.planned_rwn,
  wt.id,
  s.support_prescription,
  s.family,
  s.role,
  s.source,
  s.expected_distance_meters,
  s.expected_duration_minutes,
  s.target_split_seconds_per_500m,
  ARRAY(SELECT jsonb_array_elements_text(s.instructions)),
  s.counts_toward_weekly_volume,
  s.is_key_session,
  s.sort_order,
  jsonb_build_object(
    'source', 'rowingTrainingBlockTemplate.ts',
    'library_match', CASE WHEN wt.id IS NULL THEN 'none' ELSE 'exact_canonical_name' END
  )
FROM session_seed s
LEFT JOIN LATERAL (
  SELECT id
  FROM public.workout_templates wt
  WHERE s.source = 'erg'
    AND s.canonical_name IS NOT NULL
    AND wt.canonical_name = s.canonical_name
  ORDER BY COALESCE(wt.validated, false) DESC, COALESCE(wt.usage_count, 0) DESC, wt.name ASC
  LIMIT 1
) wt ON true;
