# RWN Requirements Specification

> **Version**: 0.1.0  
> **Status**: Draft  
> **Related**: [RWN_spec.md](./RWN_spec.md) (Technical Spec)

This document defines the **requirements** for Rowers Workout Notation (RWN). It serves as the "English version" that translates to the formal spec and test harness for validation.

---

## 1. Purpose & Scope

### 1.1 What RWN Must Do

RWN is a text notation for describing rowing workouts that must:

1. **Be Human-Readable** - Coaches and athletes can read/write it without training
2. **Be Machine-Parseable** - Unambiguous structure for software parsing
3. **Support All Workout Types** - Intervals, steady state, pyramids, compounds
4. **Support Guidance** - Pace targets, stroke rate, intensity zones
5. **Map to PM5** - Every valid RWN should execute on a Concept2 PM5 monitor

### 1.2 Use Cases

| Use Case | Priority | Description |
|----------|----------|-------------|
| **UC-1** | P0 | Parse C2 workout data into canonical RWN |
| **UC-2** | P0 | Match workouts to templates by normalized RWN |
| **UC-3** | P0 | Display workout structure in UI |
| **UC-4** | P1 | Generate PM5-compatible workout from RWN |
| **UC-5** | P1 | Allow coaches to define training plans in RWN |
| **UC-6** | P1 | Calculate estimated duration: **total**, **work**, and **rest** separately |
| **UC-7** | P2 | Validate RWN syntax in real-time editor |

---

## 2. Core Requirements

### 2.1 Work Components

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **WC-1** | Support distance in meters (`1000m`, `2000m`) | P0 | `2000m` → Distance: 2000 |
| **WC-2** | Support time in MM:SS format (`30:00`, `1:00`) | P0 | `30:00` → Time: 1800s |
| **WC-3** | Support calories (`300cal`) | P1 | `300cal` → Calories: 300 |
| **WC-4** | Support watt-minutes (future) | P2 | `500wm` → WattMinutes: 500 |

### 2.2 Rest Components

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **RC-1** | Rest in MM:SS format with `r` suffix | P0 | `1:30r` → Rest: 90s |
| **RC-2** | Rest in seconds with `sr` suffix | P1 | `90sr` → Rest: 90s |
| **RC-3** | Undefined rest with `...r` or `ur` | P0 | `4x2000m/...r` → Rest: undefined |

### 2.3 Interval Notation

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **IN-1** | Standard repeats: `NxDIST/REST` | P0 | `4x500m/1:00r` → 4 intervals |
| **IN-2** | Time-based intervals: `NxTIME/REST` | P0 | `3x20:00/2:00r` → 3 intervals |
| **IN-3** | Single interval can omit `1x` | P1 | `500m/1:00r` = `1x500m/1:00r` |
| **IN-4** | Variable intervals with `/` separator | P1 | `v500m/1000m/500m` → 3 intervals |
| **IN-5** | Pyramid detection from variable | P2 | `v250/500/1000/500/250m` → Pyramid |

### 2.4 Steady State

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **SS-1** | Distance without rest = steady state | P0 | `5000m` → Steady state |
| **SS-2** | Time without rest = steady state | P0 | `30:00` → Steady state |
| **SS-3** | Distinguish from single interval with rest | P0 | `5000m` ≠ `5000m/2:00r` |

### 2.5 Compound Workouts

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **CW-1** | Segments linked with `+` operator | P0 | `2000m + 1000m` → 2 segments |
| **CW-2** | Warmup + main + cooldown structure | P0 | `[w]10:00 + 5x500m + [c]5:00` |
| **CW-3** | Grouped repeats with parentheses | P1 | `3x(10:00 + 5:00)/2:00r` |

---

## 3. Guidance Requirements

### 3.1 Stroke Rate

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **SR-1** | Single rate: `@r20` or `@20spm` | P0 | `30:00@r20` → Rate: 20 |
| **SR-2** | Rate range: `@r18..22` or `@18..22spm` | P1 | `60:00@r18..22` → Rate: 18-22 |
| **SR-3** | Legacy range with `-`: `@18-22spm` | P2 | Still parsed, canonical uses `..` |

### 3.2 Pace Targets

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **PT-1** | Absolute pace: `@1:45` | P0 | `2000m@1:45` → Pace: 105s |
| **PT-2** | Pace range: `@2:05..2:10` | P1 | → Pace: 125-130s |
| **PT-3** | Reference pace: `@2k`, `@5k`, `@6k` | P1 | User's PR as baseline |
| **PT-4** | Relative pace: `@2k+10`, `@2k-5` | P1 | Offset from reference |
| **PT-5** | Relative range: `@2k+5..2k+10` | P2 | Range from reference |

### 3.3 Intensity Zones

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **IZ-1** | Zone markers: `@UT2`, `@UT1`, `@AT`, `@TR`, `@AN` | P0 | `5000m@UT2` → Zone: UT2 |

### 3.4 Combined Guidance

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **CG-1** | Chain multiple with `@`: `@UT2@r20` | P1 | Both zone and rate apply |
| **CG-2** | Order doesn't matter: `@r20@UT2` = `@UT2@r20` | P1 | Same result |

