# Rowing Workout Notation (RWN) Specification
**Version:** 0.1.0-draft
**Status:** Request for Comment (RFC)

## 1. Introduction

Rowing Workout Notation (RWN) is a standardized text-based format for describing rowing workouts. It is design to be:
- **Human-readable**: Easy to read and write by coaches and athletes.
- **Machine-parseable**: Unambiguous structure for software (logbooks, erg monitors).
- **Universal**: Applicable to both indoor machine (ergometer) and on-water rowing.

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

**Syntax:** `@[M]:[SS]`

**Examples:**
- `2000m@1:45` → 2k test at 1:45 split.
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

**Examples:**
- `10:00 warmup (3:00@r18 + 3:00@r20 + 4:00@r22)`
- `2000m + 1000m` (Continuous 3k row)

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

guidance        = { "@" , ( rate | pace | zone ) } ;
```
