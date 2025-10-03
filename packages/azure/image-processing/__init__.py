"""
Azure Function entry point for image processing and OCR

This function provides a complete pipeline for:
1. Receiving base64 encoded images via HTTP
2. Processing images for OCR optimization  
3. Running Azure Document Intelligence analysis
4. Returning structured results

@source Extracted from train-better production application
@license MIT
"""

import azure.functions as func
import json
import logging
from typing import Dict, Any
import sys
import os

# Add the shared code directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'shared_code'))

from image_processor import process_images_pipeline

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Azure Function HTTP trigger for image processing and OCR
    
    Request body format:
    {
        "images": ["base64string1", "base64string2", ...],
        "options": {
            "enhanceReadability": true,
            "enhanceTableDetection": false,
            "modelId": "custom-model-id",
            "endpoint": "https://your-endpoint.cognitiveservices.azure.com/",
            "key": "your-api-key",
            "apiVersion": "2024-11-30",
            "features": ["queryFields"],
            "queryFields": ["CustomTable1", "CustomTable2"]
        }
    }
    
    Response format:
    {
        "success": true,
        "processedImages": ["base64..."],
        "primaryImage": "base64...",
        "ocrResults": { ... },
        "requestId": "unique-id"
    }
    """
    
    logging.info('Image processing function received a request')
    
    try:
        # Parse request body
        req_body = req.get_json()
        
        if not req_body:
            return func.HttpResponse(
                json.dumps({
                    "success": False,
                    "error": "Request body is required"
                }),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        # Extract images and options
        images = req_body.get('images', [])
        options = req_body.get('options', {})
        
        # Validate images
        if not images or not isinstance(images, list) or len(images) == 0:
            return func.HttpResponse(
                json.dumps({
                    "success": False,
                    "error": "At least one image is required in 'images' array"
                }),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )
        
        logging.info(f'Processing {len(images)} images with options: {list(options.keys())}')
        
        # Process images through the pipeline
        result = process_images_pipeline(images, options)
        
        # Add request metadata
        import uuid
        result["requestId"] = str(uuid.uuid4())
        
        # Determine response status
        status_code = 200 if result.get("success", False) else 500
        
        return func.HttpResponse(
            json.dumps(result),
            status_code=status_code,
            headers={"Content-Type": "application/json"}
        )
        
    except json.JSONDecodeError as e:
        logging.error(f'Invalid JSON in request: {str(e)}')
        return func.HttpResponse(
            json.dumps({
                "success": False,
                "error": f"Invalid JSON format: {str(e)}"
            }),
            status_code=400,
            headers={"Content-Type": "application/json"}
        )
        
    except Exception as e:
        logging.error(f'Unexpected error in image processing function: {str(e)}')
        import traceback
        logging.error(traceback.format_exc())
        
        return func.HttpResponse(
            json.dumps({
                "success": False,
                "error": f"Internal server error: {str(e)}"
            }),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )