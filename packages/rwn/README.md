# @readyall/rwn

**Rowing Workout Notation** — a zero-dependency TypeScript parser, serializer, and whiteboard renderer for the RWN workout notation format.

## What is RWN?

RWN (Rowing Workout Notation) is a standardized text-based format for describing rowing workouts. It is:

- **Human-readable**: `4x500m/1:00r` — 4 intervals of 500m with 1 minute rest
- **Machine-parseable**: Unambiguous structure for software (logbooks, erg monitors)
- **Universal**: Indoor ergometer and on-water rowing

## Installation

```bash
npm install @readyall/rwn
```

## Quick Start

```typescript
import { parseRWN, structureToRWN, structureToWhiteboard, validateRWN } from '@readyall/rwn';

// Parse an RWN string into a structured object
const structure = parseRWN('4x500m/1:00r');
// → { type: 'interval', repeats: 4, work: { type: 'distance', value: 500 }, rest: { type: 'time', value: 60 } }

// Validate with detailed feedback
const result = validateRWN('[w]10:00 + 4x500m/1:00r@r24 + [c]5:00');
// → { valid: true, errors: [], structure: { ... } }

// Serialize back to RWN string
const rwn = structureToRWN(structure);
// → '4x500m/1:00r'

// Generate whiteboard lines for coaches
const lines = structureToWhiteboard(structure);
// → ['4× 500m / 1:00r']
```

## API

### `parseRWN(input: string): WorkoutStructure | null`

Parses an RWN string into a `WorkoutStructure` object. Returns `null` if the input cannot be parsed.

### `validateRWN(input: string): RWNValidationResult`

Validates an RWN string and returns detailed errors/warnings alongside the parsed structure.

### `estimateDuration(input: string, defaultPace?: string): DurationEstimate | null`

Estimates total workout duration (work time, rest time, distance) from an RWN string.

### `formatDuration(seconds: number): string`

Formats a duration in seconds to a human-readable string (e.g., `"1:30:00"`).

### `structureToRWN(structure: WorkoutStructure): string`

Serializes a `WorkoutStructure` back to an RWN string.

> **Note:** The serializer does not yet preserve all guidance fields (target pace, rate, modality). Core structure (type, values, rests) round-trips faithfully.

### `structureToWhiteboard(structure: WorkoutStructure): string[]`

Converts a workout structure into terse whiteboard-style lines — the kind of thing a coach would write on a dry-erase board before practice.

## RWN Syntax Examples

| RWN | Description |
|---|---|
| `5000m` | 5K steady state |
| `30:00` | 30 minutes steady state |
| `4x500m/1:00r` | 4 × 500m intervals with 1 min rest |
| `3x20:00/2:00r` | 3 × 20 min intervals with 2 min rest |
| `5000m@UT2` | 5K at UT2 pace |
| `4x500m/1:00r@r24` | 4 × 500m at rate 24 |
| `[w]10:00 + 4x500m/1:00r + [c]5:00` | Warmup + intervals + cooldown |
| `500m/1:00r + 1000m/2:00r + 500m/1:00r` | Variable pyramid |

## Types

All types are exported:

```typescript
import type {
  WorkoutStructure,       // Discriminated union: steady_state | interval | variable
  SteadyStateStructure,   // Single continuous effort
  IntervalStructure,      // Fixed repeating intervals
  VariableStructure,      // Mixed/pyramid patterns
  IntervalStep,           // Work phase of an interval
  RestStep,               // Rest phase (always time-based)
  WorkoutStep,            // Individual step in variable workouts
  SessionExtension,       // Orchestration (partner, relay, circuit, rotate)
  BlockType,              // Semantic block: warmup | cooldown | test | main
  RWNValidationResult,
  DurationEstimate,
} from '@readyall/rwn';
```

## Spec

See the full [RWN Specification](https://github.com/gamalamadingdong/logbook-companion/blob/main/rwn/RWN_spec.md) for the complete grammar and semantics.

## License

MIT
