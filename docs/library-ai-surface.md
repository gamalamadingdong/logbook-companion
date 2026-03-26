# Authenticated Library AI Surface

This document describes the first internal machine-facing retrieval surface for the workout library.

## Status

- Internal-only
- Read-only
- Authenticated with Supabase bearer token
- Published templates only
- No public anonymous access in v1

This surface is intentionally **not** a public API yet. Public machine access is deferred until rate limiting, external-consumer policy, and abuse controls are defined.

## Functions

### `library-search`

Searches published workout templates and returns a normalized summary contract for retrieval, ranking, and planning workflows.

#### Auth

- Requires `Authorization: Bearer <supabase-jwt>`
- Rejects missing or invalid tokens with `401`

#### Query params

- `search`
- `workout_type`
- `training_zone`
- `difficulty_level`
- `tier=community|standard`
- `duration_min`
- `duration_max`
- `sort=popular|recent`
- `limit`
- `offset`

#### Notes

- Always filters to `status = published`
- Never returns drafts
- Validates `training_zone`, `tier`, and duration bounds before querying

#### Response shape

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "4 x 8min UT1",
      "description": "Long aerobic intervals",
      "workout_type": "erg",
      "training_zone": "UT1",
      "difficulty_level": "intermediate",
      "estimated_duration": 2880,
      "validated": true,
      "tier": "standard",
      "rwn": "4x8:00/2:00r @UT1",
      "canonical_name": "4x 8:00",
      "whiteboard_preview": ["4 x 8:00 / 2:00 rest", "@ UT1"],
      "usage_count": 42,
      "last_used_at": "2026-03-24T12:00:00.000Z",
      "reference_stats": {
        "groupAssignmentCount": 12,
        "planWorkoutCount": 5,
        "dailyAssignmentCount": 19
      },
      "tags": ["aerobic", "erg"]
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0
}
```

### `library-template-detail`

Returns one normalized published template detail payload.

#### Auth

- Requires `Authorization: Bearer <supabase-jwt>`
- Rejects missing or invalid tokens with `401`

#### Query params

- `templateId` (required)

#### Notes

- Returns `404` when the template does not exist or is not published
- Uses the same normalized DTO semantics as the public library detail flow
- Includes derived `whiteboard_lines` and aggregate `reference_stats`

## Contract source of truth

Shared DTO logic lives in:

- `src/lib/libraryTemplateDto.ts`
- `src/types/workoutStructure.types.ts`

This is intentional so app UI and machine consumers do not drift on:

- library tier derivation
- whiteboard derivation
- safe field selection
- published/community/standard semantics

## Deployment note

These functions can remain repo-only until the first internal AI/planning caller is ready. If deployed, they should keep:

- JWT verification enabled
- published-template-only behavior
- no ownership metadata
- no reviewer-only fields
