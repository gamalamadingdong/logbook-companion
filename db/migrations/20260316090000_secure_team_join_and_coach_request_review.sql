create or replace function public.ensure_team_member_athlete_link(p_team_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  caller_id uuid;
  target_membership team_members;
  athlete_id uuid;
  profile_display_name text;
  profile_email text;
  base_name text;
  name_parts text[];
  first_name_value text;
  last_name_value text;
begin
  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_membership
  from team_members
  where team_id = p_team_id
    and user_id = p_user_id;

  if target_membership.id is null then
    raise exception 'Target user is not a member of this team';
  end if;

  if caller_id <> p_user_id and not public.can_manage_team_members(p_team_id, caller_id) then
    raise exception 'Not allowed to link athlete records for this team';
  end if;

  select id
  into athlete_id
  from athletes
  where user_id = p_user_id;

  if athlete_id is null then
    select display_name, email
    into profile_display_name, profile_email
    from user_profiles
    where user_id = p_user_id;

    base_name := coalesce(nullif(trim(profile_display_name), ''), nullif(split_part(coalesce(profile_email, ''), '@', 1), ''), 'Athlete');
    name_parts := regexp_split_to_array(base_name, '\s+');
    first_name_value := coalesce(nullif(name_parts[1], ''), 'Athlete');
    last_name_value := coalesce(nullif(array_to_string(name_parts[2:array_length(name_parts, 1)], ' '), ''), '');

    insert into athletes (user_id, first_name, last_name, email, created_by)
    values (p_user_id, first_name_value, last_name_value, profile_email, caller_id)
    on conflict (user_id) do update
      set email = coalesce(athletes.email, excluded.email)
    returning id into athlete_id;
  end if;

  insert into team_athletes (team_id, athlete_id, status)
  values (p_team_id, athlete_id, 'active')
  on conflict (team_id, athlete_id) do nothing;

  return athlete_id;
end;
$function$;

revoke all on function public.ensure_team_member_athlete_link(uuid, uuid) from public;
grant execute on function public.ensure_team_member_athlete_link(uuid, uuid) to authenticated;

drop policy if exists "Coaches can view all coaching requests" on public.coaching_access_requests;
create policy "Org owners and admins can view all coaching requests"
on public.coaching_access_requests
for select
to authenticated
using (
  exists (
    select 1
    from organization_members
    where organization_members.user_id = auth.uid()
      and organization_members.role in ('owner', 'admin')
  )
);

create or replace function public.approve_coaching_request(request_id uuid, new_status text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  caller_can_review boolean;
  result coaching_access_requests;
begin
  select exists (
    select 1 from organization_members
    where organization_members.user_id = auth.uid()
      and organization_members.role in ('owner', 'admin')
  ) into caller_can_review;

  if not caller_can_review then
    raise exception 'Only organization owners or admins can approve/reject requests';
  end if;

  if new_status not in ('approved', 'rejected') then
    raise exception 'Status must be approved or rejected';
  end if;

  update coaching_access_requests
  set status = new_status,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = request_id
    and status = 'pending'
  returning * into result;

  if result is null then
    raise exception 'Request not found or already reviewed';
  end if;

  if new_status = 'approved' then
    update user_profiles
    set roles = case
          when 'coach' = any(roles) then roles
          else array_append(roles, 'coach')
        end,
        coach_level = coalesce(coach_level, 'standard'),
        updated_at = now()
    where user_id = result.user_id;
  end if;

  return row_to_json(result);
end;
$function$;

revoke all on function public.approve_coaching_request(uuid, text) from public;
grant execute on function public.approve_coaching_request(uuid, text) to authenticated;
