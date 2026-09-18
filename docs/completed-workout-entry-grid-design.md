# Manual workout entry: interval grid and RWN plan

Status: UX design for review, 2026-09-18. This describes the next staging form slice. The existing manual result model and explicit Concept2 development publication remain the data and transport boundaries.

## What this changes for the person entering a workout

The current interval cards proved that LC can save ordered work and rest, then publish an eligible completed RowErg result. They take too much space for repeat workouts. The form should let someone describe the intended workout once, enter what happened in a compact sequence, and see the measured totals before saving.

A plan and a result remain distinct. RWN, a saved template, or a visual plan builder describes the intended sequence. Actual distance, time, and optional measurements describe the completed session. LC may save a result without a plan.

## Desktop layout

    Add completed workout
    Activity [Indoor row v]   Equipment [Concept2 RowErg v]
    Finished [date and time]  Completion [Completed v]

    START FROM A PLAN
    [Find a saved template........................]
    or
    RWN [8x500m/3:00r.........................] [Build rows]
    Parsed plan: 8 work intervals at 500 m, with 3:00 rest between them
    [Build a plan visually]     Template: none

    COMPLETED RESULT
    Detail [Whole workout v]    Work 0 m / 0:00    Rest 0:00
    #   Segment   Basis      Planned     Actual m   Actual time    More
    1   Work      Distance   500 m       [       ]  [          ]   [•••]
    2   Rest      Time       3:00        [       ]  [          ]   [•••]
    3   Work      Distance   500 m       [       ]  [          ]   [•••]
    4   Rest      Time       3:00        [       ]  [          ]   [•••]
    ...
    15  Work      Distance   500 m       [       ]  [          ]   [•••]
    [+ Work] [+ Rest] [+ Repeat selected]

    Measured totals   Work [0 m] [0:00]   Rest [0:00]   Elapsed [0:00]
    [More measurements and notes]
    [Save workout in LC]

The exact example expands to eight Work rows and seven Rest rows. RWN suggests each Work row basis and fills the planned target; every actual measurement starts empty. Basis is a result field: changing it records what was actually programmed or completed and does not rewrite the planned RWN. The grid uses restrained separators and repeat grouping, rather than a large card around each segment. Optional row calories, watts, labels, and row actions live behind More; session heart rate and stroke rate stay in More measurements and notes. The primary result summary derives automatically from rows when coverage is Whole workout. Partial detail retains a separately entered session total and shows the partial subtotal clearly.

## Phone layout

The same ordered segments appear as compact rows. There is no horizontally scrolling table and no giant card per interval.

    1  WORK  •  Distance  •  planned 500 m      [•••]
       Actual meters [       ]   Actual time [       ]
    2  REST  •  planned 3:00                 [•••]
       Actual meters [       ]   Actual time [       ]

A row can expand for optional measurements and target detail. Add, copy, reorder, and remove actions have accessible labels and touch targets at least 44 px. The save action remains reachable when the keyboard is open. Keyboard users can move through actual cells in row order on desktop.

## RWN and template behavior

1. Search for a saved template, enter RWN directly, build a plan visually, or start without a plan. The plan controls appear before the interval results.
2. Parsing RWN shows a readable preview before rows are created. Building rows fills phase, basis, and planned target, never actual measurements.
3. A template link and its RWN snapshot remain attached while the person edits actual results, including a Work row basis that differed from the plan. Changing a planned target explains that the template link will clear.
4. Reapplying a plan to rows with actual values preserves measurements for matching segments. A change that would discard or reassign actual data requires a review of the affected rows before applying it.
5. RWN is generated from visual plan edits only for structures that round-trip through the parser and serializer without losing guidance. Unsupported guidance stays in the original RWN and cannot be silently rewritten. An unrepresentable row plan remains saveable as structured targets without claiming a canonical RWN.
6. Runs, other activities, and non-Concept2 machines use the same result entry flow where the fields make sense. RWN remains optional.

The first implementation step can replace cards with the result grid while using the existing RWN/template-to-rows path. The visual plan builder and grid-to-RWN path follow after round-trip tests cover repeats, variable intervals, rest, modality, and guidance. This preserves the current RWN contract while making result entry faster.

## Save, validation, and publication

- Saving writes one owned LC workout. It never publishes to Concept2.
- Full measured Concept2 RowErg intervals require a Distance or Time basis on each Work row. The form points to the exact missing cell before save. Partial detail and other equipment remain saveable in LC.
- The saved result page states specific missing publication requirements and links to Edit. It does not silently omit all explanation when a completed Concept2 RowErg result is close to eligible.
- If a result has already been published, editing LC shows the immutable Concept2 publication snapshot and warns that the remote result will not change automatically.
- After an eligible result is saved, the separate publication action keeps the existing one-dispatch fence, explicit confirmation, and exact-ID read-back.

## Acceptance checks for the next staging UX slice

1. Enter 8x500m/3:00r. See eight Work and seven Rest rows with correct planned values and blank actual cells on desktop and phone.
2. Enter measured rows using the keyboard or touch. Whole-workout totals update automatically, with work and rest distinguished.
3. Save and reopen a simple row, a fixed-time interval result, a variable interval result, a non-Concept2 erg, and a run without losing order, targets, or measurements.
4. A missing Work basis in a full completed Concept2 RowErg result shows an inline error at that row. An otherwise saved ineligible result explains what is missing on its detail page.
5. Selecting a template preserves its link while actuals change; changing the plan makes the link change explicit.
6. No plan operation silently overwrites actual values, drops RWN guidance, posts to Concept2, or changes an existing publication.
