-- Personal Records: one derived "best so far" row per (user, activity, metric).
-- Feature: logbook-personal-records (capability-B). Slice s1-schema.
--
-- CONTEXT / INVARIANTS (from the feature plan):
--   * A personal_records row is a DERIVED cache of "the best workout so far for
--     this (user, activity, metric)". It is never hand-entered.
--   * At most one current row per (user_id, activity, metric)  -> UNIQUE constraint.
--   * Owner-scoped: a user only ever sees/affects their own rows -> RLS on user_id,
--     mirroring the existing workout_templates RLS pattern in this project.
--   * No behavior yet: this migration only creates the table + policies.
--
-- References the live schema: public.workout_logs (user_id uuid, id uuid).

-- 1. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_records (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity     text NOT NULL,               -- e.g. 'rower' | 'bike' | 'skierg'
    metric       text NOT NULL,               -- comparable measure, e.g. 'avg_split_500m'
    best_value   double precision NOT NULL,   -- the record value (metric-native units)
    workout_id   uuid REFERENCES public.workout_logs(id) ON DELETE SET NULL,
    achieved_at  timestamptz NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    -- INVARIANT: at most one current PR per (user, activity, metric)
    CONSTRAINT personal_records_unique_per_metric UNIQUE (user_id, activity, metric)
);

-- Helpful index for the common read ("all my PRs")
CREATE INDEX IF NOT EXISTS personal_records_user_idx
    ON public.personal_records (user_id);

-- 2. Row Level Security ------------------------------------------------------
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

-- Owner-only read
DROP POLICY IF EXISTS "Users can view own personal records" ON public.personal_records;
CREATE POLICY "Users can view own personal records"
    ON public.personal_records FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Owner-only insert
DROP POLICY IF EXISTS "Users can create own personal records" ON public.personal_records;
CREATE POLICY "Users can create own personal records"
    ON public.personal_records FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Owner-only update
DROP POLICY IF EXISTS "Users can update own personal records" ON public.personal_records;
CREATE POLICY "Users can update own personal records"
    ON public.personal_records FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Owner-only delete
DROP POLICY IF EXISTS "Users can delete own personal records" ON public.personal_records;
CREATE POLICY "Users can delete own personal records"
    ON public.personal_records FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- 3. Keep updated_at fresh ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.personal_records_touch_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS personal_records_set_updated_at ON public.personal_records;
CREATE TRIGGER personal_records_set_updated_at
    BEFORE UPDATE ON public.personal_records
    FOR EACH ROW EXECUTE FUNCTION public.personal_records_touch_updated_at();
