-- Disposable fixture captured from live column/policy/function metadata on 2026-11-16.
-- No production rows. Foreign-key targets unrelated to permissions are omitted.
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.user_profiles(user_id uuid,display_name text,email text,roles text[]);
create table public.athletes (id uuid not null default gen_random_uuid() primary key,user_id uuid,first_name text not null,last_name text not null,email text,date_of_birth date,grade text,experience_level text,side text,height_cm numeric,weight_kg numeric,notes text,created_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),coach_notes text,coach_notes_visible_to_athlete bool not null default false);
alter table public.athletes enable row level security;
create table public.coaching_access_requests (id uuid not null default gen_random_uuid() primary key,user_id uuid not null,display_name text not null,message text,status text not null default 'pending'::text,reviewed_by uuid,reviewed_at timestamptz,created_at timestamptz not null default now());
alter table public.coaching_access_requests enable row level security;
create table public.coaching_athlete_coach_notes (id uuid not null default gen_random_uuid() primary key,team_id uuid not null,athlete_id uuid not null,coach_user_id uuid,note text not null,visible_to_athlete bool not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.coaching_athlete_coach_notes enable row level security;
create table public.coaching_athlete_notes (id uuid not null default gen_random_uuid() primary key,coach_user_id uuid,session_id uuid not null,athlete_id uuid not null,note text not null,created_at timestamptz not null default now(),team_id uuid);
alter table public.coaching_athlete_notes enable row level security;
create table public.coaching_athletes (id uuid not null default gen_random_uuid() primary key,coach_user_id uuid,name text not null,grade text,experience_level text,side text,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.coaching_athletes enable row level security;
create table public.coaching_boating_race_results (id uuid not null default gen_random_uuid() primary key,boating_id uuid not null,team_id uuid not null,coach_user_id uuid,schedule_event_id uuid,race_date date not null,event_name text not null,distance_meters int4 not null,time_seconds float8 not null,lineup_signature text not null,lineup_positions jsonb not null default '[]'::jsonb,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.coaching_boating_race_results enable row level security;
create table public.coaching_boatings (id uuid not null default gen_random_uuid() primary key,coach_user_id uuid,date date not null,boat_name text not null,boat_type text not null,positions jsonb not null default '[]'::jsonb,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),team_id uuid,session_id uuid,sort_order int4 default 0,is_active bool default true,boat_id uuid);
alter table public.coaching_boatings enable row level security;
create table public.coaching_boats (id uuid not null default gen_random_uuid() primary key,team_id uuid not null,coach_user_id uuid,boat_name text not null,boat_type text not null,notes text,is_active bool not null default true,sort_order int4 not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.coaching_boats enable row level security;
create table public.coaching_erg_scores (id uuid not null default gen_random_uuid() primary key,coach_user_id uuid,athlete_id uuid not null,date date not null,distance int4 not null,time_seconds numeric not null,split_500m numeric,watts numeric,stroke_rate int4,heart_rate int4,notes text,created_at timestamptz not null default now(),team_id uuid);
alter table public.coaching_erg_scores enable row level security;
create table public.coaching_schedule_events (id uuid not null default gen_random_uuid() primary key,org_id uuid not null,coach_user_id uuid,date date not null,end_date date,title text not null,event_type text not null,location text,team_ids uuid[] default '{}'::uuid[],notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.coaching_schedule_events enable row level security;
create table public.coaching_session_crew_positions (id uuid not null default gen_random_uuid() primary key,session_crew_id uuid not null,team_id uuid not null,coach_user_id uuid,seat int4 not null,athlete_id uuid,athlete_name text not null,created_at timestamptz not null default now());
alter table public.coaching_session_crew_positions enable row level security;
create table public.coaching_session_crews (id uuid not null default gen_random_uuid() primary key,session_id uuid not null,team_id uuid not null,coach_user_id uuid,boat_id uuid,source_boating_id uuid,boat_name text not null,boat_type text not null,notes text,sort_order int4 not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.coaching_session_crews enable row level security;
create table public.coaching_sessions (id uuid not null default gen_random_uuid() primary key,coach_user_id uuid,date date not null,type text not null,focus text,general_notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),team_id uuid,group_assignment_id uuid);
alter table public.coaching_sessions enable row level security;
create table public.coaching_weekly_plans (id uuid not null default gen_random_uuid() primary key,team_id uuid not null,week_start date not null,theme text,goals text[] default '{}'::text[],notes text,reflection text,created_by uuid,created_at timestamptz default now(),updated_at timestamptz default now(),coaching_points text[] default '{}'::text[],drill_examples text[] default '{}'::text[],piece_examples text[] default '{}'::text[]);
alter table public.coaching_weekly_plans enable row level security;
create table public.daily_workout_assignments (id uuid not null default gen_random_uuid() primary key,user_id uuid,team_id uuid,plan_id uuid,workout_date date not null,day_of_week int4,week_number int4,phase_name text,scheduled_workout jsonb,actual_workout jsonb,was_substituted bool default false,substitution_reason text,original_template_id uuid,substituted_template_id uuid,completed bool default false,completed_log_id uuid,completed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),group_assignment_id uuid,athlete_id uuid,result_time_seconds numeric,result_distance_meters numeric,result_split_seconds numeric,result_intervals jsonb,result_stroke_rate int4,is_test bool not null default false,result_weight_kg numeric,titan_index numeric);
alter table public.daily_workout_assignments enable row level security;
create table public.group_assignments (id uuid not null default gen_random_uuid() primary key,team_id uuid,template_id uuid not null,scheduled_date date not null,title text,instructions text,created_by uuid,created_at timestamptz default now(),org_id uuid);
alter table public.group_assignments enable row level security;
create table public.organization_members (id uuid not null default gen_random_uuid() primary key,org_id uuid not null,user_id uuid not null,role text not null default 'coach'::text,joined_at timestamptz not null default now());
alter table public.organization_members enable row level security;
create table public.organizations (id uuid not null default gen_random_uuid() primary key,name text not null,description text,invite_code text not null,created_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),performance_tier_rubric jsonb);
alter table public.organizations enable row level security;
create table public.team_athletes (id uuid not null default gen_random_uuid() primary key,team_id uuid not null,athlete_id uuid not null,status text not null default 'active'::text,joined_at timestamptz not null default now(),left_at timestamptz,squad text,performance_tier text);
alter table public.team_athletes enable row level security;
create table public.team_members (id uuid not null default gen_random_uuid() primary key,team_id uuid not null,user_id uuid not null,role text not null,joined_at timestamptz not null default now());
alter table public.team_members enable row level security;
create table public.teams (id uuid not null default gen_random_uuid() primary key,name text not null,description text,invite_code text not null,coach_id uuid not null,max_members int4 not null default 50,is_public bool not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),org_id uuid,titan_window_size int4 not null default 5,titan_power_weight numeric not null default 0.7);
alter table public.teams enable row level security;
alter table public.team_members add unique(team_id,user_id); alter table public.organization_members add unique(org_id,user_id); alter table public.team_athletes add unique(team_id,athlete_id); alter table public.athletes add unique(user_id);
create function public.can_staff_team(uuid,uuid) returns boolean language sql as $$select false$$;
create function public.can_coach_team(uuid,uuid) returns boolean language sql as $$select false$$;
CREATE OR REPLACE FUNCTION public.is_org_owner_or_admin(p_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE org_id = p_org_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
    );
$function$
;
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE org_id = p_org_id
          AND user_id = auth.uid()
    );
$function$
;
CREATE OR REPLACE FUNCTION public.can_view_team(p_team_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams t
    WHERE t.id = p_team_id
      AND t.coach_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = p_team_id
      AND tm.user_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.organization_members om ON om.org_id = t.org_id
    WHERE t.id = p_team_id
      AND om.user_id = p_user_id
  );
$function$
;
CREATE OR REPLACE FUNCTION public.can_manage_team_members(p_team_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.can_staff_team(p_team_id, p_user_id);
$function$
;
CREATE OR REPLACE FUNCTION public.can_staff_team(p_team_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams t
    WHERE t.id = p_team_id
      AND t.coach_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = p_team_id
      AND tm.user_id = p_user_id
      AND tm.role IN ('coach', 'coxswain')
  )
  OR EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.organization_members om ON om.org_id = t.org_id
    WHERE t.id = p_team_id
      AND om.user_id = p_user_id
  );
$function$
;
CREATE OR REPLACE FUNCTION public.can_coach_team(p_team_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams t
    WHERE t.id = p_team_id
      AND t.coach_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = p_team_id
      AND tm.user_id = p_user_id
      AND tm.role = 'coach'
  )
  OR EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.organization_members om ON om.org_id = t.org_id
    WHERE t.id = p_team_id
      AND om.user_id = p_user_id
  );
