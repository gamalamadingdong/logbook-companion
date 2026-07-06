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
