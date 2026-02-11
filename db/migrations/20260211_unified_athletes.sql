-- Migration: Unified Athletes Model
-- Date: 2026-02-11
-- Purpose: Replace coach-siloed coaching_athletes with team-scoped athletes table
--          enabling multi-coach collaboration and optional LC account linking

-- ============================================================================
-- PHASE 1: Create new tables
-- ============================================================================

-- 1. Create unified athletes table
CREATE TABLE public.athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id),  -- NULL = no LC account, UUID = linked
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,                                      -- Contact when no account
  date_of_birth date,
  grade text,                                      -- For scholastic programs
  experience_level text CHECK (experience_level IS NULL OR experience_level IN ('novice','freshman','jv','varsity')),
  side text CHECK (side IS NULL OR side IN ('port','starboard','coxswain','both')),
  height_cm integer,
  weight_kg numeric,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create team_athletes junction table
CREATE TABLE public.team_athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','graduated')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  UNIQUE(team_id, athlete_id)
);

-- 3. Update team_members role constraint (remove captain, add coxswain)
ALTER TABLE public.team_members 
  DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE public.team_members 
  ADD CONSTRAINT team_members_role_check 
  CHECK (role IN ('member', 'coach', 'coxswain'));

-- Migrate any existing 'captain' roles to 'member'
UPDATE public.team_members SET role = 'member' WHERE role = 'captain';

-- ============================================================================
-- PHASE 2: Add team_id to coaching tables (nullable during migration)
-- ============================================================================

-- 4. Add team_id to coaching_erg_scores
ALTER TABLE public.coaching_erg_scores
  ADD COLUMN team_id uuid REFERENCES public.teams(id);

-- 5. Add team_id to coaching_athlete_notes  
ALTER TABLE public.coaching_athlete_notes
  ADD COLUMN team_id uuid REFERENCES public.teams(id);

-- 6. Add team_id to coaching_sessions
ALTER TABLE public.coaching_sessions
  ADD COLUMN team_id uuid REFERENCES public.teams(id);

-- 7. Add team_id to coaching_boatings
ALTER TABLE public.coaching_boatings
  ADD COLUMN team_id uuid REFERENCES public.teams(id);

-- ============================================================================
-- PHASE 3: Migrate existing data
-- ============================================================================

-- 8. Migrate coaching_athletes to athletes table
-- Parse name into first_name/last_name (split on first space)
INSERT INTO public.athletes (id, first_name, last_name, grade, experience_level, side, notes, created_by, created_at, updated_at)
SELECT 
  ca.id,
  CASE 
    WHEN position(' ' in ca.name) > 0 THEN left(ca.name, position(' ' in ca.name) - 1)
    ELSE ca.name
  END as first_name,
  CASE 
    WHEN position(' ' in ca.name) > 0 THEN substring(ca.name from position(' ' in ca.name) + 1)
    ELSE ''
  END as last_name,
  ca.grade,
  ca.experience_level,
  ca.side,
  ca.notes,
  ca.coach_user_id,  -- The coach who created them becomes created_by
  ca.created_at,
  ca.updated_at
FROM public.coaching_athletes ca;

-- 9. Link athletes to teams via team_athletes
-- For each coach, find their team and link their athletes
INSERT INTO public.team_athletes (team_id, athlete_id, status, joined_at)
SELECT DISTINCT
  t.id as team_id,
  ca.id as athlete_id,
  'active' as status,
  ca.created_at as joined_at
FROM public.coaching_athletes ca
JOIN public.teams t ON t.coach_id = ca.coach_user_id;

-- 10. Backfill team_id on coaching_erg_scores
UPDATE public.coaching_erg_scores ces
SET team_id = t.id
FROM public.teams t
WHERE t.coach_id = ces.coach_user_id;

-- 11. Backfill team_id on coaching_athlete_notes
UPDATE public.coaching_athlete_notes can
SET team_id = t.id
FROM public.teams t
WHERE t.coach_id = can.coach_user_id;

-- 12. Backfill team_id on coaching_sessions
UPDATE public.coaching_sessions cs
SET team_id = t.id
FROM public.teams t
WHERE t.coach_id = cs.coach_user_id;

