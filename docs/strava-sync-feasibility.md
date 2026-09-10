# Strava Sync Feasibility for Logbook Companion

**Researched:** 2026-09-09 (consolidated from two prior drafts)
**Scope:** Import an authenticated athlete's non-Concept2 Strava activities (runs, rides, swims, hikes, strength, and other cross-training) alongside the existing Concept2 rowing sync.
**Sources:** Current official Strava developer documentation and policy only. This is a product/technical assessment, not legal advice, and Strava's published policy can change — recheck it immediately before any implementation or review submission.

## Bottom line

Strava's API is **technically sufficient**: it exposes OAuth 2.0, paginated activity history, detailed activities, activity streams (heart rate, cadence, power), and webhooks, and it can identify every activity type Logbook Companion is missing.

The intended persistent, analytics-oriented integration **should not be implemented yet**. Logbook Companion's core use case appears to conflict with four separate provisions of the Strava API Policy effective June 1, 2026, and one of those (the AI-application prohibition) is the hardest for this project specifically because the repo is driven by an AI system:

- **Section 5.3 — no use of Strava Data, or data derived from it, in the operation of an AI application.** (Highest-priority blocker for this project.)
- **Section 5.4 — no analytics/analysis on Strava Data, and no combining Strava Data with other customer data.**
- **Sections 5.5, 5.7, 6.2 — no indefinite storage; API data caching limited to seven days; no persistent index.**
- **Sections 2.5, 6.3, 7.4 — deletion, retention, and certification obligations on disconnect/revocation/account-deletion.**

Logbook Companion persistently stores workout history, combines sources, performs analytics, feeds coaching/AI surfaces, and matches activities to training blocks. Every one of those is named in the list above. **The next gate is a written answer from Strava**, not code.

Primary policy sources:

