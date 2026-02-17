-- Add team-scoped RLS policies for daily_workout_assignments
-- The existing policies only check user_id = auth.uid(), which blocks
-- coach-created fan-out rows (where user_id is NULL and athlete_id is set).

-- Allow coaches to INSERT daily_workout_assignments for their team
CREATE POLICY "Coaches can create team assignments"
ON public.daily_workout_assignments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.team_id = daily_workout_assignments.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'coach'
  )
);

-- Allow team members to SELECT daily_workout_assignments for their team
CREATE POLICY "Coaches can view team assignments"
ON public.daily_workout_assignments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.team_id = daily_workout_assignments.team_id
      AND team_members.user_id = auth.uid()
  )
);

-- Allow coaches to UPDATE daily_workout_assignments for their team
CREATE POLICY "Coaches can update team assignments"
ON public.daily_workout_assignments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.team_id = daily_workout_assignments.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'coach'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.team_id = daily_workout_assignments.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'coach'
  )
);

-- Allow coaches to DELETE daily_workout_assignments for their team
CREATE POLICY "Coaches can delete team assignments"
ON public.daily_workout_assignments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.team_id = daily_workout_assignments.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'coach'
  )
);
