# Training Block Template Architecture

Last updated: July 7, 2026

## Decision

Training blocks are schedules made from planned sessions. Workout library templates are reusable workout definitions.

A training block session may reference a `workout_templates.id`, but the training block session remains the scheduled prescription. The linked workout template is a reusable identity and matching anchor, not the entire training block session.

This gives us a hybrid model:

- Use workout library templates when a planned session is a reusable row/cross workout with history and trend value.
- Keep block-local fields for schedule-specific prescription details such as week, day slot, expected meters, target intensity, notes, and key-session status.
- Keep support work as structured training-block support prescription until RWN and/or the library model can represent strength, core, mobility, and stretching cleanly.

## Source Of Truth

Actual completed work:

- `workout_logs`
- Concept2 sync remains the default rowing path.
- Manual entries are a fallback/complement for cross-training, support work, and opt-in rowing logs.

Reusable workout definitions:

- `workout_templates`
- Used for recurring workout identity, library history, trends, and exact template matching.
- Best suited today for rowing prescriptions with canonical/RWN shape.

Training block templates:

- `training_block_templates`
- `training_block_template_days`
- `training_block_template_sessions`
- Used for scheduled block structure: week/day slot, order, family, role, expected metrics, support prescription, and block-specific instructions.

Review state:

- `training_block_enrollments`
- `training_block_log_reviews`
- Used for active/inactive enrollment and manual review overrides.

## Linking Rules

`training_block_template_sessions.workout_template_id` is optional.

Use it when:

- The planned session is a reusable library workout.
- The linked template has a canonical name and preferably valid RWN.
- Matching should count exact library-template links first.

Do not require it when:

- The session is block-specific.
- The session is support work.
- The session has a valid `planned_rwn` and does not need library history yet.

Avoid it for strength/core/stretching/mobility until the library/RWN model supports those as first-class prescriptions. For now, support work should use `support_prescription`.

## Editing Direction

When the app later supports editable/custom training blocks:

1. Let users assemble rows/cross sessions from `workout_templates` where useful.
2. Allow block-local sessions for one-off prescriptions.
3. Preserve copied block-specific fields even when a session links to a workout template.
4. If a linked workout template changes later, do not silently rewrite an existing training block session without an explicit refresh/relink action.
5. Treat template link mismatches as reviewable health warnings, not automatic data corruption.

## Matching Priority

Planned session to logged workout matching should prefer:

1. Explicit review override.
2. Exact `workout_template_id` / `template_id` match.
3. RWN/canonical signature match.
4. Same-week metric fallback.
5. Manual review.

This keeps workout-library history useful while still allowing training blocks to contain custom scheduled prescriptions.
