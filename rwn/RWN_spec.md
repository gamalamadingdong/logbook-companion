# Rowers Workout Notation (RWN) Specification
**Version:** 0.1.0-draft
**Status:** Request for Comment (RFC)

## 1. Introduction

Rowers Workout Notation (RWN) is a standardized text-based format for describing rowing workouts. It is design to be:
- **Human-readable**: Easy to read and write by coaches and athletes.
- **Machine-parseable**: Unambiguous structure for software (logbooks, erg monitors).
- **Universal**: Applicable to both indoor machine (ergometer) and on-water rowing.

### 1.1 Motivation

While the rowing community has developed informal conventions for describing workouts (e.g., `4x500m/1:00r`, `3x20' @UT2`), **no formal, machine-parseable standard exists**. This leads to:
- **Inconsistency**: Training plans use varying notation styles, making automation difficult.
- **Limited tooling**: Apps and logbooks cannot reliably parse workout descriptions.
- **Fragmentation**: Coaches and athletes must manually translate workouts between platforms.

RWN aims to provide a **lightweight, unambiguous syntax** that:
- Preserves the readability of existing conventions.
- Enables software to programmatically generate, validate, and execute workouts.
- Supports modern training methodologies (relative pace targets, multi-erg workouts).


## 2. Basic Structure

A workout is defined as a sequence of **Work Intervals** and optional **Rest Intervals**.

### 2.1 Standard Interval Notation
For workouts with uniform work and rest steps:

```
[Repeats] x [Work Component] / [Rest Component]r
```

**Examples:**
- `4x500m/1:00r` → 4 intervals of 500 meters with 1 minute rest.
- `3x20:00/2:00r` → 3 intervals of 20 minutes with 2 minutes rest.
- `10x1:00/1:00r` → 10 intervals of 1 minute on, 1 minute off.

### 2.2 Steady State
Single continuous efforts are denoted by their total duration or distance.

**Examples:**
- `10000m` → 10k steady state.
- `30:00` → 30 minutes steady state.

## 3. Component Definitions

### 3.1 Work Components
Work components define the effort phase.

| Type | Syntax | Example | Note |
|:---|:---|:---|:---|
| **Distance** | `[Number]m` | `2000m` | integer meters |
| **Time** | `[M]:[SS]` | `30:00` | minutes:seconds |
| **Calories** | `[Number]cal` | `300cal` | integer calories |

### 3.2 Rest Components
Rest components define the recovery phase. In RWN, rest is strictly **time-based** to maintain compatibility with standard monitors (PM5).

**Syntax:** `[M]:[SS]r` or `[S]sr` (optional suffix 'r' to denote rest context).

**Undefined Rest:** Use `/...r` or `/ur` to denote indefinite rest intervals (PM5 "Undefined Rest").
- `4x2000m/...r` (2k repeats with undefined rest)
- `10x500m/...r` (Relay format: Row 500m, wait for partner to finish their leg)

## 4. Extended Syntax (Guidance)

RWN supports optional guidance parameters appended to components using the `@` symbol.

### 4.1 Stroke Rate
Target cadence in Strokes Per Minute (SPM).

**Syntax:** `@[Number]spm` or `r[Number]`

**Examples:**
- `30:00@r20` → 30 mins at rate 20.
- `8x500m/1:00r@r32` → Intervals at rate 32.

### 4.2 Pace Targets
Target intensity by split (time/500m).

**Syntax:** 
- Absolute: `@[M]:[SS]`
- Reference: `@2k`, `@5k`, `@6k`, `@30m`, `@60m`
- Relative: `@2k+[offset]`, `@2k-[offset]`

**Examples:**
- `2000m@1:45` → 2k test at 1:45 split
- `10x500m@2k/3:00r` → 10x500m at 2k PR pace
- `5000m@2k+10` → 5000m at 10 seconds slower than 2k PR pace
- `4x1000m/3:30r@1:50`

### 4.3 Intensity Zones
Subjective or heart-rate based intensity zones.

**Syntax:** `@[Zone]`

**Examples:**
- `3x20:00/2:00r@UT2`
- `10x1:00/1:00r@AN`

## 5. Segmented Workouts (Compound)
Workouts composed of distinct segments without rest (e.g., warmups, rate steps) are linked with the `+` operator.

**Syntax:** `[Segment1] + [Segment2] + ...`

### 5.1 Simple segments
- `2000m + 1000m` (Continuous 3k row, recorded as two distinct intervals on PM5)

### 5.2 Rate Progressions / Steps
For complex pieces with internal rate changes (e.g., "10min at 22, 5min at 26"):
- `10:00@r22 + 5:00@r26` 
- `15:00 (5:00@r20 + 5:00@r24 + 5:00@r28)`

> **PM5 Note:** These map to **Variable Interval** workouts with **Undefined (0) Rest**. This ensures the monitor advances precisely at the segment boundary, capturing split data for each specific rate step.

### 5.3 Complex Repeats (Parenthesis Grouping)
To repeat a compound segment, wrap it in parentheses.
- `3 x (10:00@UT2 + 5:00@UT1) / 2:00r`
- `2 x (2000m + 1000m) / 5:00r`

