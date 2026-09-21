# PM5 evidence pipeline: telemetry → LC result → Concept2 payload

Status: 2026-09-21. Capture normalization is proven on real hardware for summary-level evidence. Split/stroke projection into Concept2 is **not** implemented and **not** tested. This document records the field-level contract, the measured gaps, and the pre-device work order.

## The four validity states

Keep these distinct in code, storage and UI. They are not synonyms.

| State | Meaning | Who decides |
|---|---|---|
| Evidence-valid | Captured PM5 notifications form one internally consistent completed workout | LC, deterministically |
| API-valid | Projected payload satisfies the Concept2 result schema and is accepted by the API | Concept2 API |
| Verified | Concept2 marks the result verified | Concept2, via trusted client or matching PM verification code |
| Ranked | Result appears in the season ranking | Concept2 / athlete action |

LC must never set `verified: true` from its own consistency checks. After a successful POST, exact-ID read-back is the only authority for `verified` and `ranked`.

## Current pipeline

```text
PM5 BLE notifications
  → PM5CaptureAccumulator            (@readyall/erglink)
  → PM5CompletedCaptureV1            proven on hardware
  → [MISSING] LC ingestion
  → [MISSING] CompletedWorkoutV2 with samples
  → mapCompletedWorkoutToConcept2    summary + intervals only
  → POST /api/users/me/results
  → [MISSING] exact-ID read-back of splits/strokes
```

## What real hardware has proven

Two completed 100 m RowErg workouts on firmware `212.000`. Best run:

- 23 raw notifications retained in arrival order;
- 10 normalized strokes after deduplication by PM5 `strokeCount`;
- initial all-zero `strokeCount: 0` notification retained as raw evidence, excluded from normalized strokes;
- one split notification;
- paired end summaries;
- authoritative totals `100 m`, `26.40 s`, `2:12.0/500 m`, `23 s/m`, `152 W`, `6 cal`.

Internal reconciliation held: `26.40 s × 500 / 144.5 s = 100 m`; Concept2's pace formula gives `152 W`; `10` strokes over `26.4 s` gives `22.73 s/m`, rounded to the reported `23`.

This proves the capture envelope and summary semantics. It proves nothing about Concept2 splits, intervals, or `stroke_data`.

## Gap 1 — characteristics not subscribed

`@readyall/erglink` `PM5CapacitorDriver` currently subscribes to seven characteristics:

```text
0x0031 general status
0x0032 additional status 1
0x0033 additional status 2
0x0035 stroke data
0x0037 split/interval data
0x0039 end-of-workout summary
0x003A end-of-workout additional summary 1
```

Not subscribed, and needed:

| UUID | Content | Why it matters |
|---|---|---|
| `0x0036` | additional stroke data | projected time/distance per stroke |
| `0x0038` | additional split/interval data | per-split rate, power, calories, rest detail |
| `0x003C` | end-of-workout additional summary 2 | **Workout Verified flag**, erg machine type, average pace, PM log date/time |
| `0x003E` | additional status 3 | operational state / workout verification state during the piece |

`0x003C` is not even declared in `PM5_CHARACTERISTICS`. Per the Concept2 CSAFE specification, its Game Identifier / Workout Verified byte packs the game ID in the lower nibble and the Workout Verified flag in the upper nibble:

```c
#define LOGMAP_GAMETYPEIDENT_PM5_MSK 0x0F
#define LOGMAP_LOGHEADER_STRUCT_VERIFIED_MSK 0xF0
```

Without `0x003C` we cannot report the monitor's own verification state, and we cannot confirm erg machine type from the workout log rather than from the connection.

## Gap 2 — normalized strokes lack Concept2's fields

Concept2's `stroke_data` array expects per stroke:

```ts
{
  t: number;    // deciseconds, resets per interval
  d: number;    // decimeters, resets per interval
  p: number;    // pace, deciseconds per 500 m
  spm: number;  // stroke rate
  hr: number;   // heart rate
}
```

`NormalizedStroke` currently carries:

```ts
{
  strokeCount, elapsedSeconds, cumulativeDistanceMeters,
  driveLengthMeters, driveTimeSeconds, recoveryTimeSeconds,
  strokeDistanceMeters, peakDriveForcePounds,
  averageDriveForcePounds, workPerStrokeJoules
}
```

Missing: interval identity, interval-relative time and distance, pace, stroke rate, heart rate.

Pace, rate and HR arrive on the status characteristics at a different cadence than stroke events. They must be **time-aligned** from retained status snapshots, never interpolated or invented. A stroke with no aligned status sample within tolerance omits the optional field rather than guessing.

## Gap 3 — Concept2 payload type has no splits or strokes

`Concept2ResultPayload` currently supports:

```ts
type, date, timezone, distance, time, workout_type,
rest_distance?, rest_time?,
workout?: { intervals: [...] },
weight_class, privacy, comments
```

Not represented: `workout.splits`, `stroke_data`, `stroke_rate`, `stroke_count`, `drag_factor`, `calories_total`, `wattminutes_total`, `heart_rate`, `verification_code`, `verified`.

Concept2's documentation recommends its [Online Validator](https://log.concept2.com/developers/validator) before posting, especially for interval workouts.

## Fixed 2,000 m validity rules

Deterministic checks LC must pass before calling a captured 2,000 m evidence-valid:

1. PM workout type is fixed distance, not Just Row or an interval type.
2. Capture status is `completed` — not `aborted` or `incomplete_capture`.
3. Both end summaries are present.
4. Work distance is exactly `2000`.
5. Rest time and rest distance are zero.
6. Final split and stroke evidence reconcile with the summary totals within documented PM rounding.
7. Normalized stroke counts are strictly increasing with no gaps after deduplication.
8. Each stroke's time and distance fall inside the completed window and are monotonic.
9. `averagePace × 2000 / 500` equals work time within PM resolution.
10. Reported watts reconcile with Concept2's pace/power relationship after rounding.
11. The PM log date/time from the summary — not LC connection time — becomes the provider `date`.
12. Erg machine type identifies a RowErg.
13. `0x003C` verification evidence is retained alongside the result.
14. Start-state evidence supports the ranking rule that the flywheel was stationary at the start.

Rules 13 and 14 cannot be satisfied until Gap 1 is closed.

## Ranking eligibility

Concept2's published [ranking rules](https://log.concept2.com/rankings) state ranking pieces must be fixed-duration pieces started from a non-moving flywheel, and that interval pieces are not ranking pieces. Concept2 also states ranked results need not be verified, though the ranking can be filtered to verified-only.

The POST schema exposes no `ranked` write field and examples return `ranked: false`. LC should therefore display:

```text
Evidence valid · Concept2 accepted · Ranking eligible
```

and only display **Verified** or **Ranked** after exact-ID read-back returns them.

## Work order (no mobile device required)

### E1 — Capture v2

Add `0x0036`, `0x0038`, `0x003C`, `0x003E` to the characteristic table and subscription set. Extend `PM5CompletedCapture` to `_v: 2` with interval identity, interval-relative stroke time/distance, time-aligned optional pace/rate/HR, retained `0x003C` verification evidence, erg machine type and PM log timestamp. Keep `_v: 1` readable.

Exit: byte-vector tests for each new characteristic; capture tests proving alignment tolerance and omission-on-absence; `_v: 1` fixtures still parse.

### E2 — Evidence validator

Pure function `validatePm5Capture(capture) -> { valid, violations[] }` implementing the rules above, plus the interval analogues. No network, no storage.

Exit: valid 2,000 m fixture passes; each rule has a deliberately violating fixture that fails with a specific violation code.

### E3 — Concept2 projection

Extend `Concept2ResultPayload` with `workout.splits`, `stroke_data`, and the measured optional metrics. Add `projectCaptureToConcept2(capture)` producing exact Concept2 units: meters, deciseconds, integer SPM, decimeter stroke distance, per-interval resetting `t`/`d`. Never emit `verified: true`.

Exit: unit-exact fixtures for fixed distance, fixed-distance intervals and variable intervals; malformed captures refuse to project.

### E4 — LC ingestion

Idempotent ingestion keyed by owner + capture ID + capture version. Store raw evidence separately from searchable columns. Return the owned LC workout UUID so the device `CaptureStore` can acknowledge. Do not reuse the legacy `ErgLinkUploadMeta` path.

Exit: replaying the same capture returns the same workout UUID and writes once.

### E5 — Development API proof

Post projected fixtures to the Concept2 development API and the Online Validator. Read back by exact ID and compare intervals, splits and `stroke_data`. Persist Concept2's `verified`/`ranked` without rewriting LC provenance.

Exit: one valid fixed 2,000 m and one interval workout accepted and read back field-for-field; one deliberately invalid payload rejected with the expected error.

### E6 — Hardware confirmation

Requires a PM5 and, for the full chain, an installed mobile build. Capture a real fixed 2,000 m, run E2, project through E3, ingest through E4, publish through E5.

## References

- [Concept2 Logbook API snapshot](concept2-logbook-api-reference.md)
- [Concept2 API documentation](https://log.concept2.com/developers/documentation/)
- [Concept2 Online Validator](https://log.concept2.com/developers/validator)
- [Concept2 ranking rules](https://log.concept2.com/rankings)
- [PM5 verification codes](https://www.concept2.com/support/monitors/pm5/how-to-use)
- [Capture and storage audit](capture-storage-audit.md)
- [PM5 programming boundary](pm5-programming-boundary.md)
