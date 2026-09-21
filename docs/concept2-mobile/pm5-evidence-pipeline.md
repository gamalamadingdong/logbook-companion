# PM5 evidence pipeline: telemetry → LC result → Concept2 payload

Status: 2026-09-21 after ErgLink PRs #8–#10 and LC PR #192. Capture-v1 normalization remains hardware-proven at summary level. Device-independent E0–E2 are merged and published in `@readyall/erglink@0.4.0`; E3 is implemented and tested in LC PR #192. LC capture ingestion is now the first open pipeline gap. Capture-v2 fields, validation, and projection do not yet have new physical-PM5 proof.

The original gap analysis was verified against `erg-link@origin/main` (`1bf1241`) and `logbook-companion@origin/staging` (`374053a`). Status annotations below record what has since closed; the detailed gap text remains as design rationale.

## Already built — do not rebuild

| Capability | Where |
|---|---|
| CSAFE framing, stuffing, checksums, response parsing | `@readyall/erglink/pm5/protocol` |
| Command-aware 20-byte packetization | `commands.ts`, hardware-proven |
| PM5 programming with explicit acknowledgement | `pm5ProgrammingService`, hardware-proven |
| Capture-v1 accumulator with dedup and summary semantics | `capture.ts`, hardware-proven |
| Capture v2, four additional parsers/subscriptions, start/verification evidence | `@readyall/erglink@0.4.0`, automated proof |
| Deterministic PM evidence validator | `validatePm5Capture`, automated fixed/interval/Pete Plan matrix |
| Capacitor BLE driver | `@readyall/erglink/pm5/capacitor` |
| Durable capture store contract + IndexedDB + SQLite adapters | `@readyall/erglink` storage exports |
| Pure Concept2 splits/intervals/`stroke_data` projection | LC `projectCaptureToConcept2`, PR #192 |
| RWN → PM5 translation with exact/prompt-only/unsupported | `@readyall/rwn@0.2.1` |
| LC direct connect/program UI, Capacitor projects, unsigned native CI | LC staging |

The first genuinely absent boundary is LC capture wiring and ingestion (E4).

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
  → PM5CompletedCaptureV2            automated proof; v1 hardware baseline
  → validatePm5Capture               deterministic evidence gate
  → [MISSING] LC ingestion           next: E4
  → [MISSING] CompletedWorkoutV2 with retained source evidence
  → projectCaptureToConcept2         exact splits/intervals/stroke_data
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

## Closed gap 1 — additional PM5 evidence

Closed in ErgLink capture v2. `0x0036`, `0x0038`, `0x003C`, and `0x003E` are declared, subscribed, parsed, retained, and covered by byte-vector tests. The inventory below records the original gap.

Original baseline at `1bf1241`: `PM5CapacitorDriver` subscribed to seven characteristics:

```text
0x0031 general status
0x0032 additional status 1
0x0033 additional status 2
0x0035 stroke data
0x0037 split/interval data
0x0039 end-of-workout summary
0x003A end-of-workout additional summary 1
```

Originally not subscribed, and needed:

| UUID | Content | Why it matters |
|---|---|---|
| `0x0036` | additional stroke data | projected time/distance per stroke |
| `0x0038` | additional split/interval data | per-split rate, power, calories, rest detail |
| `0x003C` | end-of-workout additional summary 2 | **Workout Verified flag**, erg machine type, average pace, PM log date/time |
| `0x003E` | additional status 3 | operational state / workout verification state during the piece |

`0x0036`, `0x0038` and `0x003E` **are** declared in `PM5_CHARACTERISTICS` as `ADDITIONAL_STROKE_DATA`, `ADDITIONAL_SPLIT_INTERVAL_DATA` and `ROWING_ADDITIONAL_STATUS3` — they are simply not in the subscription list and have no parsers. `0x003C` is absent entirely: the constant table jumps from `0x003B` (`HEART_RATE_BELT_INFO`) to `0x003D` (`FORCE_CURVE_DATA`).

Per the Concept2 CSAFE specification, the `0x003C` Game Identifier / Workout Verified byte packs the game ID in the lower nibble and the Workout Verified flag in the upper nibble:

```c
#define LOGMAP_GAMETYPEIDENT_PM5_MSK 0x0F
#define LOGMAP_LOGHEADER_STRUCT_VERIFIED_MSK 0xF0
```

Capture v2 now retains the parsed `0x003C` verification nibble, machine type, PM log timestamp, and original raw evidence. This is LC evidence; it is not permission to emit Concept2 `verified: true`.

## Closed gap 2 — normalized strokes lacked Concept2 fields

Closed in capture v2. Each normalized stroke now carries interval identity and interval-relative time/distance. Pace, rate, and HR are aligned from retained status samples within a bounded tolerance and omitted when no trustworthy sample is close enough.

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

Original missing fields: interval identity, interval-relative time and distance, pace, stroke rate, heart rate.

Pace, rate and HR arrive on the status characteristics at a different cadence than stroke events. They must be **time-aligned** from retained status snapshots, never interpolated or invented. A stroke with no aligned status sample within tolerance omits the optional field rather than guessing.

## Closed gap 3 — Concept2 payload lacked splits and strokes

Closed in LC PR #192. `Concept2ResultPayload` now represents fixed splits, intervals, `stroke_data`, and measured optional metrics. `projectCaptureToConcept2` validates first, decodes the PM-native log date/time, emits integer provider units, resets stroke `t`/`d` by interval, preserves the prescribed final rest in interval detail, and never claims provider verification.

Before PR #192, `Concept2ResultPayload` supported:

```ts
type, date, timezone, distance, time, workout_type,
rest_distance?, rest_time?,
workout?: { intervals: [...] },
weight_class, privacy, comments
```

The projection now represents `workout.splits`, `stroke_data`, `stroke_rate`, `stroke_count`, measured `drag_factor`, `calories_total`, `wattminutes_total`, and `heart_rate`. `verification_code` is unavailable and `verified: true` remains provider-owned.

Concept2's documentation recommends its [Online Validator](https://log.concept2.com/developers/validator) before posting, especially for interval workouts.

## Open gap 4 — LC never receives a capture (next: E4)

Verified on `origin/staging`. `PM5CompletedCapture` appears only as a type import in `src/types/ergSession.types.ts`. `src/services/pm5DirectService.ts` contains no capture wiring, and `src/pages/PM5Connection.tsx` shows live metrics but no completed-capture surface.

The `PM5CapacitorDriver` accepts an optional `persistCapture` callback. LC still passes nothing, so completed captures are discarded at the end of a workout. The durable store contract and IndexedDB/SQLite adapters now ship in `@readyall/erglink@0.4.0`; the remaining work is to instantiate the correct LC adapter, surface the completed summary, ingest idempotently, and acknowledge only after LC returns its owned workout UUID.

This decides slice ordering: publishing the storage port is a prerequisite for LC ingestion, and neither depends on hardware.

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

The validator now implements these rules, including retained `0x0031` start-state and `0x003C` verification notifications. Hardware confirmation remains E6.

## Ranking eligibility

Concept2's published [ranking rules](https://log.concept2.com/rankings) state ranking pieces must be fixed-duration pieces started from a non-moving flywheel, and that interval pieces are not ranking pieces. Concept2 also states ranked results need not be verified, though the ranking can be filtered to verified-only.

The POST schema exposes no `ranked` write field and examples return `ranked: false`. LC should therefore display:

```text
Evidence valid · Concept2 accepted · Ranking eligible
```

and only display **Verified** or **Ranked** after exact-ID read-back returns them.

## Work order (no mobile device required)

### E0 — Publish the storage port — complete

Move `captureStore.ts` and the IndexedDB/SQLite adapters from the ErgLink app into `@readyall/erglink` behind `./pm5/storage/indexeddb` and `./pm5/storage/sqlite`, with the platform-neutral contract at the package root. Behavior unchanged; ErgLink consumes the package.

Evidence: store tests pass from the package; `@readyall/erglink@0.3.0` introduced the port and `0.4.0` carries it forward; ErgLink and LC consume the package.

### E1 — Capture v2 — complete, automated proof

Declare `0x003C`, then add `0x0036`, `0x0038`, `0x003C` and `0x003E` to the subscription set with parsers for each. Extend `PM5CompletedCapture` to `_v: 2` with interval identity, interval-relative stroke time/distance, time-aligned optional pace/rate/HR, retained `0x003C` verification evidence, erg machine type and PM log timestamp. Keep `_v: 1` readable.

Evidence: byte-vector tests cover every new characteristic; capture tests cover alignment tolerance, omission-on-absence, late notifications, lifecycle ordering, and `_v: 1` readability. Physical capture-v2 confirmation remains E6.

### E2 — Evidence validator — complete

Pure function `validatePm5Capture(capture) -> { valid, violations[] }` implementing the rules above, plus the interval analogues. No network, no storage.

Evidence: valid fixed 500 m/2,000 m/10,000 m, fixed-time, and full documented Pete Plan fixtures pass. Deliberate violations cover every rule with specific codes, including PM raw/normalized parity and interval-local evidence.

### E3 — Concept2 projection — implemented in PR #192

Extend `Concept2ResultPayload` with `workout.splits`, `stroke_data`, and the measured optional metrics. Add `projectCaptureToConcept2(capture)` producing exact Concept2 units: meters, deciseconds, integer SPM, decimeter stroke distance, per-interval resetting `t`/`d`. Never emit `verified: true`.

Evidence: unit-exact fixed 2,000 m, 8×500 m, and speed-pyramid fixtures pass; malformed captures refuse projection. Tests cover PM date encoding, time-undefined-rest intervals, final-rest preservation, variable-only per-interval rest distance, optional metrics, and omission of unavailable drag/verification claims.

### E4 — LC capture wiring and ingestion — next

Pass a `persistCapture` callback from LC's `pm5DirectService` into `PM5CapacitorDriver`, backed by the published storage port. Surface the completed capture in the PM5 summary state. Then add idempotent ingestion keyed by owner + capture ID + capture version, storing raw evidence separately from searchable columns and returning the owned LC workout UUID so the device store can acknowledge. Do not reuse the legacy `ErgLinkUploadMeta` path.

Exit: a simulated completed capture persists locally, appears in the summary state, and replaying it returns the same workout UUID with a single write.

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
