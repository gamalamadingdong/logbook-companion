# Active Context

Last updated: 2026-09-23

## Current objective

Converge manual completion, Concept2 import, and future ErgLink/PM5 capture on one durable completed-workout model. Logbook Companion remains the training record and sole Concept2 API client. Capture producers preserve measured evidence; Concept2 publication is an explicit user action through the server-owned mapper and fenced publication state machine.

Production Concept2 publishing remains disabled. Concept2 has not replied to the production-write requirements inquiry sent to `ranking@concept2.com` on 2026-09-17.

## Current implementation state

### Manual completed workouts

The global **Add completed workout** flow supports RowErg, SkiErg, BikeErg, runs, other activities, single distance/time results, and fixed or variable work/rest segments. Saved templates and pasted RWN provide an optional plan; entered measurements remain the result. The LC workout UUID, source, completion time/timezone, plan snapshot, template link, ordered work/rest detail, and summary indexes persist in the owned `workout_logs` row.

The desktop interval editor uses a row grid; mobile uses the corresponding compact layout. Missing required interval types block Concept2 eligibility. Incomplete measurements remain unknown rather than being summed into false whole-workout totals.

The mobile entry hierarchy now puts the quick measured result before the optional plan. Plan/template controls are collapsed on phones unless an edited workout already has a plan; desktop keeps the full plan-first workflow. Training Block now opens to the current week on phones, keeps all seven compact day selectors in one row, labels today explicitly, and places setup/history/team management behind one progressive-disclosure control. The selected day's planned sessions remain primary; team prescriptions, routine/support details, and matching overrides expand only when needed on phones. This cleanup is build-verified but still needs installed-device review.

### Shared Concept2 publication core

Development publishing is proven for fixed-distance and fixed-time summaries plus fixed-distance, fixed-time, and variable intervals. The server reconstructs a versioned `CompletedWorkout`, maps it to Concept2, snapshots the immutable mapper-versioned payload, fences dispatch, records uncertain outcomes, and reads back the exact returned Concept2 result ID. Repeat imports update the same provider result rather than adding another result with that ID.

Representative manually entered development results:

| Shape | LC workout | Concept2 result |
| --- | --- | --- |
| Fixed-distance summary | `462ed6c8-5bcd-41a8-9a11-519bc408e3ad` | `86932` |
| Fixed-distance summary | `cabd2143-f776-40a3-a5ef-f95ef3fffc4e` | `86933` |
| Fixed-distance intervals | `4f037c45-e792-4896-9b90-bcbbb4c4e997` | `86935` |
| Variable intervals | `f4704481-8523-48de-bdbf-097634b3745f` | `86936` |
| Fixed-time intervals | `0de81a5a-bd5d-40df-8e59-1aa2248c35a5` | `86937` |

The fixed-interval classifier now uses equal work distance or equal work time to determine a fixed shape even when recovery distance is nonzero. Historical result `86938` retains its immutable earlier `VariableInterval` payload; current reconstruction yields the corrected fixed-distance shape.

### Source and result integrity

PRs #179–#182 are merged into staging:

- PR #179 prevents legacy Concept2 import from replacing manual or ErgLink source identity and raw evidence. A near match is retained as a separate exact-ID provider row until an explicit association rule exists.
- PR #180 keeps incomplete manual measurements unknown and prevents partial interval rows from becoming claimed full-result totals.
- PR #181 preserves imported provider detail, uses measured manual work/rest metrics, and adds a database edit guard. Sam reports applying migration `20260918210000_guard_published_manual_results.sql`. Published or uncertain general manual development results reject result-bearing edits; definite rejections and unpublished results remain editable.
- PR #182 makes cumulative training volume equal measured work distance plus measured recovery distance. RWN, pace, watts, PRs, template comparison, and Concept2 `distance` remain based on work distance. Recent-workout UI shows work and total explicitly when recovery meters exist.

Distance contract example:

```text
RWN:               2x500m/2:00r
Measured work:     1,000 m
Measured recovery:   400 m
Training volume:   1,400 m
Concept2 fields:   distance=1000, rest_distance=400
```

The shared volume change passed 531 Vitest tests, the production build, focused training-block tests, and lint with zero errors. PR #182 merged at `8cf70935bab61b5d66409fee66be1aa10c4b0087`.

### PM5 evidence-pipeline checkpoint

