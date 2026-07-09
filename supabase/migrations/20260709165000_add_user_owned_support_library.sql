-- Allow athletes to build a personal support-work library without mutating
-- canonical seeded support templates.

ALTER TABLE public.support_exercises
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.support_session_templates
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.support_exercises
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'standard'
  CHECK (visibility IN ('standard', 'personal'));

ALTER TABLE public.support_session_templates
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'standard'
  CHECK (visibility IN ('standard', 'personal'));

UPDATE public.support_exercises
SET visibility = CASE WHEN user_id IS NULL THEN 'standard' ELSE 'personal' END
WHERE visibility IS DISTINCT FROM CASE WHEN user_id IS NULL THEN 'standard' ELSE 'personal' END;

UPDATE public.support_session_templates
SET visibility = CASE WHEN user_id IS NULL THEN 'standard' ELSE 'personal' END
WHERE visibility IS DISTINCT FROM CASE WHEN user_id IS NULL THEN 'standard' ELSE 'personal' END;

ALTER TABLE public.support_exercises
  DROP CONSTRAINT IF EXISTS support_exercises_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS support_exercises_global_name_unique
  ON public.support_exercises (lower(name))
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS support_exercises_user_name_unique
  ON public.support_exercises (user_id, lower(name))
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_exercises_user_status
  ON public.support_exercises (user_id, status)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_session_templates_user_status
  ON public.support_session_templates (user_id, status)
  WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "Authenticated users can view published support exercises" ON public.support_exercises;
CREATE POLICY "Authenticated users can view support exercises"
  ON public.support_exercises
  FOR SELECT TO authenticated
  USING (
    (status = 'published' AND user_id IS NULL)
    OR user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their own support exercises" ON public.support_exercises;
CREATE POLICY "Users can insert their own support exercises"
  ON public.support_exercises
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND visibility = 'personal'
  );

DROP POLICY IF EXISTS "Users can update their own support exercises" ON public.support_exercises;
CREATE POLICY "Users can update their own support exercises"
  ON public.support_exercises
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND visibility = 'personal'
  );

DROP POLICY IF EXISTS "Users can delete their own support exercises" ON public.support_exercises;
CREATE POLICY "Users can delete their own support exercises"
  ON public.support_exercises
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view published support session templates" ON public.support_session_templates;
CREATE POLICY "Authenticated users can view support session templates"
  ON public.support_session_templates
  FOR SELECT TO authenticated
  USING (
    (status = 'published' AND user_id IS NULL)
    OR user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their own support session templates" ON public.support_session_templates;
CREATE POLICY "Users can insert their own support session templates"
  ON public.support_session_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND visibility = 'personal'
  );

DROP POLICY IF EXISTS "Users can update their own support session templates" ON public.support_session_templates;
CREATE POLICY "Users can update their own support session templates"
  ON public.support_session_templates
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND visibility = 'personal'
  );

DROP POLICY IF EXISTS "Users can delete their own support session templates" ON public.support_session_templates;
CREATE POLICY "Users can delete their own support session templates"
  ON public.support_session_templates
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view published support template exercises" ON public.support_session_template_exercises;
CREATE POLICY "Authenticated users can view support template exercises"
  ON public.support_session_template_exercises
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_session_templates st
      JOIN public.support_exercises e ON e.id = exercise_id
      WHERE st.id = support_session_template_id
        AND (
          (st.status = 'published' AND st.user_id IS NULL)
          OR st.user_id = (SELECT auth.uid())
        )
        AND (
          (e.status = 'published' AND e.user_id IS NULL)
          OR e.user_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert exercises into their own support templates" ON public.support_session_template_exercises;
CREATE POLICY "Users can insert exercises into their own support templates"
  ON public.support_session_template_exercises
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.support_session_templates st
      JOIN public.support_exercises e ON e.id = exercise_id
      WHERE st.id = support_session_template_id
        AND st.user_id = (SELECT auth.uid())
        AND (
          (e.status = 'published' AND e.user_id IS NULL)
          OR e.user_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Users can update exercises in their own support templates" ON public.support_session_template_exercises;
CREATE POLICY "Users can update exercises in their own support templates"
  ON public.support_session_template_exercises
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_session_templates st
      WHERE st.id = support_session_template_id
        AND st.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.support_session_templates st
      JOIN public.support_exercises e ON e.id = exercise_id
      WHERE st.id = support_session_template_id
        AND st.user_id = (SELECT auth.uid())
        AND (
          (e.status = 'published' AND e.user_id IS NULL)
          OR e.user_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Users can delete exercises from their own support templates" ON public.support_session_template_exercises;
CREATE POLICY "Users can delete exercises from their own support templates"
  ON public.support_session_template_exercises
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_session_templates st
      WHERE st.id = support_session_template_id
        AND st.user_id = (SELECT auth.uid())
    )
  );
