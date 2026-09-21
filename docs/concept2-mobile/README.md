# Concept2 publishing and mobile delivery

Status: development publishing covers fixed distance, fixed time, and interval shapes through the shared completed-workout mapper. Real PM5 connectivity, programming, capture-v1 summary semantics, and completed 100 m runs are hardware-proven. Published `@readyall/erglink@0.6.0` supplies durable stores, capture v2, validation, and crash recovery; LC now has exact Concept2 projection plus owner-bound local-first capture ingestion and retry/summary state in the current E4 branch. E5 development API proof is next. LC also includes Capacitor Android/iOS projects and unsigned native CI. Installed-app authentication, physical capture-v2 proof, signing, and distribution remain.

## Start here / resume

**Current state:** Read the [active context](../../working-memory/activeContext.md), then the [PM5 evidence pipeline](pm5-evidence-pipeline.md). E0–E4 are merged. E5's development-only fixture fence and Edge Function are deployed; the authenticated fixed/interval/invalid fixture run is the final pre-device gate. The [storage audit](capture-storage-audit.md) retains the broader evidence and persistence boundary. The [development publishing handoff](resume-publishing.md) retains earlier rollout detail; check dates before acting on its next steps.

Current implementation: [development auth](staging-auth-slice.md), followed by [isolated development read-sync](development-sync-slice.md). Use these handoffs for rollout/current verification rather than treating the original proposed plans below as implementation status.

API background: [official Concept2 Logbook API documentation snapshot](concept2-logbook-api-reference.md). This searchable Markdown capture covers OAuth, scopes, result reads/writes, bulk results, intervals, targets, strokes, metadata, webhooks and error behavior. Recheck the linked live source before relying on it for provider behavior.

Data boundary: [completed result storage and capture audit](capture-storage-audit.md) records the current LC, ErgLink, PM5, and Concept2 evidence and next integrity checks. The [LC → RWN → PM5 programming boundary](pm5-programming-boundary.md) records the implemented local delivery/acknowledgement path and remaining installed-device matrix.

Evidence pipeline: the [PM5 evidence pipeline](pm5-evidence-pipeline.md) records the field-level contract from PM5 notifications through capture, validation, LC ingestion and the Concept2 splits/`stroke_data` payload, plus the ordered pre-device work. Mobile surface: the [mobile UX foundation](../mobile-ux-foundation.md) records the athlete flow, navigation and route-by-route adaptation classification.

Production-write approval: [evidence matrix](approval-evidence/README.md) and [requirements-inquiry draft](approval-evidence/requirements-inquiry-draft.md).

1. Read the [roadmap](../logbook-concept2-mobile-roadmap.md) for product direction and deferred milestones.
2. Choose one independent track:
   - [Publishing specification and plan](publishing.md): capture evidence → canonical completed workout → shared Concept2 mapper/publisher → exact-ID import; development fixed distance, fixed time, and interval examples have been proven.
   - [Mobile delivery specification and status](mobile-delivery.md): merged LC Capacitor shell and unsigned native CI → installed-device authentication/PM5 proof → signing/TestFlight/Play delivery → self-hosted Capgo/Vercel updates and rollback.
3. Read `AGENTS.md`, the newest [active context](../../working-memory/activeContext.md), and [system patterns](../../working-memory/systemPatterns.md). Inspect the referenced code again before implementing; file observations here are not live-service verification.
4. Resolve that track's prerequisites, then implement only its next unchecked task with focused tests. Record actual evidence and blockers beside the task; do not mark planned acceptance tests as passed.

The two track documents own first-release detail. The roadmap remains the architectural overview; its broad workout-type matrix and future automatic/native capture flow are not first-release gates. If details conflict, resolve them explicitly before implementation rather than silently expanding scope.

## Decisions already bounded

- Save durably to LC before publishing outward; retain ErgLink origin and rich data.
- The manual fixed-distance form proved the seam; it is not the expansion architecture. Manual and ErgLink records normalize into one server-owned publication core. No automatic publishing or blind POST retries.
- Mobile follows ADR-004 (Capacitor), not React Native. Sam confirms ScheduleBoard's GitHub Actions native pipeline and self-hosted Capgo/Vercel updates are reliable in use. Adapt that pattern, not ScheduleBoard's identity, credentials, permissions, or entire dependency set.
- Appflow was retired for cost and must not be reintroduced. Historical Appflow instructions in ScheduleBoard are not the current delivery design.
- Apple/TestFlight work does not wait on Concept2 write approval. Native Concept2 OAuth still requires its own safe callback/token work; unsigned compilation is proven but installed-app authentication remains.
- Direct local PM5 programming is implemented. PM5 completed-capture ingestion, force curves, automatic publication, trusted/verified results, bidirectional edits/deletes, generalized provider sync, and additional monitor families are later work.

## Smallest next decisions

| Track | Owner / evidence needed before proceeding |
|---|---|
| Publishing | Sam/operator confirms Concept2 application, development credentials and account; implementer obtains a consented, redacted actual capture and settles owned capture identity plus exact-ID import behavior. Production write approval remains unknown. |
| Mobile | Unsigned Android and iOS simulator builds pass in GitHub Actions. Sam/operator still provides a physical Android device or emulator workflow, Apple team/app/signing state, installed-app auth/deep-link registrations, and later release/OTA approvals. No store or signing account state was inspected. |
| Shared auth | Implementer removes browser-bundled client-secret use from the relevant OAuth/refresh path before native distribution or write enablement; operator assesses rotation if a deployed bundle exposed a secret. Do not read or copy secret values. |

## Handoff discipline

Keep delivery small: no generic job framework for one publication, no hardware integration to prove TestFlight. Code changes later require local Concept2/Edge Function/schema guards as applicable, focused regression tests, and explicit operator authorization for live changes. Commit/PR authorization for this documentation does not authorize implementation, deployment, approval emails, store submission, or merging.
