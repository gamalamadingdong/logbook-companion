-- Add sort_order to coaching_boatings for persistent list ordering
ALTER TABLE coaching_boatings ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Backfill: set sort_order based on current date ordering (newest first)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY date DESC, created_at DESC) AS rn
  FROM coaching_boatings
  WHERE is_active = true
)
UPDATE coaching_boatings SET sort_order = ranked.rn
FROM ranked WHERE coaching_boatings.id = ranked.id;
