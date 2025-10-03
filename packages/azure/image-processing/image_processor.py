"""
Image Processing Module for Azure Functions

Generalized image processing utilities for OCR and document analysis.
Extracted from train-better application and adapted for SGE template use.

This module provides:
1. Image decoding and encoding utilities
2. Image enhancement for OCR readability
3. Azure Document Intelligence integration
4. Error handling and logging patterns

@source Extracted from train-better production application
@license MIT
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential

import base64
import io
import os
import traceback
import logging
from typing import List, Dict, Any, Tuple, Optional
import json
import time

def decode_base64_image(base64_string: str) -> Optional[np.ndarray]:
    """
    Decode a base64 string to OpenCV image array
    
    Args:
        base64_string: Base64 encoded image data, optionally with data URI prefix
        
    Returns:
        OpenCV image array or None if decoding fails
    """
    try:
        # Validate input
        if not base64_string or not isinstance(base64_string, str):
            logging.error(f"Invalid base64 input type: {type(base64_string)}")
            return None
            
        # Remove data URI prefix if present
        if ',' in base64_string:
            logging.info("Removing data URI prefix from base64 string")
            base64_string = base64_string.split(',')[1]
        
        logging.info(f"Decoding base64 string of length {len(base64_string)}")
        
        # Decode base64 to bytes
        image_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(image_data, np.uint8)
        
        if len(nparr) == 0:
            logging.error("Empty array after decoding base64 string")
            return None
            
        # Decode to OpenCV image
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            logging.error("Failed to decode image from base64")
            return None
            
        logging.info(f"Successfully decoded image with shape {image.shape}")
        return image
        
    except Exception as e:
        logging.error(f"Error decoding base64 image: {str(e)}")
        logging.error(traceback.format_exc())
        return None

def encode_base64_image(image: np.ndarray) -> str:
    """
    Convert OpenCV image to base64 string
    
    Args:
        image: OpenCV image array
        
    Returns:
        Base64 encoded image string
        
    Raises:
        ValueError: If image encoding fails
    """
    success, buffer = cv2.imencode('.jpg', image)
    if not success:
        raise ValueError("Could not encode image to JPEG")
    
    img_bytes = buffer.tobytes()
    img_base64 = base64.b64encode(img_bytes).decode('utf-8')
    
    return img_base64

def enhance_image_readability(image: np.ndarray) -> np.ndarray:
    """
    Enhance image for better OCR text recognition
    
    Args:
        image: OpenCV image array
        
    Returns:
        Enhanced OpenCV image array
    """
    try:
        # Convert to PIL for enhancement operations
        pil_img = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(pil_img)
        enhanced = enhancer.enhance(1.5)
        
        # Enhance sharpness
        enhancer = ImageEnhance.Sharpness(enhanced)
        enhanced = enhancer.enhance(1.5)
        
        # Convert back to OpenCV format
        enhanced_cv = cv2.cvtColor(np.array(enhanced), cv2.COLOR_RGB2BGR)
        
        return enhanced_cv
    except Exception as e:
        logging.error(f"Error enhancing image: {str(e)}")
        return image

def preprocess_for_table_detection(image: np.ndarray) -> np.ndarray:
    """
    Preprocess image to enhance table structure visibility for OCR
    
    Args:
        image: OpenCV image array
        
    Returns:
        Preprocessed OpenCV image array optimized for table detection
    """
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply adaptive thresholding to highlight lines
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 2
        )
        
        # Dilate to connect components within table cells
        kernel = np.ones((2, 2), np.uint8)
        dilated = cv2.dilate(thresh, kernel, iterations=1)
        
        # Convert back to color for Document Intelligence
        color = cv2.cvtColor(dilated, cv2.COLOR_GRAY2BGR)
        
        return color
    except Exception as e:
        logging.error(f"Error preprocessing for table detection: {str(e)}")
        return image

def analyze_image_with_azure_model(base64_image: str, options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze image using Azure Document Intelligence
    
    Args:
        base64_image: Base64 encoded image data
        options: Configuration options including Azure credentials and model settings
        
    Returns:
        Dictionary containing OCR results or error information
    """
    try:
        # Extract configuration from options or environment
        endpoint = options.get("endpoint") or os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
        key = options.get("key") or os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY")
        model_id = options.get("modelId") or os.environ.get("AZURE_DOC_INTELLIGENCE_MODEL_ID", "prebuilt-document")
        api_version = options.get("apiVersion") or os.environ.get("AZURE_DOC_INTELLIGENCE_API_VERSION", "2024-11-30")
        
        logging.info(f"Using Azure Document Intelligence - Model: {model_id}, API Version: {api_version}")
        
        if not endpoint or not key:
            error_msg = "Azure Document Intelligence credentials not provided"
            logging.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }
            
        # Create Azure client
        client = DocumentIntelligenceClient(
            endpoint=endpoint,
            credential=AzureKeyCredential(key)
        )
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(base64_image)
        
        logging.info("Starting Azure Document Intelligence analysis...")
        
        # Configure analysis parameters
        analyze_params = {
            "model_id": model_id,
            "body": image_bytes,
            "content_type": "application/octet-stream",
            "pages": "*",
            "locale": "en-US"
        }
        
        # Add custom model features if specified
        if options.get("features"):
            analyze_params["features"] = options["features"]
        if options.get("queryFields"):
            analyze_params["query_fields"] = options["queryFields"]
            
        # Start analysis
        poller = client.begin_analyze_document(**analyze_params)
        
        # Wait for completion
        logging.info("Waiting for Azure OCR operation to complete...")
        result = poller.result()
        
        # Convert result to serializable format
        result_dict = _convert_azure_result_to_dict(result)
        
        return {
            "success": True,
            "results": {
                "analyzeResult": result_dict
            }
        }
        
    except Exception as e:
        error_msg = f"Azure Document Intelligence analysis failed: {str(e)}"
        logging.error(error_msg)
        logging.error(traceback.format_exc())
        return {
            "success": False,
            "error": error_msg
        }

