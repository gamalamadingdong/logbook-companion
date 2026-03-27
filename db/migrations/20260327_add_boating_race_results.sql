-- Store actual on-water race results against saved lineup records.
-- Results keep an exact lineup snapshot/signature so later seat changes do not
-- accidentally inherit calibration from an older crew version.

CREATE TABLE IF NOT EXISTS public.coaching_boating_race_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boating_id uuid NOT NULL REFERENCES public.coaching_boatings(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  coach_user_id uuid NOT NULL REFERENCES auth.users(id),
  schedule_event_id uuid REFERENCES public.coaching_schedule_events(id) ON DELETE SET NULL,
  race_date date NOT NULL,
  event_name text NOT NULL CHECK (length(trim(event_name)) BETWEEN 1 AND 200),
  distance_meters integer NOT NULL CHECK (distance_meters BETWEEN 250 AND 20000),
  time_seconds double precision NOT NULL CHECK (time_seconds > 0 AND time_seconds < 36000),
  lineup_signature text NOT NULL CHECK (length(trim(lineup_signature)) BETWEEN 1 AND 500),
  lineup_positions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(lineup_positions) = 'array'),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boating_race_results_boating_date
  ON public.coaching_boating_race_results (boating_id, race_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_boating_race_results_team_date
  ON public.coaching_boating_race_results (team_id, race_date DESC);

CREATE INDEX IF NOT EXISTS idx_boating_race_results_schedule_event
  ON public.coaching_boating_race_results (schedule_event_id)
  WHERE schedule_event_id IS NOT NULL;

ALTER TABLE public.coaching_boating_race_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team and org members can view boating race results" ON public.coaching_boating_race_results;
CREATE POLICY "Team and org members can view boating race results"
ON public.coaching_boating_race_results
FOR SELECT
TO authenticated
USING (
  ((SELECT auth.uid()) = coach_user_id)
  OR public.can_view_team(coaching_boating_race_results.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org coaches can insert boating race results" ON public.coaching_boating_race_results;
CREATE POLICY "Team and org coaches can insert boating race results"
ON public.coaching_boating_race_results
FOR INSERT
TO authenticated
WITH CHECK (
  (coach_user_id = (SELECT auth.uid()))
  AND public.can_coach_team(coaching_boating_race_results.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org coaches can update boating race results" ON public.coaching_boating_race_results;
CREATE POLICY "Team and org coaches can update boating race results"
ON public.coaching_boating_race_results
FOR UPDATE
TO authenticated
USING (
  ((SELECT auth.uid()) = coach_user_id)
  OR public.can_coach_team(coaching_boating_race_results.team_id, (SELECT auth.uid()))
)
WITH CHECK (
  (coach_user_id = (SELECT auth.uid()))
  AND public.can_coach_team(coaching_boating_race_results.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org coaches can delete boating race results" ON public.coaching_boating_race_results;
CREATE POLICY "Team and org coaches can delete boating race results"
ON public.coaching_boating_race_results
FOR DELETE
TO authenticated
USING (
  ((SELECT auth.uid()) = coach_user_id)
  OR public.can_coach_team(coaching_boating_race_results.team_id, (SELECT auth.uid()))
);
