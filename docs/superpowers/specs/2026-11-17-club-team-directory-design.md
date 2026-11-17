# Club and team management completion

Approved in conversation: list accessible teams beneath each club and standalone teams separately. Manage team selects that exact team and opens the existing identity/access/delete settings. Do not silently edit the All Teams anchor. List read-only teams without admin actions. Reuse shared cards/buttons/modal and mobile layouts.

Club owner/admins may delete an empty club with typed-name confirmation. Block deletion while any teams or club-owned training data remain; report teams, schedule events, assignments, training enrollments and leaderboard shares. Enforce this at the database boundary, including direct DELETE, and recheck at deletion to handle changes after preview. Membership rows may cascade only after eligibility is confirmed. Never delete real user clubs during development.

Keep failed previews/deletes open with actionable retry; no optimistic success on zero rows. Refresh team/club context after success. Optional account-free athletes, team/season history protections and existing role boundaries remain unchanged. New migration applies before frontend release. Existing club deletion cascade behavior is unsafe for this workflow and must not be used without the guard.
