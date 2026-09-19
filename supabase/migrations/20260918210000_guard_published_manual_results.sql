-- A publication claim snapshots one LC result before the remote POST. Once an
-- attempt is uncertain or published, the saved result must not drift away from
-- that immutable payload. Revisions need an explicit, audited workflow later.
create function public.guard_published_manual_result_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.c2_development_publications p
    where p.workout_id = old.id
      and p.status in ('outcome_unknown', 'published')
  ) and (
    new.source, new.raw_data, new.workout_name, new.workout_type,
    new.completed_at, new.distance_meters, new.rest_distance_meters,
    new.duration_seconds, new.duration_minutes, new.avg_split_500m,
    new.calories_burned, new.watts, new.average_heart_rate,
    new.max_heart_rate, new.average_stroke_rate, new.perceived_exertion,
    new.notes, new.manual_rwn, new.external_id
  ) is distinct from (
    old.source, old.raw_data, old.workout_name, old.workout_type,
    old.completed_at, old.distance_meters, old.rest_distance_meters,
    old.duration_seconds, old.duration_minutes, old.avg_split_500m,
    old.calories_burned, old.watts, old.average_heart_rate,
    old.max_heart_rate, old.average_stroke_rate, old.perceived_exertion,
    old.notes, old.manual_rwn, old.external_id
  ) then
    raise exception 'This result has a Concept2 development publication and cannot be edited yet.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_published_manual_result_edit() from public, anon, authenticated;

create trigger guard_published_manual_result_edit
before update on public.workout_logs
for each row
when (old.source = 'manual' and old.raw_data->>'source' = 'general_manual_entry')
execute function public.guard_published_manual_result_edit();
