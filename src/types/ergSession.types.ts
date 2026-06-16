/**
 * ErgLink ↔ LogbookCompanion Integration Contract
 *
 * These types define the JSONB shapes stored in the shared Supabase schema
 * that both apps read/write. ErgLink and LogbookCompanion are separate codebases
 * but share these data contracts via the `erg_sessions` and `workout_logs` tables.
 *
 * ┌──────────────────┐        ┌──────────────┐        ┌──────────────────┐
 * │ LogbookCompanion  │──────▶│   Supabase   │◀───────│     ErgLink      │
 * │ (Coach writes     │       │              │        │ (Athlete reads   │
 * │  ActiveWorkout)   │       │ erg_sessions  │        │  ActiveWorkout,  │
 * │                   │       │ workout_logs  │        │  writes ErgUpload│
 * └──────────────────┘        └──────────────┘        └──────────────────┘
 *
 * DATA FLOW:
 * 1. Coach creates session in LC → sets erg_sessions.active_workout (ActiveWorkoutSpec)
 * 2. Athletes join in EL → read active_workout → program PM5 via CSAFE
 * 3. Athletes row → EL buffers strokes locally (IndexedDB)
 * 4. Session ends → EL uploads to workout_logs with ErgLinkUploadMeta in raw_data
 * 5. LC reconciliation picks up the upload (source: 'erg_link_live', Silver priority)
 *
 * VERSIONING: Field `_v` on ActiveWorkoutSpec. EL must handle missing fields gracefully.
 */

// ============================================================================
// 1. ACTIVE WORKOUT SPEC (LC writes → EL reads)
//    Stored in: erg_sessions.active_workout (JSONB)
// ============================================================================

/**
 * The workout specification that a coach writes to `erg_sessions.active_workout`.
 * ErgLink reads this to program the PM5 and to tag the uploaded workout log.
 *
 * PM5 programming fields: type, value, split_value, rest, repeats, intervals
 * Metadata fields: canonical_name, template_id, group_assignment_id, title, start_type
 */
export interface ActiveWorkoutSpec {
  /** Schema version — increment when adding breaking fields */
  _v: 1;

  // ─── PM5 Programming ─────────────────────────────────────────────────────

  /** Workout type for CSAFE command selection */
  type: 'just_row' | 'fixed_distance' | 'fixed_time' | 'interval_distance' | 'interval_time' | 'variable_interval';

  /** Primary value in native units: meters for distance, seconds for time */
  value?: number;

  /**
   * Split/interval length in native units.
   * For fixed workouts: split display distance/time.
   * For fixed intervals: work duration per rep.
   */
  split_value?: number;

  /** Rest between intervals in seconds (fixed intervals only) */
  rest?: number;

  /** Number of interval repeats (fixed intervals only) */
  repeats?: number;

  /**
   * Variable interval steps (variable_interval only).
   * Each step is either work or rest with its own duration.
   */
  intervals?: ActiveWorkoutInterval[];

  // ─── Metadata (for tagging uploads, not sent to PM5) ──────────────────────

  /** Start mode: immediate (athlete starts when ready) or synchronized (race countdown) */
  start_type?: 'immediate' | 'synchronized';

  /**
   * RWN canonical name from the workout template (e.g. "4x500m/2:00r").
   * EL includes this in the upload so LC can match to templates/assignments.
   * If absent, LC falls back to distance+time matching.
   */
  canonical_name?: string | null;

  /**
   * FK to workout_templates.id — the template this workout was created from.
   * EL passes this through to workout_logs.template_id on upload.
   */
  template_id?: string | null;

  /**
   * FK to group_assignments.id — the coaching assignment this session fulfills.
   * EL passes this through so LC can auto-complete the assignment on upload.
   */
  group_assignment_id?: string | null;

  /** Human-readable title for display (e.g. "Morning 5K Test") */
  title?: string | null;
}

/** A single interval step within a variable_interval workout */
export interface ActiveWorkoutInterval {
  /** Whether this step is work or rest */
  type: 'distance' | 'time' | 'rest';
  /** Duration in native units: meters for distance, seconds for time/rest */
  value: number;
  /** Rest after this work step, in seconds (only on work steps) */
  rest?: number;
}

// ============================================================================
// 2. ERGLINK UPLOAD META (EL writes → LC reads)
//    Stored in: workout_logs.raw_data (JSONB)
// ============================================================================

/**
 * The shape of `workout_logs.raw_data` when `source = 'erg_link_live'`.
 * LC reads this to extract stroke data, session context, and reconciliation keys.
 */
export interface ErgLinkUploadMeta {
  /** Identifies this as an EL upload (for type discrimination) */
  source: 'erg_link_live';

  /** FK to erg_sessions.id — the live session this data came from */
  session_id: string;

  /** FK to erg_session_participants.id — the athlete's participant record */
  participant_id: string;

  /**
   * RWN canonical name, echoed from ActiveWorkoutSpec.
   * LC uses this as the primary matching key for templates/assignments.
   */
  canonical_name?: string | null;

