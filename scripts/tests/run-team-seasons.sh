#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
container="lc-team-seasons-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$container" -e POSTGRES_PASSWORD=local-test postgres:16-alpine >/dev/null
for attempt in {1..30}; do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table teams(id uuid primary key,coach_id uuid);
create table athletes(id uuid primary key,first_name text not null,last_name text not null,grade text,user_id uuid);
create table team_athletes(id uuid primary key default gen_random_uuid(),team_id uuid references teams(id),athlete_id uuid references athletes(id),status text not null default 'active' check(status in ('active','inactive','graduated')),squad text,performance_tier text,joined_at timestamptz default now(),left_at timestamptz,unique(team_id,athlete_id));
create table daily_workout_assignments(id uuid primary key default gen_random_uuid(),team_id uuid references teams(id),athlete_id uuid references athletes(id),user_id uuid,workout_date date not null,completed boolean);
create table team_members(team_id uuid,user_id uuid,role text);
create table organization_members(org_id uuid,user_id uuid);
alter table teams add column org_id uuid;
create function can_coach_team(t uuid,u uuid) returns boolean language sql security definer stable set search_path=public as $$ select exists(select 1 from teams where id=t and coach_id=u) or exists(select 1 from team_members where team_id=t and user_id=u and role='coach') or exists(select 1 from organization_members m join teams x on x.org_id=m.org_id where x.id=t and m.user_id=u) $$;
create function can_staff_team(t uuid,u uuid) returns boolean language sql security definer stable set search_path=public as $$ select can_coach_team(t,u) or exists(select 1 from team_members where team_id=t and user_id=u and role='coxswain') $$;
grant usage on schema public,auth to authenticated;
grant select,insert,update,delete on team_athletes,athletes,daily_workout_assignments to authenticated;
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261116215714_team_seasons_and_rosters.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < scripts/tests/team_seasons.sql
# Two independent transactions retry the same preparation concurrently.
for worker in 1 2; do
 docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL' &
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select create_team_season('10000000-0000-0000-0000-000000000001','concurrent retry','2040-01-01','2041-01-01',null,'{}',false);
SQL
 pids[$worker]=$!
done
wait "${pids[1]}"
wait "${pids[2]}"
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin if (select count(*) from team_seasons where name='concurrent retry')<>1 then raise exception 'Concurrent retry duplicated season'; end if; end $$;
SQL
# Hold closure's team lock while a second connection attempts to reopen work.
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select activate_team_season(create_team_season('10000000-0000-0000-0000-000000000001','reopening race','2050-01-01','2051-01-01',null,'{}',false));
insert into daily_workout_assignments(team_id,workout_date,completed) values('10000000-0000-0000-0000-000000000001','2050-02-01',true);
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL' &
set application_name='season_archive_race';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
begin;
select archive_team_season((select id from team_seasons where name='reopening race'));
select pg_sleep(2);
commit;
SQL
archive_pid=$!
archive_waiting=false
for attempt in {1..40}; do
 if [[ "$(docker exec "$container" psql -U postgres -Atc "select exists(select 1 from pg_stat_activity where application_name='season_archive_race' and wait_event='PgSleep')")" == t ]]; then archive_waiting=true; break; fi
 sleep 0.05
done
if [[ "$archive_waiting" != true ]]; then echo 'Archive connection failed to hold its lock' >&2; exit 1; fi
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ begin
 update daily_workout_assignments set completed=false where workout_date='2050-02-01';
 raise exception 'Concurrent reopening bypassed archive';
exception when check_violation then null;
end $$;
SQL
wait "$archive_pid"
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin if exists(select 1 from daily_workout_assignments where workout_date='2050-02-01' and completed is not true) then raise exception 'Archived season gained pending work'; end if; end $$;
SQL
