# Active Context

Last updated: 2026-11-14

## Current work

Team management foundation for winter training. Work is on `feature/team-management-winter-training`, based on updated main `99224ec` (PR #240). The initial analysis is saved in [team management current state](../docs/team-management-current-state.md).

The first coach-scope UX slice is implemented, alongside the overview and memory cleanup, and is being submitted as a focused PR against main. The user authorized publication on November 14. No schema changes or live data writes were made. See the [scope plan and verification receipt](../docs/superpowers/plans/2026-11-13-coach-scope.md).

## Agreed sequence

1. Settle organization, team, account, and roster relationships and lifecycle rules.
2. Review their UX, especially clear and easy coach switching between organization and team views and the scope of create/edit actions.
3. Then prioritize assignments, completion/results, training blocks, and other findings from the baseline.

Product direction is one active coached roster per athlete, coach-defined squads, and optional non-roster groups later. Enforcement is not implemented; identity claiming, transfer authority, and existing multiple memberships still need decisions. Next: review the coach-scope UX in the running app, then continue the roster/account lifecycle design.

Questions to resolve include roster versus access membership, primary training responsibility, overlapping assignments, claiming existing roster profiles, join/leave/transfer/archive behavior, historical data preservation, and role permissions. Do not turn these questions into decided rules.

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
