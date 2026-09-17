create table public.c2_development_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workout_logs(id) on delete restrict,
  provider_user_id text not null,
  environment text not null default 'development' check (environment='development'),
  status text not null check (status in ('outcome_unknown','published','rejected')),
  attempt_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  attempt_count integer not null default 1 check (attempt_count > 0),
  result_id bigint check (result_id > 0),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_evidence text,
  resolved_by text,
  unique(user_id,workout_id,provider_user_id),
  unique(provider_user_id,result_id)
);
alter table public.c2_development_publications enable row level security;
revoke all on public.c2_development_publications from public, anon, authenticated;
grant all on public.c2_development_publications to service_role;

-- Mark unknown before the remote POST. Never retry an unknown attempt automatically.
create function public.c2_development_publish_operation(
 p_user_id uuid,p_action text,p_values jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.c2_development_auth; w public.workout_logs;
 pub public.c2_development_publications; op uuid; tz text; body jsonb;
 retry_existing boolean:=false;
begin
 select * into r from public.c2_development_auth where user_id=p_user_id for update;
 if not found then raise exception 'Development connection required'; end if;
 if p_action='list' then
  return jsonb_build_object('environment','development','publications',coalesce((
   select jsonb_agg(jsonb_build_object('workout_id',p.workout_id,'status',p.status,
    'result_id',p.result_id,'created_at',p.created_at) order by p.created_at desc)
   from public.c2_development_publications p
   where p.user_id=p_user_id and p.provider_user_id=r.provider_user_id),'[]'::jsonb));
 elsif p_action='claim' then
  select * into w from public.workout_logs
   where id=(p_values->>'workout_id')::uuid and user_id=p_user_id for update;
  if not found then raise exception 'Owned workout required'; end if;
  select * into pub from public.c2_development_publications
   where user_id=p_user_id and workout_id=w.id and provider_user_id=r.provider_user_id;
  if found and pub.status <> 'rejected' then
   return jsonb_build_object('dispatch',false,'status',pub.status,
    'result_id',pub.result_id,'workout_id',pub.workout_id);
  end if;
  retry_existing:=found;
  if r.operation_id is not null then raise exception 'Operation pending'; end if;
  if r.needs_reconnect or r.access_token is null or r.provider_user_id is null
   or r.token_scope <> 'user:read,results:write' or r.expires_at is null
   or r.expires_at <= now()+interval '30 seconds' then
   raise exception 'Reconnect or refresh with write scope first'; end if;
  tz:=p_values->>'timezone';
  if p_values->>'confirmed_completed' is distinct from 'true'
   or tz is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=tz)
   or coalesce(p_values->>'privacy','') not in ('private','partners','logged_in','everyone')
   or coalesce(p_values->>'weight_class','') not in ('H','L') then
   raise exception 'Completion, timezone, weight class and privacy required'; end if;
  if w.source is distinct from 'manual' or w.workout_type is distinct from 'row'
   or w.raw_data->>'source' is distinct from 'training_block_manual_entry'
   or w.raw_data->>'mode' is distinct from 'row'
   or w.external_id is not null or w.template_id is not null
   or w.distance_meters is null or w.distance_meters <= 0
   or w.duration_seconds is null or w.duration_seconds <= 0
   or w.duration_seconds > 86400 or round(w.duration_seconds*10) < 1
   or w.completed_at > now()
   or coalesce(w.rest_distance_meters,0) <> 0
   or w.manual_rwn is distinct from (w.distance_meters::text || 'm') then
   raise exception 'Only a completed manual fixed-distance row is eligible'; end if;
  body:=jsonb_build_object('type','rower',
   'date',to_char(w.completed_at at time zone tz,'YYYY-MM-DD HH24:MI:SS'),
   'timezone',tz,'distance',w.distance_meters,'time',round(w.duration_seconds*10),
   'workout_type','unknown',
   'weight_class',p_values->>'weight_class','privacy',p_values->>'privacy');
  op:=gen_random_uuid();
  if retry_existing then
   -- A provider rejection proves that attempt did not create a result. After
   -- correction/reconnect, a new explicit claim may safely dispatch once.
   update public.c2_development_publications set status='outcome_unknown',
    attempt_id=op,payload=body,attempt_count=attempt_count+1,result_id=null,
    resolved_at=null,resolution_evidence=null,resolved_by=null where id=pub.id;
  else
   insert into public.c2_development_publications
    (user_id,workout_id,provider_user_id,status,attempt_id,payload)
    values(p_user_id,w.id,r.provider_user_id,'outcome_unknown',op,body);
  end if;
  update public.c2_development_auth set operation_id=op,operation_started_at=now()
   where user_id=p_user_id;
  return jsonb_build_object('dispatch',true,'status','outcome_unknown',
   'attempt_id',op,'access_token',r.access_token,'payload',body,'workout_id',w.id);
 elsif p_action='operator_resolve' then
  -- Service-role only, deliberately not routed through the public Edge Function.
  if length(coalesce(p_values->>'evidence','')) < 20
   or length(coalesce(p_values->>'operator','')) < 3
   or p_values->>'outcome' not in ('published','rejected') then
   raise exception 'Operator, evidence and outcome required'; end if;
  select * into pub from public.c2_development_publications
   where user_id=p_user_id and provider_user_id=r.provider_user_id
    and workout_id=(p_values->>'workout_id')::uuid
    and attempt_id=(p_values->>'attempt_id')::uuid for update;
  if not found or pub.status <> 'outcome_unknown' then raise exception 'Unknown attempt required'; end if;
  if p_values->>'outcome'='published' and coalesce((p_values->>'result_id')::bigint,0)<=0 then
   raise exception 'Verified result ID required'; end if;
  update public.c2_development_publications set status=p_values->>'outcome',
   result_id=case when p_values->>'outcome'='published' then (p_values->>'result_id')::bigint else null end,
   resolution_evidence=p_values->>'evidence',resolved_by=p_values->>'operator',resolved_at=now()
   where id=pub.id;
  if r.operation_id=pub.attempt_id then
   update public.c2_development_auth set operation_id=null,operation_started_at=null where user_id=p_user_id;
  end if;
  return jsonb_build_object('status',p_values->>'outcome','workout_id',pub.workout_id,
   'result_id',p_values->'result_id');
 elsif p_action='finish' then
  op:=(p_values->>'attempt_id')::uuid;
  if r.operation_id is null or r.operation_id is distinct from op then
   raise exception 'Invalid operation'; end if;
  select * into pub from public.c2_development_publications
   where user_id=p_user_id and provider_user_id=r.provider_user_id and attempt_id=op for update;
  if not found or pub.status <> 'outcome_unknown' then raise exception 'Invalid attempt'; end if;
  if p_values->>'outcome'='published' then
   if coalesce((p_values->>'result_id')::bigint,0)<=0 then raise exception 'Invalid result ID'; end if;
   update public.c2_development_publications set status='published',
    result_id=(p_values->>'result_id')::bigint,resolved_at=now() where id=pub.id;
  elsif p_values->>'outcome'='rejected' then
   update public.c2_development_publications set status='rejected',resolved_at=now() where id=pub.id;
  elsif p_values->>'outcome'<>'outcome_unknown' then raise exception 'Invalid outcome'; end if;
  if p_values->>'outcome'='rejected' and p_values->>'reconnect_required'='true' then
   update public.c2_development_auth set access_token=null,refresh_token=null,expires_at=null,
    operation_id=null,operation_started_at=null,operation_scope=null,
    token_scope='user:read,results:read',needs_reconnect=true where user_id=p_user_id;
  else
   update public.c2_development_auth set operation_id=null,operation_started_at=null where user_id=p_user_id;
  end if;
  return jsonb_build_object('status',p_values->>'outcome','result_id',p_values->'result_id',
   'workout_id',pub.workout_id);
 end if;
 raise exception 'Unknown action';
