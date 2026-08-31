-- ROLLBACK for 20260831210000_create_personal_records.sql
-- Run this in the Supabase SQL editor to fully undo the Personal Records table.
-- Safe/idempotent: uses IF EXISTS everywhere.

DROP TRIGGER IF EXISTS personal_records_set_updated_at ON public.personal_records;
DROP FUNCTION IF EXISTS public.personal_records_touch_updated_at();
DROP TABLE IF EXISTS public.personal_records CASCADE;   -- drops the table + its policies + index
