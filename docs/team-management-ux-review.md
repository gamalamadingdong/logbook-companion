# Team management membership UX review

November 13, 2026. Code review on `feature/team-management-winter-training`, based on main `99224ec`. Companion to the [current-state baseline](team-management-current-state.md). These are findings and proposed changes, not implemented behavior or a final approved specification. No authenticated browser walkthrough was performed.

The first scope/roster-destination slice has since been implemented locally; see the [implementation receipt](superpowers/plans/2026-11-13-coach-scope.md). The findings below describe the pre-change review.

## Direction from the product discussion

Use the existing organization/team/squad structure wherever possible. A club contains coached teams; a team owns an active roster; coaches define its squads, such as JV, Freshmen, or Novice. Lineups remain separate from roster membership. The intended direction is one active coached roster per athlete, with possible multiple non-roster group memberships later. Community groups are outside the immediate scope.

Primary-squad organization fits the existing single squad field. Roster claiming, transfer authorization, history preservation, and treatment of existing multiple memberships still need concrete decisions before enforcing the new model.

## Coach selects a club and team

Assessment: needs attention.

- The organization switcher is implemented as a team-valued selector grouped by organization. It is labeled as switching organization but displays the selected team. A separate row of team pills changes the viewing filter without changing the active team.
- Add Athlete and bulk add on the roster page use the active team rather than the selected team filter. This is a high-priority destination mismatch, not merely a labeling issue.
- Settings also uses the active team. A team pill should not imply that settings now manages that selected team when it does not.
- On small screens, the single-organization label and navigation text are hidden. Filter pills use compact padding and horizontal scrolling. Club identity, discoverability, and touch targets need rendered mobile verification.

Proposal: make Club and Team explicit selections, retaining All Teams as a view within a club. Reuse the shared coaching navigation and scope hook. Mutations should use the selected team; in All Teams, require an explicit destination. Show the destination in add/import dialogs and the managed team in settings. Keep squad selection within the roster rather than introducing another navigation hierarchy.

Source: [navigation](../src/components/coaching/CoachingNav.tsx), [roster](../src/pages/coaching/CoachingRoster.tsx), [settings](../src/pages/coaching/CoachingSettings.tsx).

## Coach manages the roster

Assessment: usable foundations, lifecycle actions need attention.

- Squad editing already accepts coach-defined names and suggests existing values. Preserve that capability and explain that changing a squad does not transfer the athlete to another team.
- Move Athlete immediately executes when a destination is clicked. It does not explain that squad/tier are cleared or that account membership is separate. Destination choices are derived from the active team's siblings, which also needs alignment with the athlete's source team.
- Delete Athlete has a confirmation and warns that notes/scores will be deleted. The underlying operation is global athlete deletion, not normal roster removal. A normal remove/archive roster action should preserve history; this requires behavior changes, not relabeling Delete.
- Settings' account-member list and the coaching roster are separate. Their purposes and account-link status should be explicit so coaches can distinguish roster management from granting app access.

Proposal: keep coach-defined squads; make transfer source, destination, and consequences explicit; separate roster removal from global deletion; expose linked/unlinked account status without automatically claiming profiles by name/email.

Source: [roster](../src/pages/coaching/CoachingRoster.tsx), [athlete editor](../src/components/coaching/AthleteEditorModal.tsx), [service lifecycle operations](../src/services/coaching/coachingService.ts).

## Athlete joins or leaves

Assessment: flow exists, membership rules need work.

- Join uses code entry, team preview, and success screens. The preview describes becoming a team member but does not resolve an existing roster profile or active roster conflict.
- Successful join does not refresh the shared coaching context before navigating to My Team. Member settings does refresh it after leaving; join should provide equivalent consistency.
- Leaving removes account membership, without automatically changing the coaching roster relationship. The intended relationship between leaving app access and leaving the active roster needs a deliberate rule.

Proposal: show club/team identity before joining, resolve the existing roster/account relationship, and explicitly handle an existing active roster without silently moving the athlete. Refresh shared context after success. Do not automatically match or merge real athletes based only on name/email.

Source: [join](../src/pages/JoinTeam.tsx), [member settings](../src/pages/team/MyTeamSettings.tsx), [membership service](../src/services/coaching/coachingService.ts).

## Proposed sequence

1. Unify coach scope and mutation destinations, with clear desktop/mobile context.
2. Define and implement roster/account lifecycle and identity linking, including the one-active-roster rule and existing-data handling.
3. Verify the full coach and athlete journeys with representative roles, multiple clubs, selected teams, and phone layouts.

This review changes no application behavior. Existing UI components and scope patterns should be reused. Browser checks, implementation tests, and database policy verification belong to the corresponding implementation work.
