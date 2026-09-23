-- Benchmark flag for an individual workout.
--
-- The application has always read and written `is_benchmark` on this table, but
-- the column never existed. Reads returned undefined so the flag never showed,
-- and writes were rejected, which also discarded the manual RWN saved in the
-- same request. Across 5,272 workouts none carried the `#test` marker the read
-- path looked for, so nothing needs backfilling: the feature had never once
-- succeeded.
--
-- This is deliberately a column rather than a marker inside the canonical name.
-- A benchmark is a property of a workout, not part of its identity: encoding it
-- in the name would stop a flagged session grouping with other repeats of the
-- same workout, which is exactly what history and template matching rely on.

alter table public.workout_logs
  add column if not exists is_benchmark boolean not null default false;

comment on column public.workout_logs.is_benchmark is
  'Athlete marked this workout as a test effort. Excluded from steady-state analysis.';

-- Analysis filters benchmarks per athlete, and they are a small minority.
create index if not exists workout_logs_user_is_benchmark_idx
  on public.workout_logs (user_id)
  where is_benchmark;
