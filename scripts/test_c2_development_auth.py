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
finally:
    subprocess.run(['docker', 'rm', '-f', name], capture_output=True)
