# Active Context

Last updated: 2026-11-16

## Current work

Club/team management and dashboard cleanup merged through PR #244; main base is `50302cc`. Current branch: `feature/team-admin-coxswain-access`. User approved implementing simplified admin/coach/coxswain access and submitting its PR.

Implemented: coach/coxswain/member roles plus coach-only `team_members.is_admin`; team owner and club owner/admin inherit administration. Ordinary club coaches require explicit team assignments; migration preserves their current-team access without automatic future teams or admin promotion. Coaches manage assigned-team roster/training; Admin manages settings/access/codes/season transitions. Coxswains edit lineups/practice/attendance/results, without prescribing, changing roster identities/transfers/removals, reading private notes, or administering. Athlete accounts remain optional.

Server-authoritative access discovery, secure joins and affiliation, invite authorization, scope guards, result prescription guards, editor attribution, and private legacy athlete notes storage are implemented. Team codes grant member only and atomically link an athlete; club codes grant ordinary club coach without team access. No custom capability editor. See [implementation/rollout receipt](../docs/superpowers/plans/2026-11-16-team-admin-coxswain.md).

**Rollout pending:** new permission migration is local only. No live schema writes, function deploys, real invites, or roster mutations in this slice. Coordinate migration via Supabase MCP, invite-coaches/send-team-invite deployment, and app deployment in one release window; old direct join flows conflict with tightened policies. Type additions reflect the local migration and need live generated refresh after rollout. Prior season migration `20261116215714_team_seasons_and_rosters.sql` remains applied live.

Verification: 602 tests / 66 files; production build; lint 0 errors / 114 existing warnings; disposable PostgreSQL 16 permission suite; independent bounded security review. Signed-in visual/mobile review remains pending. Staging and preserved local artifacts remain untouched. Submitted as [PR #245](https://github.com/gamalamadingdong/logbook-companion/pull/245) targeting main; not merged. Coordinated live rollout remains pending.

## Agreed sequence

1. Settle organization, team, account, and roster relationships and lifecycle rules.
2. Review their UX, especially clear and easy coach switching between organization and team views and the scope of create/edit actions.
3. Then prioritize assignments, completion/results, training blocks, and other findings from the baseline.

Product direction is one active coached roster per athlete, coach-defined squads, and optional non-roster groups later. Enforcement is not implemented; identity claiming, transfer authority, and existing multiple memberships still need decisions. The user favors team codes shared by coaches/coxswains and athlete-controlled leaving, and accepted coach/coxswain confirmation of existing-profile linking for now. Seasonal roster/history is now implemented; identity claiming, departure/transfer synchronization and one-active-team enforcement remain follow-ups.

Next product decisions include claiming existing profiles, departure/transfer authority, overlapping assignments and one-active-team enforcement. Cross-page historical results/assignments/lineups and club-coordinated calendars remain explicit follow-ups. Do not describe the whole coaching workspace as season-filtered.

## Current model and important seams

The initial screen/code pass is recorded in [membership UX review](../docs/team-management-ux-review.md). Club/Team selectors now replace the ambiguous switcher/filter pills. A specific team synchronizes view and action context; All Teams requires an explicit roster-add/import destination and hides editable team settings until a team is selected. Roster score/note/transfer targets use the athlete row team; scope changes isolate old rows and settings drafts. Persisted filters are club-validated and account loads are isolated. Rendered/browser UX review remains pending: browser discovery returned no connected browsers.

- Organization/team access (`organization_members`, `team_members`) is distinct from athlete roster membership (`athletes`, `team_athletes`). An athlete need not have an LC account.
- All Teams means the current organization. Specific selections synchronize active team and filter. Existing schedule/assignment/lineup organization-wide behavior is outside this slice and still needs its own consistency review; do not claim every coach page is now unified.
- Member join/add can create or reuse an account-linked athlete; it does not claim an existing unlinked roster profile by name/email. Leave and transfer do not keep access and roster relationships automatically synchronized.
- Coach-facing assignments/results and personal workout logs are separate. Existing auto-completion paths do not consistently bridge them.
- Use the baseline for detailed findings, code references, and remaining questions. It is a point-in-time assessment, not an approved redesign.

## Completed work preceding this branch

- Search and the empty-personal-best/406 fix merged into main through PR #239.
- Continuous Concept2 workout naming, manual template UUID linking, and optional linking of identical workout history merged through PR #240 (`99224ec`). See [naming receipt](../docs/superpowers/plans/2026-11-13-concept2-continuous-names.md) and [history-linking receipt](../docs/superpowers/plans/2026-11-13-template-history-linking.md) for historical implementation and verification details.
- Main fixes plus mobile search work merged into staging through PR #241. Local staging is `0ce565f`. Staging retains its separate Concept2/mobile account and key context; this feature branch is based on main.
- These fixes are no longer pending implementation or PR creation. Earlier receipts contain historical deployment/test statements; they are not fresh runtime verification.

## Workspace preservation

- Local staging edits are preserved in the stash named `Local staging edits preserved before team-management branch 2026-11-13`; leave it intact unless explicitly needed.
- The former unpublished local-main documentation commit is preserved on `backup/local-main-before-team-management-2026-11-13`.
- Local generated/native staging artifacts were retained on disk with local ignore rules. Other worktrees and unrelated stashes remain untouched.

## Verification boundary

The baseline analysis used code/docs and read-only deployed policy/helper inspection. The coach-scope change passes 520 app tests (18 new focused tests), production build, and lint with 0 errors / 115 existing warnings. Lint excluded only untracked nested worktrees and retained staging/native artifacts. No authenticated browser walkthrough, role-by-role live mutation test, or end-to-end assignment completion test was performed. Do not claim those flows were tested. See the receipt for commands and browser limits.

## Reference routing

- [System patterns](systemPatterns.md): implementation conventions and current coaching architecture caveats.
- [Team management baseline](../docs/team-management-current-state.md): current behavior, findings, and undecided membership/UX questions.
- [Decision log](decisionLog.md): accepted architectural decisions; preserve training-block prescription ownership and support-work boundaries.
- [Implementation log](implementationLog.md): older implementation history, including support-work development.
- [Archived pre-cleanup context](archive/2026-11-13-active-context-before-team-management-cleanup.md): historical Concept2/mobile, support-work, instruction-cleanup, and test notes. Its old next steps are not current priorities.
- [Concept2/mobile docs](../docs/concept2-mobile/README.md) and [notification plan](../docs/coaching-notification-plan.md): consult when those domains become relevant; verify older status statements against the appropriate branch and current behavior.

Keep this file current-state only. Preserve historical receipts in referenced documents instead of accumulating multiple competing current-session sections.
