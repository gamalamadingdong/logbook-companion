# Mobile beta to first App Store submission

Status: 2026-09-23. Plan of record for mobile work following the first TestFlight
install. Supersedes the mobile sequencing implied by earlier delivery documents,
which ended at "installed-device proof remains".

## Strategy

Iterate on internal TestFlight, which needs no App Review, and land OTA before
submitting. Polish the core athlete loop first, then submit once.

Internal TestFlight testing does not require Beta App Review. External tester
groups do. Full App Review applies only at first public submission, so UX
iteration is cheap until then.

## Operating principle

The phone is not a smaller desktop. Mobile real estate serves one loop:

```
connect PM5 -> program workout -> row -> stay synced with Concept2
```

Team management, leaderboards, and deep analytics remain reachable but must not
occupy primary navigation or the home surface.

A key consequence: **PM5 connection is application state, not a destination.**
Modelling it as a route is why the live surface is torn down on navigation and
why "PM5" reads wrong as a tab.

## Phase 0 - Unblock PM5 discovery

Blocks every other PM5 activity.

Fixed in `erg-link` branch `fix/pm5-native-scan-filter`, commit `81eaf9a`,
released as `0.6.1`, PR gamalamadingdong/erg-link#13.

`startScan()` filtered the native scan on `PM5_SERVICES.PM5`
(`ce060030-…`), the Rowing GATT service. Native scan filters match the
advertisement packet only, and that service is resolved after connecting, so
iOS matched nothing and the scan hung. The hardware-proven browser driver
(`src/services/bluetooth.web.ts`) filters on `namePrefix` alone and passes PM5
services as non-filtering `optionalServices`. The fix mirrors that, extracting
`buildPM5ScanOptions()` into `packages/erglink/src/pm5/scan.ts` so discovery is
testable without a native plugin runtime.

Verified: 9/9 package tests including 3 regression tests, clean `tsc` build, and
a clean `npm run build` in Logbook Companion against the compiled output.

Outstanding:

- publish `0.6.1` from an unblocked machine; this host resolves npm through
  `packagefeedproxy.microsoft.io`, which cannot serve the `@readyall` packages;
- bump the Logbook Companion dependency from `0.6.0`;
- archive, install, and confirm discovery against a physical PM5.

`patch-package` was evaluated and rejected: it cannot be installed through the
blocked proxy, and adding it without a matching `package-lock.json` entry would
make `npm ci` fail in CI.

**Caveat.** The compiled fix currently lives only in this machine's
`node_modules`. CI and TestFlight builds will not contain it until `0.6.1` is
published, and any local `npm ci` silently reverts it.

**Exit.** A broadcasting PM5 appears in scan results on a physical iPhone. This
closes an M5 gate that CI cannot prove.

## Phase 1 - Navigation shell

Logbook Companion only. No native change, so it is deliverable while Phase 0
awaits publication.

- Bottom tabs reduce to **Home**, **Train**, and an overflow **...**.
  `Train` replaces the `PM5` tab name and owns the workout flow. Library is
  demoted from primary navigation and becomes step one inside Train.
- Add a bottom `Sheet` primitive to `src/components/ui/`, which currently has
  only `Modal.tsx`. Reference implementation is ScheduleBoard's
  `src/components/layout/MobileBottomNav.tsx`: `Sheet side="bottom"`, grouped
  two-column grid, dismiss on selection.
- Drawer groups: **Train** (Library, Training Block, Log a workout),
  **Review** (History, Analytics), **Team** (role-gated), **Account**
  (Concept2 sync, Docs, Feedback).
- Remove the header hamburger and the full-screen `md:hidden` overlay it
  toggles. Header carries a small logo plus screen title on the left, and the
  notification bell plus avatar on the right.
- The avatar opens an account sheet: Profile, Settings, Account, Sign out.
  `/preferences` is reached only from here, never duplicated in the drawer.
