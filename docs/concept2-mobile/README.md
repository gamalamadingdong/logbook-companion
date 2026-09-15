# Concept2 publishing and mobile delivery

Status: proposed specifications and bounded implementation plans, inspected 2026-09-15. No feature implementation, live schema changes, API approval, Apple registration, native build, or OTA validation is established by these documents.

## Start here / resume

1. Read the [roadmap](../logbook-concept2-mobile-roadmap.md) for product direction and deferred milestones.
2. Choose one independent track:
   - [Publishing specification and plan](publishing.md): owned completed workout → one manual Concept2 development publication → import into the original LC row.
   - [Mobile delivery specification and plan](mobile-delivery.md): LC Capacitor shell → GitHub Actions iOS archive → TestFlight → self-hosted Capgo/Vercel updates and rollback.
3. Read `AGENTS.md`, the newest [active context](../../working-memory/activeContext.md), and [system patterns](../../working-memory/systemPatterns.md). Inspect the referenced code again before implementing; file observations here are not live-service verification.
4. Resolve that track's prerequisites, then implement only its next unchecked task with focused tests. Record actual evidence and blockers beside the task; do not mark planned acceptance tests as passed.

The two track documents own first-release detail. The roadmap remains the architectural overview; its broad workout-type matrix and future automatic/native capture flow are not first-release gates. If details conflict, resolve them explicitly before implementation rather than silently expanding scope.

## Decisions already bounded

- Save durably to LC before publishing outward; retain ErgLink origin and rich data.
- First publishing action is manual, one completed fixed-distance row, normal/unverified, against Concept2 development. No automatic publishing or blind POST retries.
- Mobile follows ADR-004 (Capacitor), not React Native. Sam confirms ScheduleBoard's GitHub Actions native pipeline and self-hosted Capgo/Vercel updates are reliable in use. Adapt that pattern, not ScheduleBoard's identity, credentials, permissions, or entire dependency set.
- Appflow was retired for cost and must not be reintroduced. Historical Appflow instructions in ScheduleBoard are not the current delivery design.
- Apple/TestFlight work does not wait on Concept2 write approval. Native Concept2 OAuth still requires its own safe callback/token work; an archive-only milestone can precede that.
- Embedded PM5, force curves, automatic publication, trusted/verified results, bidirectional edits/deletes, generalized provider sync, and broad Android/machine expansion are later work.

## Smallest next decisions

| Track | Owner / evidence needed before proceeding |
|---|---|
| Publishing | Sam/operator confirms Concept2 application, development credentials and account; implementer obtains a consented, redacted actual capture and settles owned capture identity plus exact-ID import behavior. Production write approval remains unknown. |
| Mobile | Sam confirms Apple team/operator, LC bundle ID/app name, app record and permission to provision/sign/upload; implementer selects compatible versions and LC-owned test update endpoint. No Apple or Vercel account state was inspected. |
| Shared auth | Implementer removes browser-bundled client-secret use from the relevant OAuth/refresh path before native distribution or write enablement; operator assesses rotation if a deployed bundle exposed a secret. Do not read or copy secret values. |

## Handoff discipline

Keep delivery small: no generic job framework for one publication, no hardware integration to prove TestFlight. Code changes later require local Concept2/Edge Function/schema guards as applicable, focused regression tests, and explicit operator authorization for live changes. Commit/PR authorization for this documentation does not authorize implementation, deployment, approval emails, store submission, or merging.