def _convert_azure_result_to_dict(result) -> Dict[str, Any]:
    """
    Convert Azure Document Intelligence result to serializable dictionary
    
    Args:
        result: Azure Document Intelligence analysis result
        
    Returns:
        Serializable dictionary representation
    """
    result_dict = {}
    
    # Handle pages
    if hasattr(result, "pages") and result.pages:
        result_dict["pages"] = []
        for page in result.pages:
            page_dict = {
                "pageNumber": page.page_number,
                "width": page.width,
                "height": page.height,
                "angle": page.angle,
                "unit": page.unit
            }
            result_dict["pages"].append(page_dict)
    
    # Handle documents (structured fields)
    if hasattr(result, "documents") and result.documents:
        result_dict["documents"] = []
        for doc in result.documents:
            doc_dict = {
                "docType": doc.doc_type,
                "confidence": doc.confidence,
                "fields": {}
            }
            
            if hasattr(doc, "fields") and doc.fields:
                for field_name, field_value in doc.fields.items():
                    if hasattr(field_value, "value"):
                        doc_dict["fields"][field_name] = {
                            "value": field_value.value,
                            "confidence": getattr(field_value, "confidence", 0.0)
                        }
            
            result_dict["documents"].append(doc_dict)
    
    # Handle tables
    if hasattr(result, "tables") and result.tables:
        result_dict["tables"] = []
        for table in result.tables:
            table_dict = {
                "rowCount": table.row_count,
                "columnCount": table.column_count,
                "cells": []
            }
            
            if hasattr(table, "cells"):
                for cell in table.cells:
                    cell_dict = {
                        "rowIndex": cell.row_index,
                        "columnIndex": cell.column_index,
                        "content": cell.content,
                        "confidence": getattr(cell, "confidence", 0.0)
                    }
                    table_dict["cells"].append(cell_dict)
            
            result_dict["tables"].append(table_dict)
    
    return result_dict

def process_images_pipeline(
    base64_images: List[str], 
    options: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Complete image processing pipeline
    
    Args:
        base64_images: List of base64 encoded images
        options: Processing configuration options
        
    Returns:
        Dictionary containing processed results
    """
    if not options:
        options = {}
        
    try:
        processed_images = []
        
        for i, base64_img in enumerate(base64_images):
            logging.info(f"Processing image {i+1}/{len(base64_images)}")
            
            # Decode image
            image = decode_base64_image(base64_img)
            if image is None:
                logging.warning(f"Failed to decode image {i+1}, skipping")
                continue
            
            # Enhance for OCR if requested
            if options.get("enhanceReadability", True):
                image = enhance_image_readability(image)
            
            # Preprocess for table detection if requested
            if options.get("enhanceTableDetection", False):
                image = preprocess_for_table_detection(image)
            
            # Encode back to base64
            processed_base64 = encode_base64_image(image)
            processed_images.append(processed_base64)
        
        if not processed_images:
            return {
                "success": False,
                "error": "No images could be processed"
            }
        
        # For now, use the first processed image for OCR
        # In a more sophisticated implementation, you might stitch images together
        primary_image = processed_images[0]
        
        # Run OCR analysis
        ocr_result = analyze_image_with_azure_model(primary_image, options)
        
        return {
            "success": True,
            "processedImages": processed_images,
            "primaryImage": primary_image,
            "ocrResults": ocr_result
        }
        
    except Exception as e:
        error_msg = f"Image processing pipeline failed: {str(e)}"
        logging.error(error_msg)
        logging.error(traceback.format_exc())
        return {
            "success": False,
            "error": error_msg
        }