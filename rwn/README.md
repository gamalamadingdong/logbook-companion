# Rowers Workout Notation (RWN)

This directory contains the specification for **Rowers Workout Notation (RWN)**, a standardized text-based format for describing rowing workouts.

## Files

- **[RWN_spec.md](./RWN_spec.md)** - The complete RWN specification (v0.1.0-draft)

## About RWN

RWN is designed to be:
- **Human-readable**: Easy to read and write by coaches and athletes
- **Machine-parseable**: Unambiguous structure for software (logbooks, erg monitors)
- **Universal**: Applicable to both indoor ergometer and on-water rowing

## Examples

```
4x500m/1:00r          # 4 intervals of 500m with 1 minute rest
30:00 @2k+18          # 30 minutes at 2k split + 18 seconds
Bike: 15000m          # 15k on bike erg
2000m+1000m+500m      # Variable distance workout
```

## Implementation

The reference implementation of the RWN parser is located in:
- `../src/utils/rwnParser.ts` - TypeScript parser
- `../src/components/RWNPlayground.tsx` - Interactive validator

## Status

**Version**: 0.1.0-draft  
**Status**: Request for Comment (RFC)

This specification is open for community feedback and contributions.

## Future Plans

This directory may be extracted into a standalone repository to serve as a language-agnostic specification that can be implemented across multiple platforms and languages.
