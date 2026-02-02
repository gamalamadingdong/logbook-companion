-- Drop the old check constraint again
alter table user_goals drop constraint if exists user_goals_type_check;

-- Add the new check constraint supporting 'benchmark_goal'
alter table user_goals add constraint user_goals_type_check 
  check (type in ('weekly_distance', 'weekly_time', 'weekly_sessions', 'benchmark_goal'));

-- Add validation key column (e.g. '2000m' or '30:00')
alter table user_goals add column if not exists metric_key text;
