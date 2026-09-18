# General Completed Workout Entry Implementation Plan

> **For agentic workers:** Execute the tasks in order with focused verification. The general LC entry must work before any Concept2 publication bridge is enabled.

**Goal:** Let a signed-in person save and reopen a simple or variable-interval completed workout for rowing, ski erg, bike erg, running, or another activity, without a training block or device.

**Architecture:** Persist a versioned, provider-independent manual result under the owned `workout_logs.raw_data` JSONB column and mirror its summary into existing indexed columns. Keep activity separate from equipment. The React entry page owns draft interaction state; pure functions validate/normalize it; a service owns Supabase persistence. A dedicated manual detail view displays the saved result. Concept2 projection stays server-side and is a later task.

**Tech Stack:** React 19, Vite, TypeScript, existing UI components/Tailwind tokens, Supabase `workout_logs`, Vitest.

## Global constraints

- Follow [the accepted design](../../completed-workout-entry-design.md). Save in LC first; no automatic Concept2 publication.
- Preserve existing Training Block manual logging and Concept2 import behavior.
- No DDL is required for this slice. Live `workout_logs` has `raw_data` JSONB, `duration_seconds`, `distance_meters`, owner RLS for SELECT/INSERT/UPDATE/DELETE, and `id` UUID primary key (MCP read on 2026-09-18). Keep a version tag on the detailed result.
- Phone entry must work at 320px, with stacked interval cards, visible field errors, and 44px controls. Use existing UI components and semantic color tokens.
- An entered value is manually reported. Never present it as PM5 telemetry or device verification.

## Task 1: Domain contract and validation

**Files:** Create `src/types/completedWorkoutEntry.ts`, `src/utils/completedWorkoutEntry.ts`, `src/utils/completedWorkoutEntry.test.ts`.

- [ ] Write tests for a summary-only run; a mixed distance/time interval erg result; partial detail; missing/invalid measurements; and summary/segment disagreement.
- [ ] Run `npx vitest run src/utils/completedWorkoutEntry.test.ts` and observe the expected missing behavior.
- [ ] Implement the versioned result, time parsing/formatting, total reconciliation, and validation. Distinguish work from rest time and complete from partial detail.
- [ ] Run the focused tests and commit the domain contract.

## Task 2: Owned persistence

**Files:** Create `src/services/completedWorkoutEntryService.ts` and focused tests; avoid changing the existing Training Block service contract.

- [ ] Write a test for the exact `workout_logs` insert projection from a validated result, including `source: manual`, activity, finish instant, timezone, summary columns, and versioned detail in `raw_data`.
- [ ] Verify the test fails, then implement projection and owner-scoped create/read/update methods with the typed Supabase client.
- [ ] Preserve the original LC UUID on edits; edit only general manual entries owned by the current user. Never modify an imported provider row through this service.
- [ ] Run focused tests and commit.

## Task 3: Entry page and navigation

**Files:** Create `src/pages/CompletedWorkoutEntry.tsx` and small interval editor components as needed; modify `src/App.tsx`, `src/components/Layout.tsx`, and Dashboard action placement.

- [ ] Add a protected direct route and a persistent `Add completed workout` action accessible on desktop and phone.
- [ ] Implement activity selection, optional equipment, local finish date/time, quick result fields, status, optional metrics/notes, and expandable ordered work/rest cards. Cards support add, duplicate, move, and remove without horizontal scrolling.
- [ ] Support RWN structure prefill where the current parser returns an entry shape. Keep entered actual values editable; do not fabricate measured results.
- [ ] Show a live total review and inline errors. Save once, show progress, and navigate to the saved LC detail route.
- [ ] Run build/lint, inspect 320px and desktop UI in a browser, fix any usability defects, and commit.

## Task 4: Saved detail and edit

**Files:** Create `src/pages/CompletedWorkoutEntryDetail.tsx`; update recent-workout links only for `general_manual_entry` records.

- [ ] Show activity, equipment, measured summary, status, ordered segments, local finish time/timezone, notes, source, and edit action.
- [ ] Reopen and edit the versioned result without creating a second row. Preserve original imported/manual rows and existing detail routes.
- [ ] Show no Concept2 publish action in this slice. Publication eligibility and server mapping will be implemented separately against the saved record.
- [ ] Run focused tests, build, lint, and phone/desktop browser review; commit.

## Task 5: End-to-end verification and handoff

- [ ] Run `npm run test:run`, `npm run lint`, and `npm run build` and resolve new failures.
- [ ] Verify simple Concept2 RowErg, non-Concept2 rower, run, and mixed interval entries can be saved and reopened in a local or staging-safe account, without a training block.
- [ ] Record any live verification not possible in the PR. No shared backend migration or deployment is part of this slice.
- [ ] Review UX against the repo UI/flow guards and update the accepted design with any deliberate deviations.
