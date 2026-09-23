-- Account deletion support.
--
-- App Store Review guideline 5.1.1(v) requires any app that supports account
-- creation to offer in-app account deletion. The schema could not satisfy that:
--
--   * `user_profiles.user_id` has no foreign key to `auth.users`, so deleting an
--     auth user left the profile and everything cascading from it in place,
--     including `workout_logs`.
--   * Twenty columns referenced `auth.users` with NO ACTION, so deleting an auth
--     user raised a foreign key violation instead of deleting.
--   * Team and squad records hung off the coach's identity with NOT NULL columns
--     and ON DELETE CASCADE, so removing a coach would have erased the squad's
--     training history rather than the coach's personal data.
--
-- The agreed behavior is to detach identity from shared work and delete only
-- what belongs to the individual. Ownership columns for shared records become
-- nullable and clear themselves on delete; row-level policies already fall back
-- to team membership (`team_id IS NOT NULL AND can_view_team(...)`), so team
-- visibility survives the owning coach leaving.

-- 1. Shared coaching records: keep the work, release the identity.
--
-- These reference `user_profiles(user_id)` with CASCADE, which would delete a
-- squad's history along with the coach.

alter table public.coaching_sessions alter column coach_user_id drop not null;
alter table public.coaching_sessions drop constraint if exists coaching_sessions_coach_user_id_fkey;
alter table public.coaching_sessions add constraint coaching_sessions_coach_user_id_fkey
  foreign key (coach_user_id) references public.user_profiles(user_id) on delete set null;

alter table public.coaching_erg_scores alter column coach_user_id drop not null;
alter table public.coaching_erg_scores drop constraint if exists coaching_erg_scores_coach_user_id_fkey;
alter table public.coaching_erg_scores add constraint coaching_erg_scores_coach_user_id_fkey
  foreign key (coach_user_id) references public.user_profiles(user_id) on delete set null;

alter table public.coaching_boatings alter column coach_user_id drop not null;
alter table public.coaching_boatings drop constraint if exists coaching_boatings_coach_user_id_fkey;
alter table public.coaching_boatings add constraint coaching_boatings_coach_user_id_fkey
  foreign key (coach_user_id) references public.user_profiles(user_id) on delete set null;

alter table public.coaching_athlete_notes alter column coach_user_id drop not null;
alter table public.coaching_athlete_notes drop constraint if exists coaching_athlete_notes_coach_user_id_fkey;
alter table public.coaching_athlete_notes add constraint coaching_athlete_notes_coach_user_id_fkey
  foreign key (coach_user_id) references public.user_profiles(user_id) on delete set null;

alter table public.coaching_athletes alter column coach_user_id drop not null;
alter table public.coaching_athletes drop constraint if exists coaching_athletes_coach_user_id_fkey;
alter table public.coaching_athletes add constraint coaching_athletes_coach_user_id_fkey
  foreign key (coach_user_id) references public.user_profiles(user_id) on delete set null;

-- 2. Shared records referencing `auth.users` directly.
--
-- `coaching_athlete_coach_notes` cascaded, which would have deleted a team's
-- notes. The rest used NO ACTION, which would have blocked deletion entirely.

alter table public.coaching_athlete_coach_notes alter column coach_user_id drop not null;
alter table public.coaching_athlete_coach_notes drop constraint if exists coaching_athlete_coach_notes_coach_user_id_fkey;
alter table public.coaching_athlete_coach_notes add constraint coaching_athlete_coach_notes_coach_user_id_fkey
  foreign key (coach_user_id) references auth.users(id) on delete set null;

alter table public.coaching_boats alter column coach_user_id drop not null;
alter table public.coaching_boats drop constraint if exists coaching_boats_coach_user_id_fkey;
alter table public.coaching_boats add constraint coaching_boats_coach_user_id_fkey
  foreign key (coach_user_id) references auth.users(id) on delete set null;

alter table public.coaching_schedule_events alter column coach_user_id drop not null;
alter table public.coaching_schedule_events drop constraint if exists coaching_schedule_events_coach_user_id_fkey;
alter table public.coaching_schedule_events add constraint coaching_schedule_events_coach_user_id_fkey
  foreign key (coach_user_id) references auth.users(id) on delete set null;

alter table public.coaching_session_crews alter column coach_user_id drop not null;
alter table public.coaching_session_crews drop constraint if exists coaching_session_crews_coach_user_id_fkey;
alter table public.coaching_session_crews add constraint coaching_session_crews_coach_user_id_fkey
  foreign key (coach_user_id) references auth.users(id) on delete set null;

alter table public.coaching_session_crew_positions alter column coach_user_id drop not null;
alter table public.coaching_session_crew_positions drop constraint if exists coaching_session_crew_positions_coach_user_id_fkey;
alter table public.coaching_session_crew_positions add constraint coaching_session_crew_positions_coach_user_id_fkey
  foreign key (coach_user_id) references auth.users(id) on delete set null;

