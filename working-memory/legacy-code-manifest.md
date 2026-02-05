# Legacy Code Manifest: ErgImageProcessor

**Source Repository**: `train-better` (Local)
**Purpose**: Azure Function for PM5 Screen OCR
**Status**: Deprecated (To be migrated to LogbookCompanion/Azure)

## Core Application Code
These files contain the logic for the Azure Function and Image Processing.

*   **Entry Point (Azure Function)**
    *   `c:\Users\samgammon\apps\train-better\ErgImageProcessor\process_erg_images\__init__.py`
    *   `c:\Users\samgammon\apps\train-better\ErgImageProcessor\process_erg_images\function.json`

*   **Shared Logic**
    *   `c:\Users\samgammon\apps\train-better\ErgImageProcessor\shared_code\image_processor.py` (Main Logic)
    *   `c:\Users\samgammon\apps\train-better\ErgImageProcessor\shared_code\workout_parser.py` (Data Parsing)

*   **Configuration**
    *   `c:\Users\samgammon\apps\train-better\ErgImageProcessor\requirements.txt`
    *   `c:\Users\samgammon\apps\train-better\ErgImageProcessor\host.json`
    *   `c:\Users\samgammon\apps\train-better\ErgImageProcessor\local.settings.json` (Template)

## Test Assets
Reference images used for testing the OCR logic.

*   **Test Images Directory**
    *   `c:\Users\samgammon\apps\train-better\ErgImageProcessor\testing\test_images\`

## Migration Notes
When moving to the new `OcrService`, ensuring we replicate the logic in `image_processor.py` is critical, specifically the `analyze_image_with_direct_rest` function which interacts with the Azure Document Intelligence API.
