#!/usr/bin/env bash
# Called only with the disposable database container from run-team-permissions.sh.
set -euo pipefail
container="$1"
wait_for_sleep() {
 local app="$1"
 for attempt in {1..60}; do
  if [[ "$(docker exec "$container" psql -U postgres -Atc "select exists(select 1 from pg_stat_activity where application_name='$app' and wait_event='PgSleep')")" == t ]]; then return; fi
  sleep 0.05
 done
 echo "Concurrency worker $app did not acquire its lock" >&2
 return 1
}
# An uncommitted dependency owns an FK key-share lock before DELETE begins.
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL' &
set application_name='club_dependency_first';
begin;
insert into training_block_enrollments(org_id) values('21000000-0000-0000-0000-000000000008');
select pg_sleep(2);
commit;
SQL
worker=$!
wait_for_sleep club_dependency_first
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
do $$begin
 delete from organizations where id='21000000-0000-0000-0000-000000000008';
 raise exception 'Concurrent committed dependency was cascaded away';
exception when check_violation then null;
end $$;
SQL
wait "$worker"
# DELETE wins the row lock: a later dependency must fail its FK, never cascade.
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL' &
set application_name='club_delete_first';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
begin;
delete from organizations where id='21000000-0000-0000-0000-000000000009' returning id;
select pg_sleep(2);
commit;
SQL
worker=$!
wait_for_sleep club_delete_first
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$begin
 insert into training_block_enrollments(org_id) values('21000000-0000-0000-0000-000000000009');
 raise exception 'Concurrent dependency bypassed deleted parent';
exception when foreign_key_violation then null;
end $$;
SQL
wait "$worker"
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$begin
 if not exists(select 1 from organizations where id='21000000-0000-0000-0000-000000000008') or not exists(select 1 from training_block_enrollments where org_id='21000000-0000-0000-0000-000000000008') then raise exception 'Dependency-first race lost data'; end if;
 if exists(select 1 from organizations where id='21000000-0000-0000-0000-000000000009') or exists(select 1 from organization_members where org_id='21000000-0000-0000-0000-000000000009') then raise exception 'Delete-first race did not finish empty deletion'; end if;
end $$;
SQL
