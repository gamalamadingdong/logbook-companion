import logging
import json
import azure.functions as func
import os
import sys

# Add the shared_code directory to the path so we can import the image_processor module
dir_path = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
sys.path.append(dir_path)

from shared_code.image_processor import process_erg_images

# Load configuration from environment with defaults
DEFAULT_MODEL_ID = os.environ.get("ERG_MONITOR_MODEL_ID", "erg-monitor-reader-v4")
DEFAULT_API_VERSION = os.environ.get("AZURE_DOC_INTELLIGENCE_API_VERSION", "2024-11-30")
DEFAULT_ENHANCE_READABILITY = os.environ.get("DEFAULT_ENHANCE_READABILITY", "true").lower() == "true"
DEFAULT_STITCH_IMAGES = os.environ.get("DEFAULT_STITCH_IMAGES", "true").lower() == "true"

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Azure Function endpoint that processes erg monitor images with OCR.
    
    This function:
    1. Receives base64-encoded images from HTTP request
    2. Processes the images using the shared image_processor module
    3. Performs OCR analysis using Azure Document Intelligence
    4. Parses the OCR results into structured workout data
    5. Returns everything as JSON response
    
    Request body format:
    {
        "images": ["base64string1", "base64string2", ...],
        "options": {
            "enhanceReadability": true,
            "stitchImages": true,
            "modelId": "erg_monitor_ocr",
            "key": "your-azure-key",         // Optional: can use environment variables
            "endpoint": "your-azure-endpoint" // Optional: can use environment variables
        }
    }
    """
    logging.info('Python HTTP trigger function processed a request.')

    try:
        # Parse request body
        req_body = req.get_json()
        
        if not req_body or 'images' not in req_body:
            return func.HttpResponse(
                json.dumps({"error": "Request must include 'images' array"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Extract images
        images = req_body.get('images', [])
        
        # Get options with defaults from environment variables
        client_options = req_body.get('options', {})
        options = {
            "modelId": client_options.get("modelId", DEFAULT_MODEL_ID),
            "apiVersion": client_options.get("apiVersion", DEFAULT_API_VERSION),
            "enhanceReadability": client_options.get("enhanceReadability", DEFAULT_ENHANCE_READABILITY),
            "stitchImages": client_options.get("stitchImages", DEFAULT_STITCH_IMAGES),
            "performOcr": client_options.get("performOcr", True)
        }
        
        logging.info(f"Configuration: model_id={options['modelId']}, api_version={options['apiVersion']}")
        
        # Validate input
        if not isinstance(images, list) or len(images) == 0:
            return func.HttpResponse(
                json.dumps({"error": "The 'images' field must be a non-empty array of base64 strings"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Check if OCR is requested
        do_ocr = options.get('performOcr', True)
        
        # Process images
        logging.info(f'Processing {len(images)} images with options: {options}')
        
        logging.info(f'Processing images with OCR={do_ocr}')
        options['ocr'] = do_ocr  # Set the OCR flag in options
        result = process_erg_images(images, options)
        
        # Check for processing errors - improved error handling
        if not isinstance(result, dict):
            error_msg = "Processing returned invalid result type"
            logging.error(error_msg)
            return func.HttpResponse(
                json.dumps({"success": False, "error": error_msg}),
                status_code=500,
                mimetype="application/json"
            )
            
        # If success is explicitly False, return error
        if result.get('success') is False:
            error_msg = result.get('error', 'Unknown error')
            logging.error(f"Processing error: {error_msg}")
            return func.HttpResponse(
                json.dumps(result),
                status_code=500,
                mimetype="application/json"
            )
        
        # Return successful result
        logging.info('Processing completed successfully')
        return func.HttpResponse(
            json.dumps(result),
            status_code=200,
            mimetype="application/json"
        )
        
    except ValueError as ve:
        # Handle invalid JSON
        error_msg = f"Invalid JSON in request body: {str(ve)}"
        logging.error(error_msg)
        return func.HttpResponse(
            json.dumps({"success": False, "error": error_msg}),
            status_code=400,
            mimetype="application/json"
        )
        
    except Exception as e:
        # Add detailed error logging
        import traceback
        trace = traceback.format_exc()
        error_msg = f"Unhandled exception: {str(e)}"
        logging.error(error_msg)
        logging.error(f"Trace: {trace}")
        
        # Return a more detailed error response
        return func.HttpResponse(
            json.dumps({
                "success": False, 
                "error": error_msg,
                "trace": trace
            }),
            status_code=500,
            mimetype="application/json"
        )