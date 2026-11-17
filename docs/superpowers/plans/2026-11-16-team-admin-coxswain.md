# Team admin and coxswain access implementation plan

> **For agentic workers:** Use subagent-driven-development for the independent database and UI tasks, then review their integrated permission contract.

**Goal:** Separate administration from coaching, and allow coxswain athletes to edit lineups and workout performance within their team.

**Architecture:** Retain coach/coxswain/member team roles and existing club owner/admin roles. Add `team_members.is_admin` (coach-only, default false); team owner and club owner/admin also administer their teams. Ordinary club coach membership alone does not confer access to every team; preserve existing club coaches' access by explicitly assigning their current teams during migration. Coxswain position does not itself grant account access: an explicit coxswain membership does, and keeps the optional athlete profile link. UI capabilities derive from server-authoritative role/admin discovery; RLS and restricted RPCs protect writes.

**Boundaries:** No custom permission editor. Admins manage settings, staff elevation, team codes, deletion and season transitions. Coaches manage training/roster operations for assigned teams. Coxswains manage team lineups, session attendance/practice records and workout results; no private coach notes, staff/access administration, unrelated personal logs, training prescription, roster transfer/removal or season transitions. Team code join grants member only. Existing owning coaches/club admins retain access; ordinary coaches are not promoted to admin. Prevent self-promotion and team/club scope moves through updates. Keep optional athlete accounts.

- [x] Database: inspect live schema/helpers/triggers; implement additive admin flag, scoped role helpers/RLS, secure elevation and join paths, result-only/lineup permissions and season-admin enforcement. Verify in disposable PostgreSQL role/action and cross-team tests; no real roster mutations.
- [x] UI: settings/read-only states, coach Admin toggle and club people access using existing forms; deny administrative actions for coaches/coxswains; season admin gating; no unnecessary granular switches.
- [x] Integration: membership discovery/admin typing and service contract, account route access, operational coxswain editing flows, attribution, joins and invite handlers aligned with new checks. Focused service/component tests.
- [x] Final: independent permission review, full tests/lint/build and SQL checks; prepare coordinated migration/function/app rollout; current context/receipt; push and submit PR against main.

## Implementation receipt

Implemented on `feature/team-admin-coxswain-access` from main `50302cc` (PR #244 merged).

- Effective role discovery comes from caller-scoped database RPCs. A coach can operate assigned teams; Admin is a single extra permission. Team owners and club owner/admins inherit administration. Existing ordinary club coaches receive explicit current-team memberships during migration, without administration or automatic access to future teams.
- Settings expose coach Admin toggles and club People & access. Owner access is inherited and protected in the UI. Season transitions and settings require administration; roster/training operations remain available to ordinary assigned coaches.
- Coxswain access supports lineup/practice/attendance and manual performance entry, with editor attribution. Roster identity/transfer/removal, prescription, private notes and administration stay restricted. Practice deletion is coach-only because it can cascade into private notes. CSV assignment-result import remains coach-only because it can create recipients.
- Team-code joins always grant member access and link an athlete atomically; club codes grant ordinary club coach membership without team access. Staff invites require effective administration and never implicitly grant club membership. Existing-member invitation retries repair missing athlete links.
- Legacy athlete notes and coach notes migrate into `athlete_private_notes`; public roster columns are cleared, compatibility triggers protect old write paths, and app reads/writes use the private RLS boundary. Optional account-free athletes remain supported.
- Secure club-affiliation RPC validates both source team administration and destination club administration. Assignment result updates protect prescriptions, including organization-wide assignments. Scope/identity guards prevent moving records across teams through updates.

## Validation and rollout

Full app suite: 602 tests / 66 files passed. Production build passed. ESLint: 0 errors / 114 existing warnings. Disposable PostgreSQL 16 suite passes migration, role/action, escalation, cross-team, joins, private notes, result prescription, and editor attribution checks against captured live policy definitions with synthetic rows. Edge handler tests execute actual handlers with mocked dependencies and deny privileged lookups when administration is missing or the check fails. Independent bounded security review confirms prior blockers addressed.

No migration or Edge Function was deployed live, and no real invites/roster mutations were made. Coordinate rollout: apply `20261117010000_team_admin_and_coxswain_access.sql` through Supabase MCP, deploy `invite-coaches` and `send-team-invite`, then deploy this app revision in the same release window. Do not leave old app join flows against the tightened policies. Refresh generated database types from the deployed schema after rollout; checked-in additions describe this local migration. Verify representative admin, coach, coxswain and member workflows afterward. Signed-in visual/mobile walkthrough remains pending because no browser session is connected.

Preserved limitations: roster access and athlete roster membership are separate; one-active-team enforcement, existing-profile claiming, automatic leave/transfer synchronization, and complete historical season filtering remain follow-ups. This change does not implement a custom permission editor.
