-- Create group_assignments table
CREATE TABLE IF NOT EXISTS public.group_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  template_id uuid NOT NULL REFERENCES public.workout_templates(id),
  scheduled_date date NOT NULL,
  
  -- Flexible generic fields
  title text, 
  instructions text, 

  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Index for Roster Dashboard
CREATE INDEX IF NOT EXISTS idx_group_assignments_team_date ON public.group_assignments(team_id, scheduled_date);

-- Update daily_workout_assignments
ALTER TABLE public.daily_workout_assignments 
  ALTER COLUMN plan_id DROP NOT NULL;

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_workout_assignments' AND column_name = 'group_assignment_id') THEN
    ALTER TABLE public.daily_workout_assignments 
    ADD COLUMN group_assignment_id uuid REFERENCES public.group_assignments(id);
  END IF;
END $$;
