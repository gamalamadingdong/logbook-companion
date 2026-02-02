-- Create table for storing Immutable Power Data
CREATE TABLE IF NOT EXISTS workout_power_distribution (
    workout_id UUID PRIMARY KEY REFERENCES workout_logs(id) ON DELETE CASCADE,
    buckets JSONB NOT NULL, -- Map of "150" (Watts floor) -> Seconds (Float)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE workout_power_distribution ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own data via the join
CREATE POLICY "Read own power distribution"
    ON workout_power_distribution FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workout_logs
            WHERE workout_logs.id = workout_power_distribution.workout_id
            AND workout_logs.user_id = auth.uid()
        )
    );

-- Allow users to insert (required for client-side processing/sync)
CREATE POLICY "Insert own power distribution"
    ON workout_power_distribution FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workout_logs
            WHERE workout_logs.id = workout_power_distribution.workout_id
            AND workout_logs.user_id = auth.uid()
        )
    );

-- Allow updates
CREATE POLICY "Update own power distribution"
    ON workout_power_distribution FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workout_logs
            WHERE workout_logs.id = workout_power_distribution.workout_id
            AND workout_logs.user_id = auth.uid()
        )
    );