This describes the user's "3 blocks of 15 minutes" scenario:
`3 x (10:00@UT2 + 5:00@UT1)` (Continuous if no rest specified) or `3 x (10:00@UT2 + 5:00@UT1) / ...r` (if undefined rest).

## 6. Split Resolution (PM5)
To specify how the monitor should record data splits (the "Splits" setting on a PM5), use square brackets `[]`.

**Syntax:** `[Workout] [[SplitValue]]`

**Examples:**
- `10000m [2000m]` → 10k row with 2k splits.
- `30:00 [5:00]` → 30 minutes with 5 minute splits.

## 7. Variable Interval Syntax
For workouts where intervals change (pyramids, variable sets), steps are delimited by slashes or grouped.

**Pyramid / Variable List:**
```
[Step1] / [Step2] / [Step3] ...
```
Examples: `v500m/1000m/500m` or `(500m/1:00r) + (1000m/2:00r)`

## 8. Formal Grammar (EBNF Draft)

```ebnf
workout         = segment_sequence , [ split_config ] ;
segment_sequence= simple_workout | interval_workout | compound_workout ;

compound_workout= simple_workout , { " + " , simple_workout } ;

simple_workout  = work_component , [ guidance ] ;
interval_workout= repeats , "x" , work_component , [ "/" , rest_component ] , [ guidance ] ;

repeats         = integer ;
work_component  = distance | time | calories ;
rest_component  = time , "r" ;
split_config    = " [" , ( distance | time ) , "]" ;

distance        = integer , "m" ;
time            = integer , ":" , integer ;
calories        = integer , "cal" ;

```


## 9. Machine Types & Mixed Modalities
RWN supports non-rowing activities using a `Type:` prefix.

**Syntax:** `[Type]: [Content]`

### 9.1 Supported Types
*   `Row`, `Ski`, `Bike` (Standard C2 Ergs - standard RWN parsing applies)
*   `Run` (Running)
*   `Other` (Generic)

### 9.2 Parsing Logic
*   **Strict Mode (Ergs):** `Row`, `Ski`, `Bike` expect standard RWN syntax (distance/time/rest).
*   **Flexible Mode (Run/Other):**
    *   **Leading Quantities:** If the text starts with a standard quantity (e.g., `400m`, `10:00`), it is parsed as a Work Component.
    *   **Free Text:** Any remaining text is treated as a description/label.

**Examples:**
*   `Bike: 15000m` -> Type: Bike, Distance: 15000
*   `Ski: 8x500m/3:30r` -> Type: Ski, Interval Workout
*   `Run: 5k @20:00` -> Type: Run, Distance: 5000


### 9.1 Supported Types
*   `Row`, `Ski`, `Bike` (Standard C2 Ergs - standard RWN parsing applies)
*   `Run` (Running)
*   `Other` (Generic)

### 9.2 Parsing Logic
*   **Strict Mode (Ergs):** `Row`, `Ski`, `Bike` expect standard RWN syntax (distance/time/rest).
*   **Flexible Mode (Run/Other):**
    *   **Leading Quantities:** If the text starts with a standard quantity (e.g., `400m`, `10:00`), it is parsed as a Work Component.
    *   **Free Text:** Any remaining text is treated as a description/label.

**Examples:**
*   `Run: 400m` -> Type: Run, Distance: 400
*   `Run: 15:00 Tempo` -> Type: Run, Time: 15:00, Note: "Tempo"
*   `Other: 10 Burpees` -> Type: Other, Note: "10 Burpees" (Initial number captured if possible, else raw text)
*   `Row: 2000m + Other: 2:00 Plank + Row: 2000m` (Compound mixed workout)


## 10. Tags & Metadata
RWN supports metadata tagging for workout segments using the `#` symbol.

### 10.1 Standard Tags
Tags are used to annotate the purpose of a segment.
-   `#warmup`: Denotes a warmup segment. `erg-link` may eventually treat this as a separate program or unverified segment.
-   `#cooldown`: Denotes a cooldown segment.
-   `#test` (or `#benchmark`): Flags the workout as a benchmark/test piece.

### 10.2 Syntax
Tags are appended to the component description.
-   `2000m #warmup`
-   `10:00 #cooldown`
-   `2000m #warmup + 4x500m/2r + 1000m #cooldown`

### 10.3 Parsing Behavior
-   Tags are stripped from the core component parsing (e.g. `2000m` is still parsed as Distance).
-   Tags are stored in the workout structure's metadata.

## 11. Implementation & Verification Rules

> [!IMPORTANT]
> **End-to-End Verification Rule**:
> Whenever a change is made to the RWN schema (parsing logic, new tags, structure definitions), **EVERY** consuming component must be verified.
>
> **Checklist:**
> 1.  **Parser**: `rwnParser.ts` (Does it parse correctly?)
> 2.  **Types**: `workoutStructure.types.ts` (Are types updated?)
> 3.  **Database**: `db_schema.sql` (Do we need new columns/indexing?)
> 4.  **UI - Workout Detail**: `WorkoutDetail.tsx` (Viewing & Editing)
> 5.  **UI - Template Editor**: `TemplateEditor.tsx` (Creation & Quick Create)
> 6.  **UI - Dev Tools**: `RWNPlayground.tsx` (Visualization)
> 7.  **Service Layer**: `workoutService.ts` (Persistence)


