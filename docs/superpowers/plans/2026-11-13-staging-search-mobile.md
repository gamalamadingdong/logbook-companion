# Staging integration and mobile search

## Scope

Merge main `99224ec` into staging `58fc805`, retaining staging's development Concept2 auth, native PM5/manual workout handling, and OTA archive/trust configuration. The branches diverged and cannot be fast-forwarded. Existing dirty checkouts are preserved; work uses a separate staging-based worktree.

## Implementation

- Reuse main content search for workouts, enrolled blocks, accessible templates, active-team items, and page shortcuts.
- Add a mobile header search button; opening search closes navigation/account sheets. Navigation closes search.
- Keep input and footer visible while results scroll, use 44px touch targets and 16px input text, and fit the search sheet to visualViewport resize/scroll events for software keyboards.
- Preserve staging's richer workout reconstruction and enrollment reload behavior when resolving merge conflicts.
- Allow only a template_id metadata PATCH to a single explicit workout UUID through staging's write guard; retain result-write and production Concept2 fences.
- Port main production refresh fixes into staging's lazily loaded legacy module. Mock its credentials seam in production refresh tests instead of changing Vite credential masking.

## Verification

- Focused search/layout/modal/auth tests: 51 passed.
- Full app suite: 826 passed across 89 files.
- Sync contracts: 11 passed.
- Lint: zero errors; 115 existing warnings.
- Web build and mobile build: passed.
- Sentinel mobile bundle isolation: passed; no production OAuth/API endpoints, legacy refresh module, or sentinel credentials in assets.
- Native auth, Vite/Capacitor config, OTA settings, and iOS archive workflow retain staging versions.

Visual review and installed-device keyboard/safe-area checks remain pending because the browser runtime has no available browser. No native archive or OTA publication was requested or performed.
