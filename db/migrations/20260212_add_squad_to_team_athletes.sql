-- Migration: Add squad column to team_athletes
-- Squads are free-form text labels (e.g. "Novice Boys", "JV", "Varsity", "8+ A Boat")
-- Lives on the junction table because squad assignment is team-specific

ALTER TABLE public.team_athletes
  ADD COLUMN squad text;

-- Index for filtering by squad within a team
CREATE INDEX idx_team_athletes_squad ON public.team_athletes (team_id, squad)
  WHERE squad IS NOT NULL;

COMMENT ON COLUMN public.team_athletes.squad IS 'Free-form squad/group label within a team (e.g. Novice Boys, JV, Varsity)';
