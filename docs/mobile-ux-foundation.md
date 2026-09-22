# Mobile UX foundation

Status: 2026-09-21. The Capacitor shell renders the same React application, so every existing route already exists on mobile. The work is not duplicate native screens — it is an athlete-first shell, a workout flow, and route-by-route adaptation of layouts that currently assume desktop width.

## Principles

1. **One application, one router.** No parallel mobile route tree. Responsive components and a mobile shell, not a fork.
2. **Athlete-first.** The phone is the athlete's device at the erg. Coach and admin density stays reachable but is not the primary surface.
3. **Progressive disclosure.** Show the metric that matters now; make the rest one tap away.
4. **Reuse the design system.** `src/components/ui/` primitives and theme tokens only. No raw `gray-*`, no new colors, no inline styles.
5. **Touch targets ≥ 44 px** and single-column below `md`.

## Reference patterns

| App | Pattern worth adopting | Pattern to avoid |
|---|---|---|
| [ErgData](https://www.concept2.com/ergdata) | Persistent monitor connection state; workout setup before connection; multiple live display modes; automatic post-workout sync | Metric-dense default screen |
| [ErgZone](https://www.erg.zone/) | Workout-first flow with **Connect** attached to the selected workout; interval and target emphasis; live target delta | Configuration surfaced mid-piece |
| [Strava](https://support.strava.com/en-us/articles/15401956-indoor-treadmill-and-bike-trainer-activities) | Stable bottom navigation; prominent record action; recorder distinct from summary; indoor activities lead with performance graphs | Social feed as the primary athlete surface |

## Athlete flow

```text
Home
  ↓ today's workout, or choose one
Workout preflight
  - RWN and targets
  - PM5 translation outcome: exact / prompt-only / unsupported
  - what the monitor will and will not enforce
  ↓
Connect PM5
  ↓
Ready
  - monitor identity and firmware
  - programming receipt acknowledged
  ↓
Live
  - one primary metric, large
  - pace · rate · interval progress
  - target delta
  ↓
Summary
  - evidence validity
  - totals, splits, stroke chart
  - save to Logbook Companion
  - Concept2 publication state
```

The PM5 action must be reachable from the bottom navigation **and** from any workout or template detail screen via **Program PM5**.

## Navigation

Five bottom destinations below `md`; the existing sidebar remains at `md` and above.

| Tab | Covers |
|---|---|
| Home | `/` — today, recent results, training-block status |
| Train | `/library`, `/training-block`, assignments |
| PM5 | `/pm5` — connect, program, live, summary |
| History | `/workout/:id`, `/history/:name`, `/compare/*`, `/analytics` |
| More | `/preferences`, `/sync`, `/docs`, team and coaching workspace |

Do not attempt to promote coach destinations into the bottom bar. Coaching enters through **More → Team**.

## Route classification

Every route below already resolves on mobile. The column records what adaptation is required.

### Athlete-critical — first wave

| Route | State |
|---|---|
| `/` | Adapted in M3a: compact padding, two-column mobile summary widgets, stacked actions |
| `/pm5` | Rebuild into preflight → connect → ready → live → summary states |
| `/completed-workout/new` | Adapted in M3a: single-column form and interval grid; sticky submit clears bottom navigation |
| `/completed-workout/:id` | Adapted in M3a: stacked header/actions and two-column mobile actions |
| `/completed-workout/:id/edit` | Adapted with `/completed-workout/new` in M3a |
| `/workout/:id` | Adapted in M3b: compact charts/metrics and contained split-table scrolling |
| `/training-block` | Adapted in M3b: selected-week phone view with compact seven-day grid |
| `/library` | Adapted in M3b: cards below `md`, existing table at `md+` |
| `/library/:templateId` | Adapted in M3b: stacked detail; **Program PM5** entry point remains separate follow-up |
| `/analytics` | Adapted in M3c: scroll-contained tabs, stacked filters, compact charts |
| `/history/:name` | Already has mobile alternatives; QA only |
| `/compare/:aId/:bId?` | QA/adapted in M3c: 44 px controls, compact chart, contained interval table |
| `/sync` | Adapted in M3c: stacked progress, range, machine, and status controls |
| `/preferences` | Adapted in M3c: scroll-contained tabs, single-column fields, contained benchmark table |

### Auth and public — installed-app behavior, not layout

`/login`, `/auth/bootstrap`, `/auth/callback`, `/auth/confirm`, `/oauth/consent`, `/callback`, `/reset-password`, `/join`, `/about`, `/share/assignment-results/:shareToken`, `/share/team-leaderboard/:shareToken`.

These need deep-link and callback verification in the installed app. Layout work is minor.

### Coach and team — second wave

`/team-management` and its `live`, `roster`, `roster/:athleteId`, `schedule`, `assignments`, `assignments/:assignmentId/results`, `boatings`, `analytics`, `setup`, `settings`, `request-access` routes, plus `/team`, `/team/scores`, `/team/notes`, `/team/settings`.

Pattern for this wave:

- card/list alternatives below `md` instead of tables;
- bottom sheets for row actions;
- sticky primary action;
- single-column forms;
- horizontal scroll only where a grid is genuinely tabular, with a visible affordance.

Twenty-four page files currently contain table, wide-grid, or horizontal-overflow patterns; seven already carry `md:hidden` mobile alternatives. Treat the existing seven as the pattern reference.

### Low priority

`/docs`, `/download-c2-data`, `/feedback`, `/library/propose`, `/library/review`, `/library/strength-mobility`, redirects, and `*`.

## Work order (no mobile device required)

### M1 — Shell — implemented in current branch

Bottom navigation below `md`, safe-area insets, sidebar preserved at `md`+, active-state parity with the sidebar.

Exit: every bottom tab routes correctly; no layout shift at the `md` boundary; existing tests pass.

Implementation: a focused five-tab mobile navigation component maps route groups to Home, Train, PM5, History, and More; More opens the existing full menu. Safe-area padding protects content and controls, the feedback action is lifted above the bar, and the desktop sidebar remains unchanged at `md` and above.

### M2 — PM5 flow — implemented in current branch

Split `PM5Connection.tsx` into preflight, connect, ready, live and summary states with explicit transitions. Preflight shows the translation outcome before any monitor traffic.

Exit: state-by-state render tests; unsupported RWN never reaches a connect action.

Implementation: `/pm5` now derives explicit Preflight, Connect, Ready, Live, and Summary states. Translation occurs before scanning; unsupported RWN remains in Preflight with no connection/programming action. Exact and prompt-only workouts advance through connection and acknowledgement, live PM5 metrics own the workout surface, and durable terminal captures reopen in Summary after retry/restart.

### M3 — Athlete-critical adaptation — complete through M3c

Work the first-wave table in order. Add a viewport-sized render check per route.

Exit: no horizontal scroll at 320 px on first-wave routes; touch targets ≥ 44 px; forms usable with a virtual keyboard.

M3a covers `/`, `/completed-workout/new`, `/completed-workout/:id`, and `/completed-workout/:id/edit`. M3b covers `/workout/:id`, `/training-block`, `/library`, and library detail. M3c covers analytics, both sync modes, preferences, and workout comparison.

### M4 — Coach and team adaptation — complete

Second-wave routes using the `md:hidden` pattern already present in `WorkoutHistory` and the coaching pages.

M4a merged in PR #200 and covers the primary daily coaching loop: dashboard, schedule, roster, and athlete detail. It reuses the existing roster cards and schedule day/week views, adds dashboard roster cards, phone-default day view, stacked actions, compact athlete detail, and an explicitly scroll-contained Erg Scores table.

M4b/c complete the secondary coach-management and athlete-team routes. Mature card and responsive patterns were preserved; genuinely tabular assignment, analytics, results, and seat grids are explicitly scroll-contained with accessible affordances.

### M5 — Installed-app verification — routing implemented; device proof remains

Requires a device or emulator: auth, deep links, back-button behavior, and the PM5 flow end to end.

PR #203 added native route handling and matching iOS/Android custom-scheme registration. PR #204 subsequently removed the flaky emulator smoke job and made native builds manual-only. The current auth branch adds secure native storage and development Concept2 browser returns; real auth UI/session behavior, iOS runtime behavior, Bluetooth permission prompts, and physical PM5 operation remain device/operator gates. See [M5 installed-app verification](concept2-mobile/approval-evidence/m5-installed-app-verification.md).

## References

- [PM5 evidence pipeline](concept2-mobile/pm5-evidence-pipeline.md)
- [Mobile delivery status](concept2-mobile/mobile-delivery.md)
- `.github/skills/ui-design-reviewer/SKILL.md`
- `.github/skills/ux-flow-reviewer/SKILL.md`
