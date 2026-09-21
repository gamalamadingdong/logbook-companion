# Active Context

Last updated: 2026-09-21

## Current objective

Converge manual completion, Concept2 import, and future ErgLink/PM5 capture on one durable completed-workout model. Logbook Companion remains the training record and sole Concept2 API client. Capture producers preserve measured evidence; Concept2 publication is an explicit user action through the server-owned mapper and fenced publication state machine.

Production Concept2 publishing remains disabled. Concept2 has not replied to the production-write requirements inquiry sent to `ranking@concept2.com` on 2026-09-17.

## Current implementation state

### Manual completed workouts

The global **Add completed workout** flow supports RowErg, SkiErg, BikeErg, runs, other activities, single distance/time results, and fixed or variable work/rest segments. Saved templates and pasted RWN provide an optional plan; entered measurements remain the result. The LC workout UUID, source, completion time/timezone, plan snapshot, template link, ordered work/rest detail, and summary indexes persist in the owned `workout_logs` row.

The desktop interval editor uses a row grid; mobile uses the corresponding compact layout. Missing required interval types block Concept2 eligibility. Incomplete measurements remain unknown rather than being summed into false whole-workout totals.

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

The hardware-proven envelope remains capture v1. The merged shared package now extends it with backward-readable `PM5CompletedCaptureV2`: `0x0036`, `0x0038`, `0x003C`, and `0x003E`; interval identity and interval-relative stroke values; time-aligned optional pace/rate/HR; PM verification evidence; machine type; PM log timestamp; and retained start-state evidence. Browser IndexedDB and Capacitor SQLite now ship behind the shared `CaptureStore` contract in published `@readyall/erglink@0.4.0`.

The package also exposes the pure `validatePm5Capture` evidence validator. It reconciles raw PM summaries with normalized totals, workout/interval types, stroke identity/cadence, interval-local progression, PM rounding, retained start/verification notifications, machine type, and the known fixed/Pete Plan matrix. Capture-v2 fields and the validator have automated proof only; no new physical-PM5 claim is made.

This branch adds LC's pure `projectCaptureToConcept2`: validated capture v2 → official PM log date, measured totals, fixed splits or intervals, optional measured metrics, and exact Concept2 `stroke_data` units with per-interval resetting `t`/`d`. It never emits `verified: true`. LC still does not pass a `persistCapture` callback, ingest or acknowledge a capture, or surface a completed PM5 summary.

## Evidence boundaries

- Manual entry and synthetic fixtures prove application storage, mapping, publication, provider display, exact-ID read-back, and duplicate prevention.
- Real PM5 evidence proves the bounded connectivity, v1 stroke/split/summary parsing, deduplication, and completed-capture envelope described above. Capture-v2 enrichment, validation, and projection are statically/fixture proven; they do not yet prove new hardware behavior, aborted/retried upload behavior, force curves, HR-belt capture, or LC ingestion.
- Concept2-generated calorie and watt displays are not LC capture evidence.
- `CompletedWorkoutV2` has space for source evidence and normalized samples. ErgLink produces a stable validated capture envelope and LC can project it, but LC ingestion and canonical normalization remain unimplemented.
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

Implementation now spans merged `erg-link@origin/main` through PR #10 and this LC branch from `origin/staging` through PR #192. Hardware-proven foundations remain CSAFE, packetization, programming acknowledgement, and capture-v1 summary semantics. Device-independent E0–E2 are merged and published in `@readyall/erglink@0.4.0`; E3 is implemented in this branch. Ordered slices:

0. **Storage port — complete.** The shared `CaptureStore`, IndexedDB, and SQLite adapters ship from `@readyall/erglink`; ErgLink consumes the package.
1. **Capture v2 — complete, automated proof.** The four additional characteristics, richer interval/stroke evidence, PM verification, machine type, PM timestamp, and start-state evidence are merged. Physical capture-v2 proof remains for E6.
2. **Evidence validator — complete.** `validatePm5Capture` covers fixed pieces, intervals, PM raw/normalized reconciliation, retained evidence, and the known Pete Plan workout matrix with specific violation codes.
3. **Concept2 projection — implemented in PR #192.** `projectCaptureToConcept2` emits official PM log time, exact Concept2 units, splits/intervals, measured optional metrics, and per-interval stroke data without claiming provider verification.
4. **LC capture wiring and ingestion — next.** Pass `persistCapture` from `pm5DirectService`, surface the completed summary, persist idempotently by owner + capture ID/version, retain raw evidence separately, and acknowledge only after LC returns its owned workout UUID.
5. **Development API proof — pending.** Run projected fixed and interval fixtures through Concept2's Online Validator/development API and exact-ID read-back.
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
| Browser/mobile durable CaptureStore | Published from `@readyall/erglink@0.4.0`; IndexedDB + Capacitor SQLite tested |
| Shared RWN → PM5 translation | Published in `@readyall/rwn@0.2.1` |
| Shared PM5 protocol + Capacitor driver | Published in `@readyall/erglink@0.4.0` |
| Direct athlete LC mobile → PM5 | Code merged; web, Android debug, and iOS simulator builds pass; installed-device proof remains |
| PM5 evidence validator | Merged in ErgLink; fixed, interval, PM reconciliation, and Pete Plan fixtures pass |
| Concept2 splits + `stroke_data` projection | Implemented in PR #192; fixed/interval/variable exact-unit fixtures pass |
| LC capture wiring | Not implemented — `pm5DirectService` passes no `persistCapture`; completed captures are discarded |
| LC capture ingestion | Not implemented; E4 is the next evidence-pipeline slice |
| Mobile shell and PM5 flow states | Specified; implementation not started |
| Mobile route adaptation | 7 of 24 dense pages carry `md:hidden` alternatives; the rest need adaptation |
| Adverse-path and HR-belt PM5 evidence | Not yet proven |
| Production Concept2 publishing | Disabled pending approval |

## Resume references

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
