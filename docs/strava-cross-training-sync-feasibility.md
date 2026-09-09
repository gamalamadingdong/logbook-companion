# Strava Cross-Training Sync Feasibility

**Researched:** 2026-09-09  
**Scope:** Import an athlete's non-rowing Strava activities, especially runs and rides, alongside the existing Concept2 rowing sync.  
**Sources:** Current official Strava developer documentation and policies only.

## Bottom line

The Strava API can technically supply the activity types and measurements needed for cross-training imports. It exposes activities such as `Run`, `TrailRun`, `Ride`, `MountainBikeRide`, `GravelRide`, `VirtualRide`, `EBikeRide`, `Hike`, `Walk`, `Swim`, `Elliptical`, `Workout`, and `WeightTraining`; it also exposes activity time, distance, heart-rate streams, cadence streams, and power streams when those measurements are present. [`sport_type` is the current discriminator; `type` is deprecated](https://developers.strava.com/docs/changelog/).

However, a durable Strava-to-Logbook-Companion import is a **no-go under the published June 1, 2026 API Policy unless Strava gives written approval or clarification for this use**. The policy says that Strava data may be cached for no longer than seven days, prohibits storing Strava data or derived data in a persistent index, prohibits analytics/analysis using Strava data, and prohibits combining Strava data with other customer data. Those rules conflict directly with storing runs and rides indefinitely in `workout_logs`, matching them to training blocks, combining them with Concept2/manual history, and including them in analytics. [Strava API Policy sections 5.4, 5.5, 6.2, and 6.4](https://www.strava.com/legal/api_policy).

Recommendation: ask Strava's Developer Program for written confirmation that Logbook Companion may persist an authenticated athlete's own run/ride history and use it for personal training history, training-block matching, and analytics before implementing schema or application changes. A one-athlete technical spike may use Strava's Single Player Mode, but it should remain transient and should not be treated as approval for production retention.

## Intended source boundary

Strava should be considered only for non-rowing cross-training. Concept2 should remain authoritative for erg and rowing sessions.

- Accept an explicit allowlist of non-rowing `sport_type` values. Start with `Run`, `TrailRun`, `VirtualRun`, `Ride`, `MountainBikeRide`, `GravelRide`, `VirtualRide`, `EBikeRide`, `EMountainBikeRide`, `Hike`, `Walk`, `Swim`, `NordicSki`, `RollerSki`, `Elliptical`, `Workout`, `HighIntensityIntervalTraining`, and `WeightTraining`, then make product decisions about the remaining supported types.
- Reject `Rowing` and `VirtualRow` before fetching detail/streams or creating a local workout. The official `SportType` enumeration includes both values. [Strava API reference](https://developers.strava.com/docs/reference/)
- Use `sport_type`, with a defensive legacy fallback to `type`, because Strava made `sport_type` the preferred field and deprecated `type`. [Strava API changelog](https://developers.strava.com/docs/changelog/)
- Do not infer that `trainer: true` means indoor rowing. It only indicates that an activity was recorded on a training machine. [Strava SummaryActivity model](https://developers.strava.com/docs/reference/)
- If a Strava activity is misclassified as a generic `Workout`, do not automatically merge it with a Concept2 row. At most, flag a same-user, same-time, similar-duration record for review.

This boundary eliminates the normal Concept2-to-Strava duplicate path: a Concept2 workout that also appears on Strava as `Rowing` or `VirtualRow` is ignored by the Strava importer.

## OAuth and token lifecycle

For a read-only import, request the smallest sufficient scope:

- `activity:read` reads the athlete's activities visible to Everyone or Followers and excludes privacy-zone data.
- `activity:read_all` additionally reads activities with visibility set to Only You and privacy-zone data. Request it only if importing private activities is an explicit product requirement.
- `activity:write` is not needed.

Athletes may uncheck requested scopes, so the callback must compare the granted `scope` value with the required scopes and show a precise reconnect/limited-access state. Strava also requires `activity:read` for activity webhooks. [Strava OAuth scope documentation](https://developers.strava.com/docs/authentication/)

The web flow redirects the athlete to `GET https://www.strava.com/oauth/authorize`. The callback receives a short-lived, single-use authorization code and the granted scope; the backend exchanges that code at the token endpoint using the client ID and client secret. The redirect URI must be within the app's configured callback domain, and the flow should use and verify `state`. [Strava OAuth documentation](https://developers.strava.com/docs/authentication/)

Access tokens expire after six hours. Refreshing returns an access token and a refresh token; the returned refresh token may rotate, and the previous refresh token becomes invalid immediately. Token refresh therefore belongs server-side and must update the stored token pair atomically. Concurrent sync/webhook workers should coordinate refreshes rather than racing with the same old refresh token. Store the exact granted scopes and expiry alongside the integration. [Strava token-refresh documentation](https://developers.strava.com/docs/authentication/)

Disconnect should revoke the token using `POST https://www.strava.com/oauth/revoke`, the method Strava recommends from June 1, 2026 and says will become the only supported deauthorization endpoint on June 1, 2027. Revoking either an access or refresh token revokes its associated tokens. [Strava deauthorization documentation](https://developers.strava.com/docs/authentication/)

## Activity endpoints and usable data

### Discovery and detail

`GET /athlete/activities` returns paginated `SummaryActivity` records and supports `before` and `after` epoch filters. The default page size is 30. With `activity:read`, Only You activities are filtered out; `activity:read_all` is required to include them. [List Athlete Activities](https://developers.strava.com/docs/reference/)

A sensible flow, if policy approval is obtained, would be:

1. Use the summary endpoint for a bounded initial backfill.
2. Filter by the non-rowing `sport_type` allowlist.
3. Fetch `GET /activities/{id}` only when detail such as calories or laps is needed.
4. Fetch `GET /activities/{id}/streams` only for measurements the product will actually use.

The summary/detail activity models provide the stable Strava activity `id`, upload-time `external_id`, `distance` in meters, `moving_time` and `elapsed_time` in seconds, start timestamps, timezone, device name, and manual/trainer flags. Detailed activities add fields including calories and laps. [Strava activity models](https://developers.strava.com/docs/reference/)

### Heart rate, cadence, and power

The streams endpoint can return `time`, `distance`, `heartrate`, `cadence`, `watts`, `moving`, velocity, elevation, and other series. Heart rate is documented in beats per minute, power in watts, distance in meters, and time in seconds. [Strava stream models](https://developers.strava.com/docs/reference/)

Availability is source-dependent, so all sensor fields must be nullable:

- A run or ride without a heart-rate sensor may have no heart-rate stream.
- Cadence is modeled generically as rotations per minute; the API documentation does not promise that every sport or recording source supplies it.
- The activity model documents summary `average_watts`, `max_watts`, weighted average watts, and kilojoules as ride-only fields. Do not rely on those summary fields for runs or other sports, even though the generic stream schema can represent watts.
- Strava does not expose Concept2's rich interval/stroke structure through the activity summary model. This reinforces the decision to keep Concept2 as the rowing source.

[Strava SummaryActivity and stream reference](https://developers.strava.com/docs/reference/)

## Webhooks versus polling

Use webhooks for ongoing sync and bounded polling only for initial backfill and repair. Strava explicitly recommends webhooks and identifies activity polling as a common cause of exhausted daily rate limits. [Strava webhooks](https://developers.strava.com/docs/webhooks/) and [rate-limit guidance](https://developers.strava.com/docs/rate-limits/).

One webhook subscription covers all athletes who authorized the application. Events cover activity create/delete and updates to title, type, and privacy, plus athlete deauthorization. The event is a notification containing IDs and limited update metadata, not the full activity, so a worker must fetch the current activity when needed. Some attributes update asynchronously and one user save can produce multiple events. [Strava webhook event documentation](https://developers.strava.com/docs/webhooks/)

The callback must return `200 OK` within two seconds. Strava retries failed deliveries up to three total attempts, so the callback should authenticate/validate the request, durably record the event, acknowledge immediately, and process asynchronously. Event processing must be idempotent. [Strava webhook delivery documentation](https://developers.strava.com/docs/webhooks/)

For an `activity:read` integration, a change from visible to Only You is delivered as a delete event, and the reverse is delivered as create. With `activity:read_all`, privacy changes arrive as updates. This must drive local visibility/deletion behavior, not merely metadata refresh. [Strava webhook privacy behavior](https://developers.strava.com/docs/webhooks/)

## Rate limits and application access

Strava applies both 15-minute and daily limits per application. The published default limits are 200 overall requests per 15 minutes and 2,000 per day, with a separate non-upload/read limit of 100 per 15 minutes and 1,000 per day. Limit and usage values are returned in `X-RateLimit-*` and `X-ReadRateLimit-*` headers; excess requests return `429`. [Strava rate limits](https://developers.strava.com/docs/rate-limits/)

New apps start with athlete capacity 1 (Single Player Mode). A configured app can self-upgrade to capacity 10; the dashboard describes that level as 200 read requests per 15 minutes/2,000 per day and 400 overall per 15 minutes/4,000 per day. More than 10 athletes requires Strava review, and approval or increased limits are not guaranteed. Review asks for screenshots of every location showing Strava data and the Connect with Strava control. [Strava athlete-capacity and review documentation](https://developers.strava.com/docs/rate-limits/)

The 2026 policy also describes Standard Tier applications with limits of 10 or 9,999 users and says Standard Tier applications are subject to Strava subscription requirements. Strava's getting-started guide says a Strava subscription is required to create an app. [Strava API Policy section 3.3](https://www.strava.com/legal/api_policy) and [Getting Started](https://developers.strava.com/docs/getting-started/).

If implementation eventually proceeds, monitor the response headers, budget detail/stream calls separately from summary calls, stop backfills before exhaustion, and resume from a persisted cursor. The new `https://api-v3.strava.com` base URL is scheduled to become available on January 4, 2027, so the base URL should be configurable rather than scattered through code. [Strava API changelog](https://developers.strava.com/docs/changelog/)

## Deauthorization, deletion, and retention

The app would need source-level provenance and deletion cascades from the first release:

- A webhook athlete event with `authorized: false` means the athlete revoked the app. Stop sync immediately and delete the integration tokens.
- If a user deletes a Strava activity, the app must stop displaying the corresponding Strava data within 48 hours.
- On user request, Strava revocation, Strava-account deletion, API-use cessation, or agreement termination, the policy requires permanent deletion of Strava data and personal data derived from it. The outside limit is 30 days, and Strava may require written certification. The app must also confirm successful deletion to the user.
- Purging only `raw_data` would not be sufficient. Derived workout rows, aggregates, training-block matches, cached metrics, and other records derived from the Strava activity are also within the policy's deletion language.

[Strava API Policy sections 2.5, 6.3, and 7.4](https://www.strava.com/legal/api_policy) and [webhook deauthorization events](https://developers.strava.com/docs/webhooks/).

The policy separately limits ordinary cache retention to seven days and prohibits a persistent index. That is the central blocker for treating Strava activities as permanent Logbook Companion workouts. [Strava API Policy sections 5.5 and 6.2](https://www.strava.com/legal/api_policy).

## Logbook Companion architecture implications

These are implementation recommendations only if Strava confirms the intended retention and analytics use in writing.

### Keep ingestion separate, normalize into the shared workout model

The repo's existing patterns support a Strava API adapter under `src/api/` and normalization before persistence. `workout_logs` already has fields suitable for cross-training summaries, including distance, duration, heart rate, calories, watts, `source`, `workout_type`, and `raw_data`.

Do not route Strava through the Concept2 sync job tables. The Concept2 job source is constrained to `concept2`, and Strava's OAuth refresh, webhook lifecycle, sport filtering, deletion, and retention obligations are different. Use a separate Strava integration plus sync/webhook job path, then converge only at a provider-neutral normalized workout service.

Do not copy the current Concept2 raw-data storage strategy. Even with written permission for durable normalized workout history, confirm whether raw payload retention is allowed and store only the minimum fields the approved use requires.

### Fix source semantics before adding data

Existing generic dashboard categorization can represent run/bike-like activities, but other current paths assume any non-manual log is Concept2 or treat Concept2 as erg. A naive `source = 'strava'` addition would therefore misclassify cross-training in training-block matching and views. Source and activity kind need separate semantics:

- `source`: `concept2`, `strava`, or `manual`.
- `activity_kind`: normalized sport such as `run`, `ride`, `swim`, `erg`, or `other`.
- Rowing/erg classification should come from `activity_kind`, never from “not manual” or “imported.”

### Use provider-qualified identity

The current Concept2 flow upserts on `external_id`. Strava also supplies a stable activity ID, but IDs from independent providers must not share an unqualified namespace. The durable uniqueness rule should be `(user_id, source, external_id)` or an equivalent provider-qualified key such as `strava:<activity_id>`.

For webhook retries and repeated backfills, fetch the current object and upsert by that provider-qualified activity identity. Do not create a new workout for each webhook event; Strava notes that one user action can emit multiple events.

Cross-provider reconciliation should be conservative:

- `Rowing` and `VirtualRow`: always exclude from Strava, leaving the Concept2 record authoritative.
- Non-rowing Strava versus Concept2: no reconciliation is normally needed because the sport boundary is disjoint.
- Strava versus manual: identify possible duplicates using same user, normalized sport, start time within a small tolerance, duration, and distance; ask the user to merge rather than silently replacing a manual record.
- Preserve the provider identity even after a user-approved merge so Strava update/delete events can find the affected local record.

### Keep Strava data out of coaching and analytics until explicitly allowed

The current policy says Strava data for a user may be displayed only to that user, not to other users, and prohibits analytics and combining Strava data with other customer data. Existing coach/team access, training summaries, and combined Concept2/Strava charts therefore need to exclude Strava-derived records unless Strava explicitly approves those uses. [Strava API Policy sections 2.3 and 5.4](https://www.strava.com/legal/api_policy).

The connect flow must disclose what is collected, how it is collected, how consent can be withdrawn, and how deletion can be requested; the app must provide support contact information and a lawful privacy policy. [Strava API Policy sections 2.1, 2.4, and 7.3](https://www.strava.com/legal/api_policy).

## Recommended decision sequence

1. Send Strava a concrete use-case request: “Import an authenticated athlete's own non-rowing runs, rides, and cross-training into a durable personal workout history; match those activities to a training plan; combine them with Concept2/manual workouts for the athlete's own analytics; optionally let a coach see them only with explicit athlete consent.”
2. Ask whether Strava will permit storage beyond seven days, derived normalized records, training-block matching, athlete-only analytics, cross-source combination, and optional coach display. Get the answer in writing.
3. If denied or unanswered, do not implement API-based durable sync. Keep Concept2 sync plus manual cross-training entry, and separately evaluate user-driven file import or direct recording-platform integrations; those alternatives require their own terms review.
4. If approved, implement a one-athlete, read-only spike with `activity:read`, a strict non-rowing allowlist, provider-qualified idempotency, server-side rotating-token storage, and explicit deletion behavior.
5. Validate real payload quality for representative runs, outdoor rides, indoor/virtual rides, and sensor/no-sensor activities before designing metrics around heart rate, cadence, or power.
6. Add webhooks only after the backfill/import contract is stable; then pursue capacity above 10 through Strava review.

## Feasibility matrix

| Question | Finding |
|---|---|
| Can the API identify runs, rides, and other cross-training? | Yes. `sport_type` has specific run, ride, virtual, and cross-training values. |
| Can it provide distance and duration? | Yes, as meters and seconds. |
| Can it provide heart rate, cadence, and power? | The stream schema supports them, but presence depends on the recording/upload source; ride summary power fields are ride-only. |
| Can rowing be kept on Concept2? | Yes. Reject Strava `Rowing` and `VirtualRow` before persistence. |
| Can ongoing sync avoid frequent polling? | Yes. Use one app-level webhook subscription and fetch changed activities asynchronously. |
| Can Logbook Companion persist Strava history today? | Not under the published policy as written. Seven-day cache, persistent-storage, analytics, and cross-data restrictions are blockers. |
| Can the integration start small? | Yes for a transient technical spike: capacity 1 initially, self-service to 10, review required beyond 10. |
| What is the next gate? | Written Strava confirmation/approval for the exact durable history and analytics use case. |

## Official sources

- [Authentication, scopes, token refresh, and revocation](https://developers.strava.com/docs/authentication/)
- [API reference: activities, activity models, sport types, and streams](https://developers.strava.com/docs/reference/)
- [Webhook Events API](https://developers.strava.com/docs/webhooks/)
- [Rate limits, athlete capacity, and review](https://developers.strava.com/docs/rate-limits/)
- [Strava API Policy, effective June 1, 2026](https://www.strava.com/legal/api_policy)
- [Strava API Agreement, effective June 1, 2026](https://www.strava.com/legal/api)
- [Strava API Brand Guidelines](https://developers.strava.com/guidelines/)
- [Strava V3 API changelog](https://developers.strava.com/docs/changelog/)

This document is a product and technical assessment, not legal advice. Strava's published policy can change, so it should be rechecked immediately before implementation or review submission.
