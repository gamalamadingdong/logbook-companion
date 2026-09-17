-- The existing workout_logs statistics trigger references user_profiles without
-- a schema qualifier. Give this service-only security-invoker function a bounded
-- search path so the established trigger can resolve public.user_profiles.
alter function public.c2_development_create_manual_workout(uuid, jsonb)
  set search_path to pg_catalog, public;
