-- INSERT ... RETURNING checks the new row against SELECT policies before a
-- stable helper querying teams can see that row. Check the row's owner directly
-- so createTeam(...).insert(...).select().single() can return its result.
-- coach_id is still protected by the INSERT policy and immutable scope trigger.
alter policy teams_read on public.teams
  using (coach_id = (select auth.uid()) or public.can_view_team(id, (select auth.uid())));
