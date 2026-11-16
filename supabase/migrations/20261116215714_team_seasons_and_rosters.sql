-- Additive, opt-in seasons: no legacy adoption or account changes.
create table public.team_seasons (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete restrict,
 name text not null check (length(btrim(name)) between 1 and 100),
 starts_on date not null,
 ends_on date not null,
 status text not null default 'draft' check(status in ('draft','active','archived')),
 created_at timestamptz not null default now(),
 activated_at timestamptz,
 creation_fingerprint jsonb not null,
 check (ends_on >= starts_on),
 unique(team_id,name)
);
create unique index team_seasons_one_active on public.team_seasons(team_id) where status='active';
create index team_seasons_team_dates on public.team_seasons(team_id,starts_on,ends_on);
create table public.team_season_athletes (
 season_id uuid not null references public.team_seasons(id) on delete restrict,
 athlete_id uuid not null references public.athletes(id) on delete restrict,
 first_name text not null,
 last_name text not null,
 grade text,
 squad text,
 performance_tier text,
 status text not null check(status in ('active','inactive','graduated')),
 has_account boolean not null,
 primary key(season_id,athlete_id)
);
create index team_season_athletes_athlete on public.team_season_athletes(athlete_id);
alter table public.team_seasons enable row level security;
alter table public.team_season_athletes enable row level security;
create policy team_seasons_staff_read on public.team_seasons for select to authenticated using(public.can_staff_team(team_id,auth.uid()));
create policy team_season_athletes_staff_read on public.team_season_athletes for select to authenticated using(exists(select 1 from public.team_seasons s where s.id=season_id and public.can_staff_team(s.team_id,auth.uid())));
revoke all on public.team_seasons, public.team_season_athletes from public,anon,authenticated;
grant select(id,team_id,name,starts_on,ends_on,status,created_at) on public.team_seasons to authenticated;
grant select on public.team_season_athletes to authenticated;

