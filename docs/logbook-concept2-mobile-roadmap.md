# ErgLink, Concept2 Publishing, and Logbook Companion Mobile Roadmap

## Specifications and resumption guide

Start with [the Concept2/mobile index](concept2-mobile/README.md), then choose an independent track:

- [Publishing specification and implementation plan](concept2-mobile/publishing.md): owned capture identity and provenance, actual completed data, exact-ID import preservation, uncertain POST recovery, and the first manual single-workout development slice.
- [Mobile delivery specification and status](concept2-mobile/mobile-delivery.md): merged Capacitor Android/iOS projects and unsigned native CI, followed by installed-device proof, signing/TestFlight/Play delivery, and self-hosted Capgo/Vercel OTA integrity and rollback.
- [PM5 evidence pipeline](concept2-mobile/pm5-evidence-pipeline.md): PM5 characteristics, capture v2, the deterministic evidence validator, Concept2 splits/`stroke_data` projection, LC ingestion, and development-API proof. This is the current pre-device track.
- [Mobile UX foundation](mobile-ux-foundation.md): athlete flow, bottom navigation, five-state PM5 surface, and route-by-route mobile adaptation classification. This is the parallel pre-device track.

These bounded documents define the next evidence gates. Manual development publication, shared RWN/ErgLink packages, direct LC PM5 programming code, Capacitor projects, and unsigned Android/iOS compilation now exist. Physical-device use, capture ingestion, ranking-grade telemetry validation, production API approval, signing/store delivery, and live updates remain. Appflow is retired for cost and is not part of the delivery path.

## Status

Implementation checkpoint. Development publishing and direct PM5 programming have independent working foundations. The direct feature now compiles as Android and iOS apps; installed-device authentication/PM5 proof, LC completed-capture ingestion, ranking-grade validation, production publishing approval, and release delivery remain independent milestones.

This document captures the intended relationship between:

* Logbook Companion (LC)
* ErgLink (EL)
* Concept2 Logbook
* the Logbook Companion Capacitor mobile application

The goal is to finish several pieces of infrastructure that already exist in partial form and make the boundaries between the projects explicit.

---

# 1. North Star

The broader ecosystem should separate three concerns:

**RWN**
describes a rowing workout.

**ErgLink**
provides the shared monitor-driver/PM5 package and remains a browser hardware-development/boathouse harness.

**Logbook Companion**
stores, organizes, analyzes, schedules, and publishes rowing training data.

Concept2 remains an important external system and canonical community logbook, but Logbook Companion should not be limited to the data model supported by Concept2.

The intended workflow is:

```text
Workout Library / RWN
        |
        v
Logbook Companion mobile
        |
        | @readyall/rwn translation
        | @readyall/erglink PM5 driver
        v
PM5 via local CSAFE / BLE
        |
        | live telemetry
        | strokes
        | future force data
        v
PM5CompletedCaptureV1
        v
Logbook Companion
        |
        +---- analytics / templates / training history
        |
        +---- publish to Concept2
                    |
                    v
             Concept2 Logbook
```

This makes LC the system coordinating the overall workout lifecycle while preserving ErgLink as both a reusable device package and a useful standalone hardware harness.

---

# 2. Current State

A surprising amount of this architecture already exists.

## ErgLink

ErgLink currently provides:

* PM5 Bluetooth connectivity
* CSAFE support
* PM5 workout programming
* live workout telemetry
* local stroke buffering
* shared Supabase integration
* upload of completed sessions into `workout_logs`
* `source = erg_link_live`
* session metadata connecting workouts back to LC templates and assignments

ErgLink therefore already does much of the work required to create an authoritative completed workout.

## Logbook Companion

LC currently provides:

* Concept2 OAuth
* Concept2 result import
* stroke import
* workout normalization
* RWN generation
* template matching
* analytics
* workout library
* training blocks
* coaching/session concepts
* shared ErgLink data contracts

