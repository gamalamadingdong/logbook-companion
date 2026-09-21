-- Development-only PM5 projection fixtures and exact payload fencing.
-- Existing publication mutex, retry, and unknown-outcome behavior are preserved.
alter table public.c2_development_fixture_workouts
 drop constraint c2_development_fixture_workouts_fixture_name_check;
alter table public.c2_development_fixture_workouts
 add constraint c2_development_fixture_workouts_fixture_name_check check (fixture_name in
  ('fixed_distance_intervals_2x500m','fixed_time_intervals_3x120s','variable_intervals_mixed',
   'pm5_fixed_2000m','pm5_8x500m','pm5_invalid_stroke_data'));

create or replace function public.c2_development_create_fixture_workout(
 p_user_id uuid,p_fixture_name text,p_completed jsonb
) returns jsonb language plpgsql security invoker set search_path='pg_catalog','public' as $$
declare workout_id uuid; finished_at timestamptz; distance_value integer; duration_value numeric;
 shape text;
begin
 if p_fixture_name not in ('fixed_distance_intervals_2x500m','fixed_time_intervals_3x120s','variable_intervals_mixed','pm5_fixed_2000m','pm5_8x500m','pm5_invalid_stroke_data')
  or p_completed->>'_v' is distinct from '2'
  or p_completed->>'ownerId' is distinct from p_user_id::text
  or p_completed->>'source' is distinct from 'synthetic_fixture'
  or p_completed->>'completionStatus' is distinct from 'completed'
  or p_completed->>'machine' is distinct from 'rower'
  or jsonb_typeof(p_completed->'intervals') is distinct from 'array'
  or jsonb_array_length(p_completed->'intervals') < 2 then
  raise exception 'Named completed development fixture required'; end if;
 if not exists(select 1 from public.c2_development_auth where user_id=p_user_id
  and provider_user_id is not null) then
  raise exception 'Development connection required'; end if;
 workout_id:=(p_completed->>'workoutId')::uuid;
 finished_at:=(p_completed->>'completedAt')::timestamptz;
 distance_value:=(p_completed->>'distanceMeters')::integer;
 duration_value:=(p_completed->>'workTimeSeconds')::numeric;
 shape:=p_completed->'shape'->>'kind';
 if shape is distinct from (case p_fixture_name
   when 'fixed_distance_intervals_2x500m' then 'fixed_distance_interval'
   when 'fixed_time_intervals_3x120s' then 'fixed_time_interval'
   when 'pm5_8x500m' then 'fixed_distance_interval'
   else 'variable_interval' end)
  or p_completed->>'timezone' is distinct from 'America/New_York'
  or distance_value <= 0 or distance_value > 1000000
  or duration_value <= 0 or duration_value > 86400
  or finished_at > now() or finished_at < now()-interval '10 years' then
  raise exception 'Fixture values out of range'; end if;
 insert into public.workout_logs (
  id,user_id,source,workout_name,workout_type,manual_rwn,canonical_name,
  canonical_signature,completed_at,distance_meters,duration_seconds,duration_minutes,
  rest_distance_meters,raw_data
 ) values (
  workout_id,p_user_id,'manual','[Development test] ' || p_fixture_name,'row',null,
  '[Development test] ' || p_fixture_name,'development_fixture_' || p_fixture_name,
  finished_at,distance_value,duration_value,duration_value/60,
  (p_completed->>'restDistanceMeters')::integer,
  jsonb_build_object('source','concept2_development_fixture','fixture_name',p_fixture_name,
   'completed_workout',p_completed)
 );
 insert into public.c2_development_fixture_workouts(workout_id,user_id,fixture_name,completed_result)
  values(workout_id,p_user_id,p_fixture_name,p_completed);
 return jsonb_build_object('workout_id',workout_id,'fixture_name',p_fixture_name);
