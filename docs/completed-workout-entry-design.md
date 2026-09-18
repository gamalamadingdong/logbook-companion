# Add completed workout: product and data design

Status: approved design, 2026-09-17. The first manual-entry implementation is in progress on `feature/general-completed-workout-flow` as of 2026-09-18. It does not enable Concept2 production publishing or claim that a manual result came from a PM5.

## Purpose

A person can record what they actually did in LC, with or without an active training block, a planned workout, or a connected device. A simple session should take a few inputs. A detailed interval session should retain every entered work and rest segment. The same saved workout can later receive device evidence or an explicit, eligible Concept2 publication without changing its original identity.

This is a general LC workflow. Indoor rowing, ski erg, bike erg, running, and other activities belong in it. Equipment is separate from activity: an indoor row may use a Concept2 RowErg, another erg, or unspecified equipment. LC supports the record even when no provider accepts it.

## User flow

1. **Enter anywhere.** A persistent `Add completed workout` action opens a dedicated, directly linkable page. The Dashboard and a planned workout can also open it. It never requires training-block enrollment.
2. **Choose the activity.** Offer common choices first: Indoor row, Ski erg, Bike erg, Run, and Other. Keep a search/expanded choice for existing LC activity categories rather than forcing them into one of these five. Choosing equipment is optional; a named Concept2 machine is an explicit choice, not inferred from the activity.
3. **Start blank or from a plan.** A chosen planned workout or pasted RWN pre-fills an editable structure and any useful title. The person may change it because the result describes what happened. Starting blank is the default quick path. A plan link remains provenance even when the actual workout differs.
4. **Enter the result.** Show local date/time, the activity's useful primary measurements, and an optional note. Distance and duration appear for ergs/runs; sport-appropriate labels replace rowing-specific `split` or `stroke rate` labels. Allow an incomplete or stopped-early result to be saved with its truthful status; do not silently call it a completed prescribed piece.
5. **Expand detail when useful.** `Add intervals or splits` opens an ordered list of work and rest cards. Each work card can be distance, time, calorie, or other supported target kind and holds the *measured* distance, work time, and relevant optional metrics. Different cards may use different kinds. The UI offers add, duplicate, repeat, reorder, and delete. A warmup or cooldown is just another labeled work segment. A user can also save a summary without segment detail.
6. **Review and save in LC.** Show the summary and any mismatch between it and entered segments before saving. If the segments cover the whole session, calculate totals from them; if they cover only part, explicitly mark them as partial detail and retain the separately entered session total. Show field-level errors and save progress. Successful save opens the LC workout detail with a clear saved state.
7. **Publish separately.** Only an eligible completed Concept2 workout shows a Concept2 publication action on the saved detail page. The action explains which result will be sent and requires an explicit user choice. All other activities remain normal LC workouts. LC preserves the result's own source and detail after provider read-back.

### Example: quick entry

`Indoor row` → `Concept2 RowErg` → `5,000 m`, `20:10`, local finish time → Save. Optional watts, calories, stroke rate, heart rate, effort, and notes live under `More details`. An absent metric is unknown, not zero or a calculated PM5 measurement.

### Example: variable intervals

`Run` → `Add intervals or splits` → warmup `10:00 / 1.8 km`; work `400 m / 1:32`; rest `1:00`; work `800 m / 3:12`; cooldown `8:00 / 1.4 km` → review totals → Save. The same editor also handles an indoor row with mixed distance and timed work, different rest lengths, or an early stop. It does not need to force that session into a fixed-distance or fixed-time label.

## Interaction decisions

- One dedicated responsive page, with a short summary visible first. The interval editor expands within it. Small screens use stacked cards, large touch targets, and a save action reachable with the keyboard open. Avoid a wide interval grid on phones.
- Optional measurements appear by activity and equipment. Keep common fields short; avoid an all-sports form full of empty rowing fields.
- Time and distance inputs accept familiar display formats and normalize only on save. Date/time shows the user's local timezone and persists an unambiguous instant plus the selected timezone.
- Changing a planned structure changes the actual result only. Preserve the original plan link and prescription so planned versus completed can be compared.
- An edited LC record that was already published must show its publication snapshot/status. Editing LC must not silently update Concept2 or trigger a second POST.
- Saving a manual workout must not mark it as device-verified. Device and provenance labels must remain truthful.

## Data boundary