---

## 4. Metadata Requirements

### 4.1 Block Tags

> **Scope Note:** Block tags are designed for **erg workout structure** (warmup, cooldown, test phases).
> For non-erg activities (strength, stretching, core), use `Other:` machine type with free text.
> Full practice capture (erg + gym + stretch) may be better modeled as a **Training Session** containing multiple workouts.

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **BT-1** | Warmup tag: `[w]` | P0 | `[w]10:00` → blockType: warmup |
| **BT-2** | Cooldown tag: `[c]` | P0 | `[c]5:00` → blockType: cooldown |
| **BT-3** | Test/benchmark tag: `[t]` | P0 | `[t]2000m` → blockType: test |
| **BT-4** | Tags are prefix, not suffix | P0 | `[w]10:00` not `10:00[w]` |
| **BT-5** | Tags don't affect canonical matching | P0 | `[w]5000m` matches template `5000m` |

### 4.2 Inline Tags

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **IT-1** | Hash notation: `#warmup`, `#cooldown`, `#test` | P1 | `2000m #warmup` |
| **IT-2** | Convert to block tags in canonical form | P1 | → `[w]2000m` |

### 4.3 Split Resolution

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **SP-1** | Split config suffix: `[2000m]`, `[5:00]` | P2 | `10000m [2000m]` → Split every 2k |
| **SP-2** | Distinguish from block tags (has number) | P2 | `[w]` vs `[2000m]` |

---

## 5. Machine Type Requirements

| ID | Requirement | Priority | Test Case |
|----|-------------|----------|-----------|
| **MT-1** | Support `Row:`, `Ski:`, `Bike:` prefixes | P1 | `Bike: 15000m` |
| **MT-2** | Support `Run:`, `Other:` for cross-training | P2 | `Run: 5k` |
| **MT-3** | Mixed modality with `+` | P2 | `Row: 2000m + Other: Plank` |

> **Future Consideration:** `Other:` with free text may not be ideal for structured circuit/strength training.
> Consider dedicated notation for circuits (e.g., `Circuit: 3x(10 burpees + 20 squats + 30s plank)`) if demand exists.

---

## 6. Partner & Relay Workouts (Future Consideration)

> **Status:** Not in current scope. Documenting for future reference.

Partner and relay workouts have unique structures not yet covered:

| Scenario | Example | Current Workaround |
|----------|---------|-------------------|
| **Alternating relay** | 20x500m, you-me-you-me | `20x500m/...r` + note "partner" in description |
| **Team relay** | Team 10k, 500m legs, 3 people | `20x500m/...r` + note "3-person relay" |
| **Tandem** | Row together for 5k | `5000m` (already works) |

**Potential future syntax:**
- `1/2x20x500m/...r` → You do 10 of 20 legs (fraction prefix)
- `20x500m/...r #partner` → Tag for partner workout
- `20x500m/...r #relay(3)` → 3-person rotation

**Recommendation:** For now, use `...r` (undefined rest) and capture context in workout description.

---

## 7. Parsing Requirements

### 6.1 Correctness

| ID | Requirement | Priority |
|----|-------------|----------|
| **PR-1** | Any valid RWN string must parse without error | P0 |
| **PR-2** | Invalid RWN must return descriptive error | P0 |
| **PR-3** | Whitespace should be normalized | P0 |
| **PR-4** | Case-insensitive for keywords (`M`, `m`, `R`, `r`) | P1 |

### 6.2 Round-Trip

| ID | Requirement | Priority |
|----|-------------|----------|
| **RT-1** | `parse(stringify(parse(rwn)))` = `parse(rwn)` | P0 |
| **RT-2** | Canonical output should be minimal and consistent | P0 |
| **RT-3** | Prefer block tags over inline tags in output | P1 |

### 6.3 Tolerance

| ID | Requirement | Priority |
|----|-------------|----------|
| **TL-1** | Accept common variations (e.g., `1:00r` or `1:00 r`) | P1 |
| **TL-2** | Accept legacy range syntax (`-` vs `..`) | P1 |
| **TL-3** | Accept optional spaces around `+` | P1 |
| **TL-4** | Accept `NNrNN` shorthand as rate (e.g., `30r20` → `30:00@r20`) | P2 |

> **Alignment Note (Verified 2026-02-06):**
> - **Spec**: `@r20` prefix notation documented in Section 4.1 ✅
> - **Parser**: `rwnParser.ts` lines 106-122 handle `@r[N]` and `@[N]spm` ✅
> - **Tests**: `rwnParser.test.ts` covers `@r20`, `@r24-28`, `@r24..28`, `@18-22spm` ✅
> - **Gap**: Shorthand `30r20` (without `@`) not yet implemented in parser

---

## 7. Template Matching Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| **TM-1** | Normalize by stripping block tags before match | P0 |
| **TM-2** | Remove "JustRow" suffix for matching | P0 |
| **TM-3** | Normalize spacing and separators | P0 |
| **TM-4** | Match user templates first, then community | P0 |
| **TM-5** | Consider fuzzy matching for near-canonical (future) | P2 |

