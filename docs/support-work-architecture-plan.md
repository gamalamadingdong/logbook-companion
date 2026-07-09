# Support Work Architecture Plan

> Last Updated: 2026-07-09
> Status: Ready for product/design refinement; implementation should follow the completed training-block scheduling/config work

## Bottom Line

Strength, core, mobility, stretching, and other support work should become a lightweight support-prescription system linked into training blocks. It should not become an RWN variant, and it should not stay as opaque JSON embedded inside `training_block_template_sessions`.

The immediate goal is to preserve the current training-block architecture while making support work reusable, editable, and customizable at the enrollment level.

## Refinement After Scheduling Work

Training-block scheduling now supports active, paused, completed, and scheduled-future enrollments. That removes the main sequencing blocker.

The important follow-on design decision is that support completion should not be modeled as a fake workout log. `training_block_log_reviews` can continue to review real `workout_logs`, but support work needs its own completion table keyed by enrollment, scheduled date, and planned support session. This avoids reintroducing unmatched-workout warnings and keeps support completion out of distance totals.

## UX, Architecture, And App-Wide Review

The first implementation should be narrower than a strength-training product. It should formalize support prescriptions and support completion without building per-set history, progression analytics, or a custom plan builder.

UX boundaries:

- Planned support belongs in the training-block day, beside the prescription it satisfies.
- Completing planned support should not create a `workout_logs` row.
- Actual rowing and RWN-supported cross-training remain in the logged-workouts column, matching controls, and weekly distance totals.
- Standalone manual strength/support logs can remain available for extra work, but they should not be the persistence path for planned support checkoffs.
- The first completion UI should support `completed`, `modified`, `partial`, and `skipped`, with optional notes, minutes, RPE, and pain flag.

Architecture boundaries:

- Support templates are reusable prescription content.
- Training-block template sessions are schedule slots.
- Training-block support completions are enrollment-specific state.
- `training_block_log_reviews` remains review state for real workout logs only.
- `workout_templates` remains focused on rowing and RWN-supported workout prescriptions until support modalities have first-class representation.

App-wide boundaries:

- Do not mix support exercises into the current Workout Template Library editor yet.
- Do not generate `group_assignments` from support work yet.
- Do not extend RWN for support work in this slice.
- Keep support-template management admin/seed-driven until the athlete completion flow is stable.

## Current State

Training-block support work currently lives mostly inside:

- `training_block_template_sessions.source = 'strength'`
- `training_block_template_sessions.support_prescription jsonb`

That JSON can include:

- support kind
- title
- focus areas
- exercises
- sets and reps
- notes
- stretching or mobility lists

This was acceptable for initial seeding, but it is weak as a product foundation.

## Problems To Solve

- Support prescriptions are hard to edit without direct JSON mutation.
- Exercises are not reusable across templates.
- There is no first-class exercise library.
- Strength, core, mobility, and stretching do not have the same lifecycle as reusable rowing workout templates.
- Users cannot safely modify support work for their own block without changing the canonical published template.
- Completion tracking is too coarse and relies on notes or tags.
- Substitutions are not modeled.
- It is hard to audit or compare support prescriptions across training blocks.
- Support work cannot grow into a useful coaching surface while it remains embedded JSON.

## Product Boundary

Support work should not become RWN.

RWN should stay focused on rowing workout prescription. Support work has different primitives:

- sets
- reps
- holds
- sides
- rest
- load guidance
- substitutions
- movement patterns
- equipment constraints
- completion state
- modification notes

The right product concept is `support session`, not `row workout with a different parser`.

## Proposed Model

Keep `training_block_template_sessions` as the scheduling shell. Move support content into reusable support templates.

### `support_exercises`

Stores individual movements.

Suggested fields:

| Column | Purpose |
|--------|---------|
| `id uuid primary key` | Exercise id |
| `name text not null` | Exercise name |
| `category text not null` | `strength`, `core`, `mobility`, `stretching`, `prehab`, `recovery` |
| `movement_pattern text` | Hinge, squat, press, pull, carry, brace, rotate, etc. |
| `equipment text[]` | Barbell, dumbbell, band, bodyweight, machine, mat |
| `default_sets integer` | Optional default set count |
| `default_reps text` | Optional default rep prescription |
| `default_duration_seconds integer` | Optional default hold or timed work |
| `cues text[]` | Coaching cues |
| `contraindications text[]` | Optional warnings or avoid-if notes |
| `tags text[]` | Search and grouping tags |
| `status text not null` | `draft`, `published`, `archived` |
| `metadata jsonb not null default '{}'` | Extension point |
| `created_at timestamptz not null default now()` | Created time |
| `updated_at timestamptz not null default now()` | Updated time |

### `support_session_templates`

Stores reusable support prescriptions.

Examples:

- `Strength Pull`
- `Strength Push`
- `Core Stability 15`
- `Hip Mobility`
- `Recovery Stretch`
- `Shoulder Prehab`

Suggested fields:

