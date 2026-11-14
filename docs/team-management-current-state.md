# Team management current state

Reviewed November 13, 2026, on `feature/team-management-winter-training`, based on main commit `99224ec`.

This is the baseline for improving team management for winter training. It records existing behavior and findings from the initial review. Open questions below are not product decisions or an implementation plan.

## Agreed order of work

1. Understand and settle organization, team, account, and roster relationships, including coach access and athlete membership rules.
2. Review the UX for those rules, especially switching between organization and team views and understanding which scope an action affects.
3. Address assignments, results, training blocks, and the other findings after the membership foundation and its UX are clear.

Athletes belonging to more than one active roster are an explicit concern. The desired rule has not been decided. Do not assume either unrestricted membership or a single-roster restriction is approved.

## Core records and relationships

| Record | Purpose and current relationship |
| --- | --- |
| LC account | Authenticated user identity. An athlete can exist without one. |
| Organization | Groups teams. Teams may also exist without an organization. |
| Organization membership | Connects an account to an organization with owner, admin, or coach role. The team-discovery service exposes organization teams to these staff members. |
| Team membership | Connects an account to a team with coach, coxswain, or member role. This is an access relationship, not the coaching roster itself. |
| Athlete | Coaching profile with names, physical/profile information, and optional `user_id` linking it to an LC account. |
| Team athlete | `team_athletes` connects an athlete to a roster. It carries active/inactive/graduated status, squad, performance tier, and membership dates. |
| Group assignment | Dated team- or organization-level workout prescription, usually referencing a reusable workout template. |
| Daily workout assignment | Per-recipient assignment and completion/result record. Coach-created rows use `athlete_id`; other flows also use `user_id`. |
| Personal workout log | Actual workout history belonging to an LC account. It is separate from assignment results and coaching erg scores. |

The model can represent one athlete on multiple team rosters. It does not currently establish a primary roster or a single authoritative source of training assignments for that athlete.

Sources: [coaching types](../src/services/coaching/types.ts), [coaching service](../src/services/coaching/coachingService.ts).

## Organization and team views

`CoachingContext` combines direct team memberships with teams accessible through organization membership. Organization-derived access is represented as a coach role in the returned team list. The UI groups teams by organization and also supports standalone teams.

The context remembers the active team and team filter in user-specific local storage. An empty team filter means All Teams within the active organization, rather than all organizations. Switching the active team clears the team filter. The organization/team controls are shared through the coaching navigation.

There are two distinct concepts in the current implementation: the active team and the selected viewing scope. Some pages and mutations use the active team directly while others use the selected scope. Consequently, changing a view does not consistently change the destination of every action.

Examples found in the review:

- Roster supports organization-wide viewing, but its add-athlete handler uses the active team.
- Schedule loads practices and roster data for an effective single team alongside broader organization assignments/events.
- Settings manages the active team.

Sources: [context](../src/contexts/CoachingContext.tsx), [scope hook](../src/hooks/useScopedTeamScope.ts), [navigation](../src/components/coaching/CoachingNav.tsx), [roster](../src/pages/coaching/CoachingRoster.tsx), [schedule](../src/pages/coaching/CoachingSchedule.tsx), [settings](../src/pages/coaching/CoachingSettings.tsx).

## Membership and roster lifecycle

Coaches can create roster athletes individually or through bulk import without creating LC accounts. Profile edits affect the athlete record shared by its roster relationships. Squad and performance tier belong to the team-athlete relationship; they are different concepts from benchmark tiers calculated from erg scores.

An LC account can join a team by invite code or be added through an existing account's email. For the member role, these flows call `ensure_team_member_athlete_link`. That function reuses an athlete already linked to the account, or creates a linked athlete and roster relationship. It does not claim an existing unlinked coaching profile by matching its name or email. An existing coach-created profile can therefore remain separate from the newly linked profile.

Current lifecycle operations are independent:

- Leaving a team or removing account membership deletes the `team_members` relationship; it does not automatically deactivate or remove the roster relationship.
- Transferring a roster athlete changes the `team_athletes` team and clears squad/performance tier. It does not transfer account membership or rewrite historical assignment/practice records.
- The roster delete service deletes the global athlete record, rather than just removing one team-roster relationship. Related records can be affected by database cascades.

The existing notification plan explicitly pauses broad linking of real, unlinked athlete profiles pending a consent-based flow. The implemented member-join linking flow does not settle how to claim those existing profiles, handle duplicates, or handle junior/parent/guardian relationships.

Sources: `getTeamsForUser`, `ensureTeamMemberAthleteLink`, `joinTeamByInviteCode`, `transferAthlete`, and `deleteAthlete` in the [coaching service](../src/services/coaching/coachingService.ts); [notification plan](coaching-notification-plan.md).

## Access and roles

The frontend coaching gate is derived from memberships and approved coaching access, not simply a coach label in the user profile. Direct coaches and coxswains, organization members, and approved coaching-access requesters can enter the coaching area.

Database permissions remain authoritative. The deployed `can_coach_team` helper recognizes the owning coach, direct coach membership, or organization membership; coxswain membership alone does not satisfy that helper. Some assignment policies explicitly include coxswains, and some team-scoped policies require direct membership even when the UI presents organization-derived coach access. There is no single uniform role check across all operations.

This review establishes that role and scope alignment needs further inspection before promising a consistent permissions matrix. It is not a complete security audit or a tested guarantee for every role/action combination.

Sources: [auth context](../src/auth/AuthContext.tsx), [route gates](../src/App.tsx), read-only inspection of deployed membership/assignment/athlete policies and access helper definitions on November 13, 2026.

