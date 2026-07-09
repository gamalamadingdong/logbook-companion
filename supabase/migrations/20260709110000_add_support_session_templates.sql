-- Normalize training-block support prescriptions into reusable support session templates.
-- Planned support completion remains out of workout_logs; completion state is added in a later slice.

CREATE TABLE IF NOT EXISTS public.support_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('strength', 'core', 'mobility', 'stretching', 'prehab', 'recovery')),
  movement_pattern text,
  equipment text[] NOT NULL DEFAULT '{}'::text[],
  default_sets integer CHECK (default_sets IS NULL OR default_sets > 0),
  default_reps text,
  default_duration_seconds integer CHECK (default_duration_seconds IS NULL OR default_duration_seconds > 0),
  cues text[] NOT NULL DEFAULT '{}'::text[],
  contraindications text[] NOT NULL DEFAULT '{}'::text[],
  tags text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_session_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('strength', 'core', 'mobility', 'stretching', 'prehab', 'recovery')),
  description text,
  estimated_duration_minutes integer CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes >= 0),
  difficulty text CHECK (difficulty IS NULL OR difficulty IN ('beginner', 'intermediate', 'advanced')),
  focus text[] NOT NULL DEFAULT '{}'::text[],
  instructions text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_session_template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_session_template_id uuid NOT NULL REFERENCES public.support_session_templates(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.support_exercises(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  sets integer CHECK (sets IS NULL OR sets > 0),
  reps text,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  rest_seconds integer CHECK (rest_seconds IS NULL OR rest_seconds >= 0),
  load_prescription text,
  side text CHECK (side IS NULL OR side IN ('both', 'left', 'right', 'alternating', 'per_side')),
  notes text[] NOT NULL DEFAULT '{}'::text[],
  alternatives jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_session_template_exercises_unique_exercise UNIQUE (support_session_template_id, exercise_id)
);

ALTER TABLE public.training_block_template_sessions
ADD COLUMN IF NOT EXISTS support_session_template_id uuid REFERENCES public.support_session_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_support_exercises_category_status
  ON public.support_exercises (category, status);

CREATE INDEX IF NOT EXISTS idx_support_session_templates_kind_status
  ON public.support_session_templates (kind, status);

CREATE INDEX IF NOT EXISTS idx_support_session_template_exercises_template
  ON public.support_session_template_exercises (support_session_template_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_training_block_template_sessions_support_template
  ON public.training_block_template_sessions (support_session_template_id)
  WHERE support_session_template_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_support_exercises_updated_at ON public.support_exercises;
CREATE TRIGGER trg_support_exercises_updated_at
BEFORE UPDATE ON public.support_exercises
FOR EACH ROW
EXECUTE FUNCTION public.update_training_block_updated_at();

DROP TRIGGER IF EXISTS trg_support_session_templates_updated_at ON public.support_session_templates;
CREATE TRIGGER trg_support_session_templates_updated_at
BEFORE UPDATE ON public.support_session_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_training_block_updated_at();

DROP TRIGGER IF EXISTS trg_support_session_template_exercises_updated_at ON public.support_session_template_exercises;
CREATE TRIGGER trg_support_session_template_exercises_updated_at
BEFORE UPDATE ON public.support_session_template_exercises
FOR EACH ROW
EXECUTE FUNCTION public.update_training_block_updated_at();

ALTER TABLE public.support_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_session_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_session_template_exercises ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.support_exercises TO authenticated;
GRANT SELECT ON public.support_session_templates TO authenticated;
GRANT SELECT ON public.support_session_template_exercises TO authenticated;
GRANT ALL ON public.support_exercises TO service_role;
GRANT ALL ON public.support_session_templates TO service_role;
GRANT ALL ON public.support_session_template_exercises TO service_role;

DROP POLICY IF EXISTS "Authenticated users can view published support exercises" ON public.support_exercises;
CREATE POLICY "Authenticated users can view published support exercises"
  ON public.support_exercises
  FOR SELECT TO authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "Authenticated users can view published support session templates" ON public.support_session_templates;
CREATE POLICY "Authenticated users can view published support session templates"
  ON public.support_session_templates
  FOR SELECT TO authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "Authenticated users can view published support template exercises" ON public.support_session_template_exercises;
CREATE POLICY "Authenticated users can view published support template exercises"
  ON public.support_session_template_exercises
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_session_templates st
      JOIN public.support_exercises e ON e.id = exercise_id
      WHERE st.id = support_session_template_id
        AND st.status = 'published'
        AND e.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Service role can manage support exercises" ON public.support_exercises;
CREATE POLICY "Service role can manage support exercises"
  ON public.support_exercises
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage support session templates" ON public.support_session_templates;
CREATE POLICY "Service role can manage support session templates"
  ON public.support_session_templates
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage support template exercises" ON public.support_session_template_exercises;
CREATE POLICY "Service role can manage support template exercises"
  ON public.support_session_template_exercises
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

WITH exercise_seed(name, category, movement_pattern, equipment, default_sets, default_reps, tags) AS (
  VALUES
    ('Deadlift or Romanian Deadlift', 'strength', 'hinge', ARRAY['barbell', 'dumbbell'], 4, '6-8', ARRAY['strength', 'pull', 'posterior-chain']),
    ('Pendlay Row or Bench Pull', 'strength', 'pull', ARRAY['barbell', 'bench', 'machine'], 4, '8', ARRAY['strength', 'pull', 'back']),
    ('Weighted Pull-ups or Lat Pulldown', 'strength', 'pull', ARRAY['bodyweight', 'belt', 'lat-pulldown'], 3, '8-10', ARRAY['strength', 'pull', 'lats']),
    ('Face Pulls', 'strength', 'pull', ARRAY['cable', 'band'], 3, '15', ARRAY['strength', 'pull', 'shoulder-health']),
    ('Front Squat or Back Squat', 'strength', 'squat', ARRAY['barbell'], 4, '6-8', ARRAY['strength', 'push', 'legs']),
    ('Overhead Press or Flat Bench Press', 'strength', 'press', ARRAY['barbell', 'dumbbell', 'bench'], 4, '8', ARRAY['strength', 'push', 'upper-body']),
    ('Walking Lunges', 'strength', 'lunge', ARRAY['bodyweight', 'dumbbell'], 3, '10 steps per leg', ARRAY['strength', 'push', 'single-leg']),
    ('Ab Wheel Rollouts', 'core', 'brace', ARRAY['ab-wheel', 'mat'], 3, '10-12', ARRAY['core', 'anti-extension'])
)
INSERT INTO public.support_exercises (
  name, category, movement_pattern, equipment, default_sets, default_reps, tags, status, metadata
)
SELECT name, category, movement_pattern, equipment, default_sets, default_reps, tags, 'published', jsonb_build_object('seed_source', 'pete_block_support_v1')
FROM exercise_seed
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  equipment = EXCLUDED.equipment,
  default_sets = EXCLUDED.default_sets,
  default_reps = EXCLUDED.default_reps,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = public.support_exercises.metadata || EXCLUDED.metadata,
  updated_at = now();

WITH template_seed(template_key, title, kind, description, estimated_duration_minutes, difficulty, focus, instructions) AS (
  VALUES
    (
      'pete_strength_pull_v1',
      'Strength (pull)',
      'strength',
      'Pull-focused strength support for the Pete-style training block.',
      NULL::integer,
      'intermediate',
      ARRAY['Back', 'Grip', 'Posterior chain'],
      ARRAY['Keep low to moderate load', '1-2 reps in reserve.', 'No failed reps or grindy reps.', 'Quality and consistency over load chasing.']
    ),
    (
      'pete_strength_push_v1',
      'Strength (push)',
      'strength',
      'Push-focused strength support for the Pete-style training block.',
      NULL::integer,
      'intermediate',
      ARRAY['Upper back', 'Chest', 'Triceps'],
      ARRAY['Keep movement quality high', '1-2 reps in reserve.', 'No failed reps or grindy reps.', 'Quality and consistency over load chasing.']
    )
)
INSERT INTO public.support_session_templates (
  template_key, title, kind, description, estimated_duration_minutes, difficulty, focus, instructions, status, metadata
)
SELECT template_key, title, kind, description, estimated_duration_minutes, difficulty, focus, instructions, 'published', jsonb_build_object('seed_source', 'pete_block_support_v1')
FROM template_seed
ON CONFLICT (template_key) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  description = EXCLUDED.description,
  estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
  difficulty = EXCLUDED.difficulty,
  focus = EXCLUDED.focus,
  instructions = EXCLUDED.instructions,
  status = EXCLUDED.status,
  metadata = public.support_session_templates.metadata || EXCLUDED.metadata,
  updated_at = now();

WITH exercise_row(template_key, exercise_name, sort_order, sets, reps, notes) AS (
  VALUES
    ('pete_strength_pull_v1', 'Deadlift or Romanian Deadlift', 1, 4, '6-8', ARRAY['Quality hinge pattern; stop 1-2 reps before failure.']),
    ('pete_strength_pull_v1', 'Pendlay Row or Bench Pull', 2, 4, '8', ARRAY['Brace hard and keep the pull controlled.']),
    ('pete_strength_pull_v1', 'Weighted Pull-ups or Lat Pulldown', 3, 3, '8-10', ARRAY['Full range without grinding.']),
    ('pete_strength_pull_v1', 'Face Pulls', 4, 3, '15', ARRAY['Light, clean scapular control.']),
    ('pete_strength_push_v1', 'Front Squat or Back Squat', 1, 4, '6-8', ARRAY['Smooth reps; no failed attempts.']),
    ('pete_strength_push_v1', 'Overhead Press or Flat Bench Press', 2, 4, '8', ARRAY['Controlled eccentric on each rep.']),
    ('pete_strength_push_v1', 'Walking Lunges', 3, 3, '10 steps per leg', ARRAY['Stay tall and balanced.']),
    ('pete_strength_push_v1', 'Ab Wheel Rollouts', 4, 3, '10-12', ARRAY['Brace through the trunk; shorten range if needed.'])
)
INSERT INTO public.support_session_template_exercises (
  support_session_template_id, exercise_id, sort_order, sets, reps, notes, metadata
)
SELECT st.id, e.id, er.sort_order, er.sets, er.reps, er.notes, jsonb_build_object('seed_source', 'pete_block_support_v1')
FROM exercise_row er
JOIN public.support_session_templates st ON st.template_key = er.template_key
JOIN public.support_exercises e ON e.name = er.exercise_name
ON CONFLICT (support_session_template_id, exercise_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  sets = EXCLUDED.sets,
  reps = EXCLUDED.reps,
  notes = EXCLUDED.notes,
  metadata = public.support_session_template_exercises.metadata || EXCLUDED.metadata,
  updated_at = now();

UPDATE public.training_block_template_sessions s
SET support_session_template_id = st.id,
    metadata = COALESCE(s.metadata, '{}'::jsonb) || jsonb_build_object('support_template_link', 'pete_block_support_v1'),
    updated_at = now()
FROM public.support_session_templates st
WHERE s.source = 'strength'
  AND (
    (s.family = 'strength_pull' AND st.template_key = 'pete_strength_pull_v1')
    OR (s.family = 'strength_push' AND st.template_key = 'pete_strength_push_v1')
  );
