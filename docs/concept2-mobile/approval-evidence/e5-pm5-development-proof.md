# E5 PM5 projection development proof

Date: 2026-09-21
Environment: Concept2 development (`log-dev.concept2.com`)
Operator: authenticated LC staging user

## Exercised

1. Server-owned PM5 fixed 2,000 m projection fixture, including fixed splits and stroke data.
2. Server-owned PM5 8 × 500 m projection fixture, including intervals, rests, and per-interval-reset stroke data.
3. Server-owned deliberately malformed stroke-data fixture.

All payloads passed through the fenced `c2_development_publish_operation`; the browser could select only named server-owned fixtures and could not supply an arbitrary result payload.

## Observed outcomes

- Fixed 2,000 m: Concept2 development accepted the result. LC performed exact-ID read-back with embedded strokes and reported field-for-field projection parity.
- 8 × 500 m: Concept2 development accepted the result. LC performed exact-ID read-back with embedded strokes and reported field-for-field projection parity.
- Invalid stroke data: Concept2 development rejected the result; it was not published.
- Exact-ID read-back persisted provider-owned `verified` and `ranked` values without rewriting LC origin evidence.

The operator confirmed all three expected outcomes in the staging UI. Provider result IDs were intentionally not copied into this repository.

## Boundary

This proves the development API projection and rejection path. It is not physical PM5, installed-mobile, production API, verified-result, or ranked-result proof. E6 remains blocked on device access.

Rollback: [E5 PM5 projection development rollback](e5-pm5-projection-rollback.md).
