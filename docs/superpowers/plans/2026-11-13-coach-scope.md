# Coach scope implementation plan

**Goal:** Make a coach's selected team and roster write destination agree.

**Architecture:** Keep the shared context and existing persistence keys; synchronize specific selections. Reuse Select, Button, and Modal for explicit club/team controls and a destination step before existing roster forms. No schema changes.

**Execution:** Inline in the existing feature branch; the user has authorized this UX slice.

## Steps

- [x] Add failing provider/navigation tests covering specific-team selection, club switching, standalone teams, reload, invalid saved filters, and account/load isolation. Update `CoachingContext.tsx`, its contract, scope labels, and `CoachingNav.tsx` to satisfy them.
- [x] Add failing roster destination tests. Add `RosterAddModal.tsx` to choose a destination in All Teams and pass a fixed destination into single/bulk forms. Display the name in both existing forms. Bind roster save, quick-score, notes, and transfer operations to the explicit destination or row team; reject stale roster loads.
- [x] Add failing settings-scope tests. Hide editable settings in All Teams and key selected-team content by account/team; name the team and restrict the team info editor to it.
- [x] Run focused tests, lint, build, and the full app suite. Review changed TSX against UI/UX rules, update current memory and this receipt, and report remaining browser verification separately.

## Verification scenarios

Start in club A with teams A1/A2; select A2 and assert active ID, filter ID, persisted keys, and rendered selects agree. Switch to club B and assert A2 cannot survive as a filter. Restore a foreign-club filter and assert it is discarded. Switch accounts while a request is pending and assert the old account cannot populate the new context. In All Teams, assert neither form opens until a destination is selected, cancel writes nothing, and bulk creation receives that chosen ID. Specific-team forms display that team's name. Settings in All Teams must not load/edit an anchor team; changing team must discard previous drafts.


## Implementation and verification receipt

Implemented November 13, 2026, on `feature/team-management-winter-training`. Prepared for a focused PR against main at the user's request on November 14, with verification refreshed that day. No database/schema changes or live data writes.

- Club and Team selects stay visible on narrow screens, stack on mobile, and use shared Select controls with 44px minimum height. Standalone teams remain selectable. Team links and filter changes synchronize both context IDs; club changes cannot retain a foreign filter.
- The provider isolates account changes and ignores obsolete initial loads. Saved same-club filter-only preferences migrate to one coherent selection; invalid saved filters are discarded. All Teams persists across refresh.
- Roster adds/imports require a destination in All Teams, retain the chosen destination during form entry, and name it in the form. Single add and real bulk creation are covered by interaction tests.
- Roster quick scores, notes, and transfer choices use the row's source team. Keyed roster content prevents old responses/drafts from appearing after a scope change; navigation stays mounted.
- All Teams settings shows a team-selection prompt and does not load an anchor team's settings. Selected-team settings names the destination, limits team info editing to that team, and discards old drafts after switching. Team info props are memoized so unrelated input edits do not reload its drafts.

Commands and results:

- `npx vitest run src/contexts/CoachingContext.test.tsx src/components/coaching/RosterAddModal.test.tsx src/pages/coaching/CoachingSettings.test.tsx src/pages/coaching/CoachingRoster.test.tsx`: focused suites pass; 18 focused tests are included in the final full run.
- `npm run test:run`: 520 tests pass across 52 files.
- `npm run build`: passes, with existing bundle-size and Browserslist freshness notices.
- `npm run lint -- --ignore-pattern '.worktrees/**' --ignore-pattern 'android/**' --ignore-pattern 'ios/**' --ignore-pattern 'updates/**'`: passes, 0 errors and 115 existing warnings. Plain `eslint .` traversed unrelated nested worktrees and retained staging artifacts and was stopped; only these untracked paths were excluded on rerun. No tracked source was excluded beyond the repository's existing lint configuration.
- `git diff --check` and relative documentation link checks: pass.

Browser runtime setup succeeded but browser discovery returned no connected browsers. Rendered desktop/mobile, authenticated role workflows, and live writes were not verified. The existing desktop-only bulk-editor mobile guard remains. Schedule/assignment/lineup reporting, account linking, single-active-roster enforcement, and global athlete deletion semantics are outside this change.
