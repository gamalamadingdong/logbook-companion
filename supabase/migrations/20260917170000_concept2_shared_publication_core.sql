-- Route development fixed-distance and fixed-time claims through the shared
-- server-side mapper while preserving the proven publication state machine.
-- Direct clients cannot call either RPC; only the Edge Function service role can.

alter table public.c2_development_publications
  add column mapper_version integer not null default 0 check (mapper_version >= 0);

create or replace function public.c2_development_publish_operation(
 p_user_id uuid,p_action text,p_values jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.c2_development_auth; w public.workout_logs;
 pub public.c2_development_publications; op uuid; tz text; body jsonb; shape text;
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
  shape:=coalesce(w.raw_data->>'publication_shape','fixed_distance');
  if w.source is distinct from 'manual' or w.workout_type is distinct from 'row'
   or w.raw_data->>'source' is distinct from 'training_block_manual_entry'
   or w.raw_data->>'mode' is distinct from 'row'
   or w.external_id is not null or w.template_id is not null
   or w.distance_meters is null or w.distance_meters <= 0
   or w.duration_seconds is null or w.duration_seconds <= 0
   or w.duration_seconds > 86400 or round(w.duration_seconds*10) < 1
   or w.completed_at > now() or coalesce(w.rest_distance_meters,0) <> 0
   or shape not in ('fixed_distance','fixed_time')
   or (shape='fixed_distance' and w.manual_rwn is distinct from (w.distance_meters::text || 'm'))
   or (shape='fixed_time' and (w.raw_data->>'entry_surface' is distinct from 'concept2_development_test'
     or w.manual_rwn is distinct from (w.duration_seconds::text || 's'))) then
   raise exception 'Only a completed manual fixed-distance or fixed-time row is eligible'; end if;
  body:=p_values->'payload';
  if body is null and shape='fixed_distance' then
   body:=jsonb_build_object('type','rower',
    'date',to_char(w.completed_at at time zone tz,'YYYY-MM-DD HH24:MI:SS'),
    'timezone',tz,'distance',w.distance_meters,'time',round(w.duration_seconds*10),
    'workout_type','unknown','weight_class',p_values->>'weight_class',
    'privacy',p_values->>'privacy','comments','Logbook Companion workout ID: ' || w.id::text);
  elsif body is null then raise exception 'Mapped payload required'; end if;
  if jsonb_typeof(body) is distinct from 'object'
   or body->>'type' is distinct from 'rower'
   or body->>'date' is distinct from to_char(w.completed_at at time zone tz,'YYYY-MM-DD HH24:MI:SS')
   or body->>'timezone' is distinct from tz
   or (body->>'distance')::integer is distinct from w.distance_meters
   or (body->>'time')::integer is distinct from round(w.duration_seconds*10)::integer
   or body->>'workout_type' is distinct from (case when shape='fixed_time' then 'FixedTimeSplits' else 'unknown' end)
   or body->>'weight_class' is distinct from p_values->>'weight_class'
   or body->>'privacy' is distinct from p_values->>'privacy'
   or body->>'comments' is distinct from ('Logbook Companion workout ID: ' || w.id::text) then
   raise exception 'Mapped payload does not match owned workout'; end if;
  op:=gen_random_uuid();
  if retry_existing then
   -- A provider rejection proves that attempt did not create a result. After
   -- correction/reconnect, a new explicit claim may safely dispatch once.
   update public.c2_development_publications set status='outcome_unknown',
    attempt_id=op,payload=body,attempt_count=attempt_count+1,result_id=null,
    mapper_version=1,resolved_at=null,resolution_evidence=null,resolved_by=null where id=pub.id;
  else
   insert into public.c2_development_publications
    (user_id,workout_id,provider_user_id,status,attempt_id,payload,mapper_version)
    values(p_user_id,w.id,r.provider_user_id,'outcome_unknown',op,body,1);
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

create or replace function public.c2_development_create_manual_workout(
  p_user_id uuid, p_values jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path='pg_catalog','public' as $$
declare workout_id uuid:=gen_random_uuid(); distance_value integer;
 duration_value numeric; finished_at timestamptz; rwn text; shape text;
begin
 if not exists(select 1 from public.c2_development_auth where user_id=p_user_id) then
  raise exception 'Development connection required';
 end if;
 shape:=coalesce(p_values->>'publication_shape','fixed_distance');
 if shape not in ('fixed_distance','fixed_time')
  or coalesce(p_values->>'distance_meters','') !~ '^[0-9]{1,7}$'
  or coalesce(p_values->>'duration_seconds','') !~ '^[0-9]{1,5}([.][0-9]{1,3})?$'
  or p_values->>'completed_at' is null or length(p_values->>'completed_at') > 40 then
  raise exception 'Valid distance, duration and completion time required';
 end if;
 distance_value:=(p_values->>'distance_meters')::integer;
 duration_value:=(p_values->>'duration_seconds')::numeric;
 finished_at:=(p_values->>'completed_at')::timestamptz;
 if distance_value <= 0 or distance_value > 1000000
  or duration_value <= 0 or duration_value > 86400
  or finished_at > now() or finished_at < now()-interval '10 years' then
  raise exception 'Completed workout values out of range';
 end if;
 rwn:=case when shape='fixed_time' then duration_value::text || 's' else distance_value::text || 'm' end;
 insert into public.workout_logs(
  id,user_id,source,workout_name,workout_type,manual_rwn,canonical_name,
  canonical_signature,completed_at,distance_meters,duration_seconds,duration_minutes,raw_data
 ) values(
  workout_id,p_user_id,'manual',rwn,'row',rwn,rwn,lower(rwn),finished_at,
  distance_value,duration_value,duration_value/60,
  jsonb_build_object('source','training_block_manual_entry','mode','row',
   'entry_surface','concept2_development_test','publication_shape',shape)
 );
 return jsonb_build_object('workout_id',workout_id,'completed_at',finished_at,
  'distance_meters',distance_value,'duration_seconds',duration_value,'publication_shape',shape);
end;
$$;
revoke all on function public.c2_development_create_manual_workout(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.c2_development_create_manual_workout(uuid,jsonb) to service_role;
