# Logbook Companion — Reusable Package Extraction Plan

> **Status:** planning doc, not yet executed.
> **Author intent (Sam):** extract reusable rowing/erg primitives out of the Logbook
> Companion (LC) app into publishable `@readyall/*` npm packages, the way `@readyall/rwn`
> and `@readyall/erglink` were already carved out. This doc covers **all 7 candidates in
> priority order** (high value × feasibility → low).
> **Scope note:** tracked in LC for future work. This plan is not part of the current
> PM5 evidence/mobile sequence and should begin only after an explicit go-ahead.

---

## 0. The proven pattern (how `@readyall/rwn` actually works)

Before touching anything, understand the mechanism LC already uses — every new package
copies it exactly. `@readyall/rwn` is **not** an npm/pnpm workspace. It is a *published*
package that is **aliased to local source during development**. Three wiring points:

| Concern | Where | Value |
|---|---|---|
| Published dependency | `package.json` | `"@readyall/rwn": "^0.2.1"` |
| TS resolution (app build) | `tsconfig.app.json` `compilerOptions.paths` | `"@readyall/rwn": ["packages/rwn/src/index.ts"]` |
| TS resolution (tests) | `tsconfig.test.json` `paths` | same |
| Bundler resolution (dev/build) | `vite.config.ts` `resolve.alias` | `'@readyall/rwn' → packages/rwn/src/index.ts` |

So app code does `import { parseRWN } from '@readyall/rwn'` and gets **local TS source**
at dev time (instant, no rebuild), while `npm publish` from `packages/rwn` ships the
compiled `dist/`. The alias masks the published version until you remove it.

**Package skeleton (mirror this for every new package):**

```
packages/<name>/
  package.json         # name @readyall/<name>, type module, main dist/index.js,
                       # types dist/index.d.ts, exports map, files [dist, README, LICENSE],
                       # scripts: build=tsc, test=vitest run, prepublishOnly=npm run build
  tsconfig.json        # emits dist/ with declarations
  vitest.config.ts
  README.md
  LICENSE              # MIT (match rwn)
  src/
    index.ts           # public surface — re-exports only what's intended as API
    <impl>.ts
    __tests__/…
```

`packages/rwn/package.json` is the canonical template. Copy it, change name/description/
keywords, keep author/license/scripts identical.

### The golden rule for every extraction below
**A package may depend on app types and app services, but never the reverse once
extracted.** The dependency arrow points *out* of the app into the package. Any function
that reaches into Supabase, `user_profiles`, `athletes`, etc. does **not** move — it stays
in the app and *calls* the pure package function, passing data in as arguments. Each step
below names exactly which lines are "pure core" (moves) vs "IO shell" (stays).

### Standard procedure per package (applies to all 7)
1. Create `packages/<name>/` from the rwn skeleton.
2. Move the **pure** functions; leave IO wrappers in the app.
3. Add the 3 wiring points (package.json dep, both tsconfig `paths`, vite alias).
4. Repoint app imports to `@readyall/<name>`.
5. Move/copy the existing tests; add tests for any formula that had none.
6. Verify: `npm --prefix packages/<name> run build && npm --prefix packages/<name> test`,
   then repo root `npm run test && npm run lint && npm run build`.
7. Commit as one PR. **Serial** — Sam merges, says "go", then next package (matches the
   app-share/loop convention). Do **not** stack all 7 into one PR.

---

## Priority-ordered execution

Dependency reality drives the order: pace math is the foundation the next two ride on,
so it must ship first even though PR/PowerProfile are independently valuable.

| # | Package / target | Value | Feasibility | Ship? |
|---|---|---|---|---|
| 1 | `@readyall/rowing-math` ← `paceCalculator.ts` | High | High | **Yes, first** |
| 2 | (same pkg) ← `prCalculator.ts` | High | High | **Yes, bundle w/ #1** |
| 3 | `@readyall/power-profile` ← `powerProfile.ts` | High | Med | Yes, on top of #1 |
| 4 | Speed Index core (extract, maybe not publish) | Med | High | Extract now (DRY+test) |
| 5 | `@readyall/erg-rankings` ← #4 + tier rubric + rerank | Med | Med | Optional |
| 6 | `@readyall/training-plans` ← plan schema + templates | Med | Med | Optional |
| 7 | Training-block alignment engine | Low | Low | **No — keep in app** |