## Other implemented workflows

| Area | Existing behavior |
| --- | --- |
| Roster and athlete detail | Search/filter, bulk import, exports, inline/profile editing, notes, transfers, erg score history, benchmarks, assignment history, and training information. |
| Team workouts | Template-based dated assignments, team/squad/organization targeting, list/calendar/compliance views, recipient editing, and manual/bulk results. Recurrence produces independent dated assignments. |
| Schedule and practices | Day/week/month planning, practices, events, weekly focus, optional assignment references, athlete notes, and crew snapshots. |
| Lineups and boats | Saved lineups, seat editing, archiving/duplication, physical boat records, comparison tools, and race results. Practice snapshots preserve historical names and seats. |
| Analytics | Assignment-result comparisons, Speed Index, raw and weight-related rankings, erg comparisons, and benchmark progress. These are not a comprehensive rollup of every personal workout log. |
| Athlete views | My Team provides coaching-recorded scores, shared notes, and team access settings. It is a smaller experience than the coaching workspace. |
| Notifications | In-app assignment/score notification RPCs exist. Delivery depends on linked account identities; unlinked roster athletes do not receive account notifications. |
| Live sessions | Join-code sessions, participant monitoring, workout configuration, and synchronized starts. The current coach session workout builder does not attach group-assignment metadata. |
| Training blocks | Personal enrollment, scheduling, prescriptions, reviews, and support work exist separately. There is no complete team block publication-to-assignment workflow. Team training-block routes currently redirect elsewhere despite retained team-context code. |

Main entry points: [assignments](../src/pages/coaching/CoachingAssignments.tsx), [athlete detail](../src/pages/coaching/CoachingAthleteDetail.tsx), [lineups](../src/pages/coaching/CoachingBoatings.tsx), [analytics](../src/pages/coaching/TeamAnalytics.tsx), [member dashboard](../src/pages/team/MyTeamDashboard.tsx), [live sessions](../src/pages/CoachSessions.tsx), [training block](../src/pages/TrainingBlock.tsx).

## Findings to retain for later work

### Membership and scope

1. Account membership and roster membership can diverge after join, leave, removal, or transfer.
2. Linking an LC account can leave a pre-existing unlinked roster athlete as a separate profile.
3. Multiple active roster relationships are representable, but primary roster, assignment ownership, and conflict rules are undefined.
4. Active team and selected viewing scope are not applied consistently to reads and writes.
5. Frontend role labels and database operation permissions need a deliberate alignment pass, including coxswain and organization-derived access.
6. Global athlete deletion needs to be distinguished from roster removal in the lifecycle and UX.

### Assignments and results

1. Organization assignment creation unions the supplied recipient list with all active organization roster athletes. For an athlete on multiple teams, it takes the first encountered team for the recipient row; this is not a deliberate primary-team rule. The union can also restore recipients excluded by the UI selection.
2. Recipient lists are snapshots, not automatic subscriptions to future roster changes.
3. Parent assignment creation and recipient creation are separate writes. Recipient insertion failure is logged without failing parent creation, allowing partial success.
4. Recipient synchronization can delete removed recipients' rows without protecting completed results, despite a comment describing preservation.
5. Normal Concept2 assignment matching uses `user_id`, date, and template. Coach-created recipient rows omit `user_id`, so this does not provide dependable automatic completion of those rows.
6. Linking a workout/completing an assignment does not necessarily fill the result fields consumed by team leaderboards. Conversely, coach-entered results do not create personal workout logs.
7. An ErgLink-specific completion path exists, but depends on metadata, client reads, and permissions. It should not be treated as proven end-to-end automation. The coach live-session builder does not supply the assignment metadata described in its flow document.

Relevant sources: `createGroupAssignment`, `syncAssignmentAthletes`, and `saveAssignmentResults` in the [coaching service](../src/services/coaching/coachingService.ts); [Concept2 sync hook](../src/hooks/useConcept2Sync.ts); [ErgLink assignment contract](../working-memory/erglink-assignment-flow.md).

## Open questions for the first design discussion

These questions define the next discussion, not approved requirements:

- What distinguishes an organization, team, squad, and seasonal roster in the intended coaching workflow?
- May an athlete have several active rosters within one organization? Across organizations? Does viewing/access membership need different rules from assignment-bearing roster membership?
- If multiple rosters are allowed, is there a primary training roster, and who chooses it? How should overlapping assignments and completion credit work?
- How should an athlete claim an existing coach-created profile with consent and without creating duplicates? What changes for junior athletes and guardians?
- What should joining, leaving, transferring, archiving, and removing mean for account access, active roster status, historical results, notes, and pending assignments?
- Which actions belong to organization owners/admins, coaches, coxswains, and athletes? Does a coach with access through an organization have the same capabilities as a directly assigned team coach?
- When a coach switches organization/team scope, what should remain selected, which data should appear, and how should create/edit destinations be made explicit?

UX design follows agreement on these rules. Assignment, results, training-block, and other changes follow that foundation.

## Documentation differences and verification limits

Older system-pattern notes describe single-team assumptions and profile-role coaching gates that no longer describe the current implementation. Organization planning notes and training-block handoffs also contain planned or superseded UI descriptions. Use the current route/context/service code to distinguish reachable behavior from historical intent.

The initial review inspected application code, relevant docs, and deployed database policies/helpers through read-only Supabase queries. No live membership, roster, assignment, or result records were changed. No authenticated browser walkthrough or role-by-role mutation test was performed. Findings above describe inspected behavior and integration gaps, not newly reproduced browser incidents. This baseline covers main, not staging-only Concept2/mobile work.
