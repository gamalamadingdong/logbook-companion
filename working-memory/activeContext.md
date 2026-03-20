# Active Context

> Last updated: March 19, 2026

## Current Focus
- The March 18 team-scoping and settings cleanup work is complete and reflected in code.
- The March 18 bulk coach invite polish is complete and reflected in the invite flow.
- Working memory is being normalized so `activeContext.md` stays a concise current-state snapshot and `implementationLog.md` remains the historical record.

## Recently Completed

### Team self-service scope alignment
- Added `src/hooks/useScopedTeamScope.ts` so `/team/*` pages derive visible scope from the same model as coaching pages.
- Updated `getMyErgScores()`, `getMySessionNotes()`, and `getMyCoachNotes()` in `src/services/coaching/coachingService.ts` to accept one or many `team_id` values and apply explicit team filters.
- Refactored `src/pages/team/MyTeamDashboard.tsx`, `src/pages/team/MyScores.tsx`, `src/pages/team/MyTeamNotes.tsx`, and `src/pages/team/MyTeamSettings.tsx` to follow the shared scoped-team model.
- `MyTeamSettings` now separates visible scope from direct membership actions via `getMyDirectTeamMemberships()`.

### CoachingBoatings drag/drop audit + seat targeting fix
- Audited all current drag/drop surfaces in `src/pages/coaching/CoachingBoatings.tsx`: roster panel, compact seat badges, expanded seat rows, seated-athlete drags, and roster unseat drop.
- Fixed seat targeting so drag resolution now prefers the seat actually under the pointer before falling back to proximity matching.
- Seated-athlete drags now carry source boat/seat metadata, which makes seat-to-seat and cross-boat drops deterministic instead of silently mis-targeting nearby boats.
- Dragging a seated athlete onto an occupied seat now swaps athletes instead of orphaning the displaced row. Expanded seat-row targets now win over compact strip targets when both are plausible candidates.
- Validation: targeted ESLint on `CoachingBoatings.tsx`, `npm run build`, and `npm run test:run` all passed.
### CoachingBoatings UX polish pass
- Added a desktop drag-and-drop guidance callout so the Boathouse/seat workflow is easier to discover.
- Added confirmation dialog coverage for destructive boating actions (`Archive`, `Delete`) so those paths are no longer single-click.
- Added explicit success feedback for create, edit, duplicate, archive/reactivate, and delete actions via `toast.success(...)`.
- Added missing `aria-label` coverage to icon-only boating controls and swap actions for better keyboard/screen-reader support.
### Team Info editing UX simplification
- Added `src/components/team/TeamInfoEditorList.tsx` as the shared Team Info editor for all accessible teams.
- `src/pages/team/MyTeamSettings.tsx` and `src/pages/coaching/CoachingSettings.tsx` now use the shared editor instead of tying Team Info editing to the active team selector.
- `src/pages/coaching/CoachDashboard.tsx` no longer shows a misleading visual "Active" badge in the org/team list.

### Bulk coach invite polish
- `src/components/coaching/BulkCoachInviteModal.tsx` now uses row-based first-name / last-name / email entry instead of a freeform textarea.
- `supabase/functions/invite-coaches/index.ts` now accepts structured `entries[]`, looks up organization name, and passes invite metadata (`first_name`, `last_name`, `org_name`) while marking invited coaches as onboarding-complete.
- `src/pages/ResetPassword.tsx` now routes invited coaches to `/team-management` after password creation.
- `src/components/OnboardingWizard.tsx` and `src/components/coaching/BulkRosterModal.tsx` were updated to use design-token colors instead of older hardcoded neutral/emerald utilities.

## Validation Status
- Targeted ESLint checks on the March 18 team-settings / scoping changes passed.
- `npm run build` passed.
- `npm run test:run` passed.
- `npm run lint` still has unrelated pre-existing failures elsewhere in the repo.

## Important Files
- `src/components/team/TeamInfoEditorList.tsx`
- `src/hooks/useScopedTeamScope.ts`
- `src/pages/team/MyTeamDashboard.tsx`
- `src/pages/team/MyScores.tsx`
- `src/pages/team/MyTeamNotes.tsx`
- `src/pages/team/MyTeamSettings.tsx`
- `src/pages/coaching/CoachingSettings.tsx`
- `src/pages/coaching/CoachDashboard.tsx`
- `src/services/coaching/coachingService.ts`
- `src/components/coaching/BulkCoachInviteModal.tsx`
- `supabase/functions/invite-coaches/index.ts`

## Next Likely Steps
- Manually QA multi-team and All Teams flows across `/team/*` and `/team-management/*` with real org/team combinations.
- Decide whether the remaining non-Team-Info areas of `CoachingSettings` should stay active-team scoped or move toward broader multi-team tooling.
- Tackle repo-wide lint debt separately from feature work if a clean `npm run lint` becomes a requirement.

## Blockers
- No feature blockers for the March 18 work.
- Repo-wide lint remains noisy because of unrelated pre-existing issues.