end;
$$;
revoke all on function public.c2_development_publish_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.c2_development_publish_operation(uuid,text,jsonb) to service_role;

-- Exact ID link is projected at read time; imported snapshots and LC rows remain unchanged.
create or replace function public.c2_development_sync_operation(
 p_user_id uuid,p_action text,p_values jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.c2_development_auth; op uuid; item jsonb; n integer:=0; page_number integer;
begin
 select * into r from public.c2_development_auth where user_id=p_user_id for update;
 if not found then raise exception 'Development connection required'; end if;
 if p_action='list' then
  page_number:=coalesce((p_values->>'page')::integer,1);
  if page_number<1 or page_number>100000 then raise exception 'Invalid page'; end if;
  return jsonb_build_object('environment','development','results',coalesce((
   select jsonb_agg(x.summary order by x.result_id desc) from (
    select d.summary || case when p.workout_id is null then '{}'::jsonb
     else jsonb_build_object('lc_workout_id',p.workout_id) end as summary,d.result_id
    from public.c2_development_results d
    left join public.c2_development_publications p
     on p.user_id=d.user_id and p.provider_user_id=d.provider_user_id
      and p.result_id=d.result_id and p.status='published'
    where d.user_id=p_user_id and d.provider_user_id=r.provider_user_id
    order by d.result_id desc limit 25 offset (page_number-1)*25
   ) x),'[]'::jsonb),'total',(
   select count(*) from public.c2_development_results
    where user_id=p_user_id and provider_user_id=r.provider_user_id));
 elsif p_action='claim' then
  if r.operation_id is not null then raise exception 'Operation pending'; end if;
  if r.needs_reconnect or r.access_token is null or r.provider_user_id is null
   or r.expires_at is null or r.expires_at<=now()+interval '30 seconds' then
   raise exception 'Check / refresh connection first'; end if;
  op:=gen_random_uuid();
  update public.c2_development_auth set operation_id=op,operation_started_at=now() where user_id=p_user_id;
  return jsonb_build_object('operation_id',op,'access_token',r.access_token);
 elsif p_action in ('save','release','unauthorized') then
  if r.operation_id is null or r.operation_id is distinct from (p_values->>'operation_id')::uuid then
   raise exception 'Invalid operation'; end if;
  if p_action='save' then
   if jsonb_typeof(p_values->'results') is distinct from 'array'
    or jsonb_array_length(p_values->'results')>25 then raise exception 'Invalid results'; end if;
   for item in select value from jsonb_array_elements(p_values->'results') loop
    insert into public.c2_development_results(user_id,provider_user_id,result_id,summary)
     values(p_user_id,r.provider_user_id,(item->>'id')::bigint,item)
     on conflict(user_id,provider_user_id,result_id) do update
      set summary=excluded.summary,imported_at=now();
    n:=n+1;
   end loop;
  end if;
  update public.c2_development_auth set operation_id=null,operation_started_at=null,
   expires_at=case when p_action='unauthorized' then now() else expires_at end
   where user_id=p_user_id;
  return jsonb_build_object('environment','development','imported',n);
 end if;
 raise exception 'Unknown action';
end;
$$;
revoke all on function public.c2_development_sync_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.c2_development_sync_operation(uuid,text,jsonb) to service_role;