---

## 8. Canonical Name Generation Requirements

**Purpose:** Canonical names are used specifically for:
- **C2 Sync** → Generate from C2 workout data
- **Template Matching** → Compare `workout_logs.canonical_name` to `workout_templates.canonical_name`
- **PR Detection** → Identify standard distance/interval patterns
- **Deduplication** → Find workouts with same structure

> **Note:** Canonical name is the **bare structure** (e.g., `8x500m/1:30r`), NOT the full RWN with guidance (`8x500m/1:30r@UT2@r32`).

| ID | Requirement | Priority |
|----|-------------|----------|
| **CN-1** | Uniform intervals → `NxDIST/RESTr` | P0 |
| **CN-2** | Variable intervals → `vDIST/DIST/DISTm` | P0 |
| **CN-3** | Single distance → `DISTm` | P0 |
| **CN-4** | Single time → `MM:SS` | P0 |
| **CN-5** | Unknown structure → `Unknown` (flagged for review) | P0 |
| **CN-6** | Round to standard distances with **tight tolerances** (see Appendix A) | P1 |
| **CN-7** | Detect pyramid patterns | P2 |
| **CN-8** | Prefer interval-level data over total distance when available | P1 |

---

## 9. PM5 Compatibility Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| **PM-1** | Every interval workout must map to PM5 Variable Interval | P1 |
| **PM-2** | Compound segments map to Variable with 0 rest | P1 |
| **PM-3** | Undefined rest maps to PM5 "Undefined Rest" | P1 |
| **PM-4** | Split config maps to PM5 split setting | P2 |
| **PM-5** | Calorie targets map to PM5 calorie intervals | P2 |

---

## 10. Test Harness Requirements

The test suite must validate:

| Category | Test Count | Description |
|----------|------------|-------------|
| **Basic Parsing** | 20+ | Work components, rest, intervals |
| **Guidance** | 15+ | Pace, rate, zones, combined |
| **Tags** | 10+ | Block tags, inline tags, canonical |
| **Compound** | 10+ | Segments, groups, pyramids |
| **Round-Trip** | 10+ | Parse → stringify → parse |
| **Edge Cases** | 15+ | Empty, invalid, edge values |
| **C2 Mapping** | 20+ | Real C2 data → canonical name |

---

## 11. Acceptance Criteria

### 11.1 For Spec Completeness

- [ ] All P0 requirements have corresponding spec sections
- [ ] All P0 requirements have test cases
- [ ] EBNF grammar covers all valid syntax
- [ ] Examples cover all major patterns

### 11.2 For Parser Implementation

- [ ] Parser passes all test cases
- [ ] Round-trip tests pass
- [ ] C2 data generates valid canonical names
- [ ] Template matching works with canonical names

### 11.3 For PM5 Export (Future)

- [ ] Generated workouts execute on PM5
- [ ] Split data is captured correctly
- [ ] Rest intervals behave as specified

---

## Appendix A: Standard Distances & Rounding

### A.1 Rounding Rules

For canonical name generation, use **tight tolerances** (1-2%) to avoid false matches:

| Distance | Tolerance | % | Rationale |
|----------|-----------|---|----------|
| 500m | ±10m | 2% | Short distances should be precise |
| 1000m | ±20m | 2% | Standard benchmark |
| 2000m | ±20m | 1% | 2k tests must be exact |
| 5000m | ±50m | 1% | Minor overrun OK |
| 6000m | ±60m | 1% | Standard benchmark |
| 10000m | ±100m | 1% | Minor overrun OK |
| 21097m (HM) | ±200m | 1% | Marathon standard |
| 42195m (FM) | ±400m | 1% | Marathon standard |

### A.2 Rounding Concerns & Edge Cases

| Scenario | Problem | Recommendation |
|----------|---------|----------------|
| **Partial workout** | User stopped at 4800m, shouldn't match 5k | Do NOT round if outside tolerance |
| **Overshoot** | User did 5032m (overran monitor) | Round to 5k ✅ |
| **Composite distance** | Warmup + main totaled together | Use interval data if available |
| **Non-standard** | 4150m race | Do NOT force into 4k or 5k |
| **Warmup included** | 2000m test + 500m cooldown = 2500m total | Parse intervals, not summary |

### A.3 Implementation Guidance

1. **Prefer interval-level data** - If C2 says "4 intervals of 500m", use that, not total distance
2. **Only round within tolerance** - Outside tolerance → use exact distance
3. **Flag uncertainty** - Consider `canonical_name_confidence: 'exact' | 'rounded' | 'inferred'`

---

## Appendix B: Canonical Output Examples

| Input (various forms) | Canonical Output |
|-----------------------|------------------|
| `4 x 500m / 1:00 r` | `4x500m/1:00r` |
| `500m #warmup + 2000m #test` | `[w]500m + [t]2000m` |
| `8x500m@r32@1:50/90sr` | `8x500m/1:30r@1:50@r32` |
| `3x(10:00+5:00)/2:00r` | `3x(10:00 + 5:00)/2:00r` |
