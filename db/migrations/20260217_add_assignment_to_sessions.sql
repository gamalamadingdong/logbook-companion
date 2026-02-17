-- Add optional link from coaching_sessions to group_assignments
-- Allows coaches to associate a schedule session with a workout assignment
ALTER TABLE coaching_sessions
  ADD COLUMN IF NOT EXISTS group_assignment_id UUID REFERENCES group_assignments(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_assignment
  ON coaching_sessions (group_assignment_id)
  WHERE group_assignment_id IS NOT NULL;
