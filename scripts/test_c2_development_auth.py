#!/usr/bin/env python3
"""Local-only PostgreSQL regression test; disposable Docker DB, no host ports/secrets.
Run: python3 scripts/test_c2_development_auth.py
Never connects to Supabase or reads environment files.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
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