- Add a persistent connection pill above the tab bar showing PM5 and sync state,
  returning to the live surface when a piece is in progress.

**Exit.** No duplicate navigation affordances, desktop sidebar unchanged, no
horizontal scroll at 320 px, touch targets at least 44 px.

This structurally removes the dismiss defect rather than patching it: the
overlay at `z-40` competing with the `z-50` bottom bar ceases to exist.

## Phase 2 - Live workout

Requires a new binary; cannot ship over OTA.

- Promote PM5 connection to application-level state so it survives navigation.
  `directPM5Service` is already a module singleton, but the connection and live
  UI state live in the `PM5Connection` page.
- Provide a route-independent live surface that can be resumed from anywhere.
- Detect PM5-initiated starts by watching `ROWING_GENERAL_STATUS` workout-state
  transitions, so the app responds when an athlete simply begins rowing.
- Add `UIBackgroundModes` with `bluetooth-central` to `ios/App/App/Info.plist`,
  plus keep-awake during an active piece. Today the file declares only the two
  Bluetooth usage strings, so iOS suspends the app and stops BLE notifications
  when the screen locks mid-row.

Adding the background mode before first submission is deliberate. Introducing a
new background permission in a post-launch update invites fresh scrutiny, and
maintaining a monitor connection during a workout is a conventional,
defensible justification.

**Exit.** A full piece survives screen lock with capture intact.

## Phase 3 - View by view

Awaiting a walkthrough. Order: Home, then the Train states, then the summary.
For each view decide what content earns its place on a phone and what moves
behind the drawer.

## Phase 4 - OTA delivery

Self-hosted Capgo and Vercel bundle delivery with signature verification and
proven rollback, per the existing mobile delivery document.

Sequencing matters. JavaScript bundle updates are permitted provided they do not
change the app's primary purpose. Proving OTA before submission means later UX
fixes ship in minutes; landing it afterwards makes the first fix also the first
re-review.

## Phase 5 - App Review readiness

| Item | State |
| --- | --- |
| In-app account deletion, guideline 5.1.1(v) | **Absent.** `AuthContext.tsx:292` calls `supabase.auth.signUp`, so accounts exist. No deletion path exists anywhere in `src/`. A common rejection cause. |
| Privacy policy URL and privacy nutrition label | **Absent.** A repository search matched only `LICENSE`. Submission is impossible without the URL. |
| Reviewer demo account | **Needed.** Everything is behind login; provide seeded credentials in review notes. |
| Export compliance | Declare; HTTPS-only normally qualifies for the standard exemption. |
| Sign in with Apple | **Not required.** Guideline 4.8 applies only when third-party or social login is offered. Logbook Companion uses email and password only, with no `signInWithOAuth` or `signInWithOtp` in `src/`. Concept2 OAuth is a post-login service integration. This closes the open question in `docs/concept2-mobile/mobile-delivery.md`. |

Account deletion needs a service-role Edge Function that removes the auth user
and owned rows with RLS-safe cascade behavior. Design it early rather than at
submission time.

## Defects from the first TestFlight install

1. **PM5 scan never discovers a broadcasting monitor.** Root-caused and fixed in
   Phase 0; device proof outstanding.
2. **Full-screen menu does not dismiss on navigation.** Superseded by Phase 1.
   The bottom bar renders above the overlay and its links carry no dismiss
   handler, so a destination loads behind a still-visible menu.

## Open questions

- Whether a `Feed` tab is wanted later. Worth scrutiny: a social feed as the
  primary athlete surface is the pattern the mobile UX foundation lists under
  "avoid".
- Phase 3 view-by-view content priorities.

## References

- [Mobile UX foundation](../docs/mobile-ux-foundation.md)
- [Mobile delivery specification and status](../docs/concept2-mobile/mobile-delivery.md)
- [M5 installed-app verification](../docs/concept2-mobile/approval-evidence/m5-installed-app-verification.md)
- [Active context](activeContext.md)