There is also existing design work around publishing ErgLink workouts back to Concept2.

The current Concept2 authentication flow requests `results:write` in several places.

The Concept2 API client contains an explicit reference to a future `publish-to-c2` Edge Function responsible for write operations and token refresh.

A Concept2 upload schema has also already been documented specifically for future ErgLink-to-Concept2 publishing.

So this is not a new architecture. It is unfinished integration work.

---

# 3. Architectural Principle: Record Once, Publish Outward

A completed ErgLink workout should first become a durable LC workout.

Concept2 publishing should happen afterward.

The flow should be:

```text
PM5
 ↓
ErgLink
 ↓
CompletedErgWorkout
 ↓
workout_logs
 ↓
publish-to-c2
 ↓
Concept2
```

The Concept2 API should not sit between ErgLink and Logbook Companion.

This provides several advantages:

1. Once LC has durably saved the workout, a Concept2 outage cannot lose that saved copy. Protection before upload requires durable device storage and resumable upload; an in-memory stroke buffer is not sufficient.
2. LC can retain data Concept2 does not support.
3. Concept2 publishing becomes retryable.
4. ErgLink does not need to own Concept2 OAuth.
5. Other consumers can use ErgLink without depending on Concept2 or LC.
6. LC retains a single durable representation of the athlete's workout.

---

# 4. CompletedErgWorkout Contract

The next important shared abstraction should be a completed workout contract.

This should evolve the existing `ErgLinkUploadMeta` concept into a representation of the completed erg session rather than merely a collection of strokes.

Conceptually:

```typescript
interface CompletedErgWorkout {
  source: "erg_link_live";

  startedAt: string;
  completedAt: string;

  machine: {
    type: "rower" | "skierg" | "bikeerg";
    pmVersion?: string;
    firmwareVersion?: string;
    serialNumber?: string;
  };

  prescription?: {
    rwn?: string;
    templateId?: string;
    assignmentId?: string;
  };

  summary: {
    distanceMeters: number;
    workTimeSeconds: number;
    restTimeSeconds?: number;
    averageStrokeRate?: number;
    averageWatts?: number;
    dragFactor?: number;
    calories?: number;
  };

  intervals?: CompletedInterval[];

  strokes?: ErgStroke[];

  forceData?: ForceCurveData[];

  metadata?: Record<string, unknown>;
}
```

This becomes the boundary between the hardware-facing ErgLink world and the training/logbook-facing LC world.

The exact schema should evolve from the existing `ActiveWorkoutSpec`, `ErgLinkUploadMeta`, and reconciliation contracts rather than replacing them unnecessarily.

Before stabilizing it, use real captured workouts to define:

* a stable capture ID and contract version, preserved across upload retries;
* authenticated athlete attribution, including how anonymous/coached sessions become owned workouts;
* completed, aborted, and incomplete-capture semantics;
* work time versus elapsed time and rest, timestamp/timezone conventions, and units;
* which PM5 totals are authoritative when final summaries and stroke buffers disagree;
* true workout averages rather than treating the final stroke as an average.

The existing column-level contract in `src/types/ergSession.types.ts` describes elapsed time and last-stroke values. Those are not automatically equivalent to this proposed summary. Resolve the mapping explicitly. Force curves and additional machine types are not required to stabilize the initial rowing contract.

---

# 5. Concept2 Should Be a Publishing Destination

Concept2 should be treated as an external publication target.

A locally captured workout might therefore look like:

```text
source = erg_link_live

concept2_publish_status = published
concept2_result_id = 123456789
```

rather than changing its source to:

```text
source = concept2
```

This matters because the Concept2 copy may simply be a representation of data originally captured by ErgLink.

## Provenance versus synchronization

LC should eventually distinguish:

**Origin**
Where did this workout originate?

Examples:

* concept2
* erg_link_live
* manual
* imported file

**External publication / references**
Where else does the workout exist?

Examples:

* Concept2 result ID
* Strava activity ID
* future external systems

This avoids losing provenance during reconciliation.

---

# 6. Concept2 Publishing Service

LC should own a server-side `publish-to-c2` service.

A Supabase Edge Function is the natural implementation given the existing architecture.

Responsibilities:

1. Authenticate the LC user.
2. Retrieve the user's Concept2 integration.
3. Ensure the token has `results:write`.
4. Refresh the Concept2 token when required.
5. Load the LC workout.
6. Convert `CompletedErgWorkout` into Concept2's result schema.
7. POST the result to Concept2.
8. Record the returned Concept2 result ID.
9. Store success/failure state.
10. Support safe retry.

Suggested state:

```text
concept2_publish_status

not_requested
pending
publishing
published
failed
```

Suggested metadata:

```text
concept2_result_id
concept2_published_at
concept2_last_attempt_at
concept2_last_error
```

Publication must have a defined duplicate-prevention and ambiguous-outcome policy before release.

Concept2 itself performs duplicate detection based on workout attributes, but LC should also maintain its own publication state so normal retries do not intentionally create duplicates.

Verify Concept2's actual duplicate behavior in the development environment; do not treat it as a general idempotency guarantee. If Concept2 accepts a POST but LC loses the response or fails to persist its ID, the outcome is unknown, not safely retryable. Resolve it using a verified remote lookup/linking mechanism or explicit operator review before another POST. Concurrent requests must share a durable claim, and stale workers must not overwrite newer attempts. Define recovery for abandoned `publishing` claims as well as ordinary provider failures.

Initial publishing is an explicit user action, restricted to the authenticated owner's eligible workout and connected Concept2 account. Automatic publishing is deferred. Edits after publication and remote deletion are not automatically propagated in the first release; surface the limitation rather than silently diverging or republishing.

---

# 7. Mapping LC/ErgLink Workouts to Concept2

Concept2's result API supports considerably more than a simple distance/time record.

It supports:

* machine type
* date/time
* timezone
* distance
* work time
* workout type
* average stroke rate
* heart rate
* stroke count
* calories
* watt-minutes
* drag factor
* rest distance
* rest time
* interval/split records
* stroke data
* targets
* metadata

The first mapper should produce a correct, explicitly supported Concept2 record, not the richest possible record. Start with one fixed-distance rowing workout shape; expand only after the complete publish/import round trip works. Unsupported or incomplete workouts must be rejected clearly rather than silently flattened.

RWN can help determine the appropriate Concept2 workout type:

```text
5000m
→ FixedDistanceSplits or appropriate fixed-distance representation

30:00
→ FixedTimeSplits

8x500m/2:00r
→ FixedDistanceInterval

4x4:00/2:00r
→ FixedTimeInterval

variable pyramid
→ VariableInterval
```

However, RWN should remain independent of Concept2's vocabulary.

Publish the measured workout, not merely its prescription. RWN is supporting context; an athlete who stops early has not completed the prescribed workout. Include interval and stroke payloads only as those representations are explicitly validated.

Concept2 is one renderer/consumer of the workout description, not the definition of RWN.

---

# 8. High-Fidelity Data and Force Curves

This integration also creates a useful distinction between:

**data Concept2 accepts**

and

**data LC can retain**

Concept2's documented stroke upload format currently supports values such as:

* time
* distance
* pace
* SPM
* heart rate

It does not provide a documented field for full PM5 force-curve samples.

Therefore:

```text
ErgLink
 ├── normal workout data ───→ LC ───→ Concept2
 └── rich PM5 data ─────────→ LC
          including
          future force curves
```

LC can therefore become a richer historical repository than the Concept2 Logbook without competing with it.

This also creates a natural future ErgLink feature: capture and persist PM5 force curves.

---

# 9. Concept2 Write-Access Process

Concept2 distinguishes applications that only read Logbook data from applications that write results.

The official process should be treated as a product milestone rather than something deferred until the end.

## Step 1: Register/confirm the Concept2 application

Concept2 applications are managed through the Concept2 API Key portal.

The OAuth application needs:

* Client ID
* Client Secret
* registered callback URL
* Authorization Code flow
* Refresh Token flow

LC already has most of this infrastructure for read access.

## Step 2: Request the correct scope

Publishing requires:

```text
results:write
```

Concept2 states that `results:write` also includes result read permission.

Scopes must be granted during authorization. They cannot simply be added later through token refresh.

Existing users who authorized LC without the necessary scope may therefore need to reconnect their Concept2 accounts.

LC already appears to request `results:write` in the current authorization flow, but the complete token lifecycle should be reviewed before enabling publishing.

## Step 3: Develop against the Concept2 development Logbook

Concept2 explicitly requires applications writing Logbook data to develop against its development server before receiving live write access.

Publishing work should therefore initially target the development environment.

Development data should be treated as disposable because Concept2 notes that the development database may be reset.

## Step 4: Implement and validate result creation

Primary endpoint:

```text
POST /api/users/me/results
```

For the device-free production-approval evidence package, test at minimum:

* fixed distance
* fixed time
* fixed-distance intervals
* fixed-time intervals
* variable intervals
* workouts with rest
* duplicate submission behavior
* invalid payload behavior
* token expiration and refresh

Concept2 recommends using its Online Validator when developing workout uploads, particularly interval workouts.

Just Row, PM5-derived HR/stroke detail, richer aggregates, targets/metadata and additional machine types are later vertical-slice tests unless Concept2 explicitly requires them for approval. Synthetic canonical fixtures may prove provider mapping; they must not be labeled as real PM5 captures.

## Step 5: Validate OAuth and reconnect behavior

Test:

* initial authorization
* `results:write` permission
* access-token expiration
* refresh-token rotation
* revoked authorization
* user reconnect
* older LC users upgrading from read access
* multiple devices

## Step 6: Request production approval

Use two contacts rather than guessing at an unpublished checklist:

1. **Requirements inquiry now:** describe the proven fixed-distance development flow and ask whether Concept2 expects specific additional shapes, Online Validator output or payload samples.
2. **Formal approval request after the compact matrix:** submit fixed-distance, fixed-time and representative interval/duplicate/invalid/refresh evidence and request production result-creation approval.

Concept2's API documentation currently directs API questions to:

`ranking@concept2.com`

The public documentation does not publish a detailed production-approval checklist.

The approval request should therefore clearly describe:

* Logbook Companion
* that it is free/open source
* the intended ErgLink integration
* what data LC uploads
* which workout types are supported
* OAuth scopes requested
* development-server testing completed
* duplicate protection
* token handling
* whether results are marked verified or unverified
* GitHub repository
* live application URL
* developer contact information

Provider permission allows LC to prepare a production rollout; it does not itself enable writes. Source-controlled production replacement, operator approval, backup/rollback and one bounded smoke path remain separate gates.

---

# 10. Verified Results

Concept2 distinguishes ordinary uploaded workouts from verified workouts.

Initial LC publishing should not assume it can create verified results.

Unless Concept2 explicitly grants LC trusted-client status, workouts should be uploaded as normal/unverified results.

Trusted/verified result support can be considered separately with Concept2 later.

This should not block initial write integration.

---

# 11. Logbook Companion Mobile App

The Concept2 publishing work naturally overlaps with another planned milestone: a native mobile version of Logbook Companion.

LC previously chose Capacitor rather than React Native.

That remains the preferred direction because:

* LC is already a React web application.
* Most UI and application logic can be reused.
* ErgLink already uses Capacitor.
* native Bluetooth access can be supported.
* Supabase authentication remains shared.
* RWN and workout-library logic remain shared.
* one web/mobile product surface can eventually launch ErgLink functionality directly.

The first LC mobile milestone does not need to recreate the application.

It should primarily prove:

```text
existing LC web app
        ↓
Capacitor shell
        ↓
iOS / Android
        ↓
authentication
        ↓
navigation
        ↓
Concept2 OAuth
        ↓
core LC screens
```

Once that works, ErgLink becomes an obvious native capability to integrate.

### Reuse the ScheduleBoard delivery implementation

Use `~/apps/scheduleboardv2/` as the primary implementation reference for the Capacitor shell, native release automation, and live updates. Sam reports this is a reliable end-to-end pipeline already in use; reuse its proven approach rather than designing another pipeline. Inspection of its files confirms the implementation exists, but is not a fresh verification of its hosted services or Apple account state.

Read these reference files before implementing LC mobile:

* `capacitor.config.ts` and `capacitor.config.production.ts` — app configuration and updater behavior.
* `package.json` — build, sync, native asset, and build-number scripts.
* `.github/workflows/build-mobile.yml` — GitHub Actions macOS/Xcode archive, signing, export, and store-upload workflow; Android is also supported.
* `docs/ci/MOBILE-BUILD-SECRETS.md` — required signing and upload secret names and encoding conventions; never copy secret values into code or documentation.
* `updates/build-manifest.ts`, `updates/vercel.json`, and `updates/vite.config.ts` — self-hosted update bundle and manifest delivery.
* `src/lib/updatePublicKey.ts` and updater initialization/call sites — trace bundle verification, app-ready acknowledgement, and failure recovery before adapting them.

The reference uses GitHub Actions for native builds and `@capgo/capacitor-updater` with self-hosted updates on Vercel. Appflow was retired because of cost; do not reintroduce it for LC. Some `updates/README.md` text still describes Appflow and future client integration; those statements are stale. Follow the current executable workflow and client code.

Replicate the pattern, not the application identity or all dependencies. LC needs its own bundle ID, app record, provisioning profile, update endpoint, release configuration, and appropriately authorized signing setup. Do not inherit ScheduleBoard's camera, location, Firebase, push, SQLite, mixed-content settings, or other permissions/plugins without an LC requirement. Confirm compatible Capacitor/plugin versions when implementing instead of blindly copying version pins.

### Apple application and TestFlight setup checklist

This is planned setup, not authorization to create accounts, purchase memberships, upload credentials, or publish an app. Sam must confirm the Apple team, LC identity, and release actions. Consult the current Apple Developer and App Store Connect guidance when executing.

1. **Confirm ownership and identity.** Confirm the Apple Developer membership/team, authorized operator, app display name, and a unique reverse-domain LC bundle ID. Record the chosen non-secret identifiers; do not reuse ScheduleBoard's bundle ID.
2. **Register the App ID.** In Apple Developer Certificates, Identifiers & Profiles, register the explicit LC bundle ID and only the capabilities needed for the first shell. Defer Bluetooth/background capabilities until the capture milestone; assess Sign in with Apple requirements against LC's actual login options.
3. **Create the Apple app record.** In App Store Connect, create a new iOS app, choose the registered bundle ID, set the primary language, app name, and unique SKU, and set team access. Record the resulting Apple app ID. Resolve agreements or account-access blockers before attempting CI upload.
4. **Configure the native project.** Initialize LC Capacitor with the same bundle ID, icons, launch assets, deployment target, team, and version/build-number policy. Adapt ScheduleBoard's scripts and workflow. Use a macOS/Xcode runner for archive/export; the Linux development host cannot perform the native iOS build itself.
5. **Provision signing and uploads.** Have the authorized operator supply a valid distribution certificate and LC App Store provisioning profile, plus appropriately scoped App Store Connect API credentials. Adapt the reference workflow's `APPLE_CERTIFICATE_P12`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_PROVISIONING_PROFILE`, `APPLE_TEAM_ID`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, and `APPLE_API_KEY_P8` inputs. Store values only in approved CI secret storage; use ephemeral signing keychains and cleanup. Do not place `.p8`, `.p12`, or profiles in the repository.
6. **Configure authentication return paths.** Define LC's native deep-link/universal-link strategy, Supabase redirect allowlist, and Concept2 callback/browser-return flow. Test cold launch and already-running app returns. Keep development and production identities/endpoints distinct; do not embed Concept2 client secrets in the app.
7. **Build without publishing first.** Run the adapted workflow with store upload disabled; verify the archive/export, bundle ID, entitlements, artifact, and unique build number. Then obtain approval for an upload to App Store Connect/TestFlight.
8. **Validate on an iPhone through TestFlight.** Complete required processing/compliance information, configure internal testers, and exercise login/logout, session restoration, navigation, safe areas, keyboard, OAuth, and offline/error states. External testing may require Beta App Review. A successful CI build alone does not establish mobile readiness.
9. **Prepare App Store submission separately.** Supply screenshots, description, support/privacy URLs, privacy disclosures reflecting analytics and OTA SDK behavior, age rating, review access/instructions, and account-deletion behavior where required. Confirm current Apple policies, including downloaded-code/live-update restrictions. App Store review and release remain explicit approval steps, not automatic consequences of merging code.

### Live-update delivery and safety

Adapt ScheduleBoard's self-hosted bundle/manifest pipeline to an LC-owned endpoint. Keep native TestFlight/App Store delivery distinct from web-bundle OTA delivery.

* Define test versus production rollout targets; a preview build or arbitrary branch must never update production devices.
* Validate bundle authenticity/integrity, native-version compatibility, app-ready acknowledgement, and fallback to a known-good bundle. Follow the reference implementation where verified; close any gaps rather than assuming its documentation proves enforcement.
* Demonstrate a successful OTA install and a failed-update rollback on a real device before enabling production updates.
* New native plugins, permissions, entitlements, or incompatible bridge changes require a new native build. OTA is not a substitute for Apple review or policy compliance.
* Never activate an update during workout capture. Download/apply only at safe lifecycle boundaries, preserving durable local data.
* Record how an operator halts a rollout and restores the last good bundle. Do not couple publishing-service deployment to a mobile update.

---

# 12. Long-Term Mobile Experience

The eventual athlete experience could be:

```text
Open Logbook Companion
        ↓
Today's Workout
        ↓
8x500m / 2:00r
        ↓
Connect PM5
        ↓
Program Erg
        ↓
Row
        ↓
Live metrics / force data
        ↓
Workout completes
        ↓
Saved immediately to LC
        ↓
Published automatically to Concept2
        ↓
Template history + analytics update
```

At that point the boundary between LC and ErgLink becomes mostly architectural.

To the user, ErgLink is simply the PM5 connectivity layer inside Logbook Companion.

The standalone ErgLink repository can still remain useful as an open-source implementation and reference for developers building other rowing applications.

---

# 13. Recommended Next Work

These are independent delivery tracks, not a combined release gate. Publishing is the first functional slice; a ScheduleBoard-derived iOS delivery foundation can proceed alongside it without taking on PM5 integration.

## Track A: Concept2 publishing

1. Preserve this architecture in project documentation.
2. Review the current Concept2 OAuth implementation.
3. Confirm the registered application and development environment.
4. Verify `results:write` authorization end-to-end.
5. Define the minimal completed-workout contract and settle the provenance/import round-trip rule in Section 14 before implementing publishing.
6. Implement the ErgLink/LC completed-workout mapping.
7. Implement `publish-to-c2`.
8. Build LC → Concept2 payload conversion.
9. Prove one fixed-distance rowing workout on the Concept2 development Logbook, including ambiguous failure recovery and re-import without duplication.
10. Expand supported workout types incrementally and validate intervals with Concept2 tooling; the full matrix is not a prerequisite for the first bounded proof.
11. Document test results.
12. Request production write approval from Concept2.
13. Add production publishing after approval.

## Track B: LC mobile

1. Confirm ADR-004 still stands: Capacitor rather than React Native.
2. Inspect and adapt ScheduleBoard's existing Capacitor/build/update implementation using Section 11.
3. Complete the LC Apple identity/signing setup and build the iOS shell.
4. Prove iOS TestFlight delivery first; adapt Android delivery separately rather than making both platforms an initial gate.
5. Validate Supabase authentication.
6. Validate OAuth redirects.
7. Validate navigation and responsive UX.
8. Prove LC-specific live updates and rollback using the existing pipeline pattern. This completes the delivery-foundation milestone; steps below are a separate native-capture release.
9. Package/share ErgLink PM5 functionality cleanly.
10. Add PM5 connection to LC mobile.
11. Add workout programming.
12. Add live workout capture.
13. Add automatic LC save and Concept2 publishing.

---

# 14. Important Design Decision to Revisit

The current reconciliation strategy assigns source priority roughly as:

```text
manual < erg_link_live < concept2
```

That is sensible when the same workout is independently observed by multiple systems.

It becomes less appropriate when:

```text
ErgLink → LC → Concept2
```

because the Concept2 workout is then derived from the ErgLink workout.

Before implementing write-back, reconciliation should distinguish:

```text
origin
```

from:

```text
external publication / synchronization
```

A Concept2 copy created by LC should enrich the original ErgLink workout with a Concept2 result ID rather than replace its provenance.

This must become an explicit decision before the publishing implementation begins. Use a small LC/Concept2-specific rule, not a generalized multi-provider sync framework. Prefer exact external IDs to fuzzy matching for LC-published workouts, and define the unknown-response recovery case before allowing a retry. Existing import/reconciliation must preserve the original row, rich data, and assignment links.

---

# 15. Immediate Milestones

The next practical milestones are therefore:

**1. Validate development write access, real captured data, and identity/reconciliation semantics.** Evolve only the contract needed for the first supported workout. Confirm Concept2 approval requirements early; do not wait until broad mapping is complete to discover an access blocker.

**2. Deliver a manual, single-shape publishing slice.** Capture/save once, publish to the development Logbook, and import back into the same LC workout. Production activation follows approval and the acceptance checks below.

**3. Replicate ScheduleBoard's mobile delivery foundation for LC.** Create the Apple app identity, adapt native CI, prove TestFlight authentication and navigation, and verify LC-specific OTA delivery/rollback. Native PM5 integration is a subsequent milestone, not part of establishing this pipeline.

### First publishing release acceptance checks

* [ ] Repeating a capture upload retains one owned LC workout.
* [ ] A supported completed fixed-distance row maps accurately and publishes to Concept2 development.
* [ ] Double-clicks and concurrent requests do not create multiple publications.
* [ ] Remote acceptance followed by a lost response/local save failure has a verified recovery path without blind retry.
* [ ] Normal Concept2 sync retains one LC workout with original provenance, strokes, and assignment/template links.
* [ ] Missing write scope, expiry, and revoked access produce explicit recovery/reconnect behavior.
* [ ] Unsupported and incomplete workouts are rejected clearly.
* [ ] Device-local save, LC upload, and Concept2 publication are distinct states; no unsupported offline-loss guarantee is shown.
* [ ] Development and production routing are explicit, and live publishing remains disabled until approval.

Defer automatic publishing, force curves, verified-result status, generalized external destinations, bidirectional edits/deletes, and embedded PM5 capture from this first release. Add supported workout shapes incrementally rather than silently degrading them.

These reinforce each other.

The mobile app provides the natural home for PM5 connectivity.

ErgLink provides the PM5 transport and high-fidelity recording.

LC provides workout identity, RWN, analytics, training plans, authentication, and persistence.

Concept2 publishing completes the loop so athletes do not have to choose between using Logbook Companion and maintaining their existing Concept2 Logbook.