create function public.create_team_season(p_team_id uuid,p_name text,p_starts_on date,p_ends_on date,p_source_season_id uuid,p_athlete_ids uuid[],p_copy_squads boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_fingerprint jsonb; v_existing jsonb; v_count integer;
begin
 perform 1 from public.teams where id=p_team_id for update;
 if not found or not coalesce(public.can_coach_team(p_team_id,auth.uid()),false) then raise insufficient_privilege using message='Coach permission required for this team'; end if;
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
end $$;

create function public.activate_team_season(p_season_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_team uuid; v_season public.team_seasons; v_old public.team_seasons;
begin
 select team_id into v_team from public.team_seasons where id=p_season_id;
 perform 1 from public.teams where id=v_team for update;
 if not found or not coalesce(public.can_coach_team(v_team,auth.uid()),false) then raise insufficient_privilege using message='Coach permission required for this team'; end if;
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
end $$;

create function public.archive_team_season(p_season_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_team uuid; v_season public.team_seasons;
begin
 select team_id into v_team from public.team_seasons where id=p_season_id;
 perform 1 from public.teams where id=v_team for update;
 if not found or not coalesce(public.can_coach_team(v_team,auth.uid()),false) then raise insufficient_privilege using message='Coach permission required for this team'; end if;
 select * into v_season from public.team_seasons where id=p_season_id;
 if v_season.status='archived' then return; end if;
 if v_season.status='active' and exists(select 1 from public.daily_workout_assignments where team_id=v_team and workout_date between v_season.starts_on and v_season.ends_on and completed is not true) then raise check_violation using message='Complete or explicitly resolve pending assignments before archiving this season'; end if;
 update public.team_seasons set status='archived' where id=p_season_id;
 if v_season.status='active' then update public.team_athletes set status='inactive',left_at=now() where team_id=v_team and status='active'; end if;
end $$;

create function public.set_team_season_squad(p_season_id uuid,p_athlete_id uuid,p_squad text) returns void
language plpgsql security definer set search_path='' as $$
declare v_team uuid; v_status text;
begin
 select team_id into v_team from public.team_seasons where id=p_season_id;
 perform 1 from public.teams where id=v_team for update;
 if not found or not coalesce(public.can_coach_team(v_team,auth.uid()),false) then raise insufficient_privilege using message='Coach permission required for this team'; end if;
 select status into v_status from public.team_seasons where id=p_season_id;
 if v_status='archived' then raise check_violation using message='Archived roster placements are read-only'; end if;
 update public.team_season_athletes set squad=nullif(btrim(p_squad),'') where season_id=p_season_id and athlete_id=p_athlete_id;
 if not found then raise check_violation using message='Athlete is not in this season'; end if;
 if v_status='active' then update public.team_athletes set squad=nullif(btrim(p_squad),'') where team_id=v_team and athlete_id=p_athlete_id; end if;
end $$;

create function public.sync_active_team_season_roster() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then
  update public.team_season_athletes r set status='inactive' from public.team_seasons s where r.season_id=s.id and s.team_id=old.team_id and s.status='active' and r.athlete_id=old.athlete_id;
  return old;
 end if;
 if TG_OP='UPDATE' and (old.team_id<>new.team_id or old.athlete_id<>new.athlete_id) then
  update public.team_season_athletes r set status='inactive' from public.team_seasons s where r.season_id=s.id and s.team_id=old.team_id and s.status='active' and r.athlete_id=old.athlete_id;
 end if;
 insert into public.team_season_athletes(season_id,athlete_id,first_name,last_name,grade,squad,performance_tier,status,has_account)
 select s.id,a.id,a.first_name,a.last_name,a.grade,new.squad,new.performance_tier,new.status,a.user_id is not null from public.team_seasons s join public.athletes a on a.id=new.athlete_id where s.team_id=new.team_id and s.status='active'
 on conflict(season_id,athlete_id) do update set squad=excluded.squad,performance_tier=excluded.performance_tier,status=excluded.status;
 return new;
end $$;
create trigger sync_active_season_roster after insert or update or delete on public.team_athletes for each row execute function public.sync_active_team_season_roster();
create function public.sync_active_team_season_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.teams t where exists(select 1 from public.team_seasons s join public.team_season_athletes r on r.season_id=s.id where s.team_id=t.id and r.athlete_id=new.id) order by t.id for update;
 update public.team_season_athletes r set first_name=new.first_name,last_name=new.last_name,grade=new.grade,has_account=(new.user_id is not null) from public.team_seasons s where r.season_id=s.id and s.status='active' and r.athlete_id=new.id;
 return new;
end $$;
create trigger sync_active_season_identity after update of first_name,last_name,grade,user_id on public.athletes for each row execute function public.sync_active_team_season_identity();
revoke all on function public.create_team_season(uuid,text,date,date,uuid,uuid[],boolean),public.activate_team_season(uuid),public.archive_team_season(uuid),public.set_team_season_squad(uuid,uuid,text),public.sync_active_team_season_roster(),public.sync_active_team_season_identity() from public,anon,authenticated;
grant execute on function public.create_team_season(uuid,text,date,date,uuid,uuid[],boolean),public.activate_team_season(uuid),public.archive_team_season(uuid),public.set_team_season_squad(uuid,uuid,text) to authenticated;

-- Serialize legacy operational writes with lifecycle transitions. Teams which have
-- never adopted seasons retain their existing behavior.
create function public.guard_team_season_eligibility() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_season public.team_seasons;
begin
 -- Result completion/corrections remain possible after archive; reopening is
 -- new pending work and must serialize with season closure.
 if TG_TABLE_NAME='daily_workout_assignments' and TG_OP='UPDATE' then
  if row(new.team_id,new.athlete_id,new.user_id,new.workout_date) is not distinct from row(old.team_id,old.athlete_id,old.user_id,old.workout_date)
   and not (old.completed is true and new.completed is not true) then return new; end if;
 end if;
 if TG_OP='DELETE' then
  perform 1 from public.teams where id=old.team_id for update;
  return old;
 end if;
 if TG_OP='UPDATE' then
  perform 1 from public.teams where id in (old.team_id,new.team_id) order by id for update;
 else
  perform 1 from public.teams where id=new.team_id for update;
 end if;
 if not exists(select 1 from public.team_seasons where team_id=new.team_id and activated_at is not null) then return new; end if;
 select * into v_season from public.team_seasons where team_id=new.team_id and status='active';
 if TG_TABLE_NAME='team_athletes' then
  if new.status='active' and v_season.id is null then raise check_violation using message='Activate a season before adding active roster participants'; end if;
 else
  if v_season.id is null or new.workout_date not between v_season.starts_on and v_season.ends_on then raise check_violation using message='Team assignments require an active season covering the workout date'; end if;
  if new.athlete_id is not null and not exists(select 1 from public.team_athletes where team_id=new.team_id and athlete_id=new.athlete_id and status='active') then raise check_violation using message='Assignment athlete must be on the active team roster'; end if;
  if new.athlete_id is null and new.user_id is not null and not exists(select 1 from public.team_athletes t join public.athletes a on a.id=t.athlete_id where t.team_id=new.team_id and t.status='active' and a.user_id=new.user_id) then raise check_violation using message='Assignment account must be linked to an active team athlete'; end if;
 end if;
 return new;
end $$;
create trigger guard_season_roster_eligibility before insert or update on public.team_athletes for each row execute function public.guard_team_season_eligibility();
create trigger guard_season_assignment_eligibility before insert or update on public.daily_workout_assignments for each row execute function public.guard_team_season_eligibility();
revoke all on function public.guard_team_season_eligibility() from public,anon,authenticated;

create trigger guard_season_roster_delete before delete on public.team_athletes for each row execute function public.guard_team_season_eligibility();
