-- Preserve measured rest distance without changing fixed interval work shape.
-- Concept2 uses workout-level rest_distance for fixed intervals; only variable
-- intervals carry rest_distance on each individual interval.
-- Existing publication payload snapshots and IDs remain untouched.
-- Rebuild the mapped interval payload from the owned, saved manual measurements.
-- The client and Edge Function cannot supply an alternative interval structure.
create or replace function public.c2_development_manual_interval_payload(
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
 shape := case when all_distance then 'FixedDistanceInterval'
  when all_time then 'FixedTimeInterval' else 'VariableInterval' end;
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