ErgLink's PM5 path has now been audited against Concept2 CSAFE revision 0.34 and exercised on a real RowErg PM5 (`hardware 907`, firmware `212.000`). The branch proves read-only device discovery, GATT capability inspection, public CSAFE `GETSTATUS` write/notify responses, basic live metrics, actual stroke/split/end-summary notifications, and paired completed-workout summaries.

Two completed 100 m workouts established the capture semantics:

- PM5 status and summary units reconcile exactly with distance, pace, watts, elapsed time, and stroke rate.
- Twenty stroke-characteristic notifications represented ten actual strokes; normalized strokes must deduplicate by PM5 `strokeCount` while preserving all raw notifications.
- Initial `strokeCount: 0` notifications are raw evidence, not normalized strokes.
- Paired PM5 end summaries—not the last live/stroke sample—are authoritative for final totals.

The hardware-proven envelope remains capture v1. Published `@readyall/erglink@0.6.0` extends it with backward-readable `PM5CompletedCaptureV2`: `0x0036`, `0x0038`, `0x003C`, and `0x003E`; interval identity and interval-relative stroke values; time-aligned optional pace/rate/HR; PM verification evidence; machine type; PM log timestamp; retained start-state evidence; shared IndexedDB/SQLite stores; and interrupted-upload recovery.

The package also exposes the pure `validatePm5Capture` evidence validator. It reconciles raw PM summaries with normalized totals, workout/interval types, stroke identity/cadence, interval-local progression, PM rounding, retained start/verification notifications, machine type, and the known fixed/Pete Plan matrix. Capture-v2 fields and the validator have automated proof only; no new physical-PM5 claim is made.

LC's pure `projectCaptureToConcept2` maps validated capture v2 to official PM log date, measured totals, fixed splits or intervals, optional measured metrics, and exact Concept2 `stroke_data` units with per-interval resetting `t`/`d`. It never emits `verified: true`. E4 capture persistence/ingestion and E5 development API projection proof are complete as recorded below; physical installed-device confirmation remains E6.

## Evidence boundaries

- Manual entry and synthetic fixtures prove application storage, mapping, publication, provider display, exact-ID read-back, and duplicate prevention.
- Real PM5 evidence proves the bounded connectivity, v1 stroke/split/summary parsing, deduplication, and completed-capture envelope described above. Capture-v2 enrichment, validation, and projection are statically/fixture proven; they do not yet prove new hardware behavior, aborted/retried upload behavior, force curves, HR-belt capture, or LC ingestion.
- Concept2-generated calorie and watt displays are not LC capture evidence.
- `CompletedWorkoutV2` has space for source evidence and normalized samples. ErgLink produces a stable validated capture envelope and LC can ingest/project it; automated proof is not physical installed-device evidence.
- The deployed legacy production `publish-to-c2` function remains separate, absent from source control, and unsuitable as the shared core.

## Ordered next steps

### 1. Close the post-merge manual integrity smoke

Use the staging-only account and browser profile:

1. Confirm a published manual result rejects result-bearing edits while still allowing an unrelated template association.
2. Confirm an unpublished manual result remains editable.
3. Save and reopen one complete and one incomplete work/rest result; blank measurements must remain unknown in JSON and indexed columns.
4. Record a result with measured recovery meters and verify work, recovery, and total volume separately in the result detail, recent workouts, dashboard totals, Analytics, goals, and reports.
5. Keep RWN and performance calculations based on measured work, and confirm the Concept2 projection still sends work and recovery separately.

### 2. Prove import identity and source preservation end to end

1. Re-sync an already imported Concept2 result by exact provider ID and confirm the provider row refreshes.
2. Exercise a near-time/manual match and confirm the LC-owned row keeps its source and raw result while the provider result is saved under its exact ID.
3. Do not hide the possible two-row representation until an association is proven.
4. Design an explicit provider-link/display rule that associates one real session without rewriting origin evidence.

### 3. Define published-result reconciliation

When a user edits a result in Concept2, refresh the linked provider snapshot, compare it with the immutable published payload, and surface divergence. An explicit adoption action should create an auditable LC revision. Do not silently overwrite the LC source row or automatically repost.

### 4. Build the PM5 evidence pipeline (current focus, no device required)

Full field-level contract and work order: [PM5 evidence pipeline](../docs/concept2-mobile/pm5-evidence-pipeline.md).

Implementation now spans merged `erg-link@origin/main` through PR #12 and merged LC PRs #192–#193. Hardware-proven foundations remain CSAFE, packetization, programming acknowledgement, and capture-v1 summary semantics. Device-independent E0–E2 plus crash recovery are published in `@readyall/erglink@0.6.0`; E3–E4 are merged in LC. Ordered slices:

0. **Storage port — complete.** The shared `CaptureStore`, IndexedDB, and SQLite adapters ship from `@readyall/erglink`; ErgLink consumes the package.
1. **Capture v2 — complete, automated proof.** The four additional characteristics, richer interval/stroke evidence, PM verification, machine type, PM timestamp, and start-state evidence are merged. Physical capture-v2 proof remains for E6.
2. **Evidence validator — complete.** `validatePm5Capture` covers fixed pieces, intervals, PM raw/normalized reconciliation, retained evidence, and the known Pete Plan workout matrix with specific violation codes.
3. **Concept2 projection — implemented in PR #192.** `projectCaptureToConcept2` emits official PM log time, exact Concept2 units, splits/intervals, measured optional metrics, and per-interval stroke data without claiming provider verification.
4. **LC capture wiring and ingestion — complete in merged PR #193.** The driver saves to IndexedDB/SQLite first, binds immutable owner/programming context to the local capture, recovers interrupted uploads, validates and inserts idempotently under owner + capture ID/version, surfaces summary/retry state, and acknowledges only after LC returns its owned workout UUID. No live row was written by automated verification.
5. **Development API proof — complete.** Concept2 development accepted the fixed 2,000 m and 8×500 m PM5 projection fixtures; exact-ID read-back with embedded strokes reported field-for-field parity. The deliberately invalid stroke payload was rejected and not published. Provider-owned `verified`/`ranked` were retained; result IDs are not stored in-repo.
6. **Hardware confirmation — blocked on hardware.** Capture, validate, ingest, project, and publish a real fixed 2,000 m through the full installed-mobile path.

### 5. Prove the direct athlete RWN → PM5 mobile path

RWN is the canonical superset. Published `@readyall/rwn` owns `translateWorkoutToPm5`, and published `@readyall/erglink` owns the PM5 protocol and Capacitor driver. LC now has Android/iOS Capacitor source projects plus an athlete `/pm5` flow for local discovery, connection, diagnostics, exact/prompt-only/unsupported handling, and explicit PM5 acknowledgement without a coach session or Supabase programming relay. Full web gates, an Android Java 21 debug build, and an iOS simulator build pass in GitHub Actions. This is not mobile release readiness: installed-app authentication/deep links, physical-device PM5 proof, signing, store delivery, and OTA remain. The older `ergLinkAdapter.ts` remains a legacy path and should be retired rather than extended.

### 6. Build the mobile UX foundation (current focus, no device required)

Flow, navigation and route classification: [mobile UX foundation](../docs/mobile-ux-foundation.md).

One application, one router. Capacitor already renders every existing route; the work is a bottom-navigation shell below `md`, a five-state PM5 flow (preflight → connect → ready → live → summary), athlete-critical route adaptation, then coach/team adaptation using the `md:hidden` pattern already present in `WorkoutHistory` and the coaching pages. Reference patterns: ErgData connection persistence, ErgZone workout-first programming, Strava recorder/summary separation. Use `src/components/ui/` primitives and theme tokens only.

### 7. Complete adverse-path PM5 evidence

Collect consented aborted, interrupted, retried, interval-with-rest, and HR-belt captures. Verify interval reset behavior, work/rest elapsed meanings, retry durability, and optional HR fields before projecting `stroke_data`.

### 8. Enrich Concept2 projection from measured evidence

After PM5 semantics are proven, normalize interval and sample detail into the shared completed-workout model. Add calories, watt-minutes, watts, stroke rate/count, drag factor, heart rate, and Concept2 `stroke_data` only when backed by trustworthy source evidence. Compare each immutable submitted payload with exact-ID provider detail.

## Progress snapshot

