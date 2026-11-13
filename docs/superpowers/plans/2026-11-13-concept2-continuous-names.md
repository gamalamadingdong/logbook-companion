# Concept2 continuous workout names

Approved scope: fix LC's interpretation of Concept2 splits, correct the user's affected saved labels, and leave the RWN library unchanged.

Continuous Concept2 modes are authoritative: fixed distance uses total distance, fixed time uses exact total duration, and JustRow keeps its total-distance label. Recorded splits remain raw detail, never repetitions. Actual interval workouts continue through the existing interval naming logic, including workouts with zero rest. Manual RWN overrides retain priority. No template merging, data deletion, auth changes, or schema changes.

- [x] Add regression coverage for continuous distance/time, true intervals, zero-rest intervals, overrides, and both stored-history and detail rendering.
- [x] Share the continuous-mode rule between client naming and the sync worker; apply it before interval/stroke inference and in name maintenance.
- [x] Run focused tests, full suite, lint, build, and edge-function contract checks.
- [x] Preview and correct only the affected user's unoverridden Concept2 labels/signatures and generated RWN notes. Preserve raw data, measurements, template links, and custom notes. Save before-values and verify the correction.
- [x] Compare deployed worker source to the repository before deploying the naming-only fix with the existing JWT mode; verify authentication without starting a sync.

Project fit: reuses existing canonical naming and RWN conventions; addresses incorrect history/grouping without changing templates or introducing new workout models.

Verification: 482 application tests and 11 edge contract tests pass; lint has 0 errors and 115 existing warnings; production build passes. The shared helper passes Deno type checking. The original and changed worker produce identical pre-existing standalone Deno SDK typing diagnostics (40 errors); local Deno runtime smoke verified OPTIONS 200, GET 405, and unauthorized POST 401.

Live receipt: run-c2-sync-batch deployed as version 14 with verify_jwt=true; retrieved source matches both uploaded files. Live OPTIONS returns 200 and unauthenticated POST returns 401. No authenticated sync job was started for verification.

The guarded data repair updated exactly 12 rows in the requesting user's account. All 12 labels, signatures, and generated notes match total distance. Hash comparison verifies every other workout field, excluding normal updated_at timestamps, is unchanged. Zero repeated-effort labels remain among the user's unoverridden continuous distance/time workouts. Baseline PR values/dates remain unchanged; normal update triggers invalidate cached pacing recommendations. Before-values, executed SQL, and guarded rollback SQL are saved outside git under /tmp/lc-continuous-name-repair*.
