-- Enable RLS on group_assignments
ALTER TABLE public.group_assignments ENABLE ROW LEVEL SECURITY;

-- SELECT: team members can view assignments for their team
CREATE POLICY "Team members can view group assignments"
ON public.group_assignments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.team_id = group_assignments.team_id
      AND team_members.user_id = auth.uid()
  )
);

-- INSERT: team coaches can create assignments
CREATE POLICY "Coaches can create group assignments"
ON public.group_assignments FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.team_id = group_assignments.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'coach'
  )
);

-- UPDATE: creator can update their assignments
CREATE POLICY "Creator can update group assignments"
ON public.group_assignments FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- DELETE: creator can delete their assignments
CREATE POLICY "Creator can delete group assignments"
ON public.group_assignments FOR DELETE
TO authenticated
USING (created_by = auth.uid());