---

## 1. `@readyall/rowing-math` — pace/watts/zones core  *(FIRST)*

**Source:** `src/utils/paceCalculator.ts` (303 lines).
**Why first:** pure physics, highest reuse, already an internal shared primitive
(`powerProfile.ts` and `prCalculator.ts` both import it). Every erg app reimplements
split↔watts and gets it subtly wrong.

**Moves (pure core):**
- `calculateWattsFromSplit`, `calculateSplitFromWatts` — Paul's Law `2.80/(split/500)³`.
- `formatSplit`, `parsePaceToSeconds`.
- `TRAINING_ZONE_CONFIG` + `TrainingZone` type, `getZoneTimeAdjustment`,
  `calculateZonePaceRange`, `calculate2kRelativePace`, `calculatePaceWithConfidence`.
- `calculateActualPace` (parses `@2k+10`, `@UT2`, ranges, absolute).
- `extractPaceTargets` — **caveat:** depends on `WorkoutStructure` type. Either (a) move a
  minimal structural type into the package, or (b) leave this one thin wrapper in the app
  since it's LC-schema-specific. Recommend (b): keep the package free of app types.

**Stays (IO shell):**
- `getUserBaseline2kWatts(userId, supabase)` — the **only** Supabase-coupled function.
  Rewrite in-app to fetch the baseline string, then call the package's pure math. This is
  the single cut that makes the whole file portable.

**Steps:**
1. Skeleton `packages/rowing-math/`.
2. Move the pure functions to `src/paceCalculator.ts`; re-export from `src/index.ts`.
3. In the app, replace `src/utils/paceCalculator.ts` with a re-export shim
   (`export * from '@readyall/rowing-math'`) **plus** the retained app-only helpers
   (`getUserBaseline2kWatts`, optionally `extractPaceTargets`). This keeps ~15 existing
   import sites unchanged.
4. Move `paceCalculator.test.ts` into the package.
5. Wire the 3 resolution points; add `"@readyall/rowing-math": "^0.1.0"` to app deps.

**Blast radius:** `powerProfile.ts`, `prCalculator.ts`, and any pace UI. Contained because
of the re-export shim.

