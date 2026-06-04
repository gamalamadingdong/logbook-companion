-- Fan out assignment-created notifications to linked athlete users.
-- Keeps app_notifications owner-scoped while allowing authorized coaches/org members
-- to notify assignment recipients through a controlled RPC.

create or replace function public.notify_assignment_created(
  p_group_assignment_id uuid,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment record;
  v_inserted_count integer := 0;
begin
  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then
    raise exception 'Unauthorized notification actor' using errcode = '42501';
  end if;

  select ga.id,
         ga.team_id,
         ga.org_id,
         ga.title,
         ga.scheduled_date,
         ga.created_by
    into v_assignment
    from public.group_assignments ga
   where ga.id = p_group_assignment_id;

  if not found then
    raise exception 'Assignment not found' using errcode = 'P0002';
  end if;

  if not (
    v_assignment.created_by = p_actor_user_id
    or (
      v_assignment.team_id is not null
      and public.can_coach_team(v_assignment.team_id, p_actor_user_id)
    )
    or (
      v_assignment.org_id is not null
      and exists (
        select 1
          from public.organization_members om
         where om.org_id = v_assignment.org_id
           and om.user_id = p_actor_user_id
      )
    )
  ) then
    raise exception 'Not allowed to notify for this assignment' using errcode = '42501';
  end if;

  with recipients as (
    select distinct coalesce(dwa.user_id, a.user_id) as user_id
      from public.daily_workout_assignments dwa
      left join public.athletes a on a.id = dwa.athlete_id
     where dwa.group_assignment_id = p_group_assignment_id
       and coalesce(dwa.user_id, a.user_id) is not null
       and coalesce(dwa.user_id, a.user_id) <> p_actor_user_id
  ), inserted as (
    insert into public.app_notifications (
      user_id,
      type,
      title,
      body,
      href,
      metadata
    )
    select r.user_id,
           'assignment_created',
           'New workout assignment',
           coalesce(nullif(v_assignment.title, ''), 'Workout') || ' is scheduled for ' || to_char(v_assignment.scheduled_date, 'Mon FMDD, YYYY') || '.',
           '/team-management/assignments',
           jsonb_build_object(
             'assignment_id', v_assignment.id,
             'team_id', v_assignment.team_id,
             'org_id', v_assignment.org_id,
             'scheduled_date', v_assignment.scheduled_date,
             'actor_user_id', p_actor_user_id
           )
      from recipients r
     where not exists (
       select 1
         from public.app_notifications existing
        where existing.user_id = r.user_id
          and existing.type = 'assignment_created'
          and existing.metadata ->> 'assignment_id' = v_assignment.id::text
     )
    returning 1
  )
  select count(*) into v_inserted_count from inserted;

  return v_inserted_count;
end;
$$;

grant execute on function public.notify_assignment_created(uuid, uuid) to authenticated;
