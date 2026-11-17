# Club and team management completion implementation plan

> For agentic workers: use subagent-driven-development for independent UI/database work, then integrate and review.

**Goal:** Make accessible teams manageable from the clubs page and safely delete empty clubs.
**Architecture:** Existing settings remain the team action destination. Club directory uses effective access already supplied by context. Database preflight RPC plus DELETE trigger enforce empty-club deletion; frontend typed-name confirmation uses RLS-protected delete returning its result.
**Tech Stack:** React/TypeScript/Tailwind, Supabase/PostgreSQL.

- [x] UI: failing component tests for teams in All Teams, standalone teams, exact destination and read-only restrictions; implement directory and deletion modal, loading/errors/retry.
- [x] Database: inspect live FK/policies; failing disposable SQL tests for dependencies, roles, direct delete and empty success; add guarded migration and preview RPC with safe search path/grants; no real club deletion.
- [x] Integrate services/generated contract, context refresh and existing team delete behavior; tests for surfaced errors and zero-row failure.
- [x] Review integrated role/data safety and mobile markup; run SQL suite, full tests/build/lint/diff. Apply safe migration through MCP and verify schema before frontend rollout. Record receipt/current context; push PR.

## Verification and rollout receipt

- Effective-access teams appear under their clubs, including clubs visible only through team access; standalone teams have a separate section. Manage team opens the exact selected team's existing admin settings, including cross-club destinations. Add team remains available with an empty directory.
- Club owners/admins receive a typed-name deletion dialog. Preview failures disable deletion and offer retry. All five dependency counts are authoritative and include data hidden by ordinary RLS. A database trigger repeats the checks under the parent row lock, preventing stale-preview and concurrent-insert deletion races. Nonempty clubs cannot be deleted through direct or service-role DELETE either.
- Team deletion retains existing permissions/history protection, now rejects failed previews and zero-row deletes, keeps failures in the confirmation dialog, prevents duplicate submissions and refreshes the directory after the final team. Refresh failure offers refresh-only retry.
- `npm test -- --run`: 625 tests / 67 files passed. `npm run build`: passed (existing bundle-size advisory). `npm run lint -- --ignore-pattern ".worktrees/**" --ignore-pattern "android/**" --ignore-pattern "ios/**" --ignore-pattern "updates/web/**" --ignore-pattern "updates/dist/**"`: 0 errors / 114 warnings (excludes only preserved nested worktrees/native/generated artifacts). Focused UI tests: 34; focused service tests: 9. `git diff --check` and shell syntax checks passed.
- `bash scripts/tests/run-team-permissions.sh`: passed in disposable PostgreSQL, including role matrix, all dependency blockers, hidden enrollment, absent/unauthorized preview, service-role direct-delete guard and both insert/delete concurrency orderings. Fixture FK actions and policies were checked against live definitions.
- Migration **20261117154311_guard_empty_club_deletion.sql already applied** through Supabase MCP to `vmlhcbkyonemmlawnqqr`; migration history, trigger, SECURITY DEFINER settings and grants verified. Health advisors remain clear. Security counts unchanged except authenticated-definer RPCs 39 → 40: intentional owner/admin preview RPC with internal authorization. [Advisor documentation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- No real club, team, athlete, invitation or training records created/deleted for verification. No Edge Functions changed. Merge/deploy the frontend after review; do not reapply the already-recorded migration. Authenticated browser/mobile walkthrough remains pending; component and markup checks do not establish rendered-device behavior.

Submitted as [PR #247](https://github.com/gamalamadingdong/logbook-companion/pull/247), targeting main.