**Package name decision:** `@readyall/rowing-math` (broad, holds #1+#2). Alt narrower name
`@readyall/erg-pace` if you'd rather keep PR detection separate — but bundling is better.

---

## 2. PR calculator — fold into `@readyall/rowing-math`  *(bundle with #1)*

**Source:** `src/utils/prCalculator.ts` (275 lines).
**Why bundle:** it already imports `paceCalculator`; shipping them together avoids a
cross-package dependency and gives the core package a complete "efforts + records" story.

**Moves (pure core):**
- `PR_DISTANCES`, `BENCHMARK_PATTERNS`, `TIME_BASED_TESTS` constants.
- `PRRecord` interface, `formatTime`, pace formatting, standard-distance + interval-split
  PR detection logic.

**Generalize (the one cost):**
- Imports `C2ResultDetail`, `C2Interval` from `../api/concept2.types` and helpers from
  `workoutNaming`. Two options:
  - **Preferred:** define a minimal generic input type in the package
    (`{ distance, timeSeconds, intervals?: {...}[] }`) and have the app adapt C2 shapes to
    it. Keeps the package Concept2-agnostic (matches your "generation-neutral" ErgLink
    stance).
  - **Faster:** move a copy of the needed C2 type fields into the package. Less clean;
    couples the package to Concept2 naming.
- `calculateCanonicalName`/`detectIntervalsFromStrokes` from `workoutNaming` — if PR
  detection needs these, either move `workoutNaming` too or pass canonical names in. Audit
  the exact call sites before deciding; prefer passing data in.

**Steps:** add `src/prCalculator.ts` to the package created in #1, re-export, move tests,
app keeps a thin adapter that maps C2 → generic input.

**Result after #1+#2:** one `@readyall/rowing-math` package = the high-value, low-risk
foundation. Everything else is optional or rides on this.

---

## 3. `@readyall/power-profile` — power-duration engine  *(on top of #1)*

**Source:** `src/utils/powerProfile.ts` (644 lines).
**Why third:** more novel and substantial than Speed Index/rankings (power-duration curve,
11-anchor expected-ratio table, sprinter/diesel/threshold-gap/balanced classification,
training prescriptions). No good open version exists. But it **depends on #1+#2**, so it
can only cleanly extract after them.

**Moves (pure core):**
- All types (`PowerCurvePoint`, `PowerRatio`, `ProfileType`, `PowerProfile`, etc.).
- `EXPECTED_RATIOS`, `ANCHOR_ORDER`, `DISTANCE_TO_ANCHOR`, anchor groupings, `GAP_MESSAGES`.
- `extractBestEfforts`, `computePowerProfile`, `classifyProfile`, `generatePrescriptions`,
  `isIntervalWorkout`, `parseRawData` helper.

**Generalize:**
- Imports `WorkoutLog` from `../services/supabase` and `C2ResultDetail`. Same play as #2:
  define a minimal `WorkoutLike` input type in the package; app adapts its `WorkoutLog[]`
  to it. The engine only reads a handful of fields (`distance_meters`, `duration_seconds`,
  `completed_at`, `canonical_name`, `workout_name`, `raw_data`) — enumerate them into a
  package-owned interface.
- Depends on `@readyall/rowing-math` for `calculateWattsFromSplit` /
  `calculateSplitFromWatts` and `PR_DISTANCES`/`TIME_BASED_TESTS` — clean package→package
  dep (allowed; arrow still points away from the app).

**Steps:** skeleton `packages/power-profile/`, `dependencies: { "@readyall/rowing-math":
"^0.1.0" }`, add its alias/paths, move `powerProfile.test.ts`, app adapts `WorkoutLog`→
`WorkoutLike` at the call boundary.

**Feasibility note:** medium only because of the input-type generalization; the algorithm
itself is self-contained.

---

## 4. Speed Index core — extract now, DRY + test  *(publish decision deferred)*

**Sources (the problem):** the ~35-line z-score algorithm is **duplicated** and the two
copies only agree by hand:
- `src/services/coaching/analyticsView.ts::computeAssignmentTitanIndexes` (pure, in-memory).
- `src/services/coaching/coachingService.ts::computeAndStoreWorkoutTitanIndex` (same algo
  wrapped in Supabase read/write).
- Weights live in `coachingService.ts`: `TITAN_POWER_WEIGHT = 0.5`,
  `TITAN_EFFICIENCY_WEIGHT = 0.5` (note the naming quirk — `POWER_WEIGHT` is actually
  applied to the **speed** z-score; preserve the exact behavior when extracting, fix the
  name only with a deliberate note).

**Why do it regardless of publishing:** the duplication is a latent bug (two formulas that
must stay identical, no shared test). Collapsing to one tested pure function is worth it on
its own.

**Extract to a pure module** (internal first — `src/utils/speedIndex.ts` or straight into
the rankings package in #5):
```
computeSpeedIndex(rows: { id: string; split: number; wPerLb: number | null }[],
                  opts?: { speedWeight?: number; powerWeight?: number })
  : Map<string, number | null>   // 0–100, null when < 2 eligible rows or zero variance
```
Both call sites then reduce to: build rows → `computeSpeedIndex` → (analyticsView returns
map / coachingService writes map back to `daily_workout_assignments.titan_index`).

**Publish?** Only bundled (see #5). Standalone it's ~35 lines of an *opinionated* 50/50
blend — too thin, and the weighting is a ReadyAll choice, not a standard.

**Steps:** write pure fn + unit tests (mean/std/z/rescale, <2-row guard, zero-variance
guard), repoint both call sites, delete the duplicate math. Keep `titan_index` DB column
name and public "Speed Index" label unchanged.

---

## 5. `@readyall/erg-rankings` — Speed Index + tiers + rerank  *(optional)*

**Sources:** #4's pure `computeSpeedIndex`, `src/utils/performanceTierRubric.ts`,
`rerankLeaderboard` from `coachingService.ts`.
**Value:** medium — makes leaderboards **portable across your own apps**. Lower for the
generic community because `performanceTierRubric.ts` encodes *your* scholastic squad
taxonomy (novice/freshman/jv/varsity) and specific 2k time bands.

**Moves (pure core):**
- `performanceTierRubric.ts` is already clean and self-contained (tier derivation, labels,
  progress, `buildBest2kByAthlete`). Direct move.
- `computeSpeedIndex` from #4.
- `rerankLeaderboard` — audit its coupling in `coachingService.ts` first; move only if pure.

**Stays:** all Supabase fetch/write (`computeAndStoreWorkoutTitanIndex`,
`backfillTitanIndexes`) stays in the app and calls the package.

**Decision gate:** build this **only if** you have a second app that needs the same
leaderboard/tiers. Otherwise stop after #4 (internal dedup) and leave rankings in-app.

---

## 6. `@readyall/training-plans` — plan schema + template library  *(optional)*

**Split the training-block domain in two.** This item is the **data/schema/templates**
half only. The engine half is #7 and does **not** move.

**Moves (data + types):**
- `src/types/trainingBlock.types.ts` (`TrainingBlockPlan`, `TrainingBlockPlannedDay`, etc.).
- `src/data/rowingTrainingBlockTemplate.ts` (Pete Plan rotation, `WEEK_TARGETS_M`, week
  targets) — the template *library*.
- Note: `rowingTrainingBlockTemplate.ts` imports `@readyall/rwn` (`parseRWN`,
  `structureToRWN`). That's a package→package dep — fine, and it's a good sign this data is
  already expressed in your canonical notation.

**Value:** medium. A data + types package LC and ErgLink can both consume; lets the
community adopt the plan *format* and standard templates. Standards-compliant/reusable,
which matches your stated preference over app-private shortcuts.

**Feasibility:** medium — mostly moving data + types, but verify no template helper reaches
into app services. Keep it pure data + pure builders.

**Steps:** skeleton `packages/training-plans/`, `dependencies: { "@readyall/rwn": "^0.2.1" }`,
move types + template data + `rowingTrainingBlockTemplate.test.ts`, wire resolution, app
imports the plan types/templates from the package.

---

## 7. Training-block alignment engine — **keep in app (do not package)**

**Source:** `src/utils/trainingBlockCalculations.ts` (602 lines) +
`trainingBlockMatching.ts` + `trainingBlockStatus.ts`.
**Why not:** tightly bound to LC's log schema (`TrainingBlockActualLogEvent`), the matching
context, and app conventions (`source === 'concept2'`, strength/cross-training keyword
heuristics, slot/date bucket filling, key-session credit). Low generic reuse, high coupling,
high churn. Packaging it would export LC's internals as API and freeze them.

**Action:** leave in `src/utils/`. It *consumes* #6's types (that dependency direction is
correct). Revisit only if a second app ever needs identical plan-vs-actual reconciliation —
unlikely.

---

## Sequencing summary (serial PRs)

1. **PR 1 — `@readyall/rowing-math`** (paceCalculator core + PR calculator). Cut the one
   Supabase fn. Highest value, lowest risk. → merge → "go".
2. **PR 2 — `@readyall/power-profile`** on top of rowing-math. → merge → "go".
3. **PR 3 — Speed Index dedup** (internal pure `computeSpeedIndex`, collapse the two
   copies, add tests). No new package yet. → merge → "go".
4. **PR 4 (optional) — `@readyall/erg-rankings`** if cross-app portability is wanted.
5. **PR 5 (optional) — `@readyall/training-plans`** (schema + templates).
6. **Never** — training-block engine stays in app.

**Fastest high-value path:** PR 1 alone already delivers the biggest win. PR 1 + PR 2 is the
whole high-value/low-risk cluster. Everything after is portability/community polish.

## Per-PR verification checklist
- [ ] `npm --prefix packages/<name> run build` clean (emits `dist/` + `.d.ts`)
- [ ] `npm --prefix packages/<name> test` green
- [ ] 3 resolution points wired (package.json dep, both tsconfig `paths`, vite alias)
- [ ] App imports repointed; re-export shim left where it reduces churn
- [ ] Formula-level tests added for anything previously untested (esp. Speed Index)
- [ ] Root `npm run test && npm run lint && npm run build` all green
- [ ] Dependency arrow points **out** of the app (no package imports app services)
- [ ] DB column names + public labels (`titan_index` / "Speed Index") unchanged

## Open questions to resolve before starting
- Package naming: confirm `@readyall/rowing-math` vs splitting pace/PR into two.
- Concept2 generalization depth: minimal generic input types (preferred, matches
  generation-neutral ErgLink stance) vs. copying C2 types (faster, more coupled).
- Publish cadence: publish each to npm immediately, or keep local-aliased until a second
  consumer app exists? (rwn is already published; matching that is simplest.)
