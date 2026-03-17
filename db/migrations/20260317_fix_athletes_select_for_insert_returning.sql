-- Fix: INSERT...RETURNING on athletes fails because the existing SELECT policy
-- uses can_view_athlete() (SECURITY DEFINER), which cannot see the uncommitted
-- row in the RETURNING clause. Add a simple inline policy so the row creator
-- can always read back their own athletes without a function call.

CREATE POLICY "Creators can view own athletes"
ON public.athletes
FOR SELECT
TO authenticated
USING (created_by = (SELECT auth.uid()));