  /**
   * FK to group_assignments.id, echoed from ActiveWorkoutSpec.
   * LC uses this to auto-complete coaching assignment for the athlete.
   */
  group_assignment_id?: string | null;

  /**
   * FK to workout_templates.id, echoed from ActiveWorkoutSpec.
   * LC writes this to workout_logs.template_id for template linking.
   */
  template_id?: string | null;

  /** Full stroke buffer from the session */
  strokes: ErgLinkStroke[];
}

/**
 * A single stroke data point from the PM5 BLE stream.
 * Matches ErgLink's PM5Data interface shape but with explicit field names
 * for cross-app clarity.
 */
export interface ErgLinkStroke {
  /** Unix timestamp in ms */
  timestamp: number;
  /** Cumulative distance in meters */
  distance: number;
  /** Current pace in seconds per 500m */
  pace: number;
  /** Strokes per minute */
  strokeRate: number;
  /** Instantaneous watts */
  watts: number;
  /** Heart rate in BPM (if HR belt connected) */
  heartRate?: number;
  /** Cumulative calories */
  calories?: number;
  /** Elapsed time in seconds */
  elapsedTime: number;
}

// ============================================================================
// 3. RECONCILIATION CONTRACT
// ============================================================================

/**
 * Source priority for the Swiss Cheese reconciliation strategy (ADR-015).
 * Higher number = higher trust. A workout can only be upgraded, never downgraded.
 *
 * LC stores `source` as a text column on `workout_logs`.
 * These are the known source values and their priority.
 */
export const SOURCE_PRIORITY = {
  /** Manual entry or OCR — lowest trust */
  manual: 1,
  ocr: 1,
  /** ErgLink live stream — hardware-verified but not C2-verified */
  erg_link_live: 2,
  /** Concept2 Logbook sync — highest trust */
  concept2: 3,
} as const;

export type WorkoutSource = keyof typeof SOURCE_PRIORITY;

// ============================================================================
// 3A. CONCEPT2 BACKGROUND SYNC JOB CONTRACT
//     Phase 1 of docs/c2-background-sync-plan.md: durable Supabase state only.
// ============================================================================

export const C2_SYNC_JOB_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'partial_success',
  'cancelled',
] as const;

export type C2SyncJobStatus = (typeof C2_SYNC_JOB_STATUSES)[number];

export type C2SyncJobRange = 'all' | 'recent' | 'custom' | string;

export interface C2SyncJob {
  id: string;
  user_id: string;
  status: C2SyncJobStatus;
  range: C2SyncJobRange;
  options: Record<string, unknown>;
  current_page: number | null;
  total_pages: number | null;
  total_workouts: number | null;
  processed_count: number;
  saved_count: number;
  skipped_count: number;
  failed_count: number;
  last_error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export type C2SyncJobProgressUpdate = Partial<
  Pick<
    C2SyncJob,
    | 'status'
    | 'current_page'
    | 'total_pages'
    | 'total_workouts'
    | 'processed_count'
    | 'saved_count'
    | 'skipped_count'
    | 'failed_count'
    | 'last_error'
    | 'started_at'
    | 'finished_at'
  >
>;

/**
 * Matching criteria for deduplication/upgrade between sources.
 * Two workout_logs rows are considered the "same workout" if:
 *   - Same user_id
 *   - completed_at within ±5 minutes
 *   - distance_meters within ±10m OR duration_seconds within ±2s
 *
 * When a match is found, the higher-priority source wins (upgrade).
 * The lower-priority row is either merged into the winner or deleted.
 */
export interface ReconciliationMatch {
  /** Tolerance for timestamp matching */
  timeWindowMinutes: 5;
  /** Tolerance for distance matching (meters) */
  distanceToleranceMeters: 10;
  /** Tolerance for duration matching (seconds) */
  durationToleranceSeconds: 2;
}

// ============================================================================
// 4. COLUMN-LEVEL CONTRACT (workout_logs fields EL must populate)
// ============================================================================

/**
 * The minimum set of workout_logs columns that ErgLink must populate
 * for LC to successfully reconcile, match templates, and complete assignments.
 *
 * This is documentation — not enforced at runtime — but violations will
 * cause silent data loss in LC coaching views.
 *
 * Required columns:
 *   user_id          — auth.users.id (null for anon → fallback to participant record)
 *   workout_name     — human-readable name (ActiveWorkoutSpec.title or fallback)
 *   workout_type     — 'erg_session'
 *   completed_at     — ISO timestamp
 *   distance_meters  — total distance from last stroke
 *   duration_seconds — total elapsed time from last stroke
 *   source           — 'erg_link_live'
 *   raw_data         — ErgLinkUploadMeta (JSONB)
 *
 * Strongly recommended:
 *   canonical_name   — from ActiveWorkoutSpec.canonical_name (enables template matching)
 *   template_id      — from ActiveWorkoutSpec.template_id (direct template link)
 *   average_stroke_rate — from last stroke
 *   watts            — from last stroke
 *
 * Set by LC on reconciliation (EL should NOT set):
 *   training_zone, zone_distribution, rating, perceived_exertion, notes
 */
