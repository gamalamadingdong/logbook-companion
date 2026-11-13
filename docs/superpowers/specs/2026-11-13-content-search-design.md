# Content search design

Approved in conversation on 2026-11-13. Replace the page-first command palette with grouped content search: owned completed workouts, personal enrolled training blocks and planned sessions (including support work), accessible workout/support templates, and active-team assignments/sessions (including permitted organization-wide workouts) plus coach roster results. Keep existing navigation shortcuts secondary.

Each row shows a title, type and context (date, totals, block/week/day, team). Exact title and notation matches rank ahead of broader text matches. Limit each group to six results with an explicit refinement hint when truncated. Search uses a 250 ms debounce, authenticated RLS-bound reads, explicit ownership/team filters, and independent group failures. Results from previous queries, identities or teams must never remain actionable. The team scope is the selected team, independent of an organization-wide dashboard filter.

Use the existing cmdk keyboard behavior inside the shared accessible Modal, with responsive sizing, Escape, focus restoration and loading/empty/error feedback. Add URL selection for training block enrollment/day/session, support templates, and athlete assignment destinations. Team members see owned assignments, shared team workouts and shared sessions; private coach notes are excluded. No migration or provider/auth configuration changes.

Verify query boundaries, ranking, literal search escaping, independent failures, deep-link selection and stale-response invalidation with focused tests, then lint, build and the full suite. Browser verification should exercise the dialog and routing where the available environment permits.
