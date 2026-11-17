-- Separate assigned coaching, operational staff, and administration.
-- Existing club coaches retain access only to teams present during this migration.
alter table public.team_members add column is_admin boolean not null default false;
alter table public.team_members add constraint team_members_admin_requires_coach check(not is_admin or role='coach');
insert into public.team_members(team_id,user_id,role,is_admin)
select t.id,m.user_id,'coach',false from public.teams t
join public.organization_members m on m.org_id=t.org_id and m.role='coach'
on conflict(team_id,user_id) do update set role='coach';

create or replace function public.can_admin_team(p_team_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.teams t where t.id=p_team_id and (t.coach_id=p_user_id or exists(select 1 from public.organization_members m where m.org_id=t.org_id and m.user_id=p_user_id and m.role in ('owner','admin'))))
 or exists(select 1 from public.team_members m where m.team_id=p_team_id and m.user_id=p_user_id and m.role='coach' and m.is_admin);
$$;
create or replace function public.can_coach_team(p_team_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.can_admin_team(p_team_id,p_user_id) or exists(select 1 from public.team_members m where m.team_id=p_team_id and m.user_id=p_user_id and m.role='coach');
$$;
create or replace function public.can_staff_team(p_team_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.can_coach_team(p_team_id,p_user_id) or exists(select 1 from public.team_members m where m.team_id=p_team_id and m.user_id=p_user_id and m.role='coxswain');
$$;
create or replace function public.can_view_team(p_team_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.can_coach_team(p_team_id,p_user_id) or exists(select 1 from public.team_members m where m.team_id=p_team_id and m.user_id=p_user_id);
$$;
create or replace function public.can_manage_team_members(p_team_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$ select public.can_coach_team(p_team_id,p_user_id); $$;
create or replace function public.can_create_teams(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.coaching_access_requests where user_id=p_user_id and status='approved')
 or exists(select 1 from public.teams where coach_id=p_user_id)
 or exists(select 1 from public.team_members where user_id=p_user_id and role='coach')
 or exists(select 1 from public.organization_members where user_id=p_user_id and role in ('owner','admin'));
$$;
create function public.can_create_coaching_space() returns boolean
language sql stable security definer set search_path='' as $$ select auth.uid() is not null and public.can_create_teams(auth.uid()); $$;
create function public.get_team_access() returns table(team_id uuid,role text,is_admin boolean,org_role text)
language sql stable security definer set search_path='' as $$
 select t.id,case when public.can_coach_team(t.id,auth.uid()) then 'coach' else tm.role end,
 public.can_admin_team(t.id,auth.uid()),om.role
 from public.teams t left join public.team_members tm on tm.team_id=t.id and tm.user_id=auth.uid()
 left join public.organization_members om on om.org_id=t.org_id and om.user_id=auth.uid()
 where auth.uid() is not null and public.can_view_team(t.id,auth.uid());
$$;

-- Membership joins use a verified code; the direct API cannot self-select staff.
create function public.join_team_by_code(p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_team uuid;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Authentication required'; end if;
 select id into v_team from public.teams where invite_code=upper(btrim(p_code));
 if v_team is null then raise check_violation using message='Invalid team code'; end if;
 insert into public.team_members(team_id,user_id,role,is_admin) values(v_team,auth.uid(),'member',false) on conflict(team_id,user_id) do nothing;
 if exists(select 1 from public.team_members where team_id=v_team and user_id=auth.uid() and role in ('member','coxswain')) then perform public.ensure_team_member_athlete_link(v_team,auth.uid()); end if;
 return v_team;
end $$;
create function public.join_organization_by_code(p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_org uuid;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Authentication required'; end if;
 select id into v_org from public.organizations where invite_code=upper(btrim(p_code));
 if v_org is null then raise check_violation using message='Invalid club code'; end if;
 insert into public.organization_members(org_id,user_id,role) values(v_org,auth.uid(),'coach') on conflict(org_id,user_id) do nothing;
 return v_org;
end $$;

-- BEFORE triggers close old-row/new-row scope and staff elevation loopholes.
-- Invoker security preserves the distinction between API calls and trusted RPCs.
create function public.guard_access_membership() returns trigger
language plpgsql set search_path='' as $$
declare v_team uuid;
begin
 if current_user in ('postgres','service_role','supabase_admin') then
  if TG_OP='DELETE' then return old; end if; return new;
 end if;
 if TG_OP='UPDATE' then
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id then raise insufficient_privilege using message='Membership identity is immutable'; end if;
  if TG_TABLE_NAME='team_members' then
   if new.team_id is distinct from old.team_id then raise insufficient_privilege using message='Membership team is immutable'; end if;
   if (new.role is distinct from old.role or new.is_admin is distinct from old.is_admin) and not public.can_admin_team(old.team_id,auth.uid()) then raise insufficient_privilege using message='Team administration required for access changes'; end if;
  elsif new.org_id is distinct from old.org_id then raise insufficient_privilege using message='Membership club is immutable'; end if;
 elsif TG_TABLE_NAME='team_members' then
  if TG_OP='INSERT' then
   if (new.role<>'member' or new.is_admin) and not public.can_admin_team(new.team_id,auth.uid()) then
    if not (new.user_id=auth.uid() and new.role='coach' and not new.is_admin and exists(select 1 from public.teams where id=new.team_id and coach_id=auth.uid())) then raise insufficient_privilege using message='Team administration required for staff access'; end if;
   end if;
  elsif (old.role<>'member' or old.is_admin) and old.user_id<>auth.uid() and not public.can_admin_team(old.team_id,auth.uid()) then raise insufficient_privilege using message='Team administration required to remove staff'; end if;
 end if;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
create trigger guard_team_access before insert or update or delete on public.team_members for each row execute function public.guard_access_membership();
create trigger guard_club_access before update on public.organization_members for each row execute function public.guard_access_membership();

create function public.guard_coaching_scope() returns trigger
language plpgsql set search_path='' as $$
declare old_row jsonb:=to_jsonb(old); new_row jsonb:=to_jsonb(new); k text;
begin
 if current_user in ('postgres','service_role','supabase_admin') then return new; end if;
 foreach k in array TG_ARGV loop
  if old_row->k is distinct from new_row->k then raise insufficient_privilege using message='Scope and attribution fields are immutable: '||k; end if;
 end loop;
 return new;
end $$;
create trigger guard_team_scope before update on public.teams for each row execute function public.guard_coaching_scope('id','coach_id','org_id');
create trigger guard_club_scope before update on public.organizations for each row execute function public.guard_coaching_scope('id','created_by');
create trigger guard_roster_scope before update on public.team_athletes for each row execute function public.guard_coaching_scope('id','team_id','athlete_id');

-- A coxswain may correct performance, never rewrite a prescription or recipient.
create function public.guard_assignment_results() returns trigger
language plpgsql set search_path='' as $$
declare result_keys text[]:=array['completed','completed_at','result_time_seconds','result_distance_meters','result_split_seconds','result_intervals','result_stroke_rate','result_weight_kg','titan_index','updated_at','edited_by','edited_at'];
begin
 if current_user in ('postgres','service_role','supabase_admin') then return new; end if;
 if old.team_id is distinct from new.team_id or old.user_id is distinct from new.user_id or old.athlete_id is distinct from new.athlete_id or old.group_assignment_id is distinct from new.group_assignment_id then raise insufficient_privilege using message='Assignment scope and recipient are immutable'; end if;
 if (old.team_id is not null and not public.can_coach_team(old.team_id,auth.uid()) or old.team_id is null and old.group_assignment_id is not null and not exists(select 1 from public.group_assignments g where g.id=old.group_assignment_id and (g.team_id is not null and public.can_coach_team(g.team_id,auth.uid()) or g.team_id is null and public.is_org_owner_or_admin(g.org_id)))) and (to_jsonb(old)-result_keys) is distinct from (to_jsonb(new)-result_keys) then raise insufficient_privilege using message='Only a coach may change training prescription'; end if;
 return new;
end $$;
create trigger guard_assignment_results before update on public.daily_workout_assignments for each row execute function public.guard_assignment_results();
-- Replace permissive policies as a set: PostgreSQL ORs all permissive policies.
drop policy "Team and org coaches can delete athlete coach feed notes" on public.coaching_athlete_coach_notes;
drop policy "Team and org coaches can insert athlete coach feed notes" on public.coaching_athlete_coach_notes;
drop policy "Team and org coaches can update athlete coach feed notes" on public.coaching_athlete_coach_notes;
drop policy "Team and org coaches can view athlete coach feed notes" on public.coaching_athlete_coach_notes;
drop policy "Team and org coaches can delete athlete notes" on public.coaching_athlete_notes;
drop policy "Team and org coaches can insert athlete notes" on public.coaching_athlete_notes;
drop policy "Team and org coaches can update athlete notes" on public.coaching_athlete_notes;
drop policy "Team and org coaches can view athlete notes" on public.coaching_athlete_notes;
drop policy "Team and org coaches can delete boating race results" on public.coaching_boating_race_results;
drop policy "Team and org coaches can insert boating race results" on public.coaching_boating_race_results;
drop policy "Team and org coaches can update boating race results" on public.coaching_boating_race_results;
drop policy "Team and org members can view boating race results" on public.coaching_boating_race_results;
drop policy "Team and org coaches can delete boatings" on public.coaching_boatings;
drop policy "Team and org coaches can insert boatings" on public.coaching_boatings;
drop policy "Team and org coaches can update boatings" on public.coaching_boatings;
drop policy "Team and org members can view boatings" on public.coaching_boatings;
drop policy "Team and org coaches can delete boats" on public.coaching_boats;
drop policy "Team and org coaches can insert boats" on public.coaching_boats;
drop policy "Team and org coaches can update boats" on public.coaching_boats;
drop policy "Team and org members can view boats" on public.coaching_boats;
drop policy "Team and org coaches can delete erg scores" on public.coaching_erg_scores;
drop policy "Team and org members can view erg scores" on public.coaching_erg_scores;
drop policy "Team and org staff can insert erg scores" on public.coaching_erg_scores;
drop policy "Team and org staff can update erg scores" on public.coaching_erg_scores;
drop policy "Team and org coaches can delete session crew positions" on public.coaching_session_crew_positions;
drop policy "Team and org coaches can insert session crew positions" on public.coaching_session_crew_positions;
drop policy "Team and org coaches can update session crew positions" on public.coaching_session_crew_positions;
drop policy "Team and org members can view session crew positions" on public.coaching_session_crew_positions;
drop policy "Team and org coaches can delete session crews" on public.coaching_session_crews;
drop policy "Team and org coaches can insert session crews" on public.coaching_session_crews;
drop policy "Team and org coaches can update session crews" on public.coaching_session_crews;
drop policy "Team and org members can view session crews" on public.coaching_session_crews;
drop policy "Team and org coaches can delete sessions" on public.coaching_sessions;
drop policy "Team and org coaches can insert sessions" on public.coaching_sessions;
drop policy "Team and org coaches can update sessions" on public.coaching_sessions;
drop policy "Team and org members can view sessions" on public.coaching_sessions;
drop policy "Coaches can create team assignments" on public.daily_workout_assignments;
drop policy "Coaches can delete team assignments" on public.daily_workout_assignments;
drop policy "Coaches can update team assignments" on public.daily_workout_assignments;
drop policy "Coaches can view team assignments" on public.daily_workout_assignments;
drop policy "Users can create their own assignments" on public.daily_workout_assignments;
drop policy "Users can update their own assignments" on public.daily_workout_assignments;
drop policy "Users can view their own assignments" on public.daily_workout_assignments;
drop policy "Coaches can create group assignments" on public.group_assignments;
drop policy "Coaches can delete group assignments" on public.group_assignments;
drop policy "Coaches can update group assignments" on public.group_assignments;
drop policy "Team or org members can view group assignments" on public.group_assignments;
drop policy "Org members can view membership" on public.organization_members;
drop policy "Org owner/admin can delete members" on public.organization_members;
drop policy "Org owner/admin can insert members" on public.organization_members;
drop policy "Org owner/admin can update members" on public.organization_members;
drop policy "Authenticated users can create organizations" on public.organizations;
drop policy "Org members can view their organizations" on public.organizations;
drop policy "Org owner/admin can delete organizations" on public.organizations;
drop policy "Org owner/admin can update organizations" on public.organizations;
drop policy "Team and org coaches can update team members" on public.team_members;
drop policy "Team and org members can view team members" on public.team_members;
drop policy "Users and staff can insert team members" on public.team_members;
drop policy "Users, team coaches, and org coaches can delete team members" on public.team_members;
drop policy "Coaches can delete their teams" on public.teams;
drop policy "Coaches can insert teams" on public.teams;
drop policy "Coaches can update their teams" on public.teams;
drop policy "Team and org members can view teams" on public.teams;
create policy teams_read on public.teams for select to authenticated using (public.can_view_team(id,auth.uid()));
create policy teams_insert on public.teams for insert to authenticated with check (coach_id=auth.uid() and public.can_create_teams(auth.uid()) and (org_id is null or public.is_org_owner_or_admin(org_id)));
create policy teams_update on public.teams for update to authenticated using (public.can_admin_team(id,auth.uid())) with check (public.can_admin_team(id,auth.uid()));
create policy teams_delete on public.teams for delete to authenticated using (public.can_admin_team(id,auth.uid()));
create policy organizations_read on public.organizations for select to authenticated using (created_by=auth.uid() or public.is_org_member(id));
create policy organizations_insert on public.organizations for insert to authenticated with check (created_by=auth.uid() and public.can_create_teams(auth.uid()));
create policy organizations_update on public.organizations for update to authenticated using (public.is_org_owner_or_admin(id)) with check (public.is_org_owner_or_admin(id));
create policy organizations_delete on public.organizations for delete to authenticated using (public.is_org_owner_or_admin(id));
create policy team_members_read on public.team_members for select to authenticated using (public.can_view_team(team_id,auth.uid()));
create policy team_members_insert on public.team_members for insert to authenticated with check (public.can_coach_team(team_id,auth.uid()));
create policy team_members_update on public.team_members for update to authenticated using (public.can_coach_team(team_id,auth.uid())) with check (public.can_coach_team(team_id,auth.uid()));
create policy team_members_delete on public.team_members for delete to authenticated using (user_id=auth.uid() or public.can_coach_team(team_id,auth.uid()));
create policy organization_members_read on public.organization_members for select to authenticated using (user_id=auth.uid() or public.is_org_member(org_id));
create policy organization_members_insert on public.organization_members for insert to authenticated with check (public.is_org_owner_or_admin(org_id) or (user_id=auth.uid() and role='owner' and exists(select 1 from public.organizations where id=org_id and created_by=auth.uid()) and not public.is_org_member(org_id)));
create policy organization_members_update on public.organization_members for update to authenticated using (public.is_org_owner_or_admin(org_id)) with check (public.is_org_owner_or_admin(org_id));
create policy organization_members_delete on public.organization_members for delete to authenticated using (public.is_org_owner_or_admin(org_id));
create policy coaching_boatings_read on public.coaching_boatings for select to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_view_team(team_id,auth.uid()))));
create policy coaching_boatings_insert on public.coaching_boatings for insert to authenticated with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))) and coach_user_id=auth.uid());
create policy coaching_boatings_update on public.coaching_boatings for update to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid())))) with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))));
create policy coaching_boatings_delete on public.coaching_boatings for delete to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))));
create trigger guard_scope before update on public.coaching_boatings for each row execute function public.guard_coaching_scope('id','team_id','coach_user_id','session_id');
create policy coaching_boating_race_results_read on public.coaching_boating_race_results for select to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_view_team(team_id,auth.uid()))));
create policy coaching_boating_race_results_insert on public.coaching_boating_race_results for insert to authenticated with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))) and coach_user_id=auth.uid());
create policy coaching_boating_race_results_update on public.coaching_boating_race_results for update to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid())))) with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))));
create policy coaching_boating_race_results_delete on public.coaching_boating_race_results for delete to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))));
create trigger guard_scope before update on public.coaching_boating_race_results for each row execute function public.guard_coaching_scope('id','team_id','coach_user_id','boating_id');
create policy coaching_session_crews_read on public.coaching_session_crews for select to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_view_team(team_id,auth.uid()))));
create policy coaching_session_crews_insert on public.coaching_session_crews for insert to authenticated with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))) and coach_user_id=auth.uid());
create policy coaching_session_crews_update on public.coaching_session_crews for update to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid())))) with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))));
create policy coaching_session_crews_delete on public.coaching_session_crews for delete to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))));
create trigger guard_scope before update on public.coaching_session_crews for each row execute function public.guard_coaching_scope('id','team_id','coach_user_id','session_id');
create policy coaching_session_crew_positions_read on public.coaching_session_crew_positions for select to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_view_team(team_id,auth.uid()))));
create policy coaching_session_crew_positions_insert on public.coaching_session_crew_positions for insert to authenticated with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))) and coach_user_id=auth.uid());
create policy coaching_session_crew_positions_update on public.coaching_session_crew_positions for update to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid())))) with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))));
create policy coaching_session_crew_positions_delete on public.coaching_session_crew_positions for delete to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))));
create trigger guard_scope before update on public.coaching_session_crew_positions for each row execute function public.guard_coaching_scope('id','team_id','coach_user_id','session_crew_id');
create policy coaching_sessions_read on public.coaching_sessions for select to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_view_team(team_id,auth.uid()))));
create policy coaching_sessions_insert on public.coaching_sessions for insert to authenticated with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))) and coach_user_id=auth.uid());
create policy coaching_sessions_update on public.coaching_sessions for update to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid())))) with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))));
create policy coaching_sessions_delete on public.coaching_sessions for delete to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))));
create trigger guard_scope before update on public.coaching_sessions for each row execute function public.guard_coaching_scope('id','team_id','coach_user_id');
create policy coaching_erg_scores_read on public.coaching_erg_scores for select to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_view_team(team_id,auth.uid()))));
create policy coaching_erg_scores_insert on public.coaching_erg_scores for insert to authenticated with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))) and coach_user_id=auth.uid());
create policy coaching_erg_scores_update on public.coaching_erg_scores for update to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid())))) with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))));
create policy coaching_erg_scores_delete on public.coaching_erg_scores for delete to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_staff_team(team_id,auth.uid()))));
create trigger guard_scope before update on public.coaching_erg_scores for each row execute function public.guard_coaching_scope('id','team_id','coach_user_id','athlete_id');
create policy coaching_athlete_notes_read on public.coaching_athlete_notes for select to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid()))));
create policy coaching_athlete_notes_insert on public.coaching_athlete_notes for insert to authenticated with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid()))) and coach_user_id=auth.uid());
create policy coaching_athlete_notes_update on public.coaching_athlete_notes for update to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid())))) with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid()))));
create policy coaching_athlete_notes_delete on public.coaching_athlete_notes for delete to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid()))));
create trigger guard_scope before update on public.coaching_athlete_notes for each row execute function public.guard_coaching_scope('id','team_id','coach_user_id');
create policy coaching_athlete_coach_notes_read on public.coaching_athlete_coach_notes for select to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid()))) or (visible_to_athlete and exists(select 1 from public.athletes a where a.id=athlete_id and a.user_id=auth.uid())));
create policy coaching_athlete_coach_notes_insert on public.coaching_athlete_coach_notes for insert to authenticated with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid()))) and coach_user_id=auth.uid());
create policy coaching_athlete_coach_notes_update on public.coaching_athlete_coach_notes for update to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid())))) with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid()))));
create policy coaching_athlete_coach_notes_delete on public.coaching_athlete_coach_notes for delete to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid()))));
create trigger guard_scope before update on public.coaching_athlete_coach_notes for each row execute function public.guard_coaching_scope('id','team_id','coach_user_id');
create policy coaching_boats_read on public.coaching_boats for select to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_view_team(team_id,auth.uid()))));
create policy coaching_boats_insert on public.coaching_boats for insert to authenticated with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid()))) and coach_user_id=auth.uid());
create policy coaching_boats_update on public.coaching_boats for update to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid())))) with check (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid()))));
create policy coaching_boats_delete on public.coaching_boats for delete to authenticated using (((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid()))));
create trigger guard_scope before update on public.coaching_boats for each row execute function public.guard_coaching_scope('id','team_id','coach_user_id');
create policy group_assignments_read on public.group_assignments for select to authenticated using ((team_id is not null and public.can_view_team(team_id,auth.uid())) or (team_id is null and org_id is not null and public.is_org_member(org_id)));
create policy group_assignments_insert on public.group_assignments for insert to authenticated with check (((team_id is not null and public.can_coach_team(team_id,auth.uid())) or (team_id is null and org_id is not null and public.is_org_owner_or_admin(org_id))) and created_by=auth.uid());
create policy group_assignments_update on public.group_assignments for update to authenticated using (((team_id is not null and public.can_coach_team(team_id,auth.uid())) or (team_id is null and org_id is not null and public.is_org_owner_or_admin(org_id)))) with check (((team_id is not null and public.can_coach_team(team_id,auth.uid())) or (team_id is null and org_id is not null and public.is_org_owner_or_admin(org_id))));
create policy group_assignments_delete on public.group_assignments for delete to authenticated using (((team_id is not null and public.can_coach_team(team_id,auth.uid())) or (team_id is null and org_id is not null and public.is_org_owner_or_admin(org_id))));
create trigger guard_group_scope before update on public.group_assignments for each row execute function public.guard_coaching_scope('id','team_id','org_id','created_by');
create policy assignments_read on public.daily_workout_assignments for select to authenticated using (user_id=auth.uid() or ((team_id is not null and public.can_staff_team(team_id,auth.uid())) or (team_id is null and group_assignment_id is not null and exists(select 1 from public.group_assignments g where g.id=group_assignment_id and g.team_id is null and public.is_org_owner_or_admin(g.org_id)))));
create policy assignments_insert on public.daily_workout_assignments for insert to authenticated with check ((team_id is null and group_assignment_id is null and user_id=auth.uid()) or ((team_id is not null and public.can_coach_team(team_id,auth.uid())) or (team_id is null and group_assignment_id is not null and exists(select 1 from public.group_assignments g where g.id=group_assignment_id and g.team_id is null and public.is_org_owner_or_admin(g.org_id)))));
create policy assignments_update on public.daily_workout_assignments for update to authenticated using (user_id=auth.uid() or ((team_id is not null and public.can_staff_team(team_id,auth.uid())) or (team_id is null and group_assignment_id is not null and exists(select 1 from public.group_assignments g where g.id=group_assignment_id and g.team_id is null and public.is_org_owner_or_admin(g.org_id))))) with check (user_id=auth.uid() or ((team_id is not null and public.can_staff_team(team_id,auth.uid())) or (team_id is null and group_assignment_id is not null and exists(select 1 from public.group_assignments g where g.id=group_assignment_id and g.team_id is null and public.is_org_owner_or_admin(g.org_id)))));
create policy assignments_delete on public.daily_workout_assignments for delete to authenticated using (((team_id is not null and public.can_coach_team(team_id,auth.uid())) or (team_id is null and group_assignment_id is not null and exists(select 1 from public.group_assignments g where g.id=group_assignment_id and g.team_id is null and public.is_org_owner_or_admin(g.org_id)))));