| Area | State |
| --- | --- |
| Development OAuth, rotating refresh, write consent | Proven |
| Fixed-distance/fixed-time/interval development publication | Proven |
| Manual completed-workout entry and shared mapper | Functional; final smoke remains |
| Source preservation, incomplete-total guard, published edit guard | Merged; targeted live smoke remains |
| Work/recovery/total volume semantics | Merged in PR #182 |
| Provider association and remote-edit reconciliation | Designed direction; implementation remains |
| Stable PM5 completed-capture envelope | Capture v1 hardware-proven; backward-readable capture v2 merged with automated proof |
| PM5 stroke/split/end-summary evidence | Capture-v1 summary path proven for completed 100 m workouts; v2 enrichment awaits hardware |
| Browser/mobile durable CaptureStore | Published from `@readyall/erglink@0.6.0`; IndexedDB + Capacitor SQLite plus interrupted-upload recovery tested |
| Shared RWN → PM5 translation | Published in `@readyall/rwn@0.2.1` |
| Shared PM5 protocol + Capacitor driver | Published in `@readyall/erglink@0.6.0` |
| Direct athlete LC mobile → PM5 | Code merged; web, Android debug, iOS simulator, and signed iOS archive/export pass; installed-device proof remains |
| PM5 native discovery | Fixed in `@readyall/erglink@0.6.1`; the scan filtered on a GATT service never present in an advertisement. Adopted in staging; hardware proof remains |
| Mobile navigation shell | Home, Train and an overflow drawer merged in PR #215 |
| Application-level PM5 connection | Merged in PR #216 with `bluetooth-central` and a screen wake lock; the page previously disconnected the monitor on navigation |
| Browser PM5 connection | Merged in PR #220; browsers use the platform chooser because `requestLEScan` is experimental there |
| Connect-first Train and guided workout builder | Merged in PR #221; the builder generates RWN so every entry path shares one validation route |
| Workout analysis measurements and structure | Merged in PR #224; the detail is built from columns, and interval structure is resolved from three storage arrangements |
| Per-workout benchmark flag | Merged in PR #225; the column it was written to had never existed, so the feature had never worked |
| In-app account deletion and privacy policy | Merged in PR #218; migration applied and verified. Never executed end to end |
| OTA delivery | Implemented locally on the OTA branch: Capgo v7 native plugin, committed RSA public trust key, encrypted immutable Vercel bundle service, compatibility/replay gates, workout-safe activation, and boot-failure rollback. Hosting, private-key provisioning, next TestFlight shell, and installed-device rollback proof remain |
| PM5 evidence validator | Merged in ErgLink; fixed, interval, PM reconciliation, and Pete Plan fixtures pass |
| Concept2 splits + `stroke_data` projection | Implemented in PR #192; fixed/interval/variable exact-unit fixtures pass |
| LC capture wiring | Merged in PR #193; local-first persistence and summary/retry UI are fixture-proven |
| LC capture ingestion | Implemented without schema change; owner-bound idempotent replay/acknowledgement tests pass; live smoke remains |
| Mobile shell | M1 merged in PR #195: five-tab bottom navigation, route-group active state, safe-area padding, desktop sidebar preserved |
| Native authentication | Current branch implements development-first system-browser returns, secure session storage, and mobile bundle isolation; deployment/operator configuration and installed-device proof remain |
| PM5 flow states | M2 merged in PR #196; explicit preflight/connect/ready/live/summary tests pass |
| Mobile route adaptation | M3a–M3c are merged through PR #199; primary coaching M4a through PR #200. Remaining coach-management and athlete-team M4b/c routes are completed in the current branch |
| Adverse-path and HR-belt PM5 evidence | Not yet proven |
| Production Concept2 publishing | Disabled pending approval |

### Mobile pause point

Responsive mobile work is complete through M4. PR #203 merged strict native URL routing and matching Android/iOS custom-scheme registration; PR #204 removed the flaky installed-emulator job and made native CI manual-only. The current auth branch builds on that routing with system-browser development Concept2 returns, secure native session storage, and a mobile build mode excluding production legacy auth. No live auth changes or deployment have been performed. Real auth UI/session behavior, iOS runtime checks, Bluetooth prompts, and PM5 operation remain device/operator gates; E6 still requires a physical PM5.

### iOS delivery preparation

Native-auth PR #205 and the signing follow-ups are merged into staging. The operator registered `org.readyall.logbookcompanion`, created the App Store Connect record, and configured the seven Apple signing/upload secret names. The requested delivery configuration is GitHub's existing **Production** environment, with staging application source and Concept2 development; no permanent delivery branch or staging-to-main app promotion.

