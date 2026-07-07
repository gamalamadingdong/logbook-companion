# Logbook Companion Training Block — Product Specification

## 1. Product Goal

Build a 12-week rowing training block feature inside Logbook Companion.

This is not a standalone logger. The feature should use the systems Logbook Companion already has:

- Concept2 sync and existing `workout_logs` for actual training history
- manual workout logs as a fallback/complement to Concept2
- RWN for prescribed rowing workout structure
- Team Management and coaching assignments for coach/team workflows
- existing athlete/team/organization scoping

The feature should make it easy to review:

- planned vs actual rowing volume
- workout adherence
- substitutions and modifications
- RPE and training load
- Pete Plan interval progression
- strength routine adherence
- basic performance metrics: split, watts, rate, heart rate
- weekly progression toward 80–85 km volume

The first implementation is primarily a plan review and matching experience. It should make Concept2-imported work feel native, avoid duplicate data entry, and give both an individual athlete and a coach/team view into the same block.

Important notation decision:

- RWN is canonical for rowing prescriptions now.
- RWN can represent simple cross-training modalities and rowing warm-up/cooldown blocks today.
- RWN should add `cross` as the generic cross-training modality for deliberate non-rowing conditioning.
- RWN should keep `other` for unusual or unknown modalities, not as the normal cross-training bucket.
- RWN does not yet fully represent strength, core, stretching, or mobility prescriptions.
- Bare durations such as `30:00` should not be considered correct canonical RWN for strength work.
- If support work needs canonical notation, `@readyall/rwn` should be extended rather than building app-only parsing rules in Logbook Companion.

---

## 2. Core Philosophy

The system should separate these concepts:

1. Did I get the planned volume?
2. Did I complete the intended training stimulus?
3. How hard did it feel?
4. Am I progressing over repeated benchmark workouts?
5. Did the existing team assignment plan support or conflict with the block?

The app should not punish schedule shifting. If a Monday workout is completed on Tuesday, the user should still be able to record it cleanly.

The app should prioritize weekly targets over rigid daily perfection.

The app should treat week number and day slot as the training-plan anchors. Calendar dates define the week window, but the matching model should tolerate work moving within the week.

RWN is the common language for prescribed rowing sessions. Every prescribed rowing workout in the block should have a valid RWN representation generated through `@readyall/rwn`.

Support work should not be forced into lossy RWN placeholders. Strength/core/stretching/mobility should either wait for an RWN extension or use a separate structured support prescription field until RWN supports it.

Generic cross-training should be represented as `Cross: ...` once RWN supports that modality. Specific cross-training can remain `Bike: ...`, `Run: ...`, or `Ski: ...`.

---

## 3. Program Structure

The training plan lasts 12 weeks.

- Start date: Monday, July 6, 2026
- End date: Sunday, September 27, 2026
- Weeks run Monday through Sunday

Weekly template:

| Day | Planned structure |
|---|---|
| Monday | Pete Plan Speed Intervals + flush + Pull strength |
| Tuesday | Steady state row |
| Wednesday | Cross-training + Push strength |
| Thursday | Pete Plan Endurance Intervals + flush + Pull strength |
| Friday | Steady state row |
| Saturday | Cross-training/sport + Push strength, optional rowing |
| Sunday | Passive rest |

---

## 4. Weekly Rowing Volume Targets

The app should store the following weekly rowing volume targets:

| Week | Target Rowing Volume |
|---:|---:|
| 1 | 50 km |
| 2 | 55 km |
| 3 | 60 km |
| 4 | 55 km |
| 5 | 65 km |
| 6 | 70 km |
| 7 | 75 km |
| 8 | 65 km |
| 9 | 78 km |
| 10 | 82 km |
| 11 | 85 km |
| 12 | 65–70 km |

For Week 12, use 70 km as the default target but allow the user to treat 65–70 km as acceptable.

---

## 5. Pete Plan Workout Rotation

The app must use this corrected Pete Plan rotation.

