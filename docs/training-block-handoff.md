# Training Block Handoff

Last updated: July 7, 2026

## Goal

Integrate the 12-week rowing training block into Logbook Companion as a real product feature, not as a separate parallel logger. The training block should use the same workout log, Concept2 sync, RWN workout representation, team management, and coaching assignment concepts that already exist in the app.

The intended product direction is:

- Athletes can view the 12-week block, see the planned work for each week/day slot, and understand how their Concept2/manual logs satisfy the plan.
- Coaches can view the same block through Team Management, filter by athlete/team scope, and compare the block against existing team workout assignments.
- The plan should tolerate schedule shifting within a week. A workout is tied to a week and day slot, not morally tied to doing "Monday" on Monday.
- Every prescribed rowing workout should have an RWN representation generated through the `@readyall/rwn` package.
- Strength, core, warm-up, stretching, cross-training, and flush work should be visible as planned/supporting work even if the primary matching logic is initially rowing-focused.

## Current Implementation Status

The current stopping point is a persisted training block implementation with substantial frontend matching/review UX. Earlier local-only assumptions are obsolete: the repo now includes training block schema migrations and generated database types.

Verification at this stopping point:

- Focused training block tests passed.
- `npm run build` passed.

Implemented:

- Added shared training block types in `src/types/trainingBlock.types.ts`.
- Added a 12-week rowing training block template in `src/data/rowingTrainingBlockTemplate.ts`.
- Added template tests in `src/data/rowingTrainingBlockTemplate.test.ts`.
- Added plan/log alignment and summary helpers in `src/utils/trainingBlockCalculations.ts`.
- Added calculation tests in `src/utils/trainingBlockCalculations.test.ts`.
- Added the main UI in `src/pages/TrainingBlock.tsx`.
- Added athlete route `/training-block`.
- Added team member route `/team/training-block`.
- Added coach route `/team-management/training-block`.
- Added Training Block navigation in the main layout, team dashboard, coach dashboard, and coach nav.
- Added team-context support in the Training Block UI:
  - team/organization scope from `useScopedTeamScope`
  - athlete filter
  - team weekly snapshot
  - week/day slot alignment
  - team assignment loading for the selected week
  - selected-day team prescriptions
- Added persistent review overrides for logged workouts, with local fallback when database persistence is unavailable:
  - status
  - key session credit
  - strength status
  - planned day slot
- Added text marker parsing from workout notes:
  - `[tb:status:...]`
  - `[tb:key:...]`
  - `[tb:strength:...]`
  - `[tb:slot:...]`
  - `[tb:day:...]`

Product decisions reflected in the current code:

- The training block is integrated into Logbook Companion rather than built as a standalone logger.
- Concept2/manual `workout_logs` are the source of actual training work.
- RWN is the canonical representation for prescribed rowing sessions.
- RWN should not be treated as solved for strength, stretching, mobility, and other support work yet.
- Week number and day slot are the training-plan anchors; calendar dates define the week window.
- Team and coach workflows are first-class, even though no one is actively using the old coaching/team feature yet.
- Training block template/session persistence exists. Further schema changes should be conservative and driven by editing/customization requirements.

Not implemented yet:
- Automatic creation of team assignments from the training block.
- Assignment-to-plan matching beyond displaying team assignments beside plan days.
- RWN support-work extensions for strength, core, stretching, and mobility.
- Rich Pete Plan progress screen.
- CSV export for training block summaries.
- Zone distribution summaries.
- Strength adherence summary metrics beyond basic visible status support.
- Coach plan editing or alternate block creation.
- Mobile-first daily quick-entry workflow.

## Plan

### Phase 1: Stabilize Current Local Feature

Status: complete for the current stopping point.

- Keep the 12-week block as a local template.
- Keep all planned rowing sessions represented as RWN strings.
- Use Concept2/manual `workout_logs` as the source of actual work.
- Summarize progress by week and by day slot.
- Allow schedule shifting through slot-based alignment and persisted review overrides, with local fallback when needed.
- Surface strength/core/warm-up/stretching/flush guidance in the planned day view.

### Phase 2: Integrate Team And Coaching Context

Status: complete as frontend integration, not yet persisted as a deeper model.

- Treat `/team/*` and `/team-management/*` as team contexts.
- Load athletes in the scoped team/org view.
- Support all-athletes and single-athlete training block views.
- Load `group_assignments` for the selected week.
- Display team assignments beside the training block so coaches can compare current team planning with the prescribed block.
- Add coach navigation and dashboard entry points.

### Phase 3: Tighten Matching And Scoring

Status: next recommended phase.

Recommended scope:

- Audit the current RWN representation before relying on it for all session families.
- Match team assignments to training block day slots when their template RWN/canonical structure corresponds to the planned session.
- Show whether a team assignment satisfies, modifies, or conflicts with the block prescription.
- Use `workout_logs` linked to assignments when available; otherwise fall back to Concept2/manual log matching.
- Make key session credit and strength adherence rollups more explicit.
- Add warnings for missed key sessions, excess weekly volume, and high perceived load.
- Keep using `@readyall/rwn`; do not manually parse workout specs in app code if the package can represent the workout.

Recommended order:

1. Inventory the planned session families and the RWN strings generated by `src/data/rowingTrainingBlockTemplate.ts`.
2. Remove the assumption that every non-rowing support session is correctly represented by a generic duration such as `30:00`.
3. Inspect how `group_assignments.workout_structure` and template RWN/canonical names are available in current assignment data.
4. Add a small matching helper that compares a training block planned session with a group assignment.
5. Surface assignment relationship status in `TrainingBlock.tsx`.
6. Add focused tests for the matching helper.

### Phase 3A: RWN Support-Work Decision

Status: investigation complete enough to plan; implementation not started.

Current RWN capabilities:

- Rowing prescriptions are well covered by distance/time/interval/variable structures.
- Warm-up and cooldown rowing blocks are supported through block tags such as `[w]10:00` and `[c]5:00`.
- Basic cross-training is partly supported through modality prefixes such as `Bike: 60:00`, `Ski: 30:00`, `Run: 45:00`, and `Other: 30:00`.
- Session orchestration supports `circuit(...)` and `rotate(...)`, but circuit items are opaque strings.

Current RWN gaps:

- No first-class `strength`, `mobility`, `stretching`, or `core` modality.
- No structured exercise prescription model for sets, reps, load guidance, sides, holds, or rest.
- No support-specific block types beyond `warmup`, `cooldown`, `test`, and `main`.
- `30:00` as a strength prescription is too generic and should be treated as a placeholder, not a correct canonical representation.

Recommendation:

- Do not force every support session into current RWN as bare duration.
- Use RWN immediately for rowing, flush rows, warm-up rows, cooldown rows, and simple bike/ski/run cross-training.
- Add `cross` as the preferred generic cross-training modality for deliberate non-rowing conditioning when the modality is intentionally broad.
- Keep `other` for unusual or unknown modalities; do not use `other` as the normal cross-training bucket.
- Update `@readyall/rwn` before using it as the canonical format for strength/core/stretching/mobility.
- The first RWN extension should add typed support-work structures, not just more app-specific string parsing in Logbook Companion.

Possible RWN extension shape:

- Add `cross`, `strength`, `mobility`, `stretching`, and `core` to supported modalities.
- Add support block types or tags for `strength`, `mobility`, `stretching`, and `core`.
- Add a structured circuit/exercise representation that can preserve:
  - exercise name
  - sets
  - reps or duration
  - optional side
  - optional rest
  - optional intensity/load guidance
- Preserve round-trip behavior through parser, serializer, and whiteboard renderer.
- Keep opaque `circuit(...)` support for backwards compatibility.

Training block implication:

- The current `strength_pull: '30:00'` and `strength_push: '30:00'` entries are placeholders.
- The current generic cross-training prescription should eventually become something like `Cross: 60:00` rather than `60:00` or `Other: 60:00`.
- Before Phase 3 matching treats support sessions as canonical, either update RWN or make `planned_rwn` rowing-only and add a separate structured support prescription field.
- Preferred path: update RWN so support work can still use the same parser/serializer/rendering package.

### Phase 4: Persist Training Block State

Status: started.

- Training block templates, template days, template sessions, enrollments, and log reviews exist.
- Review overrides are persisted for enrolled users, with local fallback behavior.
- Decide whether plan assignments are generated as `group_assignments`, linked to them, or represented as a separate plan-prescription layer.
- Preserve compatibility with Concept2 sync by treating synced logs as actual work that can be matched or reviewed.

Current template architecture decision:

- Training blocks are schedules made from planned sessions.
- Workout library templates are reusable workout definitions.
- `training_block_template_sessions.workout_template_id` is optional and should be used as a reusable identity/matching anchor, not as the entire scheduled prescription.
- Block sessions can still carry block-local `planned_rwn`, expected metrics, support prescriptions, instructions, role, family, and key-session flags.
- Support work should remain structured `support_prescription` until RWN and/or the library model supports strength/core/mobility/stretching cleanly.
- See `docs/training-block-template-architecture.md`.

### Phase 5: Planning And Authoring

Status: not started.

- Let a coach or athlete start a new block from a template.
- Support a Monday-snapped week start by default.
- Support alternate plans later, but keep the first block centered on the current 12-week Pete Plan variant.
- Add editing only after the review/matching model is stable.

## Updated Spec Relationship

`docs/rowing-training-logger-spec.md` is now a product specification for the Logbook Companion training block feature, not a standalone app spec. It still preserves the original training concepts, but its implementation sections now reflect the actual decisions made in this branch.

When the spec and this handoff differ, prefer this handoff for immediate engineering sequence and use the spec for product intent.

## Design Notes

The UI should stay operational and information-dense. This is a training and coaching tool, not a marketing page.

Important UX principles:

- The user should see "what was planned", "what was done", and "how it matched" in one place.
- Coaches should be able to scan a week across athletes quickly.
- Athletes should not be punished for moving a workout within the week.
- The app should make Concept2-imported work feel first-class rather than requiring manual re-entry.
- Strength and support work should be visible without forcing exhaustive exercise-level logging.

## Suggested Next Prompt

```text
Continue from docs/training-block-handoff.md and docs/rowing-training-logger-spec.md.

First inspect the current tests/build result if available. Then continue Phase 3: tighten training block matching and scoring. Focus on using RWN and existing workout log/assignment structures rather than adding schema until the matching model is clear.
```