-- 13. Backfill team_id on coaching_boatings
UPDATE public.coaching_boatings cb
SET team_id = t.id
FROM public.teams t
WHERE t.coach_id = cb.coach_user_id;

-- ============================================================================
-- PHASE 4: Update foreign keys to point to athletes table
-- ============================================================================

-- 14. Drop old FK constraints
ALTER TABLE public.coaching_erg_scores
  DROP CONSTRAINT IF EXISTS coaching_erg_scores_athlete_id_fkey;

ALTER TABLE public.coaching_athlete_notes
  DROP CONSTRAINT IF EXISTS coaching_athlete_notes_athlete_id_fkey;

-- 15. Add new FK constraints pointing to athletes
ALTER TABLE public.coaching_erg_scores
  ADD CONSTRAINT coaching_erg_scores_athlete_id_fkey 
  FOREIGN KEY (athlete_id) REFERENCES public.athletes(id);

ALTER TABLE public.coaching_athlete_notes
  ADD CONSTRAINT coaching_athlete_notes_athlete_id_fkey 
  FOREIGN KEY (athlete_id) REFERENCES public.athletes(id);

-- ============================================================================
-- PHASE 5: Make team_id NOT NULL (after backfill)
-- ============================================================================

-- Only run these after verifying all records have team_id populated
-- ALTER TABLE public.coaching_erg_scores ALTER COLUMN team_id SET NOT NULL;
-- ALTER TABLE public.coaching_athlete_notes ALTER COLUMN team_id SET NOT NULL;
-- ALTER TABLE public.coaching_sessions ALTER COLUMN team_id SET NOT NULL;
-- ALTER TABLE public.coaching_boatings ALTER COLUMN team_id SET NOT NULL;

-- ============================================================================
-- PHASE 6: Create indexes
-- ============================================================================

CREATE INDEX idx_athletes_user_id ON public.athletes(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_athletes_created_by ON public.athletes(created_by);
CREATE INDEX idx_team_athletes_team_id ON public.team_athletes(team_id);
CREATE INDEX idx_team_athletes_athlete_id ON public.team_athletes(athlete_id);
CREATE INDEX idx_coaching_erg_scores_team_id ON public.coaching_erg_scores(team_id);
CREATE INDEX idx_coaching_sessions_team_id ON public.coaching_sessions(team_id);

-- ============================================================================
-- PHASE 7: RLS Policies
-- ============================================================================

ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_athletes ENABLE ROW LEVEL SECURITY;

-- Athletes: Viewable by team members, or by the athlete themselves
CREATE POLICY "Athletes viewable by team staff" ON public.athletes
  FOR SELECT USING (
    -- Athlete can see their own record
    (user_id = auth.uid())
    OR
    -- Team members can see athletes on their teams
    EXISTS (
      SELECT 1 FROM public.team_athletes ta
      JOIN public.team_members tm ON tm.team_id = ta.team_id
      WHERE ta.athlete_id = athletes.id
        AND tm.user_id = auth.uid()
    )
    OR
    -- Team owner (coach_id) can see their athletes
    EXISTS (
      SELECT 1 FROM public.team_athletes ta
      JOIN public.teams t ON t.id = ta.team_id
      WHERE ta.athlete_id = athletes.id
        AND t.coach_id = auth.uid()
    )
  );

CREATE POLICY "Athletes insertable by coaches" ON public.athletes
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
  );

CREATE POLICY "Athletes updatable by coaches" ON public.athletes
  FOR UPDATE USING (
    -- Athlete can update own record
    (user_id = auth.uid())
    OR
    -- Team coaches can update athletes on their teams
    EXISTS (
      SELECT 1 FROM public.team_athletes ta
      JOIN public.team_members tm ON tm.team_id = ta.team_id
      WHERE ta.athlete_id = athletes.id
        AND tm.user_id = auth.uid()
        AND tm.role = 'coach'
    )
    OR
    -- Team owner can update
    EXISTS (
      SELECT 1 FROM public.team_athletes ta
      JOIN public.teams t ON t.id = ta.team_id
      WHERE ta.athlete_id = athletes.id
        AND t.coach_id = auth.uid()
    )
  );

