# Coach scope and roster destinations

The approved first slice from the membership UX review is consistent coach scope selection and explicit roster action destinations. Reuse existing organization/team records; no database or membership-rule changes.

## Selection contract

- Shared coaching navigation exposes labeled Club and Team selects on desktop and mobile. Standalone teams remain accessible without inventing a club record.
- Club selection opens that club's All Teams view when it has multiple teams. A club with one team opens that team. A standalone selection always resolves to a team.
- Selecting a specific team synchronizes the active team and team filter atomically. Dashboard team links also select the specific team.
- All Teams retains an internal anchor team for compatibility, but it is not an implicit roster-add destination. Existing organization-wide reporting queries remain unchanged in this slice.
- Saved filters are accepted only inside the saved active team's organization. Stale or foreign-club filters cannot redirect writes. Account changes clear prior context and ignore late loads.

## Roster destinations

- A selected team is the default destination for single and bulk adds. Both forms show the destination name.
- All Teams requires choosing a team within the current club before entering either form. Opening or canceling does not write. The chosen destination stays fixed throughout that dialog.
- Quick scores and notes use the athlete row's team in an organization-wide roster. Transfer destinations derive from the athlete's source, not a hidden anchor team.
- Roster requests must not let a late response from a previously selected scope replace the current roster.

## Settings

All Teams shows a prompt to select a team instead of exposing an anchor team's editable settings. A selected team is named in the header and is the only team shown in the team info editor. Key settings content by account/team to prevent old drafts and dialogs carrying into a new selection.

## Limits and checks

This does not enforce one active roster, change linking/transfer/delete semantics, or redesign assignment/schedule/lineup reporting. Those remain later work. Verify context persistence and switching, explicit single/bulk destinations, account/load races, and settings isolation with focused tests; run lint, build, and the app suite. Rendered authenticated mobile verification remains a separate evidence requirement if no session is available.
