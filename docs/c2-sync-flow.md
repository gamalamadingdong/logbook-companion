# C2 Data Sync & Template Matching: Technical Reference

> **Last Updated**: 2026-02-06  
> **Status**: Complete

This document details how Concept2 (C2) workout data flows through the Logbook Companion system, from API fetch to database storage and template matching.

---

---

## Architecture Overview

```mermaid
flowchart TB
    subgraph Frontend["Frontend (Browser)"]
        UI[Sync.tsx UI]
        Hook[useConcept2Sync Hook]
    end
    
    subgraph C2API["Concept2 API"]
        Results[/users/me/results]
        Detail[/users/me/results/:id]
        Strokes[/users/me/results/:id/strokes]
    end
    
    subgraph Processing["Data Processing"]
        Naming[workoutNaming.ts]
        Zones[zones.ts]
        Normalize[workoutNormalization.ts]
        Bucketing[powerBucketing.ts]
    end
    
    subgraph Database["Supabase"]
        WorkoutLogs[(workout_logs)]
        Templates[(workout_templates)]
        Baseline[(user_baseline_metrics)]
        PowerDist[(workout_power_distribution)]
    end
    
    UI --> Hook
    Hook --> Results --> Detail --> Strokes
    Detail --> Naming --> Normalize --> Hook
    Strokes --> Bucketing --> Hook
    Bucketing --> PowerDist
    Hook --> WorkoutLogs
    Hook --> Templates
    Baseline --> Zones
    
    note["Data Storage Strategy:<br>1. Raw Data (Full JSON)<br>2. Power Histogram (Separate Table)<br>3. Zone Distribution (Snapshot)"]
    WorkoutLogs -.-> note
    PowerDist -.-> WorkoutLogs
```

---

## Sync Flow Summary

| Step | Description | Key File |
|------|-------------|----------|
| 1 | User clicks "Start Sync" | `Sync.tsx` |
| 2 | Match C2 email to Supabase user | `useConcept2Sync.ts:66-69` |
| 3 | Fetch baseline 2k watts for zone calculations | `useConcept2Sync.ts:72-78` |
| 4 | Fetch paginated workout summaries | `useConcept2Sync.ts:80-116` |
| 5 | Check existing records to skip duplicates | `useConcept2Sync.ts:127-135` |
| 6 | For each workout: fetch detail + strokes | `useConcept2Sync.ts:171-178` |
| 7 | **Filter Work Strokes & Calculate Power Buckets** (New) | `zones.ts` (Update needed) |
| 8 | Calculate zone distribution (Snapshot) | `zones.ts:73-148` |
| 9 | Generate canonical name (RWN) | `workoutNaming.ts:45-296` |
| 10 | Map C2 fields to database columns | `useConcept2Sync.ts:184-237` |
| 11 | Upsert to database (conflict on `external_id`) | `supabase.ts:87-99` |
| 12 | Match workout to template | `templateMatching.ts:62-85` |
| 13 | Rate limit: 500ms between workouts | `useConcept2Sync.ts:260-261` |
| 14 | Update PR cache | `prDetection.ts:38-109` |

---

## Hybrid Data Model (Buckets + Zones)

To support future baseline changes while maintaining performant queries, we use a hybrid storage approach:

### 1. Raw Power Buckets (`workout_power_distribution`)
*   **Format**: JSONB `{ "150": 30, "155": 45, "160": 10 }` (Watts -> Duration in Seconds)
*   **Storage**: Separate table, 1:1 with `workout_logs`.
*   **Source**: Calculated from **WORK strokes only**.
*   **Filtering Logic**: 
    - For `JustRow`/`FixedDistance`/`FixedTime`: All strokes are work.
    - For `Intervals`: Map strokes to interval times. **Exclude rest intervals.**
*   **Purpose**: "Source of Truth" for intensity. Allows retroactive zone recalculation.

### 2. Zone Snapshot (`zone_distribution`)
*   **Format**: JSONB `{ "UT2": 600, "UT1": 300, ... }`
*   **Source**: Derived from `power_histogram` + `current_baseline_watts` at sync time.
*   **Purpose**: **Fast filtering & Indexing**. Used for "Show me AT workouts" queries.

---

## Zone Distribution Calculation

Zones are classified based on percentage of user's 2k watts:

| Zone | % of 2k Watts | Description |
|------|---------------|-------------|
| UT2 | < 60% | Steady state, recovery |
| UT1 | 60-75% | Hard steady |
| AT | 75-90% | Threshold |
| TR | 90-105% | VO2 Max |
| AN | > 105% | Anaerobic |

**Data Priority** (highest fidelity first):
1. Stroke data (per-stroke power)
2. Interval data
3. Split data

---

## Canonical Name Generation

The system generates standardized RWN strings for template matching:

| Input Type | Example Output |
|------------|----------------|
| Uniform intervals | `8x500m/1:30r` |
| Variable intervals | `v500/750/1000m` |
| Pyramid | `v250/500/1000/500/250m Pyramid` |
| Single distance | `5000m` |
| Time piece | `30:00` |
| JustRow | `2345m JustRow` |

---

## Template Matching

1. **Normalize** canonical name (strip `[w]`, `[c]`, `[t]` tags, remove "JustRow")
2. **Query** templates where `canonical_name` matches
3. **Prioritize** user's own templates, then highest `usage_count`
4. **Update** `workout_logs.template_id`

---

## Database Field Mapping

| C2 Field | DB Column | Transformation |
|----------|-----------|----------------|
| `id` | `external_id` | `toString()` |
| `date` | `completed_at` | ISO timestamp |
| `distance` | `distance_meters` | Direct |
| `time` | `duration_seconds` | `/ 10` (deciseconds) |
| `watts` | `watts` | `Math.round()` |
| `stroke_rate` | `average_stroke_rate` | `Math.round()` |
| Full response | `raw_data` | JSON |
| Calculated | `power_histogram` | **Separate Table** (`workout_power_distribution`) |
| Calculated | `zone_distribution` | JSON (Snapshot) |
| Calculated | `canonical_name` | RWN string |
| Calculated | `avg_split_500m` | `(time/distance) * 500` |

---

## Known Issues

### Critical
1. **Email mismatch blocks sync** - No fallback to C2 user_id
2. **Canonical name falls back to "Unknown"** - When intervals empty but splits exist
3. **Template history uses wrong columns** - `workout_date` vs `completed_at`

### Moderate
4. Zone calculation first-stroke assumption
5. PR detection filters out "1x2000m" patterns
6. Template personal best uses `watts` which can be null
7. Warmup/cooldown stripped in normalization
8. Unknown workout types not logged

### Minor
9. Hardcoded 500ms rate limit
10. Fallback baseline of 202W
11. Stroke `p` field ambiguity (watts vs pace)
12. Season always starts May 1st
13. No sync progress persistence

---

## Key Files

| File | Purpose |
|------|---------|
| `src/hooks/useConcept2Sync.ts` | Main sync orchestrator |
| `src/api/concept2.ts` | C2 API client |
| `src/utils/workoutNaming.ts` | Canonical RWN generation |
| `src/utils/workoutNormalization.ts` | Name cleanup for matching |
| `src/utils/zones.ts` | Zone distribution calculation |
| `src/utils/templateMatching.ts` | Workout ↔ Template linking |
| `src/utils/prCalculator.ts` | PR detection logic |
| `src/services/supabase.ts` | Database operations |
