-- Migration: coaching_weekly_plans
-- Purpose: Allow coaches to set weekly focus/goals visible from the coaching dashboard

CREATE TABLE IF NOT EXISTS coaching_weekly_plans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    week_start  DATE NOT NULL,                      -- Monday of the target week
    theme       TEXT,                               -- e.g. "Build the Stroke"
    focus_points TEXT[] DEFAULT '{}',               -- bullet-point goals/focuses
    notes       TEXT,                               -- optional freeform notes
    reflection  TEXT,                               -- end-of-week retrospective
    created_by  UUID NOT NULL REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),

    -- One plan per team per week
    UNIQUE(team_id, week_start)
);

-- Index for fast lookup by team + date
CREATE INDEX IF NOT EXISTS idx_coaching_weekly_plans_team_week
ON coaching_weekly_plans(team_id, week_start DESC);

-- RLS
ALTER TABLE coaching_weekly_plans ENABLE ROW LEVEL SECURITY;

-- Coaches & team members can read their team's plans
CREATE POLICY "Team members can view weekly plans"
ON coaching_weekly_plans FOR SELECT
USING (
    team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
);

-- Only coaches can insert/update/delete
CREATE POLICY "Coaches can manage weekly plans"
ON coaching_weekly_plans FOR ALL
USING (
    team_id IN (
        SELECT team_id FROM team_members
        WHERE user_id = auth.uid() AND role = 'coach'
    )
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_weekly_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coaching_weekly_plans_updated_at
BEFORE UPDATE ON coaching_weekly_plans
FOR EACH ROW EXECUTE FUNCTION update_weekly_plan_updated_at();

COMMENT ON TABLE coaching_weekly_plans IS 'Per-week coaching focus and goals, editable by coaches';
COMMENT ON COLUMN coaching_weekly_plans.week_start IS 'Monday of the target week (ISO week start)';
COMMENT ON COLUMN coaching_weekly_plans.focus_points IS 'Array of short bullet-point goals for the week';
COMMENT ON COLUMN coaching_weekly_plans.reflection IS 'End-of-week coaching retrospective/reflection';
