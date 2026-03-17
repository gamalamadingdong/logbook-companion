-- Add is_active flag to coaching_boatings
-- Active lineups represent the current boats; inactive ones are historical.
-- Existing rows default to true (all current lineups are considered active).

ALTER TABLE public.coaching_boatings
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Index for fast active-lineup queries
CREATE INDEX IF NOT EXISTS idx_coaching_boatings_active
  ON public.coaching_boatings (team_id, is_active)
  WHERE is_active = true;