### Weeks 1, 5, and 9

Monday speed:

- 8 x 500m
- 3:30 rest

Thursday endurance:

- 5 x 1500m
- 5:00 rest

### Weeks 2, 6, and 10

Monday speed:

- Speed Pyramid
- 250m / 500m / 750m / 1000m / 750m / 500m / 250m
- Rest according to Pete Plan style

Thursday endurance:

- 4 x 2000m
- 5:00 rest

### Weeks 3, 7, and 11

Monday speed:

- 4 x 1000m
- 5:00 rest

Thursday endurance:

- 3000m / 2500m / 2000m
- 5:00 rest

### Week 4

Monday:

- 30r20
- 30 minutes continuous
- Rate capped at 20 spm

Thursday:

- 3 x 2000m
- 5:00 rest
- Controlled benchmark effort

### Week 8

Monday:

- Hour of Power
- 60 minutes continuous
- Rate capped at 22 spm

Thursday:

- Cascading Pyramid
- 3000m / 2000m / 1000m
- 4:00 rest
- Rate/power steps upward

### Week 12

Monday:

- 2 x 5000m
- 6:00 rest
- Rate capped at 24 spm

Thursday:

- Final benchmark
- 5000m or 6000m maximal time trial

---

## 6. Flush Rules

After Monday and Thursday interval workouts, the target flush should be:

- Minimum: 3 km
- Normal: 4–5 km
- Full: 6 km only when time and recovery are good

The app should display this guidance on Monday and Thursday workouts.

For Week 1 especially, Pete Plan workouts may be completed as structured aerobic volume rather than true high-intensity sessions. The app should allow the user to mark these as `Modified` but still count key session credit if the structure was completed intentionally.

---

## 7. Data Model Direction

The current implementation does not add training block database tables. It uses a local 12-week template and reads actual work from existing `workout_logs`.

The intended model has four layers:

1. Training block template: the canonical 12-week plan, including week/day slots, planned sessions, support work, weekly volume targets, and RWN prescriptions.
2. Actual logs: Concept2/manual `workout_logs`, used as the source of completed training.
3. Review state: status, key session credit, strength status, and explicit day-slot overrides for a log.
4. Team planning context: existing `group_assignments`, shown beside the block so coaches can compare team-prescribed work with the block prescription.

Review state is currently local-only. A future persistence phase should promote it into database records after the matching model is stable.

Each training day conceptually has planned fields, actual rowing fields, strength fields, and calculated fields.

### Planned Fields

- Date
- Week number
- Day slot
- Day-of-week label
- Planned workout category
- Planned workout name
- Planned RWN for rowing prescriptions
- Planned support prescription for strength/core/stretching/mobility
- Planned rowing target km
- Planned strength split
- Planned notes
- Key session flag: Yes / No

### Actual Rowing Fields

- Source: Concept2 or manual
- Existing workout log ID
- Actual rowed km
- Actual workout status
- Actual workout type
- Key session credit
- Session RPE
- Average split seconds per 500m
- Average split display
- Average watts
- Average stroke rate
- Average heart rate
- Max heart rate
- UT2 km
- UT1 km
- AT/TR km
- Cross-training minutes
- Actual workout notes

### Strength Fields

- Strength status
- Strength RPE
- Strength minutes
- Strength notes

Early implementation may track strength status before detailed strength RPE/minutes. The key requirement is that strength adherence is visible separately from rowing compliance.

### Calculated Fields

- Daily rowing variance km
- Training load
- Watts from split
- Weekly volume contribution
- Weekly intensity contribution
- Week/day-slot match confidence
- Assignment-to-plan relationship, when a team assignment exists

---

## 8. Workout Status Values

Use these status values:

- As Written
- Modified
- Swapped
- Partial
- Skipped

Definitions:

| Status | Meaning |
|---|---|
| As Written | Completed the planned workout basically as prescribed. |
| Modified | Same general workout category, but adjusted volume/intensity. |
| Swapped | Did a different workout entirely. |
| Partial | Started but did not complete meaningful portion of planned work. |
| Skipped | Did not train. |