| Column | Purpose |
|--------|---------|
| `id uuid primary key` | Support template id |
| `template_key text unique not null` | Stable seed/application key |
| `title text not null` | Display title |
| `kind text not null` | `strength`, `core`, `mobility`, `stretching`, `prehab`, `recovery` |
| `description text` | Short description |
| `estimated_duration_minutes integer` | Planned duration |
| `difficulty text` | `beginner`, `intermediate`, `advanced` |
| `focus text[]` | Focus areas |
| `instructions text[]` | Session-level guidance |
| `status text not null` | `draft`, `published`, `archived` |
| `metadata jsonb not null default '{}'` | Extension point |
| `created_at timestamptz not null default now()` | Created time |
| `updated_at timestamptz not null default now()` | Updated time |

### `support_session_template_exercises`

Stores ordered exercises inside a support session template.

Suggested fields:

| Column | Purpose |
|--------|---------|
| `id uuid primary key` | Row id |
| `support_session_template_id uuid not null` | Parent support template |
| `exercise_id uuid not null` | Linked movement |
| `sort_order integer not null default 0` | Display order |
| `sets integer` | Set count |
| `reps text` | Rep prescription |
| `duration_seconds integer` | Timed work or holds |
| `rest_seconds integer` | Rest guidance |
| `load_prescription text` | RPE, reps in reserve, percent, bodyweight, light/moderate/heavy |
| `side text` | `both`, `left`, `right`, `alternating`, if needed |
| `notes text[]` | Exercise-level instructions |
| `alternatives jsonb` | Optional substitution metadata |
| `metadata jsonb not null default '{}'` | Extension point |
| `created_at timestamptz not null default now()` | Created time |
| `updated_at timestamptz not null default now()` | Updated time |

### Link From Training Blocks

Add a nullable link from `training_block_template_sessions`:

```sql
ALTER TABLE public.training_block_template_sessions
ADD COLUMN support_session_template_id uuid
REFERENCES public.support_session_templates(id)
ON DELETE SET NULL;
```

Keep `support_prescription jsonb` temporarily as a compatibility fallback. New templates should use `support_session_template_id`.

## Enrollment-Level Customization

Users need to modify their actual assigned support work without mutating published templates.

Add a later override table:

### `training_block_support_session_overrides`

Suggested fields:

| Column | Purpose |
|--------|---------|
| `id uuid primary key` | Override id |
| `enrollment_id uuid not null` | User's training-block enrollment |
| `template_session_id uuid not null` | Scheduled block session |
| `support_session_template_id uuid` | Base support template |
| `scheduled_date date not null` | Date for the modified support work |
| `scope text not null` | `single_day`, `rest_of_block`, `entire_enrollment` |
| `override_payload jsonb not null` | Modified exercises, sets, reps, substitutions, notes |
| `status text not null` | `active`, `archived` |
| `created_at timestamptz not null default now()` | Created time |
| `updated_at timestamptz not null default now()` | Updated time |

This enables:

- replace deadlift with Romanian deadlift
- reduce 4 sets to 3
- add shoulder prehab
- skip a painful movement
- save a modification for today only
- save a modification for the rest of the block

## Completion Tracking

Support completion should be explicit but lightweight.

For v1, completion state should be session-level:

- `planned`
- `completed`
- `modified`
- `skipped`

Useful optional fields:

- completion notes
- perceived effort
- pain or discomfort flag
- minutes completed
- modified reason

Exercise-level completion can come later. It is not required for the first useful slice.

### `training_block_support_completions`

Support completions should be separate from `training_block_log_reviews`, because `training_block_log_reviews` requires a real `workout_log_id`.

Suggested fields:

| Column | Purpose |
|--------|---------|
| `id uuid primary key` | Completion id |
| `enrollment_id uuid not null` | User's training-block enrollment |
| `user_id uuid not null` | Owner for RLS and simple querying |
| `template_session_id uuid` | Linked planned session when loaded from persisted template rows |
| `planned_week_number integer not null` | Planned week |
| `planned_day_slot integer not null` | Planned day slot |
| `planned_session_key text not null` | Stable fallback key, for static/fallback plans |
| `scheduled_date date not null` | Actual date for the planned support session |
| `support_session_template_id uuid` | Linked support template, once support templates exist |
| `status text not null` | `completed`, `modified`, `partial`, `skipped` |
| `minutes_completed integer` | Optional duration actually completed |
| `perceived_exertion integer` | Optional RPE |
| `pain_flag boolean not null default false` | Whether discomfort was noted |
| `notes text` | User notes |
| `metadata jsonb not null default '{}'` | Extension point |
| `created_at timestamptz not null default now()` | Created time |
| `updated_at timestamptz not null default now()` | Updated time |

Suggested uniqueness:

```sql
UNIQUE (enrollment_id, planned_week_number, planned_day_slot, planned_session_key)
```

This gives one current completion state per planned support session. If later we want history/audit of multiple edits, add an event table rather than overcomplicating v1.

