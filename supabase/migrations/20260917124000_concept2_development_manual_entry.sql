-- Small authenticated development-only entry seam for exercising the publish loop.
-- The row uses the existing manual workout contract and remains an ordinary owned LC workout.
create or replace function public.c2_development_create_manual_workout(
  p_user_id uuid, p_values jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare workout_id uuid:=gen_random_uuid(); distance_value integer;
 duration_value numeric; finished_at timestamptz; rwn text;
begin
 if not exists(select 1 from public.c2_development_auth where user_id=p_user_id) then
  raise exception 'Development connection required';
 end if;
 if coalesce(p_values->>'distance_meters','') !~ '^[0-9]{1,7}$'
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
 rwn:=distance_value::text || 'm';
 insert into public.workout_logs(
  id,user_id,source,workout_name,workout_type,manual_rwn,canonical_name,
  canonical_signature,completed_at,distance_meters,duration_seconds,duration_minutes,raw_data
 ) values(
  workout_id,p_user_id,'manual',rwn,'row',rwn,rwn,lower(rwn),finished_at,
  distance_value,duration_value,duration_value/60,
  jsonb_build_object('source','training_block_manual_entry','mode','row',
   'entry_surface','concept2_development_test')
 );
 return jsonb_build_object('workout_id',workout_id,'completed_at',finished_at,
  'distance_meters',distance_value,'duration_seconds',duration_value);
end;
$$;
revoke all on function public.c2_development_create_manual_workout(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.c2_development_create_manual_workout(uuid,jsonb) to service_role;
