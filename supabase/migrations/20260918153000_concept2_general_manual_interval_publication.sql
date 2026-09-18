-- Rebuild the mapped interval payload from the owned, saved manual measurements.
-- The client and Edge Function cannot supply an alternative interval structure.
create function public.c2_development_manual_interval_payload(
  p_workout public.workout_logs, p_timezone text, p_weight_class text, p_privacy text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c jsonb := p_workout.raw_data->'completed_result';
 segments jsonb := c->'segments'; segment jsonb; current_interval jsonb;
 mapped_intervals jsonb := '[]'::jsonb; projected_intervals jsonb;
 kind text; previous_role text; shape text;
 work_distance numeric := 0; work_time numeric := 0;
 rest_distance numeric := 0; rest_time numeric := 0;
 segment_distance numeric; segment_time numeric;
 first_distance numeric; first_time numeric;
 all_distance boolean := true; all_time boolean := true; work_count integer := 0;
begin
 if c->>'detailCoverage' is distinct from 'full'
  or jsonb_typeof(segments) is distinct from 'array'
  or jsonb_array_length(segments) < 2
  or jsonb_typeof(c->'summary'->'distanceMeters') is distinct from 'number'
  or jsonb_typeof(c->'summary'->'durationSeconds') is distinct from 'number'
  or jsonb_typeof(c->'workTimeSeconds') is distinct from 'number' then
  raise exception 'Full measured interval detail required'; end if;
 for segment in select value from jsonb_array_elements(segments) loop
  if jsonb_typeof(segment) is distinct from 'object' then
   raise exception 'Invalid measured interval segment'; end if;
  if segment->>'role' = 'work' then
   kind := segment->>'intervalKind';
   if kind is null or kind not in ('distance','time')
    or jsonb_typeof(segment->'distanceMeters') is distinct from 'number'
    or jsonb_typeof(segment->'durationSeconds') is distinct from 'number' then
    raise exception 'Work interval type, distance and time required'; end if;
   segment_distance := (segment->>'distanceMeters')::numeric;
   segment_time := (segment->>'durationSeconds')::numeric;
   if segment_distance <= 0 or segment_distance <> trunc(segment_distance)
    or segment_time <= 0 or segment_time * 10 <> trunc(segment_time * 10) then
    raise exception 'Invalid measured work interval'; end if;
   if current_interval is not null then
    mapped_intervals := mapped_intervals || jsonb_build_array(current_interval);
   end if;
   current_interval := jsonb_build_object('type',kind,'distance',segment_distance::integer,
    'time',(segment_time*10)::integer,'rest_time',0,'rest_distance',0);
   work_count := work_count + 1;
   if first_distance is null then first_distance := segment_distance; first_time := segment_time; end if;
   all_distance := all_distance and kind='distance' and segment_distance=first_distance;
   all_time := all_time and kind='time' and segment_time=first_time;
   work_distance := work_distance + segment_distance;
   work_time := work_time + segment_time;
  elsif segment->>'role' = 'rest' then
   if current_interval is null or previous_role='rest' or segment ? 'intervalKind'
    or (segment->'distanceMeters' is null and segment->'durationSeconds' is null)
    or (segment->'distanceMeters' is not null and
      jsonb_typeof(segment->'distanceMeters') is distinct from 'number')
    or (segment->'durationSeconds' is not null and
      jsonb_typeof(segment->'durationSeconds') is distinct from 'number') then
    raise exception 'Rest must follow measured work'; end if;
   segment_distance := coalesce((segment->>'distanceMeters')::numeric,0);
   segment_time := coalesce((segment->>'durationSeconds')::numeric,0);
   if segment_distance < 0 or segment_distance <> trunc(segment_distance)
    or segment_time < 0 or segment_time * 10 <> trunc(segment_time * 10) then
    raise exception 'Invalid measured rest interval'; end if;
   current_interval := current_interval ||
    jsonb_build_object('rest_time',(segment_time*10)::integer,'rest_distance',segment_distance::integer);
   rest_distance := rest_distance + segment_distance;
   rest_time := rest_time + segment_time;
  else
   raise exception 'Unsupported measured segment role';
  end if;
  previous_role := segment->>'role';
 end loop;
 if current_interval is not null then mapped_intervals := mapped_intervals || jsonb_build_array(current_interval); end if;
 if work_count < 2 or work_distance > 1000000 or work_time + rest_time > 86400
  or work_distance + rest_distance is distinct from (c->'summary'->>'distanceMeters')::numeric
  or work_time + rest_time is distinct from (c->'summary'->>'durationSeconds')::numeric
  or work_time is distinct from (c->>'workTimeSeconds')::numeric
  or work_distance is distinct from p_workout.distance_meters
  or rest_distance is distinct from coalesce(p_workout.rest_distance_meters,0)
  or work_time + rest_time is distinct from p_workout.duration_seconds then
  raise exception 'Measured interval totals do not match saved result'; end if;
 shape := case when rest_distance=0 and all_distance then 'FixedDistanceInterval'
  when rest_distance=0 and all_time then 'FixedTimeInterval' else 'VariableInterval' end;
 select jsonb_agg(case when shape='VariableInterval' then value else value - 'rest_distance' end
  order by ordinality) into projected_intervals
  from jsonb_array_elements(mapped_intervals) with ordinality;
 return jsonb_build_object('type','rower',
  'date',to_char(p_workout.completed_at at time zone p_timezone,'YYYY-MM-DD HH24:MI:SS'),
  'timezone',p_timezone,'distance',work_distance::integer,'time',(work_time*10)::integer,
  'workout_type',shape,'rest_distance',rest_distance::integer,'rest_time',(rest_time*10)::integer,
  'workout',jsonb_build_object('intervals',projected_intervals),
  'weight_class',p_weight_class,'privacy',p_privacy,
  'comments','Logbook Companion workout ID: ' || p_workout.id::text);
end;
$$;
revoke all on function public.c2_development_manual_interval_payload(public.workout_logs,text,text,text) from public,anon,authenticated;
grant execute on function public.c2_development_manual_interval_payload(public.workout_logs,text,text,text) to service_role;

-- Extend only the service-role development claim for saved general manual RowErg results.
-- Preserve the proven fixture and legacy claim branches, mutex, and unknown-outcome fence.
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
