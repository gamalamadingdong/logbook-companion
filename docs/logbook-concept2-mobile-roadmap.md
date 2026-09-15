# ErgLink, Concept2 Publishing, and Logbook Companion Mobile Roadmap

## Status

Proposed direction.

This document captures the intended relationship between:

* Logbook Companion (LC)
* ErgLink (EL)
* Concept2 Logbook
* the future Logbook Companion mobile application

The goal is to finish several pieces of infrastructure that already exist in partial form and make the boundaries between the projects explicit.

---

# 1. North Star

The broader ecosystem should separate three concerns:

**RWN**
describes a rowing workout.

**ErgLink**
communicates with the rowing machine and captures high-fidelity PM5 data.

**Logbook Companion**
stores, organizes, analyzes, schedules, and publishes rowing training data.

Concept2 remains an important external system and canonical community logbook, but Logbook Companion should not be limited to the data model supported by Concept2.

The intended workflow is:

```text
Workout Library / RWN
        |
        v
Logbook Companion
        |
        | workout prescription
        v
     ErgLink
        |
        | CSAFE / BLE
        v
       PM5
        |
        | live telemetry
        | strokes
        | future force data
        v
     ErgLink
        |
        | completed workout
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

This makes LC the system coordinating the overall workout lifecycle while preserving ErgLink as a useful standalone PM5 integration layer.

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

1. A network or Concept2 outage can never cause the workout to be lost.
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

Publication should be idempotent wherever possible.

Concept2 itself performs duplicate detection based on workout attributes, but LC should also maintain its own publication state so normal retries do not intentionally create duplicates.

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

The mapper should attempt to produce the richest valid Concept2 record possible.

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

Test at minimum:

* Just Row
* fixed distance
* fixed time
* fixed-distance intervals
* fixed-time intervals
* variable intervals
* HR data
* stroke data
* workouts with rest
* duplicate submission behavior
* invalid payload behavior
* token expiration and refresh

Concept2 recommends using its Online Validator when developing workout uploads, particularly interval workouts.

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

Once write integration works against the development Logbook, contact Concept2 requesting approval to use the live API for result creation.

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

Unless Concept2 gives additional instructions, this email should be treated as the formal handoff from development testing to production approval.

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

These should be treated as parallel but related tracks.

## Track A: Concept2 publishing

1. Preserve this architecture in project documentation.
2. Review the current Concept2 OAuth implementation.
3. Confirm the registered application and development environment.
4. Verify `results:write` authorization end-to-end.
5. Define `CompletedErgWorkout`.
6. Implement the ErgLink/LC completed-workout mapping.
7. Implement `publish-to-c2`.
8. Build LC → Concept2 payload conversion.
9. Test on the Concept2 development Logbook.
10. Validate interval workouts with Concept2 tooling.
11. Document test results.
12. Request production write approval from Concept2.
13. Add production publishing after approval.

## Track B: LC mobile

1. Confirm ADR-004 still stands: Capacitor rather than React Native.
2. Initialize the LC Capacitor project.
3. Build iOS shell.
4. Build Android shell.
5. Validate Supabase authentication.
6. Validate OAuth redirects.
7. Validate navigation and responsive UX.
8. Establish mobile release/build process.
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

This should become an explicit ADR before the publishing implementation is completed.

---

# 15. Immediate Milestones

The next practical milestones are therefore:

**1. Document and stabilize the ErgLink/LC completed-workout contract.**

**2. Establish Concept2 development write access and build the first `publish-to-c2` proof of concept.**

**3. Start the LC Capacitor mobile shell.**

These reinforce each other.

The mobile app provides the natural home for PM5 connectivity.

ErgLink provides the PM5 transport and high-fidelity recording.

LC provides workout identity, RWN, analytics, training plans, authentication, and persistence.

Concept2 publishing completes the loop so athletes do not have to choose between using Logbook Companion and maintaining their existing Concept2 Logbook.
