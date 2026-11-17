\set ON_ERROR_STOP on
create function pg_temp.assert_true(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Assertion failed: %',msg; end if; end$$;
create function pg_temp.denied(q text) returns void language plpgsql as $$begin execute q; raise exception 'Expected permission denial: %',q; exception when insufficient_privilege or check_violation then null; end$$;
-- Synthetic independent clubs for permission, each dependency, and races.
insert into organizations(id,name,invite_code,created_by)
select ('21000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Delete fixture '||n,'DELETE'||n,'00000000-0000-0000-0000-000000000001' from generate_series(1,10) n;
insert into organization_members(org_id,user_id,role)
select o.id,('00000000-0000-0000-0000-'||lpad(r.n::text,12,'0'))::uuid,r.role
from organizations o cross join (values(1,'owner'),(2,'coach'),(3,'coxswain'),(4,'member'),(6,'admin')) r(n,role) where o.id::text like '21000000-%';
set role authenticated;
do $$declare n integer; v_count integer; begin
  foreach n in array array[2,3,4,7] loop
    perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-'||lpad(n::text,12,'0'),false);
    perform pg_temp.denied($q$select * from get_club_deletion_counts('21000000-0000-0000-0000-000000000001')$q$);
    delete from organizations where id='21000000-0000-0000-0000-000000000001';
    get diagnostics v_count=row_count;
    perform pg_temp.assert_true(v_count=0,'nonadmins cannot delete even an empty club');
  end loop;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
select pg_temp.denied($q$select * from get_club_deletion_counts('ffffffff-ffff-ffff-ffff-ffffffffffff')$q$);
select pg_temp.assert_true((select teams+schedule_events+assignments+training_enrollments+leaderboard_shares=0 from get_club_deletion_counts('21000000-0000-0000-0000-000000000001')),'admin sees empty preview');
delete from organizations where id='21000000-0000-0000-0000-000000000001' returning id;
reset role;
select pg_temp.assert_true(not exists(select 1 from organizations where id='21000000-0000-0000-0000-000000000001'),'empty club deleted');
select pg_temp.assert_true(not exists(select 1 from organization_members where org_id='21000000-0000-0000-0000-000000000001'),'empty club memberships cascade');
insert into teams(name,invite_code,coach_id,org_id) values('Hidden dependency','DELETEDEP','00000000-0000-0000-0000-000000000008','21000000-0000-0000-0000-000000000002');
insert into coaching_schedule_events(org_id,date,title,event_type) values('21000000-0000-0000-0000-000000000003','2040-01-01','Fixture','practice');
insert into group_assignments(org_id,template_id,scheduled_date) values('21000000-0000-0000-0000-000000000004',gen_random_uuid(),'2040-01-01');
insert into training_block_enrollments(org_id) values('21000000-0000-0000-0000-000000000005');
insert into team_leaderboard_shares(org_id,team_id,token_hash,created_by,expires_at) values('21000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','fixture','00000000-0000-0000-0000-000000000008','2040-01-01');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
-- No policy exposes enrollment rows; preview must still count them.
select pg_temp.assert_true((select count(*)=0 from training_block_enrollments),'RLS hides enrollment dependency');
do $$declare n integer; v_org uuid; v_counts record; begin
 for n in 2..6 loop
   v_org:=('21000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
   select * into v_counts from get_club_deletion_counts(v_org);
   perform pg_temp.assert_true(v_counts.teams=case when n=2 then 1 else 0 end and v_counts.schedule_events=case when n=3 then 1 else 0 end and v_counts.assignments=case when n=4 then 1 else 0 end and v_counts.training_enrollments=case when n=5 then 1 else 0 end and v_counts.leaderboard_shares=case when n=6 then 1 else 0 end,'precise dependency counts for club '||n);
   perform pg_temp.denied(format('delete from organizations where id=%L',v_org));
 end loop;
end $$;
-- Preflight can become stale: a later dependency must block the final DELETE.
select pg_temp.assert_true((select training_enrollments=0 from get_club_deletion_counts('21000000-0000-0000-0000-000000000007')),'preflight initially empty');
reset role;
insert into training_block_enrollments(org_id) values('21000000-0000-0000-0000-000000000007');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
select pg_temp.denied($q$delete from organizations where id='21000000-0000-0000-0000-000000000007'$q$);
select pg_temp.denied($q$select public.guard_empty_club_deletion()$q$);
reset role;
-- A privileged service write must not cascade away dependencies either.
grant select,delete on organizations to service_role;
set role service_role;
select pg_temp.denied($q$delete from organizations where id='21000000-0000-0000-0000-000000000005'$q$);
reset role;
select pg_temp.assert_true((select count(*)=2 from training_block_enrollments where org_id::text like '21000000-%'),'blocked deletes preserve hidden data');
set role anon;
select pg_temp.denied($q$select * from public.get_club_deletion_counts('21000000-0000-0000-0000-000000000008')$q$);
reset role;