**Completed result** is broader than today's `CompletedWorkoutV1/V2` Concept2 publication inputs. Those existing types are provider-independent mapping inputs but currently cover supported RowErg publication shapes; they are not the complete activity catalog or manual-entry persistence contract.

Define a versioned LC completed-result object with:

- Stable LC workout UUID, owner, source, completion state, local timezone and actual finish instant.
- Activity category and optional equipment/machine identity as separate fields.
- Measured session totals and ordered measured segments, each with work/rest role, target kind when known, actual values, optional measured metrics, and an explicit detail-coverage flag.
- Optional plan/RWN/template/assignment links. RWN is a useful structure shortcut and prescription reference, not the required format for an actual result.
- Optional source evidence references and normalized samples for future ErgLink captures. Manual values must not be presented as PM5 telemetry.

`workout_logs` remains the LC identity and summary index. The first implementation must choose and document a versioned detail persistence location after inspecting current live schema/RLS. Keep its measured detail separate from external provider snapshots; do not overwrite it during Concept2 import. Top-level summary columns should be derived consistently from the saved result. For large ErgLink telemetry, use a referenced source-evidence store rather than stuffing a sample stream into a manual-entry form record.

The server alone normalizes an eligible saved LC result into the Concept2 mapper input. Eligibility is explicit by activity, equipment, completion status, evidence, supported result shape, account and environment. Current development evidence proves RowErg summary and synthetic interval shapes; it does not make every activity or every manual field publishable. Unsupported shapes still fail closed. Production remains disabled pending provider and operator approval.

## Reuse and constraints from the current app

- `src/services/workoutService.ts` already writes owned manual `workout_logs`, but its input is tied to Training Block modes and stores no ordered actual intervals. Keep that existing flow working while the general flow is introduced.
- `src/utils/workoutEntryClassifier.ts` and the coaching results UI can scaffold fixed distance/time and variable planned intervals. Reuse the parsing/scaffolding logic where it fits; the coaching modal's athlete/team persistence is a different workflow.
- `rwn/RWN_spec.md` is the workout-structure reference. Do not assume every valid RWN form is supported by today's entry classifier, and do not require RWN for freeform sessions.
- The development Concept2 fixture form remains a test surface, not the product entry architecture.
- Any database change follows live schema/RLS discovery and the repo migration guards. Shared Supabase is live even when the staging UI is used.

## Delivery slices and acceptance

1. **Domain and persistence:** versioned activity/result/segment validation, owned durable save/read/update, timezone and total reconciliation; preserve existing manual and imported records. Test mixed segment kinds, partial detail, invalid values, and ownership.
2. **General entry and detail:** reachable global action and direct route, activity-first quick entry, relevant fields, honest status, save feedback and a readable detail page for manual workouts. Verify phone width and keyboard behavior.
3. **Structured entry:** ordered variable work/rest editor; optional prefill from a plan/RWN; duplicate/reorder; visible total reconciliation. Include run and non-Concept2 erg examples in tests, not only RowErg. Release the general entry when this slice works, not as a RowErg-only form.
4. **Concept2 bridge:** normalize only eligible saved Concept2 equipment results on the server; exercise fixed and variable manual results against the development mapper and existing fenced publication state machine. Require explicit publication and exact-ID read-back. Keep other activities in LC without a publish button.
5. **ErgLink producer:** ingest trustworthy completed captures into the same LC result boundary while retaining raw evidence and retry identity. PM5 sample semantics and real aggregate/interval proof are separate gates.

The first usable release passes if a person without a training block can save and reopen a simple indoor row, a non-Concept2 erg, a run, and a variable interval session; can see precisely which details were saved; and cannot accidentally publish anything while entering or editing.

## First implementation slice (2026-09-18)

The new flow stores a versioned result under `workout_logs.raw_data.completed_result` with `source: general_manual_entry`. The existing `workout_logs` UUID remains the identity and its summary columns remain an index. Live schema and owner RLS were inspected; this slice needs no migration. It adds global/dashboard entry, activity-first quick entry, named Other activities, optional equipment, full or partial measured intervals, RWN target prefill, LC save/read/edit, and a dedicated saved-result view. No Concept2 write occurs in this entry flow.

The planned-workout picker and durable plan/assignment link are not in this slice; a pasted RWN is retained as plan text. The Concept2 eligibility/publication bridge and ErgLink capture producer are separate later slices. The responsive layout and touch targets were reviewed in code; an interactive phone/desktop browser review remains required before staging merge.
