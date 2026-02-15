# OCR Salvage + Integration Brief (Train Better → Logbook Companion)

> Date: 2026-02-15  
> Source artifacts reviewed: `working-memory/extracted-ocr/*` + `train-better/functions/src/*` + `working-memory/feature-specs/workout-capture-system.md`

## Executive Takeaway

You should **keep and integrate** the OCR pipeline, but as a **modular Bronze-layer ingestion path** in Logbook Companion (not as Expo/Firebase-specific code).

The most valuable salvage is:
1. Python image + OCR + parsing pipeline (`image_processor` + `workout_parser`)
2. TypeScript parser heuristics for interval/variable interval normalization (`ErgWorkoutParser`)
3. Request/response contract patterns from `OcrService`

---

## What to Keep / Adapt / Drop

## Keep (high value, direct reuse)

### 1) `workout_parser.train-better.py`
- Keep the field extraction fallback system (`TotalWorkTime`, `TotalTime`, etc.).
- Keep interval table deduplication (`deduplicate_interval_tables`).
- Keep variable interval detection heuristics (`determine_interval_table_type`, alternating pattern checks).
- Keep cleanup normalization (notably `¥ -> r`) for OCR corruption.

### 2) `image_processor.train-better.py`
- Keep monitor detection fallback strategy (multi-method detection + conservative single-image crop fallback).
- Keep two-mode stitching concepts:
  - monitor-specific header-preserving stitch
  - overlap-aware stitch
- Keep output semantics: `monitorDetected`, `needsBetterImage`, `detectionMessages`.

### 3) `OcrService.train-better.ts` + `ErgWorkoutParser.train-better.ts`
- Keep client contract + robust response handling (`success`, `error`, `parsedData`, `ocrResults`).
- Keep parser normalization for:
  - workout type mapping
  - split formatting normalization
  - interval structure extraction

## Adapt (required before production in LC)

1. **Platform bindings**
- Remove Expo-only dependencies (`expo-constants`) and use web env access (`import.meta.env`).

2. **Types and strictness**
- Replace `any` in parser/service boundaries with typed contracts aligned to LC strict TS rules.

3. **RWN + canonical naming integration**
- Route OCR parsed output through LC’s existing structure/canonical pipeline (`structureAdapter`, `workoutNaming`, template matching), not a parallel naming scheme.

4. **Ingestion and reconciliation integration**
- OCR output must enter the existing Bronze/Silver/Gold reconciliation flow as Bronze source with upgrade semantics.

5. **Security and ops hardening**
- Move secrets to server-side env only.
- Add request-size limits and rate controls at OCR endpoint.
- Add failure telemetry fields for retriable vs terminal OCR errors.

## Drop / Avoid (do not carry over)

1. Firebase callable wrapper flow (`functions/src/processErgImages.ts`) as your primary runtime path.
2. Legacy duplicated stitching variants that are not selected by measured quality metrics.
3. UI coupling from `train-better` app screens/types that are unrelated to LC workflow.

---

## Suggested Target Architecture in Logbook Companion

1. **Server OCR Module (Python)**
- Place salvage Python under an OCR function package (Azure Function is acceptable and already close to your intended Phase 1 design).
- Preserve:
  - image preprocess
  - OCR call
  - parser/dedup
  - normalized JSON output

2. **Web Client OCR Adapter (TypeScript)**
- Create LC-side adapter service (web-safe env handling) that:
  - posts images
  - parses response contract
  - maps to LC ingestion DTO

3. **Workout Ingestion Bridge**
- Convert OCR parsed data into LC canonical workout structure and run through existing reconciliation/template matching.

---

## Data Contract Recommendation (Minimum)

### OCR service response (normalized)
- `success: boolean`
- `monitorDetected: boolean`
- `needsBetterImage?: boolean`
- `detectionMessages?: string[]`
- `parsedData?: { workoutType, totalTime, totalDistance, averageSplit, averageStrokeRate, averageHeartRate, standardTable, fields }`
- `error?: string`

### LC ingestion DTO
- `source: 'manual_ocr'`
- `captured_at`
- `athlete_id` / `user_id`
- `raw_ocr_payload`
- `derived_metrics` (time, distance, avg split, sr, hr)
- `intervals` (if available)
- `confidence / parse_quality flags`

---

## Immediate Next Steps (Phase-Aligned)

Aligned to `feature-specs/workout-capture-system.md`:

### Phase 1A (now, 1-2 days)
1. Create OCR integration issue set:
   - OCR endpoint hardening
   - Web adapter in LC
   - Bronze ingestion bridge
   - reconciliation hook-up
2. Define canonical response schema and add contract tests.
3. Decide which stitching strategy is default (monitor-first vs overlap-first), then keep one default + one fallback.

### Phase 1B (next, 2-4 days)
1. Implement LC web OCR adapter.
2. Wire Smart Form / Quick Capture to submit image(s) and preview parsed metrics.
3. Add “needs better image” UX branch.

### Phase 1C (stabilization)
1. Add telemetry dashboard for OCR success/failure and parse quality.
2. Add regression fixtures for common workout displays (single distance/time, fixed intervals, variable intervals).
3. Tune interval dedup heuristics with real team captures.

---

## Risks to Watch

1. **Interval misclassification**: variable vs uniform intervals can silently skew totals.
2. **Stitching artifacts**: over-stitching can duplicate rows and poison interval extraction.
3. **Schema drift**: if parser output evolves, client parser can break unless contract-tested.
4. **Auth/config mismatch**: endpoint keys and env variable naming inconsistencies across environments.

---

## Recommendation

Do **not** delete old repo yet. Keep it archived until:
- OCR module is migrated,
- contract tests pass,
- 1-2 weeks of real capture validation completes.

Then archive old repo and retain only the extracted OCR artifacts + migration brief in LC working memory.