end;
$$;
revoke all on function public.c2_development_create_fixture_workout(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.c2_development_create_fixture_workout(uuid,text,jsonb) to service_role;

create or replace function public.c2_development_publish_operation(
 p_user_id uuid,p_action text,p_values jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.c2_development_auth; w public.workout_logs;
 pub public.c2_development_publications; op uuid; tz text; body jsonb; shape text;
 fixture jsonb; fixture_name text; expected jsonb; interval_payload jsonb; general_result jsonb;
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
  if tz is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=tz)
   or coalesce(p_values->>'privacy','') not in ('private','partners','logged_in','everyone')
   or coalesce(p_values->>'weight_class','') not in ('H','L') then
   raise exception 'Timezone, weight class and privacy required'; end if;
  if w.raw_data->>'source' = 'concept2_development_fixture' then
   if p_values->>'confirmed_fixture' is distinct from 'true'
    or p_values ? 'confirmed_completed' then
    raise exception 'Explicit synthetic fixture confirmation required'; end if;
   select f.completed_result, f.fixture_name into fixture, fixture_name
    from public.c2_development_fixture_workouts f
    where f.workout_id=w.id and f.user_id=p_user_id;
   if not found or w.source is distinct from 'manual' or w.workout_type is distinct from 'row'
    or w.external_id is not null or w.template_id is not null or w.manual_rwn is not null
    or fixture->>'workoutId' is distinct from w.id::text
    or fixture->>'ownerId' is distinct from p_user_id::text
    or fixture->>'source' is distinct from 'synthetic_fixture'
    or fixture->>'completionStatus' is distinct from 'completed'
    or fixture->>'machine' is distinct from 'rower'
    or fixture->>'timezone' is distinct from tz
    or w.raw_data is distinct from jsonb_build_object('source','concept2_development_fixture',
      'fixture_name',fixture_name,'completed_workout',fixture)
    or w.distance_meters is distinct from (fixture->>'distanceMeters')::integer
    or w.duration_seconds is distinct from (fixture->>'workTimeSeconds')::numeric
    or coalesce(w.rest_distance_meters,0) is distinct from (fixture->>'restDistanceMeters')::integer
    or w.completed_at is distinct from (fixture->>'completedAt')::timestamptz
    or w.completed_at > now() then
    raise exception 'Saved synthetic fixture is incomplete or changed'; end if;
   shape:=fixture->'shape'->>'kind';
   if shape not in ('fixed_distance_interval','fixed_time_interval','variable_interval')
    or jsonb_typeof(fixture->'intervals') is distinct from 'array'
    or jsonb_array_length(fixture->'intervals') < 2 then
    raise exception 'Unsupported interval fixture'; end if;
   if fixture ? 'concept2Payload' then
    expected:=fixture->'concept2Payload' || jsonb_build_object(
      'weight_class',p_values->>'weight_class','privacy',p_values->>'privacy',
      'comments','Logbook Companion workout ID: ' || w.id::text);
    if jsonb_typeof(expected) is distinct from 'object'
     or expected->>'type' is distinct from 'rower'
     or expected->>'date' is distinct from to_char(w.completed_at at time zone tz,'YYYY-MM-DD HH24:MI:SS')
     or expected->>'timezone' is distinct from tz
     or (expected->>'distance')::integer is distinct from w.distance_meters
     or (expected->>'time')::integer is distinct from round(w.duration_seconds*10)::integer
     or jsonb_typeof(expected->'workout') is distinct from 'object'
     or jsonb_typeof(expected->'stroke_data') is distinct from 'array'
     or jsonb_array_length(expected->'stroke_data') < 1
     or expected->>'verified' = 'true' then
     raise exception 'Invalid saved PM5 projection fixture'; end if;
    body:=p_values->'payload';
    if body is distinct from expected then
     raise exception 'PM5 projection payload does not match saved fixture'; end if;
    shape:='pm5_projection';
   else
    select jsonb_agg(jsonb_build_object('type',i->>'kind',
       'distance',(i->>'distanceMeters')::integer,
       'time',round((i->>'workTimeSeconds')::numeric*10)::integer,
       'rest_time',round((i->>'restTimeSeconds')::numeric*10)::integer)
       || case when shape='variable_interval' then
        jsonb_build_object('rest_distance',(i->>'restDistanceMeters')::integer)
        else '{}'::jsonb end order by n)
     into interval_payload
     from jsonb_array_elements(fixture->'intervals') with ordinality as intervals(i,n);
    expected:=jsonb_build_object('type','rower',
     'date',to_char(w.completed_at at time zone tz,'YYYY-MM-DD HH24:MI:SS'),
     'timezone',tz,'distance',w.distance_meters,
     'time',round(w.duration_seconds*10)::integer,
     'workout_type',case shape when 'fixed_distance_interval' then 'FixedDistanceInterval'
       when 'fixed_time_interval' then 'FixedTimeInterval' else 'VariableInterval' end,
     'rest_distance',(fixture->>'restDistanceMeters')::integer,
     'rest_time',round((fixture->>'restTimeSeconds')::numeric*10)::integer,
     'workout',jsonb_build_object('intervals',interval_payload),
     'weight_class',p_values->>'weight_class','privacy',p_values->>'privacy',
     'comments','Logbook Companion workout ID: ' || w.id::text);
    body:=p_values->'payload';
    if body is distinct from expected then
     raise exception 'Mapped interval payload does not match saved fixture'; end if;
   end if;
  elsif w.raw_data->>'source' = 'general_manual_entry' then
   if p_values->>'confirmed_completed' is distinct from 'true' or p_values ? 'confirmed_fixture' then
    raise exception 'Explicit completed row confirmation required'; end if;
   general_result:=w.raw_data->'completed_result';
   if w.source is distinct from 'manual' or w.workout_type is distinct from 'row'
    or w.external_id is not null or w.manual_rwn is not null
    or w.template_id::text is distinct from general_result->'plannedTemplate'->>'id'
    or jsonb_typeof(general_result) is distinct from 'object'
    or general_result->>'_v' is distinct from '1'
    or general_result->>'activity' is distinct from 'indoor_row'
    or general_result->>'status' is distinct from 'completed'
    or general_result->'equipment'->>'brand' is distinct from 'concept2'
    or general_result->'equipment'->>'name' is distinct from 'RowErg'
    or general_result->>'timezone' is distinct from tz
    or (general_result->>'completedAt')::timestamptz is distinct from w.completed_at
    or w.completed_at > now()
    or w.distance_meters is null or w.distance_meters <= 0 or w.distance_meters > 1000000
    or w.duration_seconds is null or w.duration_seconds <= 0 or w.duration_seconds > 86400
    or round(w.duration_seconds*10) is distinct from w.duration_seconds*10 then
    raise exception 'Only an intact completed Concept2 RowErg result is eligible'; end if;
   if general_result->>'detailCoverage' = 'full' then
    expected:=public.c2_development_manual_interval_payload(w,tz,
      p_values->>'weight_class',p_values->>'privacy');
    shape:='manual_interval';
   else
    if general_result->>'detailCoverage' is distinct from 'none'
     or general_result->'segments' is distinct from '[]'::jsonb
     or general_result ? 'workTimeSeconds'
     or coalesce(w.rest_distance_meters,0) <> 0
     or (general_result->'summary'->>'distanceMeters')::integer is distinct from w.distance_meters
     or (general_result->'summary'->>'durationSeconds')::numeric is distinct from w.duration_seconds then
     raise exception 'Only an intact completed single-piece Concept2 RowErg result is eligible'; end if;
    expected:=jsonb_build_object('type','rower',
     'date',to_char(w.completed_at at time zone tz,'YYYY-MM-DD HH24:MI:SS'),
     'timezone',tz,'distance',w.distance_meters,'time',(w.duration_seconds*10)::integer,
     'workout_type','unknown','weight_class',p_values->>'weight_class',
     'privacy',p_values->>'privacy','comments','Logbook Companion workout ID: ' || w.id::text);
   end if;
   body:=p_values->'payload';
   if body is distinct from expected then
    raise exception 'Mapped manual payload does not match saved result'; end if;
  else
  if p_values->>'confirmed_completed' is distinct from 'true' or p_values ? 'confirmed_fixture' then
   raise exception 'Explicit completed row confirmation required'; end if;
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
  end if;
  op:=gen_random_uuid();
  if retry_existing then
   -- A provider rejection proves that attempt did not create a result. After
   -- correction/reconnect, a new explicit claim may safely dispatch once.
   update public.c2_development_publications set status='outcome_unknown',
    attempt_id=op,payload=body,attempt_count=attempt_count+1,result_id=null,
    mapper_version=case when fixture is not null or shape='manual_interval' then 2 else 1 end,resolved_at=null,resolution_evidence=null,resolved_by=null where id=pub.id;
  else
   insert into public.c2_development_publications
    (user_id,workout_id,provider_user_id,status,attempt_id,payload,mapper_version)
    values(p_user_id,w.id,r.provider_user_id,'outcome_unknown',op,body,case when fixture is not null or shape='manual_interval' then 2 else 1 end);
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
