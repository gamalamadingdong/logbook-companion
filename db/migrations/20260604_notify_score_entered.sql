-- Fan out score-entered notifications to linked athlete users.
-- Keeps app_notifications owner-scoped while allowing authorized staff
-- to notify the athlete attached to a saved erg score through a controlled RPC.

create or replace function public.notify_score_entered(
  p_score_id uuid,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_score record;
  v_recipient_user_id uuid;
  v_inserted_count integer := 0;
begin
  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then
    raise exception 'Unauthorized notification actor' using errcode = '42501';
  end if;

  select ces.id,
         ces.team_id,
         ces.coach_user_id,
         ces.athlete_id,
         ces.distance,
         ces.date,
         a.user_id as athlete_user_id,
         trim(concat(a.first_name, ' ', a.last_name)) as athlete_name
    into v_score
    from public.coaching_erg_scores ces
    join public.athletes a on a.id = ces.athlete_id
   where ces.id = p_score_id;

  if not found then
    raise exception 'Score not found' using errcode = 'P0002';
  end if;

  if not (
    v_score.coach_user_id = p_actor_user_id
    or (
      v_score.team_id is not null
      and public.can_staff_team(v_score.team_id, p_actor_user_id)
    )
  ) then
    raise exception 'Not allowed to notify for this score' using errcode = '42501';
  end if;

  v_recipient_user_id := v_score.athlete_user_id;

  if v_recipient_user_id is null or v_recipient_user_id = p_actor_user_id then
    return 0;
  end if;

  insert into public.app_notifications (
    user_id,
    type,
    title,
    body,
    href,
    metadata
  )
  select v_recipient_user_id,
         'score_entered',
         'Score recorded',
         coalesce(nullif(v_score.athlete_name, ''), 'Your athlete') || '''s ' || v_score.distance::text || 'm score was recorded.',
         '/team-management/log',
         jsonb_build_object(
           'score_id', v_score.id,
           'team_id', v_score.team_id,
           'athlete_id', v_score.athlete_id,
           'date', v_score.date,
           'distance', v_score.distance,
           'actor_user_id', p_actor_user_id
         )
  where not exists (
    select 1
      from public.app_notifications existing
     where existing.user_id = v_recipient_user_id
       and existing.type = 'score_entered'
       and existing.metadata ->> 'score_id' = v_score.id::text
  );

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

grant execute on function public.notify_score_entered(uuid, uuid) to authenticated;
