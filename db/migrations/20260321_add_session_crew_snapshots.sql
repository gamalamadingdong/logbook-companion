-- Session-owned crew snapshots become the canonical saved lineup state for a coaching session.
-- Existing coaching_boatings rows remain reusable template/history inputs.

CREATE TABLE IF NOT EXISTS public.coaching_session_crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.coaching_sessions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  coach_user_id uuid NOT NULL REFERENCES auth.users(id),
  boat_id uuid REFERENCES public.coaching_boats(id) ON DELETE SET NULL,
  source_boating_id uuid UNIQUE REFERENCES public.coaching_boatings(id) ON DELETE SET NULL,
  boat_name text NOT NULL CHECK (length(trim(boat_name)) BETWEEN 1 AND 200),
  boat_type text NOT NULL CHECK (boat_type IN ('8+', '4+', '4x', '2x', '1x', '2-', '4-')),
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_session_crews_session_sort
  ON public.coaching_session_crews (session_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_coaching_session_crews_team_session
  ON public.coaching_session_crews (team_id, session_id);

CREATE TABLE IF NOT EXISTS public.coaching_session_crew_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_crew_id uuid NOT NULL REFERENCES public.coaching_session_crews(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  coach_user_id uuid NOT NULL REFERENCES auth.users(id),
  seat integer NOT NULL CHECK (seat BETWEEN 0 AND 8),
  athlete_id uuid REFERENCES public.athletes(id) ON DELETE SET NULL,
  athlete_name text NOT NULL CHECK (length(trim(athlete_name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_crew_id, seat)
);

CREATE INDEX IF NOT EXISTS idx_coaching_session_crew_positions_crew
  ON public.coaching_session_crew_positions (session_crew_id, seat);

CREATE INDEX IF NOT EXISTS idx_coaching_session_crew_positions_team_athlete
  ON public.coaching_session_crew_positions (team_id, athlete_id)
  WHERE athlete_id IS NOT NULL;

ALTER TABLE public.coaching_session_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_session_crew_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team and org members can view session crews" ON public.coaching_session_crews;
CREATE POLICY "Team and org members can view session crews"
ON public.coaching_session_crews
FOR SELECT
TO authenticated
USING (
  ((SELECT auth.uid()) = coach_user_id)
  OR public.can_view_team(coaching_session_crews.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org coaches can insert session crews" ON public.coaching_session_crews;
CREATE POLICY "Team and org coaches can insert session crews"
ON public.coaching_session_crews
FOR INSERT
TO authenticated
WITH CHECK (
  (coach_user_id = (SELECT auth.uid()))
  AND public.can_coach_team(coaching_session_crews.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org coaches can update session crews" ON public.coaching_session_crews;
CREATE POLICY "Team and org coaches can update session crews"
ON public.coaching_session_crews
FOR UPDATE
TO authenticated
USING (
  ((SELECT auth.uid()) = coach_user_id)
  OR public.can_coach_team(coaching_session_crews.team_id, (SELECT auth.uid()))
)
WITH CHECK (
  (coach_user_id = (SELECT auth.uid()))
  AND public.can_coach_team(coaching_session_crews.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org coaches can delete session crews" ON public.coaching_session_crews;
CREATE POLICY "Team and org coaches can delete session crews"
ON public.coaching_session_crews
FOR DELETE
TO authenticated
USING (
  ((SELECT auth.uid()) = coach_user_id)
  OR public.can_coach_team(coaching_session_crews.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org members can view session crew positions" ON public.coaching_session_crew_positions;
CREATE POLICY "Team and org members can view session crew positions"
ON public.coaching_session_crew_positions
FOR SELECT
TO authenticated
USING (
  ((SELECT auth.uid()) = coach_user_id)
  OR public.can_view_team(coaching_session_crew_positions.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org coaches can insert session crew positions" ON public.coaching_session_crew_positions;
CREATE POLICY "Team and org coaches can insert session crew positions"
ON public.coaching_session_crew_positions
FOR INSERT
TO authenticated
WITH CHECK (
  (coach_user_id = (SELECT auth.uid()))
  AND public.can_coach_team(coaching_session_crew_positions.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org coaches can update session crew positions" ON public.coaching_session_crew_positions;
CREATE POLICY "Team and org coaches can update session crew positions"
ON public.coaching_session_crew_positions
FOR UPDATE
TO authenticated
USING (
  ((SELECT auth.uid()) = coach_user_id)
  OR public.can_coach_team(coaching_session_crew_positions.team_id, (SELECT auth.uid()))
)
WITH CHECK (
  (coach_user_id = (SELECT auth.uid()))
  AND public.can_coach_team(coaching_session_crew_positions.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org coaches can delete session crew positions" ON public.coaching_session_crew_positions;
CREATE POLICY "Team and org coaches can delete session crew positions"
ON public.coaching_session_crew_positions
FOR DELETE
TO authenticated
USING (
  ((SELECT auth.uid()) = coach_user_id)
  OR public.can_coach_team(coaching_session_crew_positions.team_id, (SELECT auth.uid()))
);

INSERT INTO public.coaching_session_crews (
  session_id,
  team_id,
  coach_user_id,
  boat_id,
  source_boating_id,
  boat_name,
  boat_type,
  notes,
  sort_order,
  created_at,
  updated_at
)
SELECT
  cb.session_id,
  cb.team_id,
  cb.coach_user_id,
  cb.boat_id,
  cb.id,
  cb.boat_name,
  cb.boat_type,
  cb.notes,
  COALESCE(cb.sort_order, 0),
  cb.created_at,
  cb.updated_at
FROM public.coaching_boatings cb
WHERE cb.session_id IS NOT NULL
  AND cb.team_id IS NOT NULL
ON CONFLICT (source_boating_id) DO NOTHING;

INSERT INTO public.coaching_session_crew_positions (
  session_crew_id,
  team_id,
  coach_user_id,
  seat,
  athlete_id,
  athlete_name,
  created_at
)
SELECT
  csc.id,
  csc.team_id,
  csc.coach_user_id,
  (pos.value ->> 'seat')::integer,
  NULLIF(pos.value ->> 'athlete_id', '')::uuid,
  COALESCE(
    NULLIF(pos.value ->> 'athlete_name', ''),
    NULLIF(trim(concat_ws(' ', a.first_name, a.last_name)), ''),
    'Unknown athlete'
  ),
  csc.created_at
FROM public.coaching_session_crews csc
JOIN public.coaching_boatings cb
  ON cb.id = csc.source_boating_id
CROSS JOIN LATERAL jsonb_array_elements(cb.positions) AS pos(value)
LEFT JOIN public.athletes a
  ON a.id = NULLIF(pos.value ->> 'athlete_id', '')::uuid
ON CONFLICT (session_crew_id, seat) DO NOTHING;