- [Strava API Policy](https://www.strava.com/legal/api_policy)
- [Strava API Agreement](https://www.strava.com/legal/api)
- [Strava developer rate limits and review process](https://developers.strava.com/docs/rate-limits/)

## Desired source and activity model

Provider authority and activity modality must be **separate concepts**. This is the single most important design decision and it is also a correctness fix worth making independent of Strava (see "Repository seams" below).

- `source` / provider provenance: `concept2`, `strava`, `erg_link_live`, `manual`
- `activity_kind` / normalized modality: `row`, `run`, `ride`, `swim`, `hike`, `strength`, `ski`, `other`
- training-block rollup: `erg`, `cross_training`, `strength`, `support` — **derived for planning views only**, never used as the stored activity type

Rowing/erg classification must come from `activity_kind`, never from "not manual" or "imported."

### Reconciliation: provenance-first, not sport-type-first

Concept2 is authoritative whenever an activity exists in Concept2, **regardless of machine or workout type** — RowErg, BikeErg, SkiErg, StrengthErg, and future Concept2 types.

> **Note on a superseded approach.** An earlier draft proposed simply rejecting Strava `Rowing` and `VirtualRow` by sport type. That is **insufficient**: Concept2 BikeErg and SkiErg sessions surface on Strava under *non-rowing* sport types (`Ride`, `NordicSki`, etc.), so sport-type filtering alone cannot prevent duplicates. Use provenance-first reconciliation instead.

Reconciliation sequence:

1. Identify the provider activity and look for an existing Concept2 identity or a high-confidence Concept2 match (same user, start time within a small tolerance, similar duration/distance).
2. If Concept2 exists, retain the Concept2 workout as canonical; link or suppress the Strava representation.
3. If an unmatched Strava activity remains, preserve its specific normalized `activity_kind` (`run`, `ride`, ...).
4. Map that kind to a rollup category (`cross_training`, `strength`) **only** in training-block views.
5. If Strava arrives first and Concept2 arrives later, upgrade the canonical workout to Concept2 **without losing the Strava identity** needed for later update/delete handling.
6. Strava vs. manual: identify possible duplicates conservatively and ask the user to merge — never silently replace a manual record.

## What the Strava API can supply

Supported sport types include `Rowing` and `VirtualRow` plus non-rowing types such as `Run`, `TrailRun`, `VirtualRun`, `Ride`, `MountainBikeRide`, `GravelRide`, `VirtualRide`, `EBikeRide`, `Hike`, `Walk`, `Swim`, `NordicSki`, `Elliptical`, `Workout`, `HighIntensityIntervalTraining`, and `WeightTraining`. Use `sport_type` as the discriminator with a defensive legacy fallback to the deprecated `type`. See the [API reference](https://developers.strava.com/docs/reference/) and [changelog](https://developers.strava.com/docs/changelog/).

Summary/detail activity fields usable for a cross-training record:

- Strava activity `id` and upload `external_id`
- activity name and `sport_type`
- UTC and local start timestamps, timezone
- `distance` (meters), `moving_time` / `elapsed_time` (seconds)
- `trainer` / `manual` / `private` flags and recording device name
- average and maximum speed
- heart-rate summaries when recorded; `calories` and laps on detailed activities
- cadence and power where Strava supplies them (power summary fields are **ride-only**)

Optional [streams](https://developers.strava.com/docs/reference/) (`time`, `distance`, `velocity`, `heartrate`, `cadence`, `watts`) are **not guaranteed** for every activity and are not equivalent to Concept2 interval/stroke data. All sensor fields must be nullable. Do not infer `trainer: true` means indoor rowing — it only means a training machine was used. An MVP should use summaries and fetch detail/streams only when a feature actually needs them.

## Authentication and incremental sync

Strava uses OAuth 2.0. Request the smallest sufficient scope:

- `activity:read` — activities visible to Everyone/Followers, excludes privacy-zone data.
- `activity:read_all` — adds Only-You activities and privacy-zone data. Request only if importing private activities is an explicit requirement.
- `activity:write` — not needed.

Athletes can decline requested scopes, so the callback must compare granted `scope` against required scopes and show a precise limited-access/reconnect state. Verify `state` in the flow. Access tokens expire after six hours; a refresh returns a new access token and **may rotate the refresh token**, invalidating the previous one immediately. Token refresh must be **server-side and atomic**, and concurrent sync/webhook workers must coordinate rather than race the same old refresh token. Disconnect should revoke via `POST /oauth/revoke` (the method Strava recommends from June 1, 2026 and the only supported one from June 1, 2027). See [authentication](https://developers.strava.com/docs/authentication/).

History comes from `GET /athlete/activities` (`before`, `after`, `page`, `per_page`; default page 30). Ongoing updates should use the [Webhook Events API](https://developers.strava.com/docs/webhooks/): one app-level subscription covers all authorized athletes; acknowledge within two seconds, durably record the event, then fetch and process asynchronously and idempotently. Events cover activity create/delete, limited update metadata (title/type/privacy), and athlete deauthorization — the event is a notification, not the full activity, and one user action can emit multiple events. Under `activity:read`, a visible→Only-You change arrives as a *delete* and the reverse as a *create*; this must drive local visibility/deletion, not just a metadata refresh.

## Rate limits, capacity, and cost gate

Strava applies both 15-minute and daily limits per application (published defaults: 200 overall / 15 min, 2,000 / day; separate read limit 100 / 15 min, 1,000 / day). Usage is in `X-RateLimit-*` / `X-ReadRateLimit-*` headers; excess returns `429`. Strava explicitly names activity polling as a common cause of exhausted limits and recommends webhooks.

Capacity path — **this is a business gate, not just engineering**:

- New apps start at capacity 1 (Single Player Mode).
- A configured app can self-upgrade to capacity 10.
- **More than 10 athletes requires Strava review**, which asks for screenshots of every place Strava data appears plus the "Connect with Strava" control; approval and higher limits are not guaranteed.
- **Creating a developer app currently requires a Strava subscription**, and Standard Tier apps are subject to Strava subscription requirements.

The new `https://api-v3.strava.com` base URL is scheduled for January 4, 2027, so keep the base URL configurable. See [rate limits](https://developers.strava.com/docs/rate-limits/) and [getting started](https://developers.strava.com/docs/getting-started/).

## Deauthorization, deletion, and retention

Provenance and deletion cascades are required from the first release, not retrofitted:

- A webhook athlete event with `authorized: false` means the athlete revoked the app — stop sync immediately and delete the integration tokens.
- If a user deletes a Strava activity, stop displaying the corresponding data within **48 hours**.
- On user request, revocation, account deletion, API-use cessation, or agreement termination, permanently delete Strava data **and personal data derived from it** within an outside limit of **30 days**; Strava may require written certification, and the app must confirm successful deletion to the user.
- Purging only `raw_data` is **not sufficient** — derived workout rows, aggregates, training-block matches, and cached metrics are all within the deletion language.

Ordinary cache retention is limited to seven days with no persistent index. See [API Policy](https://www.strava.com/legal/api_policy) §§2.5, 5.5, 6.2, 6.3, 7.4 and [webhook deauthorization](https://developers.strava.com/docs/webhooks/).

## Repository seams that must change

The existing `workout_logs` row already carries most summary fields (source, external ID, workout type, timestamps, distance, duration, heart rate, calories, watts, raw JSON). But several paths assume "not manual ⇒ Concept2 ⇒ erg" and would **silently mis-classify** Strava cross-training:

- `src/services/workoutService.ts` — `viewableSources` is hardcoded to `['concept2', 'erg_link_live', 'manual']`; a Strava source is invisible until added here.
- `src/utils/trainingBlockMatching.ts` (`normalizeLogSource`, ~L64) — maps every non-`manual` source to `'concept2'`.
- `src/utils/trainingBlockCalculations.ts` (`estimateLogCategory`, ~L82) — `if (log.source === 'concept2') return 'erg'`, so a naive `strava` log would be classified as **erg** and corrupt block completion/volume.
- `external_id` is the global upsert conflict key — provider IDs must be namespaced. Prefer a provider-identity table with a uniqueness constraint on `(user_id, source, external_id)`, or a `strava:<activity_id>` qualified key.
- `c2_sync_jobs.source` is constrained to `concept2`. Strava history/webhook sync must use a **separate job path** (or a deliberately generalized provider-sync model), not be forced through the Concept2 worker — its OAuth refresh, webhook lifecycle, sport filtering, deletion, and retention obligations all differ.
- Detail views assume stored raw data has Concept2's shape. Strava needs a provider adapter or a provider-neutral workout-detail model.
- Keep Strava data **out of coaching/team views and analytics** until Strava explicitly approves those uses — the policy says a user's Strava data may be shown only to that user.

> **The `source`/`activity_kind` separation is worth doing on its own merits.** It is a latent correctness bug today (anything that ever adds a non-Concept2, non-manual source inherits the erg mis-classification). Fixing it behind the current behavior does not depend on Strava approval and de-risks any future provider.

## Non-Strava fallback (likely the real near-term answer)

Because the API path is policy-blocked, the pragmatic MVP for cross-training is almost certainly **outside the Strava API entirely**:

1. **Manual cross-training entry** — extend the existing manual-log path to capture `activity_kind`, duration, distance, and optional HR. No third-party terms, ships now.
2. **User-driven file import (GPX / FIT / TCX)** — the athlete exports their own file from any platform and uploads it. Because there is no Strava API relationship, Strava's caching/analytics/AI restrictions do not apply. This still needs its own terms review for whatever formats/services are involved, but it is a fundamentally different (and lighter) legal posture than the API.

These two cover the actual product goal — "a non-Concept2 activity feed where each activity keeps its real type" — without the policy wall. Size these before committing to the API route.

## Foundry / automation fit

If this ever becomes a feature plan under readyall-foundry, **Phase 0 (written Strava approval) is an external human/legal action the sequencer cannot drive or verify.** It must be a manual precondition held *outside* the ledger — not slice #1. Otherwise the outer loop will build Phases 1–2 against a policy that forbids shipping them, producing green PRs for un-shippable code. Do not promote this to the sequencer until the external gate has cleared.

## Conditional implementation plan

Proceed past Phase 0 **only** if Strava confirms in writing that the intended storage, combination, analytics, and AI use are permitted.

### Phase 0: policy clearance (external, blocking)

Send Strava (`developers@strava.com`) a concise architecture description and ask for written confirmation covering:

- persistent storage of an authenticated user's own activity summaries;
- display and analysis **for that same authenticated user**;
- combining the user's Strava cross-training with their own Concept2 history;
- training-block completion and workload calculations;
- **whether any Logbook Companion AI or coaching feature may receive or derive from Strava data** (§5.3 — call this out explicitly);
- provider-identity retention for deduplication and webhook deletion handling.

### Phase 1: single-athlete technical spike (only if permitted)

Server-side, one athlete, read-only: OAuth callback + rotating-token persistence; narrow recent-history fetch; normalized `sport_type` → `activity_kind` mapping; provenance-first reconciliation against **all** Concept2 types; no geographic fields and no streams initially; explicit disconnect and provider-data deletion. Single Player Mode is a spike, **not** approval for production retention.

### Phase 2: durable integration (only after clearance + spike validation)

Webhook receiver + async idempotent processing; provider-identity records and uniqueness constraints; create/update/delete/deauthorization/revocation handling; `source` and `activity_kind` independent across dashboard, search, detail, analytics, and training blocks; attribution, privacy disclosure, consent withdrawal, export/access, deletion confirmation; Concept2 preserved as canonical on every resolved duplicate.

## Feasibility matrix

| Question | Finding |
|---|---|
| Can the API identify runs, rides, and other cross-training? | Yes — `sport_type` has specific run/ride/virtual/cross-training values. |
| Distance and duration? | Yes, meters and seconds. |
| Heart rate, cadence, power? | Stream schema supports them, but presence is source-dependent; power summary fields are ride-only. |
| Can rowing stay on Concept2? | Yes — via provenance-first reconciliation (not sport-type filtering alone). |
| Can ongoing sync avoid polling? | Yes — one app-level webhook subscription + async fetch. |
| Can Logbook Companion persist Strava history today? | **No** under the published policy — 7-day cache, persistent-storage, analytics, cross-data, and AI-application rules all block it. |
| Can it start small technically? | Yes for a transient spike: capacity 1 → self-serve 10 → review beyond 10. |
| What is the next gate? | **Written Strava confirmation** for the durable-history + analytics + AI use case. |

## Official sources

- [Authentication, scopes, token refresh, revocation](https://developers.strava.com/docs/authentication/)
- [API reference: activities, models, sport types, streams](https://developers.strava.com/docs/reference/)
- [Webhook Events API](https://developers.strava.com/docs/webhooks/)
- [Rate limits, athlete capacity, review](https://developers.strava.com/docs/rate-limits/)
- [Strava API Policy (June 1, 2026)](https://www.strava.com/legal/api_policy)
- [Strava API Agreement (June 1, 2026)](https://www.strava.com/legal/api)
- [Strava API Brand Guidelines](https://developers.strava.com/guidelines/)
- [Strava V3 API changelog](https://developers.strava.com/docs/changelog/)
