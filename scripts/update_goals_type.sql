-- Drop the old check constraint
alter table user_goals drop constraint user_goals_type_check;

-- Add the new check constraint with 'weekly_time'
alter table user_goals add constraint user_goals_type_check 
  check (type in ('weekly_distance', 'monthly_distance', 'target_2k_watts', 'weekly_sessions', 'weekly_time'));