CREATE OR REPLACE FUNCTION public.create_team_season(p_team_id uuid, p_name text, p_starts_on date, p_ends_on date, p_source_season_id uuid, p_athlete_ids uuid[], p_copy_squads boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_fingerprint jsonb; v_existing jsonb; v_count integer;
begin
 perform 1 from public.teams where id=p_team_id for update;
 if not found or not coalesce(public.can_admin_team(p_team_id,auth.uid()),false) then raise insufficient_privilege using message='Team administration required for this team'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_starts_on is null or p_ends_on is null or p_ends_on<p_starts_on or p_athlete_ids is null or p_copy_squads is null then raise check_violation using message='Provide a name, valid season dates and an explicit athlete selection'; end if;
 if cardinality(p_athlete_ids)<>(select count(distinct x) from unnest(p_athlete_ids) x) then raise check_violation using message='Athlete IDs must be unique and non-null'; end if;
 v_fingerprint=jsonb_build_object('source',p_source_season_id,'ids',(select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from unnest(p_athlete_ids) x),'copy_squads',p_copy_squads,'starts_on',p_starts_on,'ends_on',p_ends_on);
 select id,creation_fingerprint into v_id,v_existing from public.team_seasons where team_id=p_team_id and name=btrim(p_name);
 if found then
  if v_fingerprint=v_existing then return v_id; end if;
  raise check_violation using message='A season with this name already exists with different preparation choices';
 end if;
 if exists(select 1 from public.team_seasons where team_id=p_team_id and status<>'archived' and starts_on<=p_ends_on and ends_on>=p_starts_on) then raise check_violation using message='Season dates overlap another draft or active season'; end if;
 if p_source_season_id is not null and not exists(select 1 from public.team_seasons where id=p_source_season_id and team_id=p_team_id) then raise check_violation using message='Source season must belong to this team'; end if;
 select count(*) into v_count from public.athletes a where a.id=any(p_athlete_ids) and (case when p_source_season_id is null then exists(select 1 from public.team_athletes t where t.team_id=p_team_id and t.athlete_id=a.id and t.status='active') else exists(select 1 from public.team_season_athletes r where r.season_id=p_source_season_id and r.athlete_id=a.id) end);
 if v_count<>cardinality(p_athlete_ids) then raise check_violation using message='Selection contains athletes outside the reviewed source roster; refresh and review it'; end if;
 insert into public.team_seasons(team_id,name,starts_on,ends_on,creation_fingerprint) values(p_team_id,btrim(p_name),p_starts_on,p_ends_on,v_fingerprint) returning id into v_id;
 insert into public.team_season_athletes(season_id,athlete_id,first_name,last_name,grade,squad,performance_tier,status,has_account)
 select v_id,a.id,a.first_name,a.last_name,a.grade,case when p_copy_squads then case when p_source_season_id is null then t.squad else r.squad end end,null,'active',a.user_id is not null
 from public.athletes a left join public.team_athletes t on t.athlete_id=a.id and t.team_id=p_team_id left join public.team_season_athletes r on r.athlete_id=a.id and r.season_id=p_source_season_id where a.id=any(p_athlete_ids);
 return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.activate_team_season(p_season_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_team uuid; v_season public.team_seasons; v_old public.team_seasons;
begin
 select team_id into v_team from public.team_seasons where id=p_season_id;
 perform 1 from public.teams where id=v_team for update;
 if not found or not coalesce(public.can_admin_team(v_team,auth.uid()),false) then raise insufficient_privilege using message='Team administration required for this team'; end if;
 select * into v_season from public.team_seasons where id=p_season_id;
 if v_season.status='active' then return; end if;
 if v_season.status<>'draft' then raise check_violation using message='Only draft seasons can be activated'; end if;
 select * into v_old from public.team_seasons where team_id=v_team and status='active';
 if v_old.id is null and not exists(select 1 from public.team_seasons where team_id=v_team and activated_at is not null) and exists(select 1 from public.daily_workout_assignments where team_id=v_team and completed is not true) then raise check_violation using message='Complete or explicitly resolve pending legacy team assignments before first season activation'; end if;
 if v_old.id is not null and exists(select 1 from public.daily_workout_assignments where team_id=v_team and workout_date between v_old.starts_on and v_old.ends_on and completed is not true) then raise check_violation using message='Complete or explicitly resolve pending assignments in the current season before activating another season'; end if;
 -- Archive before changing operational rows so the old snapshot cannot be rewritten.
 update public.team_seasons set status='archived' where team_id=v_team and status='active';
 update public.team_athletes set status='inactive',left_at=now() where team_id=v_team and status='active';
 update public.team_seasons set status='active',activated_at=coalesce(activated_at,now()) where id=p_season_id;
 insert into public.team_athletes(team_id,athlete_id,status,squad,performance_tier,left_at)
 select v_team,athlete_id,status,squad,performance_tier,case when status='active' then null else now() end from public.team_season_athletes where season_id=p_season_id
 on conflict(team_id,athlete_id) do update set status=excluded.status,squad=excluded.squad,performance_tier=excluded.performance_tier,left_at=excluded.left_at;
end $function$
;

CREATE OR REPLACE FUNCTION public.archive_team_season(p_season_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_team uuid; v_season public.team_seasons;
begin
 select team_id into v_team from public.team_seasons where id=p_season_id;
 perform 1 from public.teams where id=v_team for update;
 if not found or not coalesce(public.can_admin_team(v_team,auth.uid()),false) then raise insufficient_privilege using message='Team administration required for this team'; end if;
 select * into v_season from public.team_seasons where id=p_season_id;
 if v_season.status='archived' then return; end if;
 if v_season.status='active' and exists(select 1 from public.daily_workout_assignments where team_id=v_team and workout_date between v_season.starts_on and v_season.ends_on and completed is not true) then raise check_violation using message='Complete or explicitly resolve pending assignments before archiving this season'; end if;
 update public.team_seasons set status='archived' where id=p_season_id;
 if v_season.status='active' then update public.team_athletes set status='inactive',left_at=now() where team_id=v_team and status='active'; end if;
end $function$
;

revoke all on function public.can_admin_team(uuid,uuid),public.can_create_coaching_space(),public.get_team_access(),public.join_team_by_code(text),public.join_organization_by_code(text),public.guard_access_membership(),public.guard_coaching_scope(),public.guard_assignment_results() from public,anon,authenticated;
grant execute on function public.can_admin_team(uuid,uuid),public.can_create_coaching_space(),public.get_team_access(),public.join_team_by_code(text),public.join_organization_by_code(text) to authenticated;

-- Parent IDs must agree with the row's team even when each FK exists separately.
create function public.guard_coaching_references() returns trigger
language plpgsql security definer set search_path='' as $$
declare r jsonb:=to_jsonb(new); pair text[]; ref_team uuid; ref_id uuid;
begin
 foreach pair slice 1 in array array[
  ['session_id','coaching_sessions'],['session_crew_id','coaching_session_crews'],
  ['boating_id','coaching_boatings'],['source_boating_id','coaching_boatings'],['boat_id','coaching_boats']
 ] loop
  ref_id:=(r->>pair[1])::uuid;
  if ref_id is not null then
   execute format('select team_id from public.%I where id=$1',pair[2]) into ref_team using ref_id;
   if ref_team is distinct from new.team_id then raise check_violation using message='Referenced coaching record must belong to the same team'; end if;
  end if;
 end loop;
 if new.team_id is not null and r->>'athlete_id' is not null and not exists(select 1 from public.team_athletes where team_id=new.team_id and athlete_id=(r->>'athlete_id')::uuid) then raise check_violation using message='Athlete must belong to this team'; end if;
 return new;
end $$;

create function public.stamp_coaching_editor() returns trigger
language plpgsql set search_path='' as $$
begin
 new.edited_by:=auth.uid(); new.edited_at:=clock_timestamp(); return new;
end $$;
create trigger guard_references before insert or update on public.coaching_boatings for each row execute function public.guard_coaching_references();
create trigger guard_references before insert or update on public.coaching_boating_race_results for each row execute function public.guard_coaching_references();
create trigger guard_references before insert or update on public.coaching_sessions for each row execute function public.guard_coaching_references();
create trigger guard_references before insert or update on public.coaching_session_crews for each row execute function public.guard_coaching_references();
create trigger guard_references before insert or update on public.coaching_session_crew_positions for each row execute function public.guard_coaching_references();
create trigger guard_references before insert or update on public.coaching_erg_scores for each row execute function public.guard_coaching_references();
create trigger guard_references before insert or update on public.coaching_athlete_notes for each row execute function public.guard_coaching_references();
create trigger guard_references before insert or update on public.coaching_athlete_coach_notes for each row execute function public.guard_coaching_references();
alter table public.coaching_boatings add column edited_by uuid references auth.users(id), add column edited_at timestamptz;
create trigger z_stamp_editor before insert or update on public.coaching_boatings for each row execute function public.stamp_coaching_editor();
alter table public.coaching_boating_race_results add column edited_by uuid references auth.users(id), add column edited_at timestamptz;
create trigger z_stamp_editor before insert or update on public.coaching_boating_race_results for each row execute function public.stamp_coaching_editor();
alter table public.coaching_sessions add column edited_by uuid references auth.users(id), add column edited_at timestamptz;
create trigger z_stamp_editor before insert or update on public.coaching_sessions for each row execute function public.stamp_coaching_editor();
alter table public.coaching_session_crews add column edited_by uuid references auth.users(id), add column edited_at timestamptz;
create trigger z_stamp_editor before insert or update on public.coaching_session_crews for each row execute function public.stamp_coaching_editor();
alter table public.coaching_session_crew_positions add column edited_by uuid references auth.users(id), add column edited_at timestamptz;
create trigger z_stamp_editor before insert or update on public.coaching_session_crew_positions for each row execute function public.stamp_coaching_editor();
alter table public.coaching_erg_scores add column edited_by uuid references auth.users(id), add column edited_at timestamptz;
create trigger z_stamp_editor before insert or update on public.coaching_erg_scores for each row execute function public.stamp_coaching_editor();
alter table public.daily_workout_assignments add column edited_by uuid references auth.users(id), add column edited_at timestamptz;
create trigger z_stamp_editor before insert or update on public.daily_workout_assignments for each row execute function public.stamp_coaching_editor();
revoke all on function public.guard_coaching_references(),public.stamp_coaching_editor() from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.ensure_team_member_athlete_link(p_team_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid;
  target_membership public.team_members;
  v_athlete_id uuid;
  profile_display_name text;
  profile_email text;
  base_name text;
  name_parts text[];
  first_name_value text;
  last_name_value text;
begin
  caller_id := auth.uid();

  if caller_id is null and current_setting('role',true)<>'service_role' then
    raise exception 'Authentication required';
  end if;

  select *
  into target_membership
  from public.team_members
  where team_id = p_team_id
    and user_id = p_user_id;

  if target_membership.id is null then
    raise exception 'Target user is not a member of this team';
  end if;

  if current_setting('role',true)<>'service_role' and caller_id <> p_user_id and not public.can_manage_team_members(p_team_id, caller_id) then
    raise exception 'Not allowed to link athlete records for this team';
  end if;

  select id
  into v_athlete_id
  from public.athletes
  where user_id = p_user_id;

  if v_athlete_id is null then
    select display_name, email
    into profile_display_name, profile_email
    from public.user_profiles
    where user_id = p_user_id;

    base_name := coalesce(nullif(trim(profile_display_name), ''), nullif(split_part(coalesce(profile_email, ''), '@', 1), ''), 'Athlete');
    name_parts := regexp_split_to_array(base_name, '\s+');
    first_name_value := coalesce(nullif(name_parts[1], ''), 'Athlete');
    last_name_value := coalesce(nullif(array_to_string(name_parts[2:array_length(name_parts, 1)], ' '), ''), '');

    insert into public.athletes (user_id, first_name, last_name, email, created_by)
    values (p_user_id, first_name_value, last_name_value, profile_email, coalesce(caller_id,p_user_id))
    on conflict (user_id) do update
      set email = coalesce(athletes.email, excluded.email)
    returning id into v_athlete_id;
  end if;

  insert into public.team_athletes (team_id, athlete_id, status)
  values (p_team_id, v_athlete_id, 'active')
  on conflict (team_id, athlete_id) do nothing;

  return v_athlete_id;
end;
$function$;
grant execute on function public.can_admin_team(uuid,uuid),public.ensure_team_member_athlete_link(uuid,uuid) to service_role;

create function public.can_bootstrap_organization(p_org_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organizations where id=p_org_id and created_by=p_user_id)
 and not exists(select 1 from public.organization_members where org_id=p_org_id);
$$;
drop policy organization_members_insert on public.organization_members;
create policy organization_members_insert on public.organization_members for insert to authenticated
with check(public.is_org_owner_or_admin(org_id) or (user_id=auth.uid() and role='owner' and public.can_bootstrap_organization(org_id,auth.uid())));
revoke all on function public.can_bootstrap_organization(uuid,uuid) from public,anon,authenticated;
grant execute on function public.can_bootstrap_organization(uuid,uuid) to authenticated;

create function public.guard_assignment_scope() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_group public.group_assignments;
begin
 if new.group_assignment_id is not null then
  select * into v_group from public.group_assignments where id=new.group_assignment_id;
  if not found or (v_group.team_id is not null and v_group.team_id is distinct from new.team_id)
   or (v_group.team_id is null and new.team_id is not null and not exists(select 1 from public.teams where id=new.team_id and org_id=v_group.org_id)) then raise check_violation using message='Assignment group and team scopes must agree'; end if;
 end if;
 if new.team_id is not null and new.athlete_id is not null and not exists(select 1 from public.team_athletes where team_id=new.team_id and athlete_id=new.athlete_id) then raise check_violation using message='Assignment athlete must belong to the same team'; end if;
 return new;
end $$;
create trigger guard_assignment_scope before insert or update on public.daily_workout_assignments for each row execute function public.guard_assignment_scope();
revoke all on function public.guard_assignment_scope() from public,anon,authenticated;

-- Club affiliation is a deliberate two-sided administrative operation.
create function public.set_team_club(p_team_id uuid,p_org_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.teams where id=p_team_id for update;
 if not found or not public.can_admin_team(p_team_id,auth.uid()) then raise insufficient_privilege using message='Team administration required'; end if;
 if p_org_id is not null and not public.is_org_owner_or_admin(p_org_id) then raise insufficient_privilege using message='Target club administration required'; end if;
 update public.teams set org_id=p_org_id where id=p_team_id;
end $$;
revoke all on function public.set_team_club(uuid,uuid) from public,anon,authenticated;
grant execute on function public.set_team_club(uuid,uuid) to authenticated;

-- General roster rows are visible to coxswains; private notes live separately.
create table public.athlete_private_notes(
 athlete_id uuid primary key references public.athletes(id) on delete cascade deferrable initially deferred,
 notes text,
 coach_notes text,
 coach_notes_visible_to_athlete boolean not null default false
);
alter table public.athlete_private_notes enable row level security;
create policy athlete_private_notes_coaches on public.athlete_private_notes for all to authenticated
using(public.can_coach_athlete(athlete_id,auth.uid())) with check(public.can_coach_athlete(athlete_id,auth.uid()));
revoke all on public.athlete_private_notes from public,anon,authenticated;
grant select,insert,update,delete on public.athlete_private_notes to authenticated;
insert into public.athlete_private_notes(athlete_id,notes,coach_notes,coach_notes_visible_to_athlete)
select id,notes,coach_notes,coach_notes_visible_to_athlete from public.athletes where notes is not null or coach_notes is not null;
update public.athletes set notes=null,coach_notes=null,coach_notes_visible_to_athlete=false where notes is not null or coach_notes is not null or coach_notes_visible_to_athlete;
create function public.route_athlete_private_notes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true) not in ('postgres','service_role','supabase_admin','none') and not (
  (TG_OP='INSERT' and new.created_by=auth.uid() and public.can_create_teams(auth.uid()))
  or (TG_OP='UPDATE' and public.can_coach_athlete(new.id,auth.uid()))
 ) then
  if TG_OP='UPDATE' or new.notes is not null or new.coach_notes is not null or new.coach_notes_visible_to_athlete then raise insufficient_privilege using message='Private athlete notes require coaching permission'; end if;
 end if;
 if TG_OP='INSERT' then
  if new.notes is not null or new.coach_notes is not null then
   insert into public.athlete_private_notes(athlete_id,notes,coach_notes,coach_notes_visible_to_athlete) values(new.id,new.notes,new.coach_notes,new.coach_notes_visible_to_athlete);
  end if;
  new.notes:=null; new.coach_notes:=null; new.coach_notes_visible_to_athlete:=false;
 elsif TG_ARGV[0]='notes' then
  insert into public.athlete_private_notes(athlete_id,notes) values(new.id,new.notes) on conflict(athlete_id) do update set notes=excluded.notes;
  new.notes:=null;
 else
  insert into public.athlete_private_notes(athlete_id,coach_notes,coach_notes_visible_to_athlete) values(new.id,new.coach_notes,new.coach_notes_visible_to_athlete)
  on conflict(athlete_id) do update set coach_notes=excluded.coach_notes,coach_notes_visible_to_athlete=excluded.coach_notes_visible_to_athlete;
  new.coach_notes:=null; new.coach_notes_visible_to_athlete:=false;
 end if;
 return new;
end $$;
create trigger route_private_notes_insert before insert on public.athletes for each row execute function public.route_athlete_private_notes();
create trigger route_private_notes before update of notes on public.athletes for each row execute function public.route_athlete_private_notes('notes');
create trigger route_private_coach_notes before update of coach_notes,coach_notes_visible_to_athlete on public.athletes for each row execute function public.route_athlete_private_notes('coach_notes');
revoke all on function public.route_athlete_private_notes() from public,anon,authenticated;
-- Deleting a practice can cascade to private coach notes; reserve it for coaches.
drop policy coaching_sessions_delete on public.coaching_sessions;
create policy coaching_sessions_delete on public.coaching_sessions for delete to authenticated using((team_id is null and coach_user_id=auth.uid()) or (team_id is not null and public.can_coach_team(team_id,auth.uid())));

-- Membership-based read access and coach-only weekly prescription writes.
drop policy "Coaches can manage weekly plans" on public.coaching_weekly_plans;
drop policy "Team members can view weekly plans" on public.coaching_weekly_plans;
create policy weekly_plans_read on public.coaching_weekly_plans for select to authenticated using(public.can_view_team(team_id,auth.uid()));
create policy weekly_plans_coach on public.coaching_weekly_plans for all to authenticated using(public.can_coach_team(team_id,auth.uid())) with check(public.can_coach_team(team_id,auth.uid()));
create trigger guard_weekly_scope before update on public.coaching_weekly_plans for each row execute function public.guard_coaching_scope('id','team_id','coach_user_id');

create function public.can_manage_club_training(p_org_id uuid,p_team_ids uuid[]) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_org_owner_or_admin(p_org_id) or (cardinality(p_team_ids)>0 and not exists(
 select 1 from unnest(p_team_ids) x where x is null or not exists(select 1 from public.teams t where t.id=x and t.org_id=p_org_id and public.can_coach_team(t.id,auth.uid()))));
$$;
drop policy coaching_schedule_events_insert on public.coaching_schedule_events;
drop policy coaching_schedule_events_update on public.coaching_schedule_events;
drop policy coaching_schedule_events_delete on public.coaching_schedule_events;
create policy schedule_events_insert on public.coaching_schedule_events for insert to authenticated with check(coach_user_id=auth.uid() and public.can_manage_club_training(org_id,team_ids));
create policy schedule_events_update on public.coaching_schedule_events for update to authenticated using(public.can_manage_club_training(org_id,team_ids)) with check(public.can_manage_club_training(org_id,team_ids));
create policy schedule_events_delete on public.coaching_schedule_events for delete to authenticated using(public.can_manage_club_training(org_id,team_ids));
create trigger guard_schedule_scope before update on public.coaching_schedule_events for each row execute function public.guard_coaching_scope('id','org_id','coach_user_id','team_ids');
revoke all on function public.can_manage_club_training(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.can_manage_club_training(uuid,uuid[]) to authenticated;

-- Result sharing follows the same explicit team boundary as result editing.
create function public.can_share_team_results(p_team_id uuid,p_org_id uuid,p_filter_team_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.can_staff_team(p_team_id,auth.uid())
 and (p_org_id is null or public.is_org_owner_or_admin(p_org_id) and exists(select 1 from public.teams where id=p_team_id and org_id=p_org_id))
 and (p_filter_team_id is null or p_org_id is null and p_filter_team_id=p_team_id or p_org_id is not null and exists(select 1 from public.teams where id=p_filter_team_id and org_id=p_org_id));
$$;
drop policy "Coaches can manage their leaderboard shares" on public.team_leaderboard_shares;
create policy leaderboard_shares_staff on public.team_leaderboard_shares for all to authenticated
using(created_by=auth.uid() and public.can_share_team_results(team_id,org_id,filter_team_id))
with check(created_by=auth.uid() and public.can_share_team_results(team_id,org_id,filter_team_id));
create trigger guard_leaderboard_scope before update on public.team_leaderboard_shares for each row execute function public.guard_coaching_scope('id','team_id','org_id','created_by','filter_team_id');
drop policy "Coaches can view assignment shares" on public.assignment_result_shares;
create policy assignment_shares_staff_read on public.assignment_result_shares for select to authenticated using(exists(select 1 from public.group_assignments g where g.id=group_assignment_id and (g.team_id is not null and public.can_staff_team(g.team_id,auth.uid()) or g.team_id is null and public.is_org_owner_or_admin(g.org_id))));
create or replace function public.create_team_leaderboard_share(p_team_id uuid,p_org_id uuid default null,p_filter_squad text default null,p_filter_tier text default null,p_filter_team_id uuid default null,p_expires_in_hours integer default 168) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_token text; v_expiry timestamptz;
begin
 if auth.uid() is null or not public.can_share_team_results(p_team_id,p_org_id,p_filter_team_id) then raise insufficient_privilege using message='Assigned team staff permission required'; end if;
 v_token:=encode(extensions.gen_random_bytes(18),'hex'); v_expiry:=now()+make_interval(hours=>greatest(coalesce(p_expires_in_hours,168),1));
 insert into public.team_leaderboard_shares(team_id,org_id,token_hash,created_by,expires_at,filter_squad,filter_tier,filter_team_id) values(p_team_id,p_org_id,encode(extensions.digest(v_token,'sha256'),'hex'),auth.uid(),v_expiry,p_filter_squad,p_filter_tier,p_filter_team_id);
 return jsonb_build_object('token',v_token,'expires_at',v_expiry);
end $$;
create or replace function public.create_assignment_results_share(p_group_assignment_id uuid,p_expires_in_hours integer default 168) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_token text; v_expiry timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from public.group_assignments g where g.id=p_group_assignment_id and (g.team_id is not null and public.can_staff_team(g.team_id,auth.uid()) or g.team_id is null and public.is_org_owner_or_admin(g.org_id))) then raise insufficient_privilege using message='Assigned team staff permission required'; end if;
 v_token:=encode(extensions.gen_random_bytes(18),'hex'); v_expiry:=now()+make_interval(hours=>greatest(coalesce(p_expires_in_hours,168),1));
 insert into public.assignment_result_shares(group_assignment_id,token_hash,created_by,expires_at) values(p_group_assignment_id,encode(extensions.digest(v_token,'sha256'),'hex'),auth.uid(),v_expiry);
 return jsonb_build_object('token',v_token,'expires_at',v_expiry);
end $$;
revoke all on function public.can_share_team_results(uuid,uuid,uuid),public.create_team_leaderboard_share(uuid,uuid,text,text,uuid,integer),public.create_assignment_results_share(uuid,integer) from public,anon,authenticated;
grant execute on function public.can_share_team_results(uuid,uuid,uuid),public.create_team_leaderboard_share(uuid,uuid,text,text,uuid,integer),public.create_assignment_results_share(uuid,integer) to authenticated;