$function$
;
CREATE OR REPLACE FUNCTION public.can_coach_athlete(p_athlete_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_athletes ta
    WHERE ta.athlete_id = p_athlete_id
      AND public.can_coach_team(ta.team_id, p_user_id)
  );
$function$
;
CREATE OR REPLACE FUNCTION public.ensure_team_member_athlete_link(p_team_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.can_create_teams(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = p_user_id
      AND 'coach' = ANY (up.roles)
  )
  OR EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.user_id = p_user_id
      AND tm.role IN ('coach', 'coxswain')
  )
  OR EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.coaching_access_requests car
    WHERE car.user_id = p_user_id
      AND car.status = 'approved'
  );
$function$
;
CREATE OR REPLACE FUNCTION public.can_view_athlete(p_athlete_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.athletes a
    WHERE a.id = p_athlete_id
      AND (a.user_id = p_user_id OR a.created_by = p_user_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.team_athletes ta
    WHERE ta.athlete_id = p_athlete_id
      AND public.can_view_team(ta.team_id, p_user_id)
  );
$function$
;
create policy "Athletes insertable by coaches" on public.athletes for INSERT to authenticated with check ((created_by = ( SELECT auth.uid() AS uid)));
create policy "Creators can view own athletes" on public.athletes for SELECT to authenticated using ((created_by = ( SELECT auth.uid() AS uid)));
create policy "Team and org coaches can delete athletes" on public.athletes for DELETE to authenticated using (can_coach_athlete(id, ( SELECT auth.uid() AS uid)));
create policy "Team and org coaches can update athletes" on public.athletes for UPDATE to authenticated using (((( SELECT auth.uid() AS uid) = user_id) OR can_coach_athlete(id, ( SELECT auth.uid() AS uid)))) with check (((( SELECT auth.uid() AS uid) = user_id) OR can_coach_athlete(id, ( SELECT auth.uid() AS uid))));
create policy "Team and org members can view athletes" on public.athletes for SELECT to authenticated using (can_view_athlete(id, ( SELECT auth.uid() AS uid)));
create policy "Org owners and admins can view all coaching requests" on public.coaching_access_requests for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
create policy "Users can submit coaching request" on public.coaching_access_requests for INSERT to authenticated with check (((auth.uid() = user_id) AND (status = 'pending'::text)));
create policy "Users can view own coaching request" on public.coaching_access_requests for SELECT to authenticated using ((auth.uid() = user_id));
create policy "Team and org coaches can delete athlete coach feed notes" on public.coaching_athlete_coach_notes for DELETE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can insert athlete coach feed notes" on public.coaching_athlete_coach_notes for INSERT to authenticated with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can update athlete coach feed notes" on public.coaching_athlete_coach_notes for UPDATE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid)))) with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can view athlete coach feed notes" on public.coaching_athlete_coach_notes for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid)) OR ((visible_to_athlete = true) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = coaching_athlete_coach_notes.athlete_id) AND (a.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "Team and org coaches can delete athlete notes" on public.coaching_athlete_notes for DELETE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR ((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org coaches can insert athlete notes" on public.coaching_athlete_notes for INSERT to authenticated with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND ((team_id IS NULL) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org coaches can update athlete notes" on public.coaching_athlete_notes for UPDATE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR ((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))))) with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND ((team_id IS NULL) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org coaches can view athlete notes" on public.coaching_athlete_notes for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR ((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Coaches manage own athletes" on public.coaching_athletes for ALL to authenticated using ((auth.uid() = coach_user_id)) with check ((auth.uid() = coach_user_id));
create policy "Team and org coaches can delete boating race results" on public.coaching_boating_race_results for DELETE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can insert boating race results" on public.coaching_boating_race_results for INSERT to authenticated with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can update boating race results" on public.coaching_boating_race_results for UPDATE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid)))) with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org members can view boating race results" on public.coaching_boating_race_results for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_view_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can delete boatings" on public.coaching_boatings for DELETE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR ((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org coaches can insert boatings" on public.coaching_boatings for INSERT to authenticated with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND ((team_id IS NULL) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org coaches can update boatings" on public.coaching_boatings for UPDATE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR ((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))))) with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND ((team_id IS NULL) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org members can view boatings" on public.coaching_boatings for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR ((team_id IS NOT NULL) AND can_view_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org coaches can delete boats" on public.coaching_boats for DELETE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can insert boats" on public.coaching_boats for INSERT to authenticated with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can update boats" on public.coaching_boats for UPDATE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid)))) with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org members can view boats" on public.coaching_boats for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_view_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can delete erg scores" on public.coaching_erg_scores for DELETE to authenticated using (((coach_user_id = ( SELECT auth.uid() AS uid)) OR ((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org members can view erg scores" on public.coaching_erg_scores for SELECT to authenticated using ((((team_id IS NULL) AND (coach_user_id = ( SELECT auth.uid() AS uid))) OR ((team_id IS NOT NULL) AND can_view_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org staff can insert erg scores" on public.coaching_erg_scores for INSERT to authenticated with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND ((team_id IS NULL) OR can_staff_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org staff can update erg scores" on public.coaching_erg_scores for UPDATE to authenticated using (((coach_user_id = ( SELECT auth.uid() AS uid)) OR ((team_id IS NOT NULL) AND can_staff_team(team_id, ( SELECT auth.uid() AS uid))))) with check (((coach_user_id = ( SELECT auth.uid() AS uid)) OR ((team_id IS NOT NULL) AND can_staff_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "coaching_schedule_events_delete" on public.coaching_schedule_events for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.org_id = coaching_schedule_events.org_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text]))))));
create policy "coaching_schedule_events_insert" on public.coaching_schedule_events for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.org_id = coaching_schedule_events.org_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text]))))));
create policy "coaching_schedule_events_select" on public.coaching_schedule_events for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.org_id = coaching_schedule_events.org_id) AND (om.user_id = auth.uid())))));
create policy "coaching_schedule_events_update" on public.coaching_schedule_events for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.org_id = coaching_schedule_events.org_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'coach'::text]))))));
create policy "Team and org coaches can delete session crew positions" on public.coaching_session_crew_positions for DELETE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can insert session crew positions" on public.coaching_session_crew_positions for INSERT to authenticated with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can update session crew positions" on public.coaching_session_crew_positions for UPDATE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid)))) with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org members can view session crew positions" on public.coaching_session_crew_positions for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_view_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can delete session crews" on public.coaching_session_crews for DELETE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can insert session crews" on public.coaching_session_crews for INSERT to authenticated with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can update session crews" on public.coaching_session_crews for UPDATE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid)))) with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org members can view session crews" on public.coaching_session_crews for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR can_view_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Team and org coaches can delete sessions" on public.coaching_sessions for DELETE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR ((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org coaches can insert sessions" on public.coaching_sessions for INSERT to authenticated with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND ((team_id IS NULL) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org coaches can update sessions" on public.coaching_sessions for UPDATE to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR ((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))))) with check (((coach_user_id = ( SELECT auth.uid() AS uid)) AND ((team_id IS NULL) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Team and org members can view sessions" on public.coaching_sessions for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = coach_user_id) OR ((team_id IS NOT NULL) AND can_view_team(team_id, ( SELECT auth.uid() AS uid)))));
create policy "Coaches can manage weekly plans" on public.coaching_weekly_plans for ALL to authenticated using (can_coach_team(team_id, ( SELECT auth.uid() AS uid))) with check (can_coach_team(team_id, ( SELECT auth.uid() AS uid)));
create policy "Team members can view weekly plans" on public.coaching_weekly_plans for SELECT to authenticated using ((team_id IN ( SELECT team_members.team_id
   FROM team_members
  WHERE (team_members.user_id = auth.uid()))));
create policy "Coaches can create team assignments" on public.daily_workout_assignments for INSERT to authenticated with check ((((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))) OR ((group_assignment_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (group_assignments ga
     JOIN organization_members om ON ((om.org_id = ga.org_id)))
  WHERE ((ga.id = daily_workout_assignments.group_assignment_id) AND (om.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "Coaches can delete team assignments" on public.daily_workout_assignments for DELETE to authenticated using ((((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))) OR ((group_assignment_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (group_assignments ga
     JOIN organization_members om ON ((om.org_id = ga.org_id)))
  WHERE ((ga.id = daily_workout_assignments.group_assignment_id) AND (om.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "Coaches can update team assignments" on public.daily_workout_assignments for UPDATE to authenticated using ((((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))) OR ((group_assignment_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (group_assignments ga
     JOIN organization_members om ON ((om.org_id = ga.org_id)))
  WHERE ((ga.id = daily_workout_assignments.group_assignment_id) AND (om.user_id = ( SELECT auth.uid() AS uid)))))))) with check ((((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))) OR ((group_assignment_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (group_assignments ga
     JOIN organization_members om ON ((om.org_id = ga.org_id)))
  WHERE ((ga.id = daily_workout_assignments.group_assignment_id) AND (om.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "Coaches can view team assignments" on public.daily_workout_assignments for SELECT to authenticated using ((((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))) OR ((group_assignment_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (group_assignments ga
     JOIN organization_members om ON ((om.org_id = ga.org_id)))
  WHERE ((ga.id = daily_workout_assignments.group_assignment_id) AND (om.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "Users can create their own assignments" on public.daily_workout_assignments for INSERT to authenticated with check ((auth.uid() = user_id));
create policy "Users can update their own assignments" on public.daily_workout_assignments for UPDATE to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can view their own assignments" on public.daily_workout_assignments for SELECT to authenticated using ((auth.uid() = user_id));
create policy "Coaches can create group assignments" on public.group_assignments for INSERT to authenticated with check (((created_by = auth.uid()) AND (((team_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.team_id = group_assignments.team_id) AND (team_members.user_id = auth.uid()) AND (team_members.role = ANY (ARRAY['coach'::text, 'coxswain'::text])))))) OR ((org_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.org_id = group_assignments.org_id) AND (organization_members.user_id = auth.uid()))))))));
create policy "Coaches can delete group assignments" on public.group_assignments for DELETE to authenticated using (((created_by = auth.uid()) OR ((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))) OR ((org_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.org_id = group_assignments.org_id) AND (om.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "Coaches can update group assignments" on public.group_assignments for UPDATE to authenticated using (((created_by = auth.uid()) OR ((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))) OR ((org_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.org_id = group_assignments.org_id) AND (om.user_id = ( SELECT auth.uid() AS uid)))))))) with check (((created_by = auth.uid()) OR ((team_id IS NOT NULL) AND can_coach_team(team_id, ( SELECT auth.uid() AS uid))) OR ((org_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.org_id = group_assignments.org_id) AND (om.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "Team or org members can view group assignments" on public.group_assignments for SELECT to authenticated using ((((team_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.team_id = group_assignments.team_id) AND (team_members.user_id = auth.uid()))))) OR ((org_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.org_id = group_assignments.org_id) AND (organization_members.user_id = auth.uid())))))));
create policy "Org members can view membership" on public.organization_members for SELECT to authenticated using (((user_id = auth.uid()) OR is_org_member(org_id)));
create policy "Org owner/admin can delete members" on public.organization_members for DELETE to authenticated using (is_org_owner_or_admin(org_id));
create policy "Org owner/admin can insert members" on public.organization_members for INSERT to authenticated with check (((user_id = auth.uid()) OR is_org_owner_or_admin(org_id)));
create policy "Org owner/admin can update members" on public.organization_members for UPDATE to authenticated using (is_org_owner_or_admin(org_id));
create policy "Authenticated users can create organizations" on public.organizations for INSERT to authenticated with check ((auth.uid() = created_by));
create policy "Org members can view their organizations" on public.organizations for SELECT to authenticated using (((created_by = auth.uid()) OR is_org_member(id)));
create policy "Org owner/admin can delete organizations" on public.organizations for DELETE to authenticated using (is_org_owner_or_admin(id));
create policy "Org owner/admin can update organizations" on public.organizations for UPDATE to authenticated using (is_org_owner_or_admin(id));
create policy "Team and org coaches can delete team athletes" on public.team_athletes for DELETE to authenticated using (can_coach_team(team_id, ( SELECT auth.uid() AS uid)));
create policy "Team and org coaches can insert team athletes" on public.team_athletes for INSERT to authenticated with check (can_coach_team(team_id, ( SELECT auth.uid() AS uid)));
create policy "Team and org coaches can update team athletes" on public.team_athletes for UPDATE to authenticated using (can_coach_team(team_id, ( SELECT auth.uid() AS uid))) with check (can_coach_team(team_id, ( SELECT auth.uid() AS uid)));
create policy "Team and org members can view team athletes" on public.team_athletes for SELECT to authenticated using (can_view_team(team_id, ( SELECT auth.uid() AS uid)));
create policy "Team and org coaches can update team members" on public.team_members for UPDATE to authenticated using (can_coach_team(team_id, ( SELECT auth.uid() AS uid))) with check (can_coach_team(team_id, ( SELECT auth.uid() AS uid)));
create policy "Team and org members can view team members" on public.team_members for SELECT to authenticated using (can_view_team(team_id, ( SELECT auth.uid() AS uid)));
create policy "Users and staff can insert team members" on public.team_members for INSERT to authenticated with check (((( SELECT auth.uid() AS uid) = user_id) OR can_manage_team_members(team_id, ( SELECT auth.uid() AS uid))));
create policy "Users, team coaches, and org coaches can delete team members" on public.team_members for DELETE to authenticated using (((( SELECT auth.uid() AS uid) = user_id) OR can_coach_team(team_id, ( SELECT auth.uid() AS uid))));
create policy "Coaches can delete their teams" on public.teams for DELETE to authenticated using (can_coach_team(id, ( SELECT auth.uid() AS uid)));
create policy "Coaches can insert teams" on public.teams for INSERT to authenticated with check (can_create_teams(( SELECT auth.uid() AS uid)));
create policy "Coaches can update their teams" on public.teams for UPDATE to authenticated using (can_coach_team(id, ( SELECT auth.uid() AS uid))) with check (can_coach_team(id, ( SELECT auth.uid() AS uid)));
create policy "Team and org members can view teams" on public.teams for SELECT to authenticated using (((( SELECT auth.uid() AS uid) = coach_id) OR (EXISTS ( SELECT 1
   FROM team_members tm
  WHERE ((tm.team_id = teams.id) AND (tm.user_id = ( SELECT auth.uid() AS uid))))) OR ((org_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.org_id = teams.org_id) AND (om.user_id = ( SELECT auth.uid() AS uid))))))));
grant usage on schema public,auth to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;
create table auth.users(id uuid primary key);
insert into auth.users select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,20) n;
-- Owner=1, assistant=2, cox=3, member=4, club coach=5, club admin=6, outsider=7.
insert into public.organizations(id,name,invite_code,created_by) values('20000000-0000-0000-0000-000000000001','Club','CLUB', '00000000-0000-0000-0000-000000000001');
insert into public.organization_members(org_id,user_id,role) values
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005','coach'),
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','admin');
insert into public.teams(id,name,invite_code,coach_id,org_id) values
('10000000-0000-0000-0000-000000000001','First','FIRST','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000002','Other club team','OTHER','00000000-0000-0000-0000-000000000008',null);
insert into public.team_members(team_id,user_id,role) values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','coach'),
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','coxswain'),
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','member');
create schema extensions;
create extension pgcrypto with schema extensions;
create table public.team_leaderboard_shares(id uuid primary key default gen_random_uuid(),team_id uuid not null,org_id uuid,token_hash text not null,created_by uuid not null,created_at timestamptz not null default now(),expires_at timestamptz not null,revoked_at timestamptz,filter_squad text,filter_tier text,filter_team_id uuid);
create table public.assignment_result_shares(id uuid primary key default gen_random_uuid(),group_assignment_id uuid not null,token_hash text not null,created_by uuid not null,created_at timestamptz not null default now(),expires_at timestamptz not null,revoked_at timestamptz);
alter table public.team_leaderboard_shares enable row level security;
alter table public.assignment_result_shares enable row level security;
create policy "Coaches can manage their leaderboard shares" on public.team_leaderboard_shares for all to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
create policy "Coaches can view assignment shares" on public.assignment_result_shares for select to authenticated using(true);
grant all on public.team_leaderboard_shares,public.assignment_result_shares to authenticated;
insert into athletes(id,first_name,last_name,created_by,notes,coach_notes) values('30000000-0000-0000-0000-000000000099','Legacy','Notes','00000000-0000-0000-0000-000000000001','Private legacy notes','Private legacy coach notes');
insert into team_athletes(team_id,athlete_id) values('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000099');
-- Mirror the real club FK actions: deletion tests must exercise actual cascades.
create table public.training_block_enrollments(id uuid primary key default gen_random_uuid(),org_id uuid references public.organizations(id) on delete cascade);
alter table public.training_block_enrollments enable row level security;
grant select,insert,update,delete on public.training_block_enrollments to authenticated;
alter table public.teams add foreign key(org_id) references public.organizations(id) on delete set null;
alter table public.organization_members add foreign key(org_id) references public.organizations(id) on delete cascade;
alter table public.coaching_schedule_events add foreign key(org_id) references public.organizations(id) on delete cascade;
alter table public.group_assignments add foreign key(org_id) references public.organizations(id) on delete cascade;
alter table public.team_leaderboard_shares add foreign key(org_id) references public.organizations(id) on delete cascade;
