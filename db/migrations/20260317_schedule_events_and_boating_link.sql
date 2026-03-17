-- Migration: Add coaching_schedule_events
-- Purpose: Org-wide calendar events (regattas, scrimmages, head races, etc.)
--          that sit alongside coaching_sessions in the schedule view.
--
-- Key design decisions:
--   - org_id scoped (not team_id) — a regatta is visible to all teams in the org
--   - team_ids UUID[] tracks which specific teams are attending
--   - end_date nullable for multi-day events (banner shows on every day)
--   - event_type CHECK constrains to known types
--
-- Also adds optional session_id FK to coaching_boatings for session-linked lineups.

-- ─── Schedule Events ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coaching_schedule_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    coach_user_id   UUID NOT NULL REFERENCES auth.users(id),
    date            DATE NOT NULL,
    end_date        DATE,
    title           TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 200),
    event_type      TEXT NOT NULL CHECK (event_type IN ('regatta', 'scrimmage', 'head_race', 'team_event', 'off_day')),
    location        TEXT,
    team_ids        UUID[] DEFAULT '{}',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_events_org_date
    ON coaching_schedule_events (org_id, date);

CREATE INDEX IF NOT EXISTS idx_schedule_events_date_range
    ON coaching_schedule_events (date, end_date);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE coaching_schedule_events ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of any team in the org can see events
CREATE POLICY coaching_schedule_events_select ON coaching_schedule_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.org_id = coaching_schedule_events.org_id
              AND om.user_id = auth.uid()
        )
    );

-- INSERT: coaches and above in the org
CREATE POLICY coaching_schedule_events_insert ON coaching_schedule_events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.org_id = coaching_schedule_events.org_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'coach')
        )
    );

-- UPDATE: coaches and above in the org
CREATE POLICY coaching_schedule_events_update ON coaching_schedule_events
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.org_id = coaching_schedule_events.org_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'coach')
        )
    );

-- DELETE: coaches and above in the org
CREATE POLICY coaching_schedule_events_delete ON coaching_schedule_events
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.org_id = coaching_schedule_events.org_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'coach')
        )
    );

-- ─── Boating ↔ Session Link ────────────────────────────────────────────────

ALTER TABLE coaching_boatings
    ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES coaching_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_boatings_session
    ON coaching_boatings (session_id)
    WHERE session_id IS NOT NULL;