---

## 9. Actual Workout Type Values

Use a simple dropdown/list:

- Pete Speed
- Pete Endurance
- Benchmark
- Steady State
- UT2
- UT1
- Mixed Aerobic
- Cross-Training
- Strength Only
- Recovery
- Rest
- Other

---

## 10. Key Session Credit Values

Use:

- Yes
- Partial
- No
- N/A

Definitions:

| Value | Meaning |
|---|---|
| Yes | Intended stimulus was achieved. |
| Partial | Some useful stimulus was achieved, but not the full intended session. |
| No | Workout volume may count, but intended stimulus was not achieved. |
| N/A | Not a key session. |

Examples:

Scheduled: 5 x 1500m  
Actual: 5 x 1500m at controlled aerobic intensity  
Status: Modified  
Key Session Credit: Yes or Partial depending on intent

Scheduled: 5 x 1500m  
Actual: 60 minutes UT2 steady state  
Status: Swapped  
Key Session Credit: No  
Actual km still counts toward weekly volume.

---

## 11. Strength Tracking

Strength should be tracked separately from rowing compliance.

### Strength Status Values

- As Written
- Modified
- Partial
- Skipped
- N/A

Definitions:

| Status | Meaning |
|---|---|
| As Written | Completed planned split. |
| Modified | Completed strength but reduced or changed exercises. |
| Partial | Did only part of the routine. |
| Skipped | Strength was planned but not done. |
| N/A | No strength planned. |

### Strength Splits

#### Pull Days: Monday and Thursday

1. Deadlift or Romanian Deadlift  
   4 sets x 6–8 reps

2. Pendlay Row or Bench Pull  
   4 sets x 8 reps

3. Weighted Pull-ups or Lat Pulldown  
   3 sets x 8–10 reps

4. Face Pulls  
   3 sets x 15 reps

#### Push Days: Wednesday and Saturday

1. Front Squat or Back Squat  
   4 sets x 6–8 reps

2. Overhead Press or Flat Bench Press  
   4 sets x 8 reps

3. Walking Lunges  
   3 sets x 10 steps per leg

4. Ab Wheel Rollouts  
   3 sets x 10–12 reps

Target effort:

- 1–2 reps in reserve
- no failed reps
- no grindy reps
- quality and consistency over load chasing

---

## 12. Warm-Up and Core Reference

The app should include a reference section for the standard routine.

### Pre-Workout Dynamic Prep

1. World’s Greatest Stretch  
   10 reps per side

2. Cat-Cows  
   15 reps

3. Banded Pass-Throughs  
   20 reps

4. Erg Warm-Up  
   2000m progressive row  
   Drop split by about 2 seconds every 500m  
   Finish with three 10-stroke power bursts at target workout rhythm

### Post-Workout Core and Mobility

3 rounds:

1. Forearm plank  
   60 seconds

2. Deadbugs  
   15 reps per side

3. Bird-Dogs  
   10 reps per side with 3-second hold

4. Pallof Presses  
   12 reps per side

Finish with 30-second static holds:

- hamstrings
- hip flexors
- glutes
- thoracic spine / foam roller

---

## 13. Split and Watts Handling

The user should enter average split as seconds per 500m.

Examples:

- 2:00.0 = 120.0
- 1:55.8 = 115.8
- 1:45.0 = 105.0

The app should display the split in `m:ss.s` format.

The app should calculate watts from split using the standard Concept2 formula:

```text
Watts = 2.8 / (split_seconds / 500)^3
```

The app should round watts to the nearest whole number.

---

## 14. Training Load

Calculate training load as:

```text
Training Load = Actual Rowed km × Session RPE
```

Examples:

- 10 km at RPE 5 = 50 load units
- 15 km at RPE 7 = 105 load units

Weekly training load should be summed.

The app should also show average session RPE by week.

---