alter table public.coaching_boating_race_results alter column coach_user_id drop not null;
alter table public.coaching_boating_race_results drop constraint if exists coaching_boating_race_results_coach_user_id_fkey;
alter table public.coaching_boating_race_results add constraint coaching_boating_race_results_coach_user_id_fkey
  foreign key (coach_user_id) references auth.users(id) on delete set null;

alter table public.coaching_weekly_plans alter column created_by drop not null;
alter table public.coaching_weekly_plans drop constraint if exists coaching_weekly_plans_created_by_fkey;
alter table public.coaching_weekly_plans add constraint coaching_weekly_plans_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

-- Roster entries and organizations outlive the account that created them.
alter table public.athletes alter column created_by drop not null;
alter table public.athletes drop constraint if exists athletes_created_by_fkey;
alter table public.athletes add constraint athletes_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.athletes drop constraint if exists athletes_user_id_fkey;
alter table public.athletes add constraint athletes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.organizations alter column created_by drop not null;
alter table public.organizations drop constraint if exists organizations_created_by_fkey;
alter table public.organizations add constraint organizations_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

-- 3. Shared library content keeps existing with authorship cleared.

alter table public.workout_templates drop constraint if exists workout_templates_created_by_fkey;
alter table public.workout_templates add constraint workout_templates_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.workout_template_proposals drop constraint if exists workout_template_proposals_submitted_by_user_id_fkey;
alter table public.workout_template_proposals add constraint workout_template_proposals_submitted_by_user_id_fkey
  foreign key (submitted_by_user_id) references auth.users(id) on delete set null;

alter table public.workout_template_proposals drop constraint if exists workout_template_proposals_reviewed_by_fkey;
alter table public.workout_template_proposals add constraint workout_template_proposals_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table public.erg_sessions drop constraint if exists erg_sessions_created_by_fkey;
alter table public.erg_sessions add constraint erg_sessions_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.group_assignments drop constraint if exists group_assignments_created_by_fkey;
alter table public.group_assignments add constraint group_assignments_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.coaching_access_requests drop constraint if exists coaching_access_requests_reviewed_by_fkey;
alter table public.coaching_access_requests add constraint coaching_access_requests_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table public.community_items drop constraint if exists community_items_moderated_by_fkey;
alter table public.community_items add constraint community_items_moderated_by_fkey
  foreign key (moderated_by) references auth.users(id) on delete set null;

alter table public.plan_adaptations drop constraint if exists plan_adaptations_reviewed_by_fkey;
alter table public.plan_adaptations add constraint plan_adaptations_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

-- 4. The deletion entry point.--
-- Runs as one transaction so an account is never partially deleted, and derives
-- its subject from `auth.uid()` so a caller can only ever delete themselves.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'delete_my_account requires an authenticated caller'
      using errcode = '28000';
  end if;

  -- Coaching records with no team are the coach's own working notes rather than
  -- squad history, and nothing would be able to read them once detached.
  delete from public.coaching_sessions where coach_user_id = uid and team_id is null;
  delete from public.coaching_erg_scores where coach_user_id = uid and team_id is null;
  delete from public.coaching_boatings where coach_user_id = uid and team_id is null;
  delete from public.coaching_athlete_notes where coach_user_id = uid and team_id is null;
  delete from public.coaching_athletes where coach_user_id = uid;

  -- Concept2 development records reference `workout_logs` with RESTRICT, so they
  -- must be removed before the logs they point at.
  delete from public.c2_development_publications where user_id = uid;
  delete from public.c2_development_fixture_workouts where user_id = uid;
  delete from public.c2_development_results where user_id = uid;
  delete from public.c2_development_auth where user_id = uid;

  -- Rows referencing this athlete's logs without a cascade would otherwise block
  -- the profile delete.
  delete from public.activity_feed where user_id = uid;
  update public.daily_workout_assignments
     set completed_log_id = null
   where completed_log_id in (select id from public.workout_logs where user_id = uid);
  update public.plan_workouts
     set completed_log_id = null
   where completed_log_id in (select id from public.workout_logs where user_id = uid);
  update public.personal_records
     set workout_id = null
   where user_id = uid;

  -- Personal records that reference `auth.users` without a cascade.
  delete from public.user_goals where user_id = uid;
  delete from public.ai_recommendations where user_id = uid;
  delete from public.ai_usage_logs where user_id = uid;

  -- Removing the profile cascades the athlete's own data: workout logs and their
  -- power distribution, assignments, team memberships, plans and sessions.
  delete from public.user_profiles where user_id = uid;

  -- Anything still referencing the account now clears or cascades on its own.
  delete from auth.users where id = uid;
end;
$$;

comment on function public.delete_my_account() is
  'Deletes the calling user''s account and personal data in one transaction. Shared team records are retained with the owning identity cleared.';

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
