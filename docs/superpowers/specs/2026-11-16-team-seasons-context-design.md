# Team seasons and coaching context

Status: product strategy approved November 16, 2026; user requested implementation. Account-optional roster participation is an explicit invariant. Implementation progress and rollout evidence belong in the companion plan.

## Purpose and agreed direction

Support Titan Rowing and clubs of different sizes without requiring three visible organizational levels. The user confirmed one annual season, such as `2026/2027`, may cover fall, winter, and spring. Preserve coach-defined groupings and historical rosters/results. Previous discussions favor team-code athlete invitations distributed by coaches/coxswains and athlete-controlled departure. Exact linking, access, and transfer contracts still need implementation design.

## Recommended model

- Club: the persistent program, e.g. Titan Rowing. Optional for standalone teams.
- Team: the persistent coached membership boundary, e.g. Titan Boys or Titan Girls. Do not create a new team each year merely to preserve history.
- Season: an annual context with a configurable label and dates, e.g. `2026/2027`; separate from the Concept2 May-to-April logbook season. Club teams can share a season calendar; standalone teams must work without a club. The eventual storage design must preserve both cases.
- Seasonal roster: that season's participation in a team, separate from ongoing account access. Prior-season records do not constitute another active coached team.
- Squad: an optional coach-defined grouping within a team's season. Start with one primary squad per seasonal participant, matching the existing model. Rename/reorganize groups without requiring athletes to rejoin the team. Coach responsibility for a group does not itself restrict access to other groups.
- Lineup: practice/race boat and seat selection, independent of primary squad and team membership.

Titan example: Titan Rowing → Titan Boys, viewed in 2026/2027 → optional Novice, Freshman, JV, Varsity squads. A small standalone team can omit the club and use no squads.

## Membership and invitations

Athlete team codes admit to a persistent team; show the receiving season before confirmation. Squads are assigned afterward. Staff invitations grant explicit team or club roles; an athlete code must not grant staff access. Future squad-specific links may preselect placement but are not needed initially.

Account membership, athlete identity, and seasonal participation remain distinct. Returning athletes retain account links and team access without annual reinvitation. Participation in the next season is confirmed by the coach; previous participation alone must not create new assignments or recipients. Ending a season is not a team departure. Leaving/removal ends current roster eligibility and the corresponding athlete membership through an explicit lifecycle operation, preserving historical records. Historical viewing permissions need an explicit access contract before implementation; preserving data must not imply access to other teams or private coach notes.

An athlete's `user_id` stays nullable. Unlinked athletes can be created, coached, assigned work, placed in lineups, and selected for rollover without account creation or invitation. Linking an account later must reuse identity/history through a separately verified claiming flow; seasonal operations never create or require accounts.

The one-active-coached-roster direction applies across current team relationships, not across historical seasonal records. A future-season returning athlete in the same team must not be treated as a second coached team. Existing multiple-team conflicts must be reported for resolution, not silently discarded.

## Coach context and action rules

Use persistent club/team context with an independent season selector. Show one-choice club/team levels as text, retaining an accessible way to manage/switch where needed. Club overview is explicit; it has no hidden write destination. An optional squad filter narrows athlete-related views within a specific team/season. Squad selection is team/season-qualified, never a global match by text such as “Novice.” Clear invalid selections on context changes. Squad filtering should carry across compatible screens; screens where it does not apply should say so instead of implying filtering.

Roster, assignments, schedule, results, and lineups must define their scope consistently before the new selector is enabled on them. Club-wide boats/resources can remain available but must be identified separately from the selected roster. Creation forms name and confirm team, season, and recipient audience; a filter is not implicit authorization or permission to notify. Club overview requires explicit destinations. Team access settings remain persistent, and must not appear to edit historical membership simply because an old season is selected. Club settings are a separate destination.

## Annual rollover and archive

Start a new season through a preview-and-confirm workflow: choose label/dates, select returning participants, optionally copy squad names, then review placements. Default returning athletes to unassigned squads unless copying placements is explicitly chosen. Reuse athlete identities and account links. Do not automatically advance grade or copy old measurements. Start schedules/assignments fresh; copying templates/plans is a separate explicit action.

Closing a season preserves its roster, historical placements, results, assignments, and practice records. Historical grade/squad/name presentation must not be reconstructed solely from mutable current-profile fields. Archived seasons open as historical views with explicit correction entry points; archive is not delete and does not itself revoke account access. Pending assignments require a visible disposition before closing; never delete completed results or silently generate next-season assignments. Rollover and close may be separate so a future season can be prepared while current work continues. Confirmation must tolerate retries without duplicate rosters or partial transitions.

## Delivery sequence

1. Agree on product semantics and context behavior in this document.
2. Inventory historical data and design seasonal storage, permissions, and migration. Map last year's Titan data through a reviewed preview; do not assume today's roster or a date range reconstructs last year's membership. Retain unresolved legacy data visibly rather than inventing history. Check authoritative schema/RLS through Supabase MCP before proposing migrations.
3. Implement seasonal roster/history and rollover with meaningful integrity tests.
4. Connect the context UI to consistent page reads and explicit action destinations. Verify team, club overview, historical season, standalone, no-squad, mobile, and account-switch behavior.
5. Implement identity claiming, departure, and active-team conflict enforcement against the agreed model as separately bounded work.

## Review boundaries

Existing code has persistent organizations/teams, athlete identities, team roster status, join/leave dates, and a single squad string on team membership. These are useful foundations but do not preserve seasonal roster placement history. Existing analytics time presets are not a rollover workflow. Do not conflate application seasons with Concept2 sync date ranges.

Before implementation, verify that rollover preserves IDs/history, old seasons do not gain current athletes, future rosters do not receive present assignments, destinations agree with selection, and existing accounts need no annual reinvitation. Browser and role-specific mutation verification remain required evidence, not assumed from unit tests.