## 15. Intensity Distribution

The user should be able to enter km by zone:

- UT2 km
- UT1 km
- AT/TR km

The app should summarize by week:

- total UT2 km
- total UT1 km
- total AT/TR km
- percentage of total rowing volume in each zone

The goal is to detect hidden intensity creep.

---

## 16. Core Screens

The current implementation has one main Training Block page with personal, team, and coach routes. Future screens can split out after the review model is stable.

### A. Training Block Review Screen

Status: implemented as the current primary screen.

Routes:

- `/training-block`
- `/team/training-block`
- `/team-management/training-block`

Purpose: show the 12-week plan, current week progress, planned sessions, matched logs, and team/coaching context.

Show:

- week selector
- day-slot selector
- weekly target and actual rowing volume
- key session credit summary
- training load summary
- planned sessions and support work
- planned RWN for rowing prescriptions
- matched Concept2/manual logs
- local review overrides
- athlete filter in team contexts
- team weekly athlete snapshot
- team assignments for the selected week and selected day

### B. Today / Quick Review Screen

Purpose: fast daily entry.

Status: future. This should reuse existing workout logs rather than create a separate logging system.

Show:

- date
- week/day
- planned workout
- planned rowing target
- planned strength split
- key notes
- quick action buttons for workout status
- entry form for actual values

Primary fields should be easy to enter one-handed:

- actual rowed km
- workout status
- actual workout type
- key session credit
- session RPE
- average split
- average rate
- strength status
- strength RPE
- notes

Optional expandable fields:

- HR avg/max
- UT2/UT1/AT/TR km
- cross-training minutes
- strength minutes
- strength notes

### C. Week Screen

Purpose: show weekly progress.

Status: partially implemented inside the Training Block Review Screen.

Show:

- weekly target km
- actual km
- variance
- completion percentage
- training load
- average RPE
- strength adherence
- key session credit
- zone distribution
- list of logged days

### D. Program Screen

Purpose: show the full 12-week plan.

Status: partially implemented inside the Training Block Review Screen.

Show:

- week-by-week targets
- planned workouts
- completion status
- volume progress

### E. Pete Plan Progress Screen

Purpose: compare repeated Pete Plan workouts.

Status: future.

Group by workout type:

- 8 x 500m
- Speed Pyramid
- 4 x 1000m
- 5 x 1500m
- 4 x 2000m
- 3000m / 2500m / 2000m
- 3 x 2000m
- 30r20
- Hour of Power
- 2 x 5000m
- final 5k/6k TT

For each workout, show:

- date
- week
- average split
- watts
- rate
- RPE
- notes
- status

### F. Reference Screen

Purpose: avoid decision fatigue.

Status: partially implemented in planned day support content.

Include:

- pacing zones
- warm-up protocol
- core protocol
- strength split A
- strength split B
- status definitions
- logging examples

---

## 17. Weekly Summary Metrics

Each week should calculate:

- Target rowing km
- Actual rowing km
- Volume variance
- Volume completion %
- Training load
- Average session RPE
- Average strength RPE
- Planned strength sessions
- Completed/modified/partial strength sessions
- Strength adherence %
- Key sessions planned
- Key sessions credited
- Key session credit %
- UT2 km
- UT1 km
- AT/TR km
- Cross-training minutes

Strength adherence should count:

- As Written = 1.0
- Modified = 0.75
- Partial = 0.5
- Skipped = 0
- N/A excluded

Key session credit should count:

- Yes = 1.0
- Partial = 0.5
- No = 0
- N/A excluded

---

## 18. Dashboard Metrics

The Training Block page should show:

- Current week
- Weekly target km
- Actual km this week
- Remaining km this week
- Weekly completion %
- Current training load
- Average RPE this week
- Strength adherence this week
- Key session credit this week
- 12-week total km completed
- Progress toward 12-week target
- Current streak of logged days

Optional but useful:

- Last Pete Plan result
- Next key workout
- Volume ramp warning if current week is too far above target

