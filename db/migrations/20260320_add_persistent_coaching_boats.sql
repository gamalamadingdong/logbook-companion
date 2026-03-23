-- Add persistent coaching boats / shells as parents of dated coaching_boatings logs.
-- Keep coaching_boatings as the outing-log table and backfill boat_id from legacy rows.

CREATE TABLE IF NOT EXISTS public.coaching_boats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  coach_user_id uuid NOT NULL REFERENCES auth.users(id),
  boat_name text NOT NULL CHECK (length(trim(boat_name)) BETWEEN 1 AND 200),
  boat_type text NOT NULL CHECK (boat_type IN ('8+', '4+', '4x', '2x', '1x', '2-', '4-')),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, boat_name, boat_type)
);

CREATE INDEX IF NOT EXISTS idx_coaching_boats_team_sort
  ON public.coaching_boats (team_id, sort_order, boat_name);

ALTER TABLE public.coaching_boats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team and org members can view boats" ON public.coaching_boats;
CREATE POLICY "Team and org members can view boats"
ON public.coaching_boats
FOR SELECT
TO authenticated
USING (
  ((SELECT auth.uid()) = coach_user_id)
  OR public.can_view_team(coaching_boats.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org coaches can insert boats" ON public.coaching_boats;
CREATE POLICY "Team and org coaches can insert boats"
ON public.coaching_boats
FOR INSERT
TO authenticated
WITH CHECK (
  (coach_user_id = (SELECT auth.uid()))
  AND public.can_coach_team(coaching_boats.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org coaches can update boats" ON public.coaching_boats;
CREATE POLICY "Team and org coaches can update boats"
ON public.coaching_boats
FOR UPDATE
TO authenticated
USING (
  ((SELECT auth.uid()) = coach_user_id)
  OR public.can_coach_team(coaching_boats.team_id, (SELECT auth.uid()))
)
WITH CHECK (
  (coach_user_id = (SELECT auth.uid()))
  AND public.can_coach_team(coaching_boats.team_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Team and org coaches can delete boats" ON public.coaching_boats;
CREATE POLICY "Team and org coaches can delete boats"
ON public.coaching_boats
FOR DELETE
TO authenticated
USING (
  ((SELECT auth.uid()) = coach_user_id)
  OR public.can_coach_team(coaching_boats.team_id, (SELECT auth.uid()))
);

ALTER TABLE public.coaching_boatings
  ADD COLUMN IF NOT EXISTS boat_id uuid REFERENCES public.coaching_boats(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coaching_boatings_boat_id
  ON public.coaching_boatings (boat_id)
  WHERE boat_id IS NOT NULL;

WITH boat_seed AS (
  SELECT
    cb.team_id,
    (ARRAY_AGG(cb.coach_user_id ORDER BY cb.created_at, cb.id))[1] AS coach_user_id,
    cb.boat_name,
    cb.boat_type,
    MIN(cb.created_at) AS created_at,
    MAX(cb.updated_at) AS updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY cb.team_id
      ORDER BY MIN(cb.created_at), cb.boat_name, cb.boat_type
    ) - 1 AS sort_order
  FROM public.coaching_boatings cb
  WHERE cb.team_id IS NOT NULL
  GROUP BY cb.team_id, cb.boat_name, cb.boat_type
)
INSERT INTO public.coaching_boats (
  team_id,
  coach_user_id,
  boat_name,
  boat_type,
  sort_order,
  created_at,
  updated_at
)
SELECT
  boat_seed.team_id,
  boat_seed.coach_user_id,
  boat_seed.boat_name,
  boat_seed.boat_type,
  boat_seed.sort_order,
  boat_seed.created_at,
  boat_seed.updated_at
FROM boat_seed
ON CONFLICT (team_id, boat_name, boat_type) DO NOTHING;

UPDATE public.coaching_boatings cb
SET boat_id = boats.id
FROM public.coaching_boats boats
WHERE cb.boat_id IS NULL
  AND cb.team_id = boats.team_id
  AND cb.boat_name = boats.boat_name
  AND cb.boat_type = boats.boat_type;
