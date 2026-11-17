-- Preview is advisory; the trigger independently protects every DELETE path,
-- including service-role writes, from cascading club-owned training history.
create function public.get_club_deletion_counts(p_org_id uuid)
returns table(teams bigint, schedule_events bigint, assignments bigint, training_enrollments bigint, leaderboard_shares bigint)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_org_owner_or_admin(p_org_id)
     or not exists(select 1 from public.organizations o where o.id=p_org_id) then
    raise exception 'Only club owners and admins can preview club deletion.' using errcode='42501';
  end if;
  return query select
    (select count(*) from public.teams t where t.org_id=p_org_id),
    (select count(*) from public.coaching_schedule_events e where e.org_id=p_org_id),
    (select count(*) from public.group_assignments a where a.org_id=p_org_id),
    (select count(*) from public.training_block_enrollments e where e.org_id=p_org_id),
    (select count(*) from public.team_leaderboard_shares s where s.org_id=p_org_id);
end;
$$;
revoke all on function public.get_club_deletion_counts(uuid) from public, anon;
grant execute on function public.get_club_deletion_counts(uuid) to authenticated;

create function public.guard_empty_club_deletion()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_teams bigint;
  v_events bigint;
  v_assignments bigint;
  v_enrollments bigint;
  v_shares bigint;
begin
  -- DELETE holds the organization's row lock. Real foreign keys make concurrent
  -- dependency inserts wait; inserts committed before that lock are counted by
  -- these fresh (volatile function) queries before any cascading action occurs.
  select count(*) into v_teams from public.teams where org_id=old.id;
  select count(*) into v_events from public.coaching_schedule_events where org_id=old.id;
  select count(*) into v_assignments from public.group_assignments where org_id=old.id;
  select count(*) into v_enrollments from public.training_block_enrollments where org_id=old.id;
  select count(*) into v_shares from public.team_leaderboard_shares where org_id=old.id;
  if v_teams+v_events+v_assignments+v_enrollments+v_shares > 0 then
    raise exception 'Club cannot be deleted while teams or club training data remain (teams: %, schedule events: %, assignments: %, training enrollments: %, leaderboard shares: %).',
      v_teams,v_events,v_assignments,v_enrollments,v_shares
      using errcode='23514', hint='Move or remove the remaining teams and training data, then retry.';
  end if;
  return old;
end;
$$;
revoke all on function public.guard_empty_club_deletion() from public, anon, authenticated;
create trigger guard_empty_club_deletion before delete on public.organizations
for each row execute function public.guard_empty_club_deletion();
