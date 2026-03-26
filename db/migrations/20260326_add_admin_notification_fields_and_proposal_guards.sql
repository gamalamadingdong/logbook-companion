ALTER TABLE public.workout_template_proposals
  ADD COLUMN IF NOT EXISTS admin_notified_at timestamp with time zone;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS admin_signup_notified_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workout_template_proposals_name_length_check'
  ) THEN
    ALTER TABLE public.workout_template_proposals
      ADD CONSTRAINT workout_template_proposals_name_length_check
      CHECK (char_length(btrim(name)) BETWEEN 1 AND 160);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workout_template_proposals_description_length_check'
  ) THEN
    ALTER TABLE public.workout_template_proposals
      ADD CONSTRAINT workout_template_proposals_description_length_check
      CHECK (char_length(description) <= 2000);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workout_template_proposals_rwn_length_check'
  ) THEN
    ALTER TABLE public.workout_template_proposals
      ADD CONSTRAINT workout_template_proposals_rwn_length_check
      CHECK (char_length(btrim(rwn)) BETWEEN 1 AND 500);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workout_template_proposals_notes_length_check'
  ) THEN
    ALTER TABLE public.workout_template_proposals
      ADD CONSTRAINT workout_template_proposals_notes_length_check
      CHECK (notes IS NULL OR char_length(notes) <= 2000);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workout_template_proposals_attribution_name_length_check'
  ) THEN
    ALTER TABLE public.workout_template_proposals
      ADD CONSTRAINT workout_template_proposals_attribution_name_length_check
      CHECK (attribution_name IS NULL OR char_length(attribution_name) <= 120);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workout_template_proposals_attribution_contact_length_check'
  ) THEN
    ALTER TABLE public.workout_template_proposals
      ADD CONSTRAINT workout_template_proposals_attribution_contact_length_check
      CHECK (attribution_contact IS NULL OR char_length(attribution_contact) <= 200);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workout_template_proposals_structure_object_check'
  ) THEN
    ALTER TABLE public.workout_template_proposals
      ADD CONSTRAINT workout_template_proposals_structure_object_check
      CHECK (
        workout_structure IS NULL OR jsonb_typeof(workout_structure) = 'object'
      );
  END IF;
END $$;
