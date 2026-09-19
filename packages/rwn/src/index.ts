/**
 * @readyall/rwn — Rowing Workout Notation
 *
 * A zero-dependency parser, serializer, and whiteboard renderer for
 * the RWN workout notation format used in rowing/ergometer training.
 */

// ── Types ──────────────────────────────────────────────────────
export type {
    WorkoutStructure,
    SteadyStateStructure,
    IntervalStructure,
    VariableStructure,
    IntervalStep,
    RestStep,
    WorkoutStep,
    SessionExtension,
    BlockType,
} from './types';

// ── Parser ─────────────────────────────────────────────────────
export {
    parseRWN,
    validateRWN,
    estimateDuration,
    formatDuration,
} from './parser';

export type {
    RWNValidationResult,
    DurationEstimate,
} from './parser';

// ── Serializer (Structure → RWN string) ────────────────────────
export { structureToRWN } from './serializer';

// ── Whiteboard (Structure → coach whiteboard lines) ────────────
export { structureToWhiteboard } from './whiteboard';

// ── PM5 translation (RWN structure → PM5-applicable subset) ──────
export { lowerWorkoutStructureToPm5, translateWorkoutToPm5 } from './pm5';
export type {
    Pm5LoweringMode,
    Pm5LoweringResult,
    Pm5TranslationMode,
    Pm5TranslationResult,
    Pm5WorkoutInterval,
    Pm5WorkoutSpec,
} from './pm5';
