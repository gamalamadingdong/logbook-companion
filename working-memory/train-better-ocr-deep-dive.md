# Train Better OCR Deep Dive for Logbook Companion

Date: 2026-02-15  
Status: Extraction complete, integration not yet wired

## What was preserved

The high-value OCR assets were copied into:
- `working-memory/extracted-ocr/OcrService.train-better.ts`
- `working-memory/extracted-ocr/ErgWorkoutParser.train-better.ts`
- `working-memory/extracted-ocr/image_processor.train-better.py`
- `working-memory/extracted-ocr/workout_parser.train-better.py`
- `working-memory/extracted-ocr/azure_function_entrypoint.train-better.py`
- `working-memory/extracted-ocr/requirements.train-better.txt`

These are archival/source-of-truth copies from Train Better to avoid loss while we phase migration.

---

## Key concepts worth reusing in LC (highest leverage)

1. **Multi-pass monitor detection before OCR**
   - The Python pipeline uses a 5-technique fallback chain (contour, Hough lines, contrast segmentation, grid analysis, multi-scale).
   - This is the main reason OCR quality is resilient across poor photos.

2. **Single-image leniency vs multi-image strictness**
   - Single image: allow conservative crop if monitor detection fails.
   - Multi-image: fail fast unless all monitors are found (prevents garbage stitched OCR).
   - This policy is strong UX and should be retained.

3. **Structured OCR output contract**
   - Response shape includes `success`, `monitorDetected`, `processedImages`, `stitchedImage`, `ocrResults`, `parsedData`, `needsBetterImage`, `detectionMessages`.
   - This is ideal for front-end progress/error handling and coaching guidance.

4. **Domain parser with interval intelligence**
   - `ErgWorkoutParser` + `workout_parser.py` handle interval typing, table extraction, deduplication, variable vs standard interval detection, canonical-style naming.
   - This aligns with LC’s RWN + canonical-name strategy and can reduce manual corrections.

5. **Data-cleaning safeguards for OCR quirks**
   - Explicit fixups like replacing `¥` with `r`, comma-to-dot split normalization, and alternate field-key fallback extraction.
   - These are small but high-impact for parsing reliability.

---

## What not to copy directly into LC runtime yet

- Expo/React-Native camera UX from Train Better (`ErgCameraCapture`, Expo permission flow).
- Direct Firebase Functions invocation pattern in Train Better UI.

LC is a web SPA; keep runtime integration web-native and only reuse OCR service contracts + parsing logic.

---

## Recommended integration shape in LC (Phase-aligned)

## Phase 1 (now, low risk)
- Add OCR ingestion as **optional/manual** input path for missing workouts.
- Keep current C2 sync as primary source.
- Use parser output to prefill:
  - `distance_meters`
  - `duration_seconds`
  - `avg_split_500m`
  - `average_stroke_rate`
  - `manual_rwn` suggestion

## Phase 2
- Add assignment-aware OCR quick entry for coaching roster “Missing” athletes.
- Auto-link to daily assignment when confidence/fields are sufficient.

## Phase 3
- Introduce confidence scoring and mismatch banners:
  - OCR result vs template expectation vs assignment target
  - “accept/edit/retry image” workflow

---

## Concrete module boundaries for LC

1. **OCR client module**
   - Web fetch to Azure Function endpoint
   - Error normalization and response typing

2. **Parser adapter module**
   - Wrap extracted parser behavior
   - Emit LC-friendly fields and optional RWN proposal

3. **Workflow integration module**
   - Hook to workout create/update paths
   - Assignment linking + unmatched surfacing

4. **Telemetry module**
   - Track monitor detection fail rate, OCR success rate, manual correction rate

---

## Risks and controls

- **Risk**: OCR drift from monitor photo quality  
  **Control**: preserve `needsBetterImage` and user guidance messaging.

- **Risk**: Incorrect interval interpretation  
  **Control**: keep dedup + variable/standard interval checks; always allow manual override.

- **Risk**: Pipeline operational fragility (Python/OpenCV/Azure model versions)  
  **Control**: pin versions (`requirements.train-better.txt`) and add smoke test payloads.

---

## Suggested immediate next implementation task

Create a new LC issue:
- Title: `[OCR][Phase 1] Add web OCR ingestion path for missing/manual workouts`
- Deliverables:
  - Typed OCR response contract in LC
  - OCR client service using Azure Function URL/key env vars
  - Parser adapter producing LC workout draft payload
  - Non-blocking UI entry point from workout/coaching flow

This gives practical value quickly without coupling launch success to OCR.