The main Logbook Companion dashboard may later surface a compact training-block summary, but the initial implementation keeps the detailed block review in the dedicated Training Block page.

---

## 19. Coaching Logic / Warnings

Keep this simple. No complex AI required.

### Volume Warning

If actual weekly volume exceeds target by more than 10%, show:

> Volume is above plan. Make sure this is intentional and recovery is stable.

### RPE Warning

If average weekly RPE is 8 or higher, show:

> High perceived load this week. Consider protecting the next steady-state day.

### Strength Warning

If strength status is skipped twice in a week, show:

> Strength adherence is slipping. Consider a shorter minimum-effective-dose session.

### Key Session Warning

If both key rowing sessions are missed or marked No:

> Volume may be fine, but the intended rowing stimulus was missed this week.

### Intensity Warning

If AT/TR km is unusually high relative to weekly volume, show:

> High-intensity share is elevated. Watch recovery and keep steady-state truly easy.

---

## 20. Data Entry Examples

### Example 1: Completed as written

Scheduled:

- 8 x 500m

Actual:

- Status: As Written
- Actual type: Pete Speed
- Key Session Credit: Yes
- Actual rowed km: 12.5
- RPE: 7
- Avg split: 110.5
- Avg rate: 32
- Strength status: As Written
- Strength RPE: 7

### Example 2: Modified intensity, full structure

Scheduled:

- 8 x 500m

Actual:

- Status: Modified
- Actual type: Pete Speed
- Key Session Credit: Yes
- Actual rowed km: 12.0
- RPE: 5
- Notes: Completed full Pete structure at aerobic intensity for Week 1 volume focus.

### Example 3: Swapped workout

Scheduled:

- 5 x 1500m

Actual:

- Status: Swapped
- Actual type: Steady State
- Key Session Credit: No
- Actual rowed km: 15.0
- RPE: 5
- Notes: Did 60 minutes UT2 instead of endurance intervals.

### Example 4: Strength partial

Scheduled:

- Pull strength

Actual:

- Strength status: Partial
- Strength RPE: 6
- Strength minutes: 25
- Notes: Completed RDL and bench pull only.

---

## 21. Data Export

CSV export is desirable but is not part of the current stopping point. Export should come after the matching and persistence model is clearer.

Required exports:

1. Daily log export
2. Weekly summary export
3. Pete Plan progress export

The CSV should be compatible with Excel.

---

## 22. Editing Behavior

The user should be able to:

- edit any past day
- enter data for future days if needed
- move a workout by logging it on a different day
- mark a day as skipped
- enter actual workout notes freely

The app should not force strict adherence to scheduled days.

---

## 23. Simplicity Requirements

The feature should avoid:

- duplicate training logs outside `workout_logs`
- coach marketplace features
- excessive exercise-level strength logging
- overly detailed nutrition tracking
- rigid validation that blocks entry
- forcing a workout to match the exact calendar day if it clearly satisfies a weekly day-slot prescription

The user should not need to re-enter Concept2 workouts just to satisfy the block. Manual quick entry remains useful, but imported logs should be the happy path.

---

## 24. Minimum Viable Product

The first usable Logbook Companion version should include:

1. 12-week schedule
2. valid RWN prescription coverage for every planned rowing session
3. Concept2/manual log matching by week and day slot
4. weekly summary
5. visible strength/support work
6. local review overrides
7. team/coach scoped views
8. team assignment visibility beside the block

The current implementation covers most of this MVP. The next MVP gap is stronger matching/scoring between planned sessions, logs, and team assignments.

The current implementation does not yet satisfy canonical notation for strength/support sessions. Treat support-session RWN placeholders as a known gap. The next implementation phase should decide whether to extend `@readyall/rwn` first or temporarily make `planned_rwn` rowing-only.

---

## 25. Future Enhancements

Possible later additions:

