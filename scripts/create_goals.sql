-- Create user_goals table
create table if not exists user_goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  type text not null check (type in ('weekly_distance', 'monthly_distance', 'target_2k_watts', 'weekly_sessions')),
  target_value numeric not null,
  start_date timestamptz default now(),
  deadline timestamptz,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table user_goals enable row level security;

-- Policies
create policy "Users can view their own goals"
  on user_goals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own goals"
  on user_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own goals"
  on user_goals for update
  using (auth.uid() = user_id);

create policy "Users can delete their own goals"
  on user_goals for delete
  using (auth.uid() = user_id);
