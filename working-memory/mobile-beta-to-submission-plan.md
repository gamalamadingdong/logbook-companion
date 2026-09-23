# Mobile beta to first App Store submission

Status: 2026-09-23, updated after the first implementation pass. Plan of record
for mobile work following the first TestFlight install. Supersedes the mobile
sequencing implied by earlier delivery documents, which ended at
"installed-device proof remains".

## Where this stands

Phases 1, 2 and the first tranche of 3 are implemented and merged to `staging`.
Phases 0 and 5 are implemented but each awaits one piece of real-world proof.
No build carrying any of this has yet run on a device.

| Phase | State |
| --- | --- |
| 0 PM5 discovery | Fixed and published as `0.6.1`; adopted in LC. Hardware proof outstanding |
| 1 Navigation shell | Merged (#215) |
| 2 App-level connection | Merged (#216) |
| 3 View by view | Train and Home merged (#221, #222); manual entry and training block outstanding |
| 4 OTA delivery | Not started |
| 5 App Review readiness | Deletion and privacy merged (#218); deletion never executed end to end |

Merged in this pass: #214 plan, #215 navigation, #216 connection, #218 account
deletion and privacy, #219 analysis crash, #220 browser Bluetooth, #221 Train,
#222 Home, plus gamalamadingdong/erg-link#13.

**Everything PM5 remains inference.** The discovery fix, connect-first ordering,
background Bluetooth and wake lock have never run against a monitor.

## Verification gate

`npm run build` is the gate before pushing, because that is what deployment
runs. `npm run test:run` does **not** typecheck, and `tsc -b` is incremental, so
both can pass while the build fails. A test-fixture type error reached a
deployment build this way. Use `npx tsc -b --force` when a check needs to be
trusted.

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

## RWN is the single workout representation

Every route into a workout produces RWN. The guided builder generates notation
rather than a parallel shape, and a suggested workout hands its notation to
Train through the URL. Validation, PM5 lowering, programming and naming
therefore share one path, and the RWN-to-PM5 interface is exercised however the
workout was entered.

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

**Caveat.** `0.6.1` is published and adopted in `staging`. The fix has still
never run against a monitor.

**Exit.** A broadcasting PM5 appears in scan results on a physical iPhone. This
closes an M5 gate that CI cannot prove.

## Phase 1 - Navigation shell

**Merged in #215.** Bottom tabs are Home, Train and an overflow drawer. A bottom
`Sheet` primitive was added to `src/components/ui/`, layered above the bottom bar
so a sheet can never render beneath the controls used to dismiss it. The header
hamburger and its full-screen overlay are gone; the header carries logo plus
screen title, with the notification bell and avatar on the right. The avatar
opens an account sheet owning identity and `/preferences`, which appears in no
other menu. Both surfaces close on any route change, covering hardware Back and
deep links.

This removed the dismiss defect structurally: the `z-40` overlay competing with
the `z-50` bottom bar no longer exists.

The connection pill moved to Phase 2, where a reactive state source exists.

## Phase 2 - Live workout

**Merged in #216.** Requires a new binary; cannot ship over OTA.

Connection moved into `PM5Provider` above the router. Previously the `/pm5`
page's effect cleanup called `disconnect()`, so navigating away ended the
session mid-piece. The monitor is now released only when the owning athlete
changes or signs out, never on unmount — cleanup also runs on React's
development double-invoke, which would drop a live connection.

`UIBackgroundModes` with `bluetooth-central` is declared, and a screen wake lock
is held for the duration of a piece, reacquired on `visibilitychange` because
the system drops it whenever the page hides. The wake lock uses the Screen Wake
Lock API rather than a plugin.

**PM5-initiated starts are inferred, not read.** The published driver narrows its
aggregated payload to `PM5Data` before the UI sees it, dropping `workoutState`
and `rowingState`. `src/services/pm5ActivityDetection.ts` therefore infers
rowing from telemetry that advances. Surfacing monitor state in a future
`@readyall/erglink` release should replace this.

#220 added browser connection. The driver discovers with `requestLEScan`, which
in a browser maps to an experimental API needing a Chrome flag and absent from
Safari, so browsers found nothing. They now use the platform chooser with PM5
services declared up front.

**Exit.** A full piece survives screen lock with capture intact.

## Phase 3 - View by view

**Train merged in #221.** Ordering inverted to connect first, then choose the
workout, then a single action to start. A guided builder sits beside RWN entry
for athletes who do not write notation; it generates RWN and parses what it
generates, so it cannot hand the PM5 path something that path rejects.

**Home merged in #222.** A suggested workout hands its notation to Train through
the URL. Adding a workout is demoted from a full-width primary button to an icon
on phones. The recent workout row was rebuilt after seeing it on a device: it
printed the distance twice for distance-named pieces, omitted pace, and repeated
an Analyze pill on every row. The row is now the link, with pace shown and the
distance line suppressed when the name already states it.

**Outstanding:** manual workout creation and training block views. Both are
redesigns of large surfaces rather than polish, and deserve their own slice.
Sectioned analysis cards on Home are also unresolved; Home already renders five
separate widgets, and grouping them needs a judgement about which earn phone
space.

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
| In-app account deletion, guideline 5.1.1(v) | **Implemented in #218.** Never executed end to end, because doing so destroys the account. |
| Privacy policy URL and privacy nutrition label | **Page merged in #218** at the public `/privacy` route. The nutrition label remains an operator task, and the policy text needs review before public release. |
| Reviewer demo account | **Needed.** Everything is behind login; provide seeded credentials in review notes. |
| Export compliance | Declare; HTTPS-only normally qualifies for the standard exemption. |
| Sign in with Apple | **Not required.** Guideline 4.8 applies only when third-party or social login is offered. Logbook Companion uses email and password only, with no `signInWithOAuth` or `signInWithOtp` in `src/`. Concept2 OAuth is a post-login service integration. This closes the open question in `docs/concept2-mobile/mobile-delivery.md`. |

### What the schema required

Live inspection of project `vmlhcbkyonemmlawnqqr` found three reasons a
conventional deletion would have failed, none visible from application code:

- `user_profiles.user_id` had **no foreign key to `auth.users`**, so deleting
  the auth user left the profile and everything cascading from it, including
  `workout_logs`. Silent retention of exactly the data the rule targets.
- **Twenty columns** referenced `auth.users` with NO ACTION, so
  `auth.admin.deleteUser()` would raise a foreign key violation.
- Team records hung off the coach's identity with NOT NULL columns and
  ON DELETE CASCADE, so deleting a coach would have **erased squad history**.

The migration `20260923150000_account_deletion.sql` makes shared-ownership
columns nullable and self-clearing, and adds `delete_my_account()`, a
security-definer routine deriving its subject from `auth.uid()` and running as
one transaction. Applied to production and verified against live schema.

Agreed behavior is detach rather than destroy: team records survive with the
owning identity cleared, which works because row-level policies already fall
back to `team_id IS NOT NULL AND can_view_team(...)`. Coaching rows with **no**
team are deleted, since nothing could read them once detached. Results already
published to Concept2 are not ours to remove and the athlete is told so.

Three NO ACTION references remain by design — `user_goals`,
`ai_recommendations`, `ai_usage_logs` — all personal data the function deletes
explicitly before touching `auth.users`.

## Defects found so far

1. **PM5 scan never discovers a broadcasting monitor.** Fixed in Phase 0; device
   proof outstanding.
2. **Full-screen menu does not dismiss on navigation.** Superseded by Phase 1
   rather than patched.
3. **Workout analysis opened a blank screen.** Fixed in #219.
   `detail.workout_type.replace(...)` was read unguarded during render. Results
   *written to* Concept2 by Logbook Companion arrive without a workout type,
   while results *imported from* Concept2 always carry one, so the crash struck
   exactly one class of workout. A render crash, not a data or routing problem.
   Two related faults were fixed alongside: a duplicated element rendering the
   same value twice, and a record lookup hardcoded to `external_id` that left
   the database id unset for UUID-addressed workouts, disabling template linking
   and benchmark saving.

## Known weaknesses

- **The Supabase client is untyped.** `src/services/supabase.ts` calls
  `createClient` without `<Database>`, so `rpc()` accepts any string and table
  queries are unchecked. A brand-new RPC compiled cleanly against generated
  types that did not contain it. Adopting `createClient<Database>` would restore
  the guarantee and will surface existing errors, so it deserves its own slice.
- **Rowing activity is inferred from telemetry** rather than read from the
  monitor, because the published driver drops `workoutState` before the UI sees
  it.
- **No DOM test environment.** Component tests use `renderToStaticMarkup`, where
  effects never run, so crashes behind an async fetch cannot be covered.

## Open questions

- Whether a `Feed` tab is wanted later. Worth scrutiny: a social feed as the
  primary athlete surface is the pattern the mobile UX foundation lists under
  "avoid".
- Whether Home's five widgets should be grouped into sectioned cards, and which
  of them earn phone space at all.
- In-row telemetry views, deliberately deferred until phases 0 through 5 are
  complete. ErgData is a reference point for which metrics matter when, not a
  design to replicate.

## References

- [Mobile UX foundation](../docs/mobile-ux-foundation.md)
- [Mobile delivery specification and status](../docs/concept2-mobile/mobile-delivery.md)
- [M5 installed-app verification](../docs/concept2-mobile/approval-evidence/m5-installed-app-verification.md)
- [Active context](activeContext.md)