## Proposed Implementation Sequence

### Phase 0: Wait For Training-Block Scheduling

Status: complete.

The training-block schedule/configuration work now has clear semantics for:

- active block
- paused block
- completed block
- scheduled future block
- changing configuration without unexpectedly replacing the current block

### Phase 1: Inventory Current Support JSON

Deliverables:

- Enumerate all current `support_prescription` shapes in static data and migrations.
- Identify every seeded strength/core/stretching/mobility prescription.
- Decide the minimal normalized field set required to preserve existing content.

Acceptance criteria:

- Every current support prescription can map into the proposed support tables.
- No current training-block display loses information.

### Phase 2: Add Support Schema

Deliverables:

- Add `support_exercises`.
- Add `support_session_templates`.
- Add `support_session_template_exercises`.
- Add RLS consistent with current training-block/template visibility.
- Add generated TypeScript database types.

Acceptance criteria:

- Published support templates can be read by authenticated users.
- Seed/admin paths can create and update support templates.
- No current training-block behavior changes yet.

### Phase 3: Seed Existing Strength Work

Deliverables:

- Convert current `Strength (pull)` JSON into a support session template.
- Convert current `Strength (push)` JSON into a support session template.
- Seed exercises used by those sessions.
- Keep stable `template_key` values for idempotent seeding.

Acceptance criteria:

- Current Pete Block strength sessions can be represented without embedded JSON.
- Seed migration is idempotent.
- Existing JSON fallback still works.

### Phase 4: Link Training-Block Sessions

Deliverables:

- Add `training_block_template_sessions.support_session_template_id`.
- Update Pete Block strength template sessions to link to seeded support session templates.
- Update new additional training-block seeds to use links where support work exists.

Acceptance criteria:

- Training-block sessions can resolve support content through the linked support template.
- Sessions without a linked support template can still render legacy `support_prescription`.

### Phase 5: Update Rendering

Deliverables:

- Update Training Block support-session rendering to prefer `support_session_template_id`.
- Fall back to `support_prescription` for old data.
- Keep rowing/cross-training rendering unchanged.

Acceptance criteria:

- Current support UI looks the same or cleaner.
- No RWN, workout matching, or distance logic changes.
- Existing seeded blocks still render.

### Phase 6: Add Simple Support Completion

Deliverables:

- Add `training_block_support_completions`.
- Support session-level status: `completed`, `modified`, `partial`, `skipped`.
- Add notes and optional RPE/pain flag.

Acceptance criteria:

- User can mark a support session done without creating an erg workout log.
- Modified/skipped support work does not produce unmatched-workout warnings.
- Paused blocks still prevent writes, consistent with current training-block behavior.
- Support completions do not affect distance totals.
- Existing `training_block_log_reviews` remains for real workout logs only.

### Phase 7: Add Basic User Modifications

Deliverables:

- Add enrollment-level override storage.
- Let the user edit sets/reps or replace an exercise for a single scheduled support session.
- Offer scope choices only when the implementation is ready to honor them.

Acceptance criteria:

- A user's support modification does not mutate the published template.
- The original support template remains recoverable.
- The UI clearly distinguishes template content from user override content.

### Phase 8: Build Management UI

Deliverables:

- Add an admin/editor surface for support exercises.
- Add an admin/editor surface for support session templates.
- Add validation around categories, sets/reps, durations, and duplicate exercises.

Acceptance criteria:

- New strength/core/mobility/stretching prescriptions can be created without hand-editing SQL or JSON.
- Published support templates can be reused across multiple training blocks.

## Non-Goals

- No full strength-training app in the first slice.
- No RWN parser for support work.
- No progressive overload engine.
- No per-rep or per-set analytics.
- No automatic exercise substitution engine.
- No coach/team support assignment semantics until the individual workflow is stable.
- No distance, split, or rowing matching behavior changes.

## Risks

- Over-normalizing too early could slow down training-block work without improving the user experience.
- If overrides are added before scheduling semantics are clear, users may accidentally modify the wrong block instance.
- If support completion is modeled as workout logs, unmatched-workout and distance logic may regress.
- If legacy JSON fallback is removed too early, existing seeded data may fail to render.

## Recommended First Slice When Resumed

Do the smallest durable slice in two passes.

### Pass 1: Normalize Support Templates

1. Add the three support template tables.
2. Seed the existing `Strength (pull)` and `Strength (push)` prescriptions.
3. Add `support_session_template_id` to `training_block_template_sessions`.
4. Update rendering to prefer linked support templates and fall back to legacy JSON.
5. Do not add user editing until the linked-template read path is stable.

### Pass 2: Support Completion Without Workout Logs

1. Add `training_block_support_completions`.
2. Render a support-session completion control on planned support sessions.
3. Allow `completed`, `modified`, `partial`, and `skipped`.
4. Persist notes, RPE, minutes, and pain flag.
5. Keep this separate from `workout_logs`, distance totals, and log matching.

