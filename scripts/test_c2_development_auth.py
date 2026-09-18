#!/usr/bin/env python3
"""Local-only PostgreSQL regression test; disposable Docker DB, no host ports/secrets.
Run: python3 scripts/test_c2_development_auth.py
Never connects to Supabase or reads environment files.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import json
import time
import uuid

name = 'lc-c2-test-' + uuid.uuid4().hex[:10]
root = Path(__file__).resolve().parents[1]

def sql(text, ok=True):
    p = subprocess.run(['docker', 'exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
                       input=text, text=True, capture_output=True)
    if ok and p.returncode:
        raise AssertionError(p.stderr)
    return p

try:
    subprocess.run(['docker', 'run', '-d', '--rm', '--name', name, '--network', 'none',
                    '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16-alpine'], check=True, capture_output=True)
    for _ in range(60):
        if subprocess.run(['docker', 'exec', name, 'pg_isready', '-U', 'postgres'], capture_output=True).returncode == 0:
            break
        time.sleep(0.5)
    else:
        raise RuntimeError('Local PostgreSQL did not start')
    sql("""
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
    """)
    sql((root / 'supabase/migrations/20260916150000_concept2_development_auth.sql').read_text())
    for role in ['anon', 'authenticated']:
        for operation in ["select * from public.c2_development_auth", "select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','status')"]:
            p = sql(f'set role {role}; {operation};', ok=False)
            assert p.returncode != 0 and 'permission denied' in p.stderr, (role, operation)
    print('PASS: anonymous/authenticated direct table and RPC access denied')
    sql("""
      create function pg_temp.denied(q text) returns void language plpgsql as $$
      begin
        begin execute q; exception when others then return; end;
        raise exception 'Expected rejection: %', q;
      end $$;
      select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','begin','{"state_hash":"state-a"}');
      select pg_temp.denied($q$select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000002','exchange','{"state_hash":"state-a"}')$q$);
      select pg_temp.denied($q$select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','exchange','{"state_hash":"wrong"}')$q$);
      select pg_temp.denied($q$select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','exchange','{}')$q$);
      update public.c2_development_auth set state_expires_at=now()-interval '1 second';
      select pg_temp.denied($q$select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','exchange','{"state_hash":"state-a"}')$q$);
      select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','begin','{"state_hash":"state-b"}');
      select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','exchange','{"state_hash":"state-b"}');
      select pg_temp.denied($q$select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','exchange','{"state_hash":"state-b"}')$q$);
      select pg_temp.denied($q$select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','save','{}')$q$);
      select pg_temp.denied($q$select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','save','{"operation_id":"00000000-0000-0000-0000-000000000000"}')$q$);
      select public.c2_development_auth_operation(user_id,'save',jsonb_build_object('operation_id',operation_id,
        'access_token','fixture-access','refresh_token','fixture-refresh','expires_at',now()-interval '1 second','provider_user_id','42'))
        from public.c2_development_auth where user_id='00000000-0000-0000-0000-000000000001';
      select pg_temp.denied($q$select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','exchange','{"state_hash":"state-b"}')$q$);
      select pg_temp.denied($q$update public.c2_development_auth set environment='production'$q$);
      select pg_temp.denied($q$insert into public.c2_development_auth(user_id,provider_user_id) values ('00000000-0000-0000-0000-000000000002','42')$q$);
    """)
    print('PASS: user isolation, TTL, state mismatch/missing/replay, generation fencing, environment/account uniqueness')
    def refresh(_):
        return sql("set role service_role; select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','refresh');", ok=False)
    with ThreadPoolExecutor(max_workers=8) as pool:
        attempts = list(pool.map(refresh, range(8)))
    assert sum(p.returncode == 0 for p in attempts) == 1
    assert all(p.returncode == 0 or 'Operation pending' in p.stderr for p in attempts)
    print('PASS: 8 concurrent refresh attempts, exactly 1 claim (service role)')
    sql("""
      update public.c2_development_auth set operation_started_at=now()-interval '2 days';
    """)
    assert refresh(0).returncode != 0
    sql("""
      select public.c2_development_auth_operation(user_id,'reject',jsonb_build_object('operation_id',operation_id))
        from public.c2_development_auth where user_id='00000000-0000-0000-0000-000000000001';
      do $$begin
        if exists(select 1 from public.c2_development_auth where access_token is not null or refresh_token is not null or operation_id is not null) then
          raise exception 'Rejected credentials were not cleared'; end if;
      end$$;
    """)
    assert refresh(0).returncode != 0
    sql("select public.c2_development_auth_operation('00000000-0000-0000-0000-000000000001','begin','{\"state_hash\":\"reconnect\"}');")
    print('PASS: no timed lock stealing; invalid_grant clears credentials and permits reconnect, not refresh')
    sql((root / 'supabase/migrations/20260916160000_concept2_development_results.sql').read_text())
    for role in ['anon', 'authenticated']:
        for statement in ["select * from public.c2_development_results", "select public.c2_development_sync_operation('00000000-0000-0000-0000-000000000001','list')"]:
            p = sql(f'set role {role}; {statement}', ok=False)
            assert p.returncode != 0 and 'permission denied' in p.stderr
    sql("""
      insert into public.c2_development_auth(user_id) values ('00000000-0000-0000-0000-000000000002') on conflict do nothing;
      update public.c2_development_auth set access_token='fixture-access', refresh_token='fixture-refresh',
        expires_at=now()+interval '1 hour', needs_reconnect=false, operation_id=null,
        provider_user_id=case when user_id='00000000-0000-0000-0000-000000000001' then '42' else '43' end;
      create table public.workout_logs(id int primary key, marker text);
      insert into public.workout_logs values(1,'production sentinel');
      do $$declare u uuid := '00000000-0000-0000-0000-000000000001'; claim jsonb; v jsonb; begin
        for i in 1..2 loop
          claim := public.c2_development_sync_operation(u,'claim');
          perform public.c2_development_sync_operation(u,'save',jsonb_build_object('operation_id',claim->>'operation_id',
            'results','[{"id":123,"distance":5000,"time":12345,"type":"rower","date":"2026-09-16"}]'::jsonb));
        end loop;
        v := public.c2_development_sync_operation(u,'list');
        if v->>'total' <> '1' or v->'results'->0->>'time' <> '12345' then raise exception 'Dedup/units failed'; end if;
        v := public.c2_development_sync_operation('00000000-0000-0000-0000-000000000002','list');
        if v->>'total' <> '0' then raise exception 'Cross-user leak'; end if;
        update public.c2_development_auth set provider_user_id='different' where user_id=u;
        v := public.c2_development_sync_operation(u,'list');
        if v->>'total' <> '0' then raise exception 'Cross-account leak'; end if;
        update public.c2_development_auth set provider_user_id='42' where user_id=u;
      end $$;
    """)
    def claim_sync(_):
        return sql("set role service_role; select public.c2_development_sync_operation('00000000-0000-0000-0000-000000000001','claim');", ok=False)
    with ThreadPoolExecutor(max_workers=8) as pool:
        claims = list(pool.map(claim_sync, range(8)))
    assert sum(p.returncode == 0 for p in claims) == 1
    assert refresh(0).returncode != 0
    assert sql("select public.c2_development_sync_operation('00000000-0000-0000-0000-000000000001','release','{\"operation_id\":\"00000000-0000-0000-0000-000000000000\"}');", ok=False).returncode != 0
    sql("""
      select public.c2_development_sync_operation(user_id,'unauthorized',jsonb_build_object('operation_id',operation_id))
        from public.c2_development_auth where user_id='00000000-0000-0000-0000-000000000001';
    """)
    assert claim_sync(0).returncode != 0
    assert sql("select marker from public.workout_logs").stdout.strip() == 'production sentinel'
    assert sql("select count(*) from public.workout_logs").stdout.strip() == '1'
    print('PASS: isolated result permissions, duplicate imports, user/account boundaries, shared refresh mutex, stale release fencing, expired-token guard, production sentinel unchanged')
    sql((root / 'supabase/migrations/20260916200841_concept2_development_write_scope.sql').read_text())
    sql("""
      do $$declare u uuid := '00000000-0000-0000-0000-000000000001'; v jsonb; begin
        v := public.c2_development_auth_operation(u,'status');
        if v->>'can_publish' is distinct from 'false' then raise exception 'Existing connection gained write scope'; end if;
        v := public.c2_development_auth_operation(u,'begin',
          '{"state_hash":"write-state","requested_scope":"user:read,results:write"}');
        v := public.c2_development_auth_operation(u,'exchange','{"state_hash":"write-state"}');
        if v->>'token_scope' is distinct from 'user:read,results:write' then raise exception 'Exchange scope mismatch'; end if;
        perform public.c2_development_auth_operation(u,'save',jsonb_build_object(
          'operation_id',v->>'operation_id','access_token','fixture-write-access',
          'refresh_token','fixture-write-refresh','provider_user_id','42',
          'expires_at',now()-interval '1 second','token_scope','user:read,results:write'));
        v := public.c2_development_auth_operation(u,'status');
        if v->>'can_publish' is distinct from 'true' then raise exception 'Write reconnect not recorded'; end if;
        v := public.c2_development_auth_operation(u,'refresh');
        if v->>'token_scope' is distinct from 'user:read,results:write' then raise exception 'Refresh downscoped write grant'; end if;
        perform public.c2_development_auth_operation(u,'reject',jsonb_build_object('operation_id',v->>'operation_id'));
      end $$;
    """)
    print('PASS: existing grant remains read-only; write reconnect and refresh retain write scope')
    sql("""
      drop table public.workout_logs;
      create table public.workout_logs (
        id uuid primary key, user_id uuid not null, source text, workout_type text,
        workout_name text not null default 'workout', canonical_name text,
        canonical_signature text, duration_minutes numeric,
        raw_data jsonb, manual_rwn text, completed_at timestamptz,
        distance_meters integer, duration_seconds numeric, rest_distance_meters integer,
        external_id text, notes text, template_id uuid
      );
      insert into public.workout_logs(id,user_id,source,workout_type,raw_data,manual_rwn,
        completed_at,distance_meters,duration_seconds,notes) values
      ('00000000-0000-0000-0000-00000000aaaa','00000000-0000-0000-0000-000000000001',
        'manual','row','{"source":"training_block_manual_entry","mode":"row"}',
        '5000m','2026-09-16 12:00:00+00',5000,1200,'keep original note');
      update public.c2_development_auth set access_token='write-access',refresh_token='write-refresh',
        expires_at=now()+interval '1 hour',needs_reconnect=false,operation_id=null,
        token_scope='user:read,results:write',provider_user_id='42'
        where user_id='00000000-0000-0000-0000-000000000001';
    """)
    sql((root / 'supabase/migrations/20260916202911_concept2_development_manual_publication.sql').read_text())
    sql((root / 'supabase/migrations/20260917124000_concept2_development_manual_entry.sql').read_text())
    sql((root / 'supabase/migrations/20260917130000_fix_concept2_development_manual_entry_trigger_path.sql').read_text())
    sql((root / 'supabase/migrations/20260917134500_add_concept2_development_publication_provenance.sql').read_text())
    sql((root / 'supabase/migrations/20260917172700_concept2_shared_publication_core.sql').read_text())
    sql((root / 'supabase/migrations/20260917190000_concept2_development_interval_fixtures.sql').read_text())
    sql((root / 'supabase/migrations/20260918142512_concept2_general_manual_summary_publication.sql').read_text())
    for role in ['anon', 'authenticated']:
        for statement in ["select * from public.c2_development_publications", "select public.c2_development_publish_operation('00000000-0000-0000-0000-000000000001','list')"]:
            p = sql(f'set role {role}; {statement}', ok=False)
            assert p.returncode != 0 and 'permission denied' in p.stderr
    sql("""
      do $$declare u uuid := '00000000-0000-0000-0000-000000000001';
        w uuid := '00000000-0000-0000-0000-00000000aaaa'; v jsonb; again jsonb;
      begin
        begin
          perform public.c2_development_publish_operation('00000000-0000-0000-0000-000000000002',
            'claim',jsonb_build_object('workout_id',w,'timezone','America/New_York',
            'weight_class','H','privacy','private','confirmed_completed',true));
          raise exception 'Cross-user claim succeeded';
        exception when others then
          if sqlerrm='Cross-user claim succeeded' then raise; end if;
        end;
        v := public.c2_development_publish_operation(u,'claim',jsonb_build_object(
          'workout_id',w,'timezone','America/New_York','weight_class','H',
          'privacy','private','confirmed_completed',true));
        if v->>'dispatch' is distinct from 'true' or v->'payload'->>'date' is distinct from '2026-09-16 08:00:00'
          or v->'payload'->>'time' is distinct from '12000'
          or v->'payload'->>'comments' is distinct from 'Logbook Companion workout ID: ' || w::text then
          raise exception 'Invalid claim payload: %',v; end if;
        again := public.c2_development_publish_operation(u,'claim',jsonb_build_object(
          'workout_id',w,'timezone','America/New_York','weight_class','H',
          'privacy','private','confirmed_completed',true));
        if again->>'dispatch' is distinct from 'false' or again->>'status' is distinct from 'outcome_unknown' then
          raise exception 'Second claim dispatched: %',again; end if;
        perform public.c2_development_publish_operation(u,'finish',jsonb_build_object(
          'attempt_id',v->>'attempt_id','result_id',999,'outcome','published'));
        again := public.c2_development_publish_operation(u,'claim',jsonb_build_object(
          'workout_id',w,'timezone','America/New_York','weight_class','H',
          'privacy','private','confirmed_completed',true));
        if again->>'dispatch' is distinct from 'false' or again->>'result_id' is distinct from '999' then
          raise exception 'Published retry dispatched'; end if;
        perform public.c2_development_sync_operation(u,'claim');
        select to_jsonb(operation_id::text) into strict v from public.c2_development_auth where user_id=u;
        perform public.c2_development_sync_operation(u,'save',jsonb_build_object(
          'operation_id',v,'results','[{"id":999,"distance":5000,"time":12000,"type":"rower","date":"2026-09-16 08:00:00"}]'::jsonb));
        v := public.c2_development_sync_operation(u,'list');
        if v->'results'->0->>'lc_workout_id' is distinct from w::text then
          raise exception 'Reimport lost exact LC identity: %',v; end if;
        if (select source from public.workout_logs where id=w) is distinct from 'manual'
          or (select notes from public.workout_logs where id=w) is distinct from 'keep original note'
          or (select external_id from public.workout_logs where id=w) is not null then
          raise exception 'Original workout changed'; end if;
      end $$;
    """)
    print('PASS: manual publication ownership, measured payload, one dispatch, exact-ID sync link, original row preserved')
    sql("""
      do $$declare u uuid := '00000000-0000-0000-0000-000000000001'; v jsonb;
      begin
        v:=public.c2_development_create_manual_workout(u,'{"distance_meters":6000,"duration_seconds":1500,"completed_at":"2026-09-17T11:00:00Z"}');
        if not exists(select 1 from public.workout_logs where id=(v->>'workout_id')::uuid
          and user_id=u and source='manual' and manual_rwn='6000m'
          and raw_data->>'entry_surface'='concept2_development_test') then
          raise exception 'Development manual row not saved correctly: %',v; end if;
        begin
          perform public.c2_development_create_manual_workout(u,'{"distance_meters":0,"duration_seconds":1500,"completed_at":"2026-09-17T11:00:00Z"}');
          raise exception 'Invalid manual row accepted';
        exception when others then
          if sqlerrm='Invalid manual row accepted' then raise; end if;
        end;
      end $$;
    """)
    for role in ['anon', 'authenticated']:
        p = sql(f"set role {role}; select public.c2_development_create_manual_workout('00000000-0000-0000-0000-000000000001','{{}}');", ok=False)
        assert p.returncode != 0 and 'permission denied' in p.stderr
    print('PASS: development test entry creates one owned manual LC row; invalid and direct client calls are rejected')
    sql("""
      do $$declare u uuid := '00000000-0000-0000-0000-000000000001'; created jsonb; claimed jsonb;
        w uuid; body jsonb;
      begin
        created:=public.c2_development_create_manual_workout(u,
          '{"distance_meters":6000,"duration_seconds":1500,"completed_at":"2026-09-17T11:00:00Z","publication_shape":"fixed_time"}');
        w:=(created->>'workout_id')::uuid;
        body:=jsonb_build_object('type','rower','date','2026-09-17 11:00:00','timezone','UTC',
          'distance',6000,'time',15000,'workout_type','FixedTimeSplits','weight_class','H',
          'privacy','private','comments','Logbook Companion workout ID: ' || w::text);
        claimed:=public.c2_development_publish_operation(u,'claim',jsonb_build_object(
          'workout_id',w,'timezone','UTC','weight_class','H','privacy','private',
          'confirmed_completed',true,'payload',body));
        if claimed->>'dispatch' is distinct from 'true' or claimed->'payload' is distinct from body
          or (select manual_rwn from public.workout_logs where id=w) is distinct from '1500s'
          or (select mapper_version from public.c2_development_publications where workout_id=w) <> 1 then
          raise exception 'Fixed-time shared-core claim failed: %',claimed; end if;
        perform public.c2_development_publish_operation(u,'finish',jsonb_build_object(
          'attempt_id',claimed->>'attempt_id','outcome','rejected'));
      end $$;
    """)
    print('PASS: fixed-time test row and exact shared-core payload are durably claimed')
    sql("""
      do $$declare u uuid := '00000000-0000-0000-0000-000000000001';
        w uuid := '11111111-2222-4333-8444-555555555555'; completed jsonb;
        payload jsonb; claim jsonb; again jsonb;
      begin
        completed:=jsonb_build_object('_v',1,'activity','indoor_row','status','completed',
          'equipment',jsonb_build_object('brand','concept2','name','RowErg'),
          'detailCoverage','none','segments','[]'::jsonb,'timezone','America/New_York',
          'completedAt','2026-09-17T12:30:00Z',
          'summary',jsonb_build_object('distanceMeters',10000,'durationSeconds',2400));
        insert into public.workout_logs(id,user_id,source,workout_type,completed_at,
          distance_meters,duration_seconds,raw_data) values
          (w,u,'manual','row','2026-09-17T12:30:00Z',10000,2400,
           jsonb_build_object('source','general_manual_entry','completed_result',completed));
        payload:=jsonb_build_object('type','rower','date','2026-09-17 08:30:00',
          'timezone','America/New_York','distance',10000,'time',24000,
          'workout_type','unknown','weight_class','H','privacy','private',
          'comments','Logbook Companion workout ID: ' || w::text);
        begin
          perform public.c2_development_publish_operation('00000000-0000-0000-0000-000000000002',
            'claim',jsonb_build_object('workout_id',w,'timezone','America/New_York',
            'weight_class','H','privacy','private','confirmed_completed',true,'payload',payload));
          raise exception 'Cross-user manual claim accepted';
        exception when others then
          if sqlerrm='Cross-user manual claim accepted' then raise; end if;
        end;
        begin
          perform public.c2_development_publish_operation(u,'claim',jsonb_build_object(
            'workout_id',w,'timezone','UTC','weight_class','H','privacy','private',
            'confirmed_completed',true,'payload',payload));
          raise exception 'Changed timezone accepted';
        exception when others then
          if sqlerrm='Changed timezone accepted' then raise; end if;
        end;
        claim:=public.c2_development_publish_operation(u,'claim',jsonb_build_object(
          'workout_id',w,'timezone','America/New_York','weight_class','H',
          'privacy','private','confirmed_completed',true,'payload',payload));
        if claim->>'dispatch' is distinct from 'true' or claim->'payload' is distinct from payload
          or (select mapper_version from public.c2_development_publications where workout_id=w) <> 1 then
          raise exception 'General manual claim failed: %',claim; end if;
        perform public.c2_development_publish_operation(u,'finish',jsonb_build_object(
          'attempt_id',claim->>'attempt_id','result_id',1010,'outcome','published'));
        again:=public.c2_development_publish_operation(u,'claim',jsonb_build_object(
          'workout_id',w,'timezone','America/New_York','weight_class','H',
          'privacy','private','confirmed_completed',true,'payload',payload));
        if again->>'dispatch' is distinct from 'false' or again->>'result_id' is distinct from '1010'
          or (select attempt_count from public.c2_development_publications where workout_id=w) <> 1 then
          raise exception 'General manual duplicate dispatched: %',again; end if;
      end $$;
    """)
    print('PASS: general manual RowErg claim, exact payload/timezone, ownership, mapper version, duplicate fence')
    sql((root / 'supabase/migrations/20260918160118_concept2_general_manual_interval_publication.sql').read_text())
    sql((root / 'supabase/migrations/20260918190410_concept2_fixed_interval_rest_distance.sql').read_text())
    for role in ['anon', 'authenticated']:
        denied = sql(f"set role {role}; select public.c2_development_manual_interval_payload(null,'UTC','H','private');", ok=False)
        assert denied.returncode != 0 and 'permission denied' in denied.stderr
    sql("""
      do $$declare u uuid := '00000000-0000-0000-0000-000000000001';
        w uuid; completed jsonb; segments jsonb; payload jsonb; claim jsonb; again jsonb;
        shape text; distance integer; elapsed integer; work_time integer; rest_distance integer;
        template uuid := 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
      begin
        for i in 1..5 loop
          w := ('99999999-8888-4777-8666-' || lpad(i::text,12,'0'))::uuid;
          if i=1 then
            segments := jsonb_build_array(
              jsonb_build_object('role','work','intervalKind','distance','target',null,'distanceMeters',500,'durationSeconds',120),
              jsonb_build_object('role','rest','target',null,'durationSeconds',60),
              jsonb_build_object('role','work','intervalKind','distance','target',null,'distanceMeters',500,'durationSeconds',120));
            shape:='FixedDistanceInterval'; distance:=1000; elapsed:=300; work_time:=240; rest_distance:=0;
          elsif i=2 then
            segments := jsonb_build_array(
              jsonb_build_object('role','work','intervalKind','time','target',null,'distanceMeters',480,'durationSeconds',120),
              jsonb_build_object('role','rest','target',null,'durationSeconds',45),
              jsonb_build_object('role','work','intervalKind','time','target',null,'distanceMeters',500,'durationSeconds',120),
              jsonb_build_object('role','rest','target',null,'durationSeconds',45),
              jsonb_build_object('role','work','intervalKind','time','target',null,'distanceMeters',520,'durationSeconds',120));
            shape:='FixedTimeInterval'; distance:=1500; elapsed:=450; work_time:=360; rest_distance:=0;
          elsif i=3 then
            segments := jsonb_build_array(
              jsonb_build_object('role','work','intervalKind','distance','target',null,'distanceMeters',500,'durationSeconds',120),
              jsonb_build_object('role','rest','target',null,'distanceMeters',25,'durationSeconds',30),
              jsonb_build_object('role','work','intervalKind','time','target',null,'distanceMeters',700,'durationSeconds',180),
              jsonb_build_object('role','rest','target',null,'distanceMeters',15,'durationSeconds',15));
            shape:='VariableInterval'; distance:=1200; elapsed:=345; work_time:=300; rest_distance:=40;
          elsif i=4 then
            segments := jsonb_build_array(
              jsonb_build_object('role','work','intervalKind','distance','target',null,'distanceMeters',500,'durationSeconds',121),
              jsonb_build_object('role','rest','target',null,'distanceMeters',1,'durationSeconds',60),
              jsonb_build_object('role','work','intervalKind','distance','target',null,'distanceMeters',500,'durationSeconds',115));
            shape:='FixedDistanceInterval'; distance:=1000; elapsed:=296; work_time:=236; rest_distance:=1;
          else
            segments := jsonb_build_array(
              jsonb_build_object('role','work','intervalKind','time','target',null,'distanceMeters',480,'durationSeconds',120),
              jsonb_build_object('role','rest','target',null,'distanceMeters',10,'durationSeconds',45),
              jsonb_build_object('role','work','intervalKind','time','target',null,'distanceMeters',500,'durationSeconds',120),
              jsonb_build_object('role','rest','target',null,'distanceMeters',20,'durationSeconds',45),
              jsonb_build_object('role','work','intervalKind','time','target',null,'distanceMeters',520,'durationSeconds',120));
            shape:='FixedTimeInterval'; distance:=1500; elapsed:=450; work_time:=360; rest_distance:=30;
          end if;
          completed := jsonb_build_object('_v',1,'activity','indoor_row','status','completed',
            'equipment',jsonb_build_object('brand','concept2','name','RowErg'),
            'detailCoverage','full','segments',segments,'timezone','America/New_York',
            'completedAt','2026-09-17T12:30:00Z','workTimeSeconds',work_time,
            'summary',jsonb_build_object('distanceMeters',distance+rest_distance,'durationSeconds',elapsed),
            'plannedRwn',case when i=1 then '2x500m/1:00r' else null end);
          if i=1 then completed := completed || jsonb_build_object('plannedTemplate',jsonb_build_object('id',template,'name','Two 500s')); end if;
          insert into public.workout_logs(id,user_id,source,workout_type,completed_at,
            distance_meters,rest_distance_meters,duration_seconds,template_id,raw_data) values
            (w,u,'manual','row','2026-09-17T12:30:00Z',distance,rest_distance,elapsed,
             case when i=1 then template else null end,
             jsonb_build_object('source','general_manual_entry','completed_result',completed));
          select public.c2_development_manual_interval_payload(wl,'America/New_York','H','private')
            into payload from public.workout_logs wl where wl.id=w;
          if payload->>'workout_type' is distinct from shape or
             (payload->>'distance')::integer is distinct from distance or
             (payload->>'time')::integer is distinct from work_time*10 or
             (payload->>'rest_distance')::integer is distinct from rest_distance or
             jsonb_array_length(payload->'workout'->'intervals') is distinct from (case when i in (2,5) then 3 else 2 end) then
             raise exception 'Interval payload shape/totals incorrect: %',payload; end if;
          if shape <> 'VariableInterval' and exists(
             select 1 from jsonb_array_elements(payload->'workout'->'intervals') interval
             where interval ? 'rest_distance') then
             raise exception 'Fixed interval includes per-interval rest distance'; end if;
          begin
            perform public.c2_development_publish_operation(u,'claim',jsonb_build_object(
              'workout_id',w,'timezone','America/New_York','weight_class','H',
              'privacy','private','confirmed_completed',true,'payload',payload || jsonb_build_object('distance',999)));
            raise exception 'Tampered interval payload accepted';
          exception when others then
            if sqlerrm='Tampered interval payload accepted' then raise; end if;
          end;
          claim := public.c2_development_publish_operation(u,'claim',jsonb_build_object(
            'workout_id',w,'timezone','America/New_York','weight_class','H',
            'privacy','private','confirmed_completed',true,'payload',payload));
          if claim->>'dispatch' is distinct from 'true' or claim->'payload' is distinct from payload or
             (select mapper_version from public.c2_development_publications where workout_id=w) <> 2 then
             raise exception 'Measured interval claim failed: %',claim; end if;
          perform public.c2_development_publish_operation(u,'finish',jsonb_build_object(
            'attempt_id',claim->>'attempt_id','result_id',1100+i,'outcome','published'));
          again := public.c2_development_publish_operation(u,'claim',jsonb_build_object(
            'workout_id',w,'timezone','America/New_York','weight_class','H',
            'privacy','private','confirmed_completed',true,'payload',payload));
          if again->>'dispatch' is distinct from 'false' or
             (select attempt_count from public.c2_development_publications where workout_id=w) <> 1 then
             raise exception 'Measured interval duplicate dispatched'; end if;
        end loop;
      end $$;
    """)
    print('PASS: measured manual fixed-distance, fixed-time, variable intervals with rest distance, template link, exact payload fence, duplicate fence')
    for role in ['anon', 'authenticated']:
        for statement in ["select * from public.c2_development_fixture_workouts", "select public.c2_development_create_fixture_workout('00000000-0000-0000-0000-000000000001','fixed_distance_intervals_2x500m','{}')"]:
            p = sql(f'set role {role}; {statement};', ok=False)
            assert p.returncode != 0 and 'permission denied' in p.stderr
    sql("""
      do $$declare u uuid := '00000000-0000-0000-0000-000000000001';
        w uuid := '44444444-5555-4666-8777-888888888888'; completed jsonb; created jsonb;
        body jsonb; claimed jsonb; again jsonb; saved jsonb;
      begin
        completed:=jsonb_build_object('_v',2,'workoutId',w,'ownerId',u,
          'source','synthetic_fixture','completionStatus','completed','machine','rower',
          'shape',jsonb_build_object('kind','fixed_distance_interval'),
          'completedAt',to_char(now()-interval '10 minutes','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'timezone','America/New_York','distanceMeters',1000,'workTimeSeconds',240,
          'restDistanceMeters',0,'restTimeSeconds',60,
          'intervals',jsonb_build_array(
            jsonb_build_object('kind','distance','distanceMeters',500,'workTimeSeconds',120,'restDistanceMeters',0,'restTimeSeconds',60),
            jsonb_build_object('kind','distance','distanceMeters',500,'workTimeSeconds',120,'restDistanceMeters',0,'restTimeSeconds',0)));
        created:=public.c2_development_create_fixture_workout(u,'fixed_distance_intervals_2x500m',completed);
        if created->>'workout_id' is distinct from w::text then raise exception 'Fixture identity changed'; end if;
        body:=jsonb_build_object('type','rower',
          'date',to_char((completed->>'completedAt')::timestamptz at time zone 'America/New_York','YYYY-MM-DD HH24:MI:SS'),
          'timezone','America/New_York','distance',1000,'time',2400,
          'workout_type','FixedDistanceInterval','rest_distance',0,'rest_time',600,
          'workout',jsonb_build_object('intervals',jsonb_build_array(
            jsonb_build_object('type','distance','distance',500,'time',1200,'rest_time',600),
            jsonb_build_object('type','distance','distance',500,'time',1200,'rest_time',0))),
          'weight_class','H','privacy','private','comments','Logbook Companion workout ID: ' || w::text);
        begin
          perform public.c2_development_publish_operation(u,'claim',jsonb_build_object(
            'workout_id',w,'timezone','America/New_York','weight_class','H','privacy','private',
            'confirmed_completed',true,'payload',body));
          raise exception 'Manual confirmation accepted for fixture';
        exception when others then
          if sqlerrm='Manual confirmation accepted for fixture' then raise; end if;
        end;
        begin
          perform public.c2_development_publish_operation(u,'claim',jsonb_build_object(
            'workout_id',w,'timezone','America/New_York','weight_class','H','privacy','private',
            'confirmed_fixture',true,'payload',body || '{"time":999}'::jsonb));
          raise exception 'Tampered interval payload accepted';
        exception when others then
          if sqlerrm='Tampered interval payload accepted' then raise; end if;
        end;
        update public.workout_logs set distance_meters=999 where id=w;
        begin
          perform public.c2_development_publish_operation(u,'claim',jsonb_build_object(
            'workout_id',w,'timezone','America/New_York','weight_class','H','privacy','private',
            'confirmed_fixture',true,'payload',body));
          raise exception 'Changed source row accepted';
        exception when others then
          if sqlerrm='Changed source row accepted' then raise; end if;
        end;
        update public.workout_logs set distance_meters=1000 where id=w;
        claimed:=public.c2_development_publish_operation(u,'claim',jsonb_build_object(
          'workout_id',w,'timezone','America/New_York','weight_class','H','privacy','private',
          'confirmed_fixture',true,'payload',body));
        if claimed->>'dispatch' is distinct from 'true' or claimed->'payload' is distinct from body
          or (select mapper_version from public.c2_development_publications where workout_id=w) <> 2 then
          raise exception 'Fixture claim failed: %',claimed; end if;
        again:=public.c2_development_publish_operation(u,'claim',jsonb_build_object('workout_id',w));
        if again->>'dispatch' is distinct from 'false' then raise exception 'Fixture duplicate dispatched'; end if;
        perform public.c2_development_publish_operation(u,'finish',jsonb_build_object(
          'attempt_id',claimed->>'attempt_id','outcome','published','result_id',1001));
        perform public.c2_development_sync_operation(u,'claim');
        perform public.c2_development_sync_operation(u,'save',jsonb_build_object(
          'operation_id',(select operation_id from public.c2_development_auth where user_id=u),
          'results',jsonb_build_array(jsonb_build_object('id',1001,'distance',1000,
            'time',2400,'type','rower','date',body->>'date'))));
        saved:=public.c2_development_sync_operation(u,'list');
        if (select x->>'lc_workout_id' from jsonb_array_elements(saved->'results') x
          where x->>'id'='1001') is distinct from w::text then
          raise exception 'Fixture exact-ID import lost LC link'; end if;
        if (select external_id from public.workout_logs where id=w) is not null then
          raise exception 'Source row contaminated by development ID'; end if;
      end $$;
    """)
    print('PASS: service-only fixture creation and exact interval claim, tamper rejection, duplicate fence')
    generated = subprocess.run(['node', '--input-type=module', '-e', """
      import { bindDevelopmentFixture } from './supabase/functions/_shared/concept2/fixtures/index.ts';
      import { mapCompletedWorkoutToConcept2 } from './supabase/functions/_shared/concept2/publication.ts';
      const names = ['fixed_time_intervals_3x120s', 'variable_intervals_mixed'];
      const ids = ['55555555-6666-4777-8888-999999999999', '66666666-7777-4888-8999-aaaaaaaaaaaa'];
      const completedAt = new Date(Date.now() - 1200000).toISOString();
      console.log(JSON.stringify(names.map((name, index) => {
        const completed = bindDevelopmentFixture(name, ids[index],
          '00000000-0000-0000-0000-000000000001', completedAt);
        return { name, completed, payload: mapCompletedWorkoutToConcept2(completed,
          { timezone: completed.timezone, weightClass: 'H', privacy: 'private' }) };
      })));
    """], cwd=root, text=True, capture_output=True, check=True)
    for result_id, item in enumerate(json.loads(generated.stdout), start=1002):
        fixture_name = item['name']
        completed = json.dumps(item['completed']).replace("'", "''")
        payload = json.dumps(item['payload']).replace("'", "''")
        sql(f"""
          do $$declare u uuid := '00000000-0000-0000-0000-000000000001';
            c jsonb := '{completed}'::jsonb; b jsonb := '{payload}'::jsonb;
            w uuid; claimed jsonb; again jsonb;
          begin
            w := (c->>'workoutId')::uuid;
            perform public.c2_development_create_fixture_workout(u,'{fixture_name}',c);
            claimed := public.c2_development_publish_operation(u,'claim',jsonb_build_object(
              'workout_id',w,'timezone','America/New_York','weight_class','H',
              'privacy','private','confirmed_fixture',true,'payload',b));
            if claimed->>'dispatch' is distinct from 'true' or claimed->'payload' is distinct from b
              or (select mapper_version from public.c2_development_publications where workout_id=w) <> 2 then
              raise exception 'Named fixture claim failed: %',claimed; end if;
            again := public.c2_development_publish_operation(u,'claim',jsonb_build_object('workout_id',w));
            if again->>'dispatch' is distinct from 'false' then raise exception 'Duplicate fixture dispatched'; end if;
            perform public.c2_development_publish_operation(u,'finish',jsonb_build_object(
              'attempt_id',claimed->>'attempt_id','outcome','published','result_id',{result_id}));
          end $$;
        """)
    print('PASS: fixed-time and variable interval claims match the TypeScript mapper exactly')
    sql("""
      do $$declare u uuid := '00000000-0000-0000-0000-000000000001';
        w uuid := '00000000-0000-0000-0000-00000000bbbb'; v jsonb; r jsonb;
      begin
        insert into public.workout_logs(id,user_id,source,workout_type,raw_data,manual_rwn,
          completed_at,distance_meters,duration_seconds) values
          (w,u,'manual','row','{"source":"training_block_manual_entry","mode":"row"}',
           '2000m','2026-09-16 12:00:00+00',2000,480);
        update public.c2_development_auth set token_scope='user:read,results:read' where user_id=u;
        begin
          perform public.c2_development_publish_operation(u,'claim',jsonb_build_object(
            'workout_id',w,'timezone','America/New_York','weight_class','H',
            'privacy','private','confirmed_completed',true));
          raise exception 'Read scope published';
        exception when others then
          if sqlerrm='Read scope published' then raise; end if;
        end;
        update public.c2_development_auth set token_scope='user:read,results:write' where user_id=u;
        v:=public.c2_development_publish_operation(u,'claim',jsonb_build_object(
          'workout_id',w,'timezone','America/New_York','weight_class','H',
          'privacy','private','confirmed_completed',true));
        perform public.c2_development_publish_operation(u,'finish',jsonb_build_object(
          'attempt_id',v->>'attempt_id','outcome','rejected','reconnect_required',true));
        if not (select needs_reconnect and access_token is null
          from public.c2_development_auth where user_id=u) then
          raise exception 'Provider auth rejection did not require reconnect'; end if;
        update public.c2_development_auth set access_token='write-access-2',
          refresh_token='write-refresh-2',expires_at=now()+interval '1 hour',
          needs_reconnect=false,token_scope='user:read,results:write' where user_id=u;
        r:=public.c2_development_publish_operation(u,'claim',jsonb_build_object(
          'workout_id',w,'timezone','America/New_York','weight_class','H',
          'privacy','private','confirmed_completed',true));
        if r->>'dispatch' is distinct from 'true' or r->>'attempt_id'=v->>'attempt_id'
          or (select attempt_count from public.c2_development_publications where workout_id=w)<>2 then
          raise exception 'Definite rejection did not create one safe retry: %',r; end if;
        v:=r;
        perform public.c2_development_publish_operation(u,'finish',jsonb_build_object(
          'attempt_id',v->>'attempt_id','outcome','outcome_unknown'));
        r:=public.c2_development_publish_operation(u,'claim',jsonb_build_object('workout_id',w));
        if r->>'dispatch' is distinct from 'false' then raise exception 'Unknown attempt redispatched'; end if;
        r:=public.c2_development_publish_operation(u,'operator_resolve',jsonb_build_object(
          'workout_id',w,'attempt_id',v->>'attempt_id','outcome','published',
          'result_id',1000,'operator','test-operator',
          'evidence','Verified exact result ID 1000 in development account 42'));
        if r->>'status' is distinct from 'published' then raise exception 'Operator resolution failed'; end if;
        if (select resolution_evidence from public.c2_development_publications where workout_id=w) is null then
          raise exception 'Resolution evidence missing'; end if;
      end $$;
    """)
    print('PASS: read scope blocked; auth rejection requires reconnect; definite rejection retries once; unknown attempt cannot redispatch and requires audited operator resolution')

finally:
    subprocess.run(['docker', 'rm', '-f', name], capture_output=True)
