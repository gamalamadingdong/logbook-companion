# Strava Sync Feasibility for Logbook Companion

Date: 2026-09-09

## Bottom line

Strava can technically provide the non-Concept2 activities Logbook Companion is missing, including runs, rides, swims, hikes, strength sessions, and many other activity types. Its API exposes OAuth, paginated activity history, detailed activities, activity streams, and webhooks.

The intended persistent integration should not be implemented yet. Strava's API Policy effective June 1, 2026 appears incompatible with Logbook Companion's core use case:

- Section 5.4 prohibits using Strava Data for analytics or analyses and prohibits combining Strava Data with other customer data.
- Sections 5.5, 5.7, and 6.2 prohibit indefinite storage and limit API data caching to seven days.
- Section 5.3 prohibits using Strava Data or derived data in the operation of an AI application.

Logbook Companion persistently stores workout history, combines sources, performs analytics, and may expose data to coaching or AI-assisted features. Before implementation, the project should obtain written confirmation from Strava that the specific first-party athlete training-log design is permitted, or receive an applicable exception/partner agreement. This is a product-policy conclusion, not legal advice.

Primary policy sources:

- [Strava API Policy](https://www.strava.com/legal/api_policy)
- [Strava API Agreement](https://www.strava.com/legal/api)
- [Strava developer rate limits and review process](https://developers.strava.com/docs/rate-limits/)

## Desired source and activity model

Provider authority and activity modality should be separate concepts.

- `source` or provider provenance: `concept2`, `strava`, `erg_link_live`, `manual`
- `activity_type`: `row`, `run`, `ride`, `swim`, `hike`, `strength`, `ski`, and other normalized modalities
- training-block rollup: `erg`, `cross_training`, `strength`, or `support`, derived for planning views rather than used as the imported activity type

Concept2 is authoritative whenever an activity exists in Concept2, regardless of machine or workout type. This includes RowErg, BikeErg, SkiErg, StrengthErg, and future Concept2 types. Strava is complementary, not a second authority for the same workout.

The reconciliation sequence should be:

1. Identify the provider activity and look for an existing Concept2 identity or a high-confidence Concept2 match.
2. If Concept2 exists, retain the Concept2 workout as canonical and link or suppress the Strava representation.
3. If an unmatched Strava activity remains, preserve its specific normalized activity type, such as `run` or `ride`.
4. Map that type to `cross_training` only in training-block rollups where the broader category is needed.
5. If Strava arrives first and Concept2 arrives later, upgrade the canonical workout to Concept2 without losing the Strava identity needed for update/delete handling.

This rule is better than simply excluding Strava `Rowing` and `VirtualRow`. Concept2 BikeErg and SkiErg sessions can appear in Strava under non-rowing sport types, so sport type alone cannot prevent duplicates.

## What the Strava API can supply

The official API supports `Rowing` and `VirtualRow`, as well as many non-rowing sport types such as `Run`, `Ride`, `MountainBikeRide`, `Swim`, `Hike`, `WeightTraining`, `Workout`, `NordicSki`, and `VirtualRide`. See the official [upload and sport type documentation](https://developers.strava.com/docs/uploads/).

The activity endpoints expose enough common fields for a useful cross-training record:

- Strava activity ID and upload identifiers
- activity name and `sport_type`
- UTC and local start timestamps
- distance in meters
- moving and elapsed time in seconds
- trainer/manual/private flags and recording device name
- average and maximum speed
- heart-rate summaries when recorded
- calories on detailed activities
- cadence and power fields where Strava supplies them, especially for rides

The [API reference](https://developers.strava.com/docs/reference/) also exposes optional streams for time, distance, velocity, heart rate, cadence, and watts. These streams are not guaranteed for every activity and are not equivalent to Concept2 intervals or stroke-level data. A cross-training MVP should use activity summaries and request details only when needed; it should not assume rowing-grade structure or power fidelity from Strava.

## Authentication and incremental sync

Strava uses OAuth 2.0. `activity:read` reads visible activities, while `activity:read_all` is required for activities whose visibility is Only You. Athletes can decline requested scopes, so the accepted scopes must be stored and validated. Access tokens expire after six hours, and a successful refresh can rotate the refresh token; the latest returned refresh token must be persisted atomically. See [Strava authentication](https://developers.strava.com/docs/authentication/) and [OAuth scope documentation](https://developers.strava.com/docs/oauth-updates/).

History is available from `GET /athlete/activities` with `before`, `after`, `page`, and `per_page`. Incremental updates should use the [Webhook Events API](https://developers.strava.com/docs/webhooks/): acknowledge within two seconds, enqueue work, then fetch and process asynchronously. Webhooks cover activity create/delete and limited updates, plus athlete deauthorization.

New apps start in single-player mode. A configured app can currently move to a capacity of 10 from the API dashboard; scaling beyond 10 requires Strava review. The published capacity-10 read limit is 200 requests per 15 minutes and 2,000 per day. Strava explicitly recommends webhooks instead of activity polling. Creating a developer app currently requires a Strava subscription. See [Getting Started](https://developers.strava.com/docs/getting-started/) and [Rate Limits](https://developers.strava.com/docs/rate-limits/).

## Fit with the current repository

The existing `workout_logs` row already has most summary fields needed: source, external ID, workout type, timestamps, distance, duration, heart rate, calories, watts, and raw JSON. The dashboard's activity categorization also preserves generic types such as run and bike.

Several seams must change before a Strava source could work correctly:

- `src/services/workoutService.ts` exposes only Concept2, ErgLink, and manual sources.
- `src/utils/trainingBlockMatching.ts` currently maps every non-manual source to Concept2.
- `src/utils/trainingBlockCalculations.ts` consequently treats a Concept2-labeled log as erg work before looking at modality. A naive `strava` addition would misclassify runs and rides.
- `external_id` is used as the global upsert conflict key. Provider IDs should be namespaced, or preferably moved to a provider identity table with a uniqueness constraint on provider plus external ID.
- `c2_sync_jobs.source` is constrained to `concept2`. Strava webhooks and history sync should use a separate job path or a deliberately generalized provider-sync model, not be forced into the Concept2 worker.
- Detail views currently assume stored raw data has Concept2's shape. Strava activities need a provider adapter or a provider-neutral workout detail model.

The existing Concept2 reconciliation priority is directionally useful, but a provider identity/link record is important. If a Strava row is merged into a later Concept2 row, the system must retain the Strava activity identity long enough to process Strava update/delete events correctly. Any such retention remains subject to Strava's policy and therefore cannot be designed as permanent storage without approval.

## Conditional implementation plan

Only proceed beyond Phase 0 if Strava confirms that the intended storage, combination, and analytics behavior is allowed.

### Phase 0: policy clearance

Send Strava a concise architecture description and ask for written confirmation covering:

- persistent storage of an authenticated user's activity summaries
- display and analysis for that same authenticated user
- combining the user's Strava cross-training activities with their own Concept2 history
- training-block completion and workload calculations
- whether any Logbook Companion AI/coaching feature may receive or derive from Strava data
- provider identity retention for deduplication and webhook deletion

The API Agreement directs uncertain use cases to `developers@strava.com`.

### Phase 1: single-athlete technical spike

If permitted, build a one-athlete server-side spike:

- OAuth callback and rotating token persistence
- narrow recent-history fetch
- normalized `sport_type` mapping for unmatched activities
- provenance-first reconciliation against all Concept2 workout types
- no geographic fields and no activity streams initially
- explicit disconnect and provider-data deletion

### Phase 2: durable integration

After policy clearance and spike validation:

- add webhook receiver and asynchronous processing
- add provider identity records and idempotency constraints
- handle create, update, delete, deauthorization, and token revocation
- make source and activity type independent throughout dashboard, search, details, analytics, and training blocks
- add attribution, privacy disclosure, consent withdrawal, export/access, and deletion confirmation required by Strava's policy
- preserve Concept2 as canonical on every resolved duplicate

## Recommendation

The product direction is sound: Strava would be valuable primarily as a non-Concept2 activity feed, with each unmatched activity retaining its real type. The implementation should be paused at policy clearance. Under the published June 1, 2026 rules, a durable Strava-to-Logbook-Companion analytics sync appears prohibited without explicit permission, even though the API itself has all necessary technical capabilities.