CREATE POLICY "Athletes deletable by coaches" ON public.athletes
  FOR DELETE USING (
    -- Only team coaches can delete
    EXISTS (
      SELECT 1 FROM public.team_athletes ta
      JOIN public.team_members tm ON tm.team_id = ta.team_id
      WHERE ta.athlete_id = athletes.id
        AND tm.user_id = auth.uid()
        AND tm.role = 'coach'
    )
    OR
    -- Team owner can delete
    EXISTS (
      SELECT 1 FROM public.team_athletes ta
      JOIN public.teams t ON t.id = ta.team_id
      WHERE ta.athlete_id = athletes.id
        AND t.coach_id = auth.uid()
    )
  );

-- Team Athletes: Same access pattern
CREATE POLICY "Team athletes viewable by team members" ON public.team_athletes
  FOR SELECT USING (
    -- Team members can see
    EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = team_athletes.team_id 
        AND tm.user_id = auth.uid()
    )
    OR
    -- Team owner can see
    EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = team_athletes.team_id 
        AND t.coach_id = auth.uid()
    )
  );

CREATE POLICY "Team athletes manageable by coaches" ON public.team_athletes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = team_athletes.team_id 
        AND tm.user_id = auth.uid()
        AND tm.role = 'coach'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = team_athletes.team_id 
        AND t.coach_id = auth.uid()
    )
  );

-- Update coaching_erg_scores RLS to be team-based
DROP POLICY IF EXISTS "Coaches can manage their erg scores" ON public.coaching_erg_scores;

CREATE POLICY "Team members can view erg scores" ON public.coaching_erg_scores
  FOR SELECT USING (
    -- Legacy records (no team_id yet)
    (team_id IS NULL AND coach_user_id = auth.uid())
    OR
    -- Team members can view
    EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = coaching_erg_scores.team_id 
        AND tm.user_id = auth.uid()
    )
    OR
    -- Team owner can view
    EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = coaching_erg_scores.team_id 
        AND t.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches and coxswains can insert erg scores" ON public.coaching_erg_scores
  FOR INSERT WITH CHECK (
    coach_user_id = auth.uid()
    AND (
      team_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.team_members tm 
        WHERE tm.team_id = coaching_erg_scores.team_id 
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'coxswain')
      )
      OR EXISTS (
        SELECT 1 FROM public.teams t 
        WHERE t.id = coaching_erg_scores.team_id 
          AND t.coach_id = auth.uid()
      )
    )
  );

CREATE POLICY "Coaches and coxswains can update erg scores" ON public.coaching_erg_scores
  FOR UPDATE USING (
    coach_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = coaching_erg_scores.team_id 
        AND tm.user_id = auth.uid()
        AND tm.role IN ('coach', 'coxswain')
    )
    OR EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = coaching_erg_scores.team_id 
        AND t.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete erg scores" ON public.coaching_erg_scores
  FOR DELETE USING (
    coach_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = coaching_erg_scores.team_id 
        AND tm.user_id = auth.uid()
        AND tm.role = 'coach'
    )
    OR EXISTS (
      SELECT 1 FROM public.teams t 
      WHERE t.id = coaching_erg_scores.team_id 
        AND t.coach_id = auth.uid()
    )
  );

-- ============================================================================
-- PHASE 8: Cleanup (run manually after verification)
-- ============================================================================

-- After verifying migration:
-- DROP TABLE public.coaching_athletes;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- DROP POLICY IF EXISTS ... (all policies created above)
-- DROP INDEX IF EXISTS idx_athletes_user_id;
-- DROP INDEX IF EXISTS idx_athletes_created_by;
-- DROP INDEX IF EXISTS idx_team_athletes_team_id;
-- DROP INDEX IF EXISTS idx_team_athletes_athlete_id;
-- DROP INDEX IF EXISTS idx_coaching_erg_scores_team_id;
-- DROP INDEX IF EXISTS idx_coaching_sessions_team_id;
-- ALTER TABLE public.coaching_erg_scores DROP COLUMN team_id;
-- ALTER TABLE public.coaching_athlete_notes DROP COLUMN team_id;
-- ALTER TABLE public.coaching_sessions DROP COLUMN team_id;
-- ALTER TABLE public.coaching_boatings DROP COLUMN team_id;
-- DROP TABLE public.team_athletes;
-- DROP TABLE public.athletes;
