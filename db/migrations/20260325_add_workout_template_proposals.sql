CREATE TABLE IF NOT EXISTS public.workout_template_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  workout_type text NOT NULL DEFAULT 'erg',
  training_zone text CHECK (training_zone = ANY (ARRAY['UT2'::text, 'UT1'::text, 'AT'::text, 'TR'::text, 'AN'::text])),
  difficulty_level text NOT NULL DEFAULT 'intermediate',
  rwn text NOT NULL,
  workout_structure jsonb,
  notes text,
  attribution_name text,
  attribution_contact text,
  submitted_by_user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status = ANY (ARRAY[
      'pending'::text,
      'under_review'::text,
      'promoted_standard'::text,
      'promoted_community'::text,
      'rejected'::text,
      'duplicate'::text
    ])
  ),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,
  promoted_template_id uuid REFERENCES public.workout_templates(id),
  duplicate_template_id uuid REFERENCES public.workout_templates(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_template_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit workout template proposals" ON public.workout_template_proposals;
DROP POLICY IF EXISTS "Admins can view workout template proposals" ON public.workout_template_proposals;
DROP POLICY IF EXISTS "Admins can update workout template proposals" ON public.workout_template_proposals;

CREATE POLICY "Anyone can submit workout template proposals"
ON public.workout_template_proposals FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND promoted_template_id IS NULL
  AND duplicate_template_id IS NULL
  AND (submitted_by_user_id IS NULL OR submitted_by_user_id = auth.uid())
);

CREATE POLICY "Admins can view workout template proposals"
ON public.workout_template_proposals FOR SELECT
TO authenticated
USING (
  auth.uid() = '93c46300-57eb-48c8-b35c-cc49c76cfa66'::uuid
  OR submitted_by_user_id = auth.uid()
);

CREATE POLICY "Admins can update workout template proposals"
ON public.workout_template_proposals FOR UPDATE
TO authenticated
USING (auth.uid() = '93c46300-57eb-48c8-b35c-cc49c76cfa66'::uuid)
WITH CHECK (auth.uid() = '93c46300-57eb-48c8-b35c-cc49c76cfa66'::uuid);