A manual archive-only recipe and signing preflight helpers are active on default `main`. It checks out staging, records source/build provenance, and contains no upload command. Run `35784015794` completed the signed archive and IPA export for bundle `org.readyall.logbookcompanion`, version `1.0`, build `1790110903`, from staging commit `e32584bff0fdc77002cf5055e5afdbd42c7b97ab`. Archive signature, archive/IPA identity and bundled runtime configuration passed; the artifact and provenance JSON were retained for seven days and temporary signing material was cleaned. Metadata confirms Concept2 development and `uploaded=false`. Production's public Supabase variables are configured, but it has no required-reviewer protection. Installed auth proof, explicit TestFlight upload approval/installation, OTA, and ScheduleBoard's separate signing migration remain outstanding. See [mobile delivery](../docs/concept2-mobile/mobile-delivery.md#archive-only-pipeline-checkpoint-2026-09-22).

### First TestFlight install and mobile replan

2026-09-23: the operator installed and used the build through TestFlight. That is the first real installed-device evidence and it produced two defects plus a mobile direction change. Mobile work now follows [mobile beta to submission plan](mobile-beta-to-submission-plan.md), which supersedes the sequencing implied above.

That plan's first implementation pass is complete and merged to `staging`: navigation shell (#215), application-level PM5 connection with background Bluetooth (#216), account deletion and privacy policy (#218), the workout-analysis crash fix (#219), browser Bluetooth (#220), connect-first Train with a guided workout builder (#221), and the Home rework (#222). The PM5 discovery fix shipped separately as `@readyall/erglink@0.6.1` (gamalamadingdong/erg-link#13) and is adopted in `staging`.

The OTA implementation now follows the proven `scheduleboardv2/updates` deployment shape with stricter LC gates. The beta channel is committed halted. Local enabled-path proof builds a Capgo-compatible encrypted bundle and verifies both its immutable SHA-256 and its private-key-authenticated checksum using the public key embedded in iOS and Android. No updates endpoint, DNS, or hosted private key has been provisioned yet, and the installed TestFlight build still predates the updater plugin.

**No build carrying any of this has run on a device.** Everything PM5 — discovery, connect-first ordering, background Bluetooth, the wake lock, and rowing detection — remains inference from the specification and the browser harness. Account deletion has likewise never been executed end to end, because doing so destroys the account.

Direction: mobile serves one loop — connect a PM5, program, row, stay synced — with connection treated as application state rather than a route. Bottom navigation is Home, Train and an overflow drawer. RWN is the single workout representation: the guided builder generates notation rather than a parallel shape, so every entry path shares one validation and lowering route.

Two App Review blockers were found and closed before submission rather than at rejection. Live schema inspection showed the database could not support account deletion at all: `user_profiles` had no foreign key to `auth.users`, twenty columns referenced `auth.users` with NO ACTION, and team records cascaded off the coach's identity so deleting a coach would have erased squad history. Migration `20260923150000_account_deletion.sql` is applied and verified. Sign in with Apple was confirmed **not** required, closing the open question in the mobile delivery checklist.

Verification note: `npm run build` is the gate before pushing, because that is what deployment runs. `npm run test:run` does not typecheck and `tsc -b` is incremental, so both can pass while the build fails. This caught three separate faults in one session, each after the full suite had passed.

Two schema faults were found by inspecting live data rather than reading code. The workout analysis was built by spreading `raw_data`, which only carries the Concept2 shape for imported results, so workouts recorded any other way lost both their measurements and their interval structure; structure turned out to live in three different arrangements depending on how the workout was recorded. Separately, `is_benchmark` was read and written for a column that did not exist, so marking a workout as a test effort had never once worked across 5,272 workouts, and the attempt also discarded the manual RWN saved in the same request. Both are fixed in #224 and #225.

Next native build is unavoidable: no OTA updater plugin is installed, so the delivered build cannot receive JavaScript updates however the server is configured. Phase 4 must land first, then one TestFlight build carrying the updater, after which JavaScript-only fixes no longer need a rebuild.

## Resume references

- [Mobile beta to submission plan](mobile-beta-to-submission-plan.md)
- [Concept2/mobile router](../docs/concept2-mobile/README.md)
- [PM5 evidence pipeline](../docs/concept2-mobile/pm5-evidence-pipeline.md)
- [Mobile UX foundation](../docs/mobile-ux-foundation.md)
- [Completed result storage and capture audit](../docs/concept2-mobile/capture-storage-audit.md)
- [Publishing specification](../docs/concept2-mobile/publishing.md)
- [Development publishing history](../docs/concept2-mobile/resume-publishing.md)
- [Manual entry design](../docs/completed-workout-entry-design.md)
- [Manual interval grid design](../docs/completed-workout-entry-grid-design.md)
- [Concept2 approval evidence](../docs/concept2-mobile/approval-evidence/README.md)
- [System patterns](systemPatterns.md)