- simple charts
- CSV export
- persisted training block instances
- persisted review state
- RWN support-work notation for strength, core, stretching, and mobility
- RWN `cross` modality for generic cross-training
- auto-generation of team assignments from a block
- stronger assignment-to-plan matching
- Pete Plan progression analytics
- mobile-first daily quick-review flow
- Apple Health / Garmin import
- workout timer
- automatic split parsing
- fatigue trend score
- notes search
- recurring plans beyond 12 weeks

---

## 26. Success Criteria

This app is successful if:

- Concept2-imported workouts are easy to review against the plan
- weekly volume is easy to track
- substitutions are captured without guilt or confusion
- Pete Plan progress is visible over time
- strength adherence is visible without exercise-by-exercise logging
- coaches can scan athlete progress in team/org scope
- team assignments can be compared with the block prescription
- the user can eventually export the data back to Excel
- the app supports consistency instead of adding friction

---

## 27. Logbook Companion Implementation Direction

This specification began as a lightweight standalone rowing training logger concept. The current implementation direction is to satisfy the spirit of the logger inside Logbook Companion rather than build a separate parallel app.

The training block should use Logbook Companion's existing foundations:

- `workout_logs` remain the source of actual training history.
- Concept2 synced workouts should be treated as first-class actual results.
- Manual workouts should still be usable when Concept2 does not cover the session.
- RWN should be the canonical representation for prescribed rowing workouts.
- Team Management and coaching assignments should be part of the model, not an afterthought.

The practical product goal is now:

- Athletes can view a 12-week block and see how their logs satisfy the planned work.
- Coaches can view the same block for a team or organization scope.
- Team workout assignments can be compared with the training block prescription.
- Schedule shifting inside a week is acceptable. The plan uses week number and day slot as the conceptual anchor, while calendar dates provide the week window.
- Strength, core, stretching, warm-up, flush, cross-training, and rest work are included as planned/supporting content even if early matching is strongest for rowing sessions.

### Current Repo Status

As of July 7, 2026, the current implementation is a frontend/local-model training block feature with no new database schema.

Implemented:

- A local 12-week rowing training block template.
- RWN generation/import through `@readyall/rwn` for planned rowing prescriptions.
- Training block shared types.
- Plan/log alignment helpers.
- Weekly and daily summary helpers.
- Training block tests for template and calculation behavior.
- A Training Block page for personal, team, and coach contexts.
- Routes:
  - `/training-block`
  - `/team/training-block`
  - `/team-management/training-block`
- Team and organization scope support through existing coaching context.
- Athlete filtering in team views.
- Team weekly athlete snapshot.
- Selected-week team assignment loading from `group_assignments`.
- Display of team assignments beside the block plan.
- Local review overrides for matched logs.

Not implemented yet:

- Persistent training block instances or enrollment.
- Persistent review/override records.
- Auto-generation of assignments from the training block.
- Strong assignment-to-plan matching.
- Pete Plan progression analytics.
- CSV export.
- Zone distribution summaries.
- Full weekly warning/coaching logic.
- A mobile-first daily quick-entry form.

For detailed handoff and the active implementation plan, see `docs/training-block-handoff.md`.

### Active Implementation Plan

The active plan is:

1. Stabilize the current local feature and keep tests/build clean.
2. Tighten matching and scoring between planned sessions, Concept2/manual logs, and team assignments.
3. Use RWN as the common structure for prescribed rowing sessions.
4. Add persistence only after the matching model is clear.
5. Expand into authoring, alternate blocks, and coach-driven plan assignment after the review model feels right.

## 28. Suggested Codex Prompt

Use this prompt after placing this file in the repository:

```text
Read docs/rowing-training-logger-spec.md and docs/training-block-handoff.md before writing code.

Continue from the current Logbook Companion training block implementation. Do not treat the spec as a standalone greenfield app. Prioritize Concept2 log matching, RWN prescription coverage, team/coaching integration, and a clear path from local review state to persisted training block state.

First, inspect the current tests/build status and summarize the existing implementation. Then continue with the next phase of the active plan.
```
