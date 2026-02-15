"""
Erg Monitor Image Processor

This module processes images of rowing machine monitors to:
1. Isolate the screen from the background
2. Enhance readability of text
3. Combine multiple images for better OCR results
4. Analyze images with Azure Document Intelligence (OCR)
5. Parse OCR results into structured workout data
"""
# filepath: c:\Users\samgammon\apps\train-better\ErgImageProcessor\shared_code\image_processor.py
# Replace the try/except import block with:
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
import sys
import argparse
import requests
import time

def decode_base64_image(base64_string):
    """Decode a base64 string to image"""
    try:
        # Add validation for the base64 string
        if not base64_string or not isinstance(base64_string, str):
            logging.error(f"Invalid base64 input type: {type(base64_string)}")
            return None
            
        # Check if the string has data URI prefix and remove it
        if ',' in base64_string:
            logging.warning("Removing data URI prefix from base64 string")
            base64_string = base64_string.split(',')[1]
        
        # Log the length of the base64 string
        logging.info(f"Decoding base64 string of length {len(base64_string)}")
        
        # Attempt to decode
        image_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(image_data, np.uint8)
        
        # Check if the array is empty
        if len(nparr) == 0:
            logging.error("Empty array after decoding base64 string")
            return None
            
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Check if image was successfully decoded
        if image is None:
            logging.error("Failed to decode image from base64")
            return None
            
        logging.info(f"Successfully decoded image with shape {image.shape}")
        return image
        
    except Exception as e:
        logging.error(f"Error decoding base64 image: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        return None
def encode_base64_image(image: np.ndarray) -> str:
    """
    Convert a CV2 image to a base64 string
    """
    # Encode image
    success, buffer = cv2.imencode('.jpg', image)
    if not success:
        raise ValueError("Could not encode image")
    
    # Convert to base64
    img_bytes = buffer.tobytes()
    img_base64 = base64.b64encode(img_bytes).decode('utf-8')
    
    return img_base64

def enhance_image_readability(image: np.ndarray) -> np.ndarray:
    """
    Enhance the readability of text in the image
    """
    # Convert to PIL Image for easier enhancement
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

def preprocess_for_table_detection(image: np.ndarray) -> np.ndarray:
    """
    Special preprocessing to enhance table structure visibility
    """
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply adaptive thresholding to highlight lines
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 2
        )
        
        # Dilate to connect components within table cells/lines
        kernel = np.ones((2, 2), np.uint8)
        dilated = cv2.dilate(thresh, kernel, iterations=1)
        
        # Convert back to color for Document Intelligence
        color = cv2.cvtColor(dilated, cv2.COLOR_GRAY2BGR)
        
        return color
    except Exception as e:
        logging.error(f"Error preprocessing for table detection: {str(e)}")
        return image


def analyze_image_with_azure_model(base64_image: str, options: Dict[str, Any]) -> Dict:
    """
    Analyze an image using Azure Document Intelligence
    """
    try:
        # Get Azure credentials from options or environment variables
        endpoint = options.get("endpoint") or os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
        key = options.get("key") or os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY")
        model_id = options.get("modelId") or os.environ.get("ERG_MONITOR_MODEL_ID", "erg-monitor-reader-v4")
        api_version = options.get("apiVersion") or os.environ.get("AZURE_DOC_INTELLIGENCE_API_VERSION", "2024-11-30")
        
        logging.info(f"Using model ID: {model_id}, API version: {api_version}")
        
        if not endpoint or not key:
            error_msg = "Azure Document Intelligence credentials not provided"
            logging.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }
            
        # Create Azure Document Intelligence client
        document_intelligence_client = DocumentIntelligenceClient(
            endpoint=endpoint,
            credential=AzureKeyCredential(key)
        )
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(base64_image)
        
        logging.info(f"Calling Azure Document Intelligence with model: {model_id}, API version: {api_version}")
        
        # Call Azure Document Intelligence - ADD FEATURES PARAMETER HERE
        #poller = document_intelligence_client.begin_analyze_document(
        #    model_id=model_id,
        #    body=image_bytes,
        #    content_type="application/octet-stream"
        #)

        poller = document_intelligence_client.begin_analyze_document(
            model_id=model_id,
            body=image_bytes,
            content_type="application/octet-stream",
            pages="*",
            locale="en-US",
            features=["queryFields"],
            query_fields=["StandardTable,IntervalTable,VariableIntervalTable"],
            #field_elements=True,  # Option 1
            #include_field_elements=True,  # Option 2
            #fields_include_elements=True,  # Option 3
        )
        
        # Wait for the operation to complete
        logging.info("Waiting for Azure OCR operation to complete...")
        result = poller.result()
        
        # Convert result to a serializable dictionary - UPDATED APPROACH
        result_dict = {}
        
        # Handle pages data
        if hasattr(result, "pages"):
            result_dict["pages"] = []
            for page in result.pages:
                page_dict = {
                    "pageNumber": page.page_number,
                    "width": page.width,
                    "height": page.height,
                    "angle": page.angle,
                    "unit": page.unit
                }
                if hasattr(page, "lines") and page.lines:
                    page_dict["lines"] = []
                    for line in page.lines:
                        page_dict["lines"].append({
                            "content": line.content,
                            "boundingBox": line.polygon if hasattr(line, "polygon") else None,
                            "spans": [{"offset": span.offset, "length": span.length} 
                                     for span in line.spans] if hasattr(line, "spans") else []
                        })
                result_dict["pages"].append(page_dict)
        
        # Handle documents data - FIXED
        if hasattr(result, "documents") and result.documents is not None:
            result_dict["documents"] = []
            for doc in result.documents:
                doc_dict = {
                    "docType": doc.doc_type if hasattr(doc, "doc_type") else "unknown",
                    "docTypeConfidence": doc.confidence if hasattr(doc, "confidence") else 0.0
                }
                
                if hasattr(doc, "fields"):
                    doc_dict["fields"] = {}
                    for name, field in doc.fields.items():
                        # Use a safer approach that checks for attribute existence
                        field_type = field.type if hasattr(field, "type") else "unknown"
                        field_confidence = field.confidence if hasattr(field, "confidence") else 0.0
                        
                        field_dict = {
                            "type": field_type,
                            "confidence": field_confidence
                        }
                        
                        # Extract content safely
                        field_value = extract_field_value(field)
                        if field_value is not None:
                            if field_type == "array":
                                field_dict["valueArray"] = []
                                if hasattr(field, "value"):
                                    for item in field.value:
                                        item_value = extract_field_value(item)
                                        if item_value is not None:
                                            field_dict["valueArray"].append({"content": str(item_value)})
                            else:
                                field_dict["content"] = str(field_value)
                        
                        doc_dict["fields"][name] = field_dict
                
                result_dict["documents"].append(doc_dict)
                
        # Create the API response format
        analyzeResult = {"analyzeResult": result_dict}
        
        logging.info("Azure OCR processing complete")
        
        return {
            "success": True,
            "modelId": model_id,
            "apiVersion": api_version,
            "results": analyzeResult
        }
        
    except Exception as e:
        error_message = f"Azure OCR analysis failed: {str(e)}"
        traceback_str = traceback.format_exc()
        logging.error(error_message)
        logging.error(traceback_str)
        
        return {
            "success": False,
            "error": error_message,
            "traceback": traceback_str
        }


def analyze_image_with_direct_rest(base64_image: str, options: Dict[str, Any]) -> Dict:
    """
    Analyze an image using direct REST API calls to Azure Document Intelligence
    with explicit request for table extraction
    """
    try:
        # Get Azure credentials from options or environment variables
        endpoint = options.get("endpoint") or os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
        key = options.get("key") or os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY")
        model_id = options.get("modelId") or os.environ.get("ERG_MONITOR_MODEL_ID", "erg-monitor-reader-v4")
        api_version = options.get("apiVersion") or os.environ.get("AZURE_DOC_INTELLIGENCE_API_VERSION", "2024-11-30")
        
        if not endpoint or not key:
            error_msg = "Azure Document Intelligence credentials not provided"
            logging.error(error_msg)
            return {"success": False, "error": error_msg}
        
        # Ensure endpoint doesn't end with slash
        if endpoint.endswith('/'):
            endpoint = endpoint[:-1]
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(base64_image)
        
        # CORRECTED URL - Match the working URL from OcrService.ts
        analyze_url = f"{endpoint}/documentintelligence/documentModels/{model_id}:analyze?api-version={api_version}"
        
        # Log the URL for debugging
        #logging.info(f"REST API URL: {analyze_url}")
        
        # Rest of function remains the same...
        
        headers = {
            "Content-Type": "application/octet-stream",
            "Ocp-Apim-Subscription-Key": key
        }
        
        # First API call - Submit document for analysis
        import requests
        response = requests.post(
            analyze_url,
            headers=headers,
            data=image_bytes,
            params={"includeFieldElements": "true"}
        )
        
        
        if response.status_code != 202:  # 202 Accepted is expected
            return {
                "success": False,
                "error": f"Failed to start analysis: {response.status_code} {response.text}"
            }
        
        # Get operation location for polling
        operation_location = response.headers.get('Operation-Location')
        if not operation_location:
            return {
                "success": False,
                "error": "No Operation-Location header returned"
            }
        
        #logging.info(f"Analysis started, polling at {operation_location}")
        
        # Poll for completion
        headers = {"Ocp-Apim-Subscription-Key": key}
        max_retries = 20
        wait_seconds = 3
        
        for i in range(max_retries):
            #logging.info(f"Polling attempt {i+1}/{max_retries}")
            time.sleep(wait_seconds)
            
            poll_response = requests.get(operation_location, headers=headers)
            poll_result = poll_response.json()
            
            status = poll_result.get("status")
            if status == "succeeded":
                logging.info("Analysis completed successfully")
                return {
                    "success": True,
                    "results": poll_result
                }
            elif status == "failed":
                error_message = poll_result.get("error", {}).get("message", "Unknown error")
                return {
                    "success": False,
                    "error": f"Analysis failed: {error_message}"
                }
                
            #logging.info(f"Status: {status}, waiting {wait_seconds} seconds...")
            
        return {
            "success": False,
            "error": f"Analysis timed out after {max_retries} polling attempts"
        }
        
    except Exception as e:
        error_message = f"REST API analysis failed: {str(e)}"
        traceback_str = traceback.format_exc()
        logging.error(error_message)
        logging.error(traceback_str)
        return {
            "success": False,
            "error": error_message,
            "traceback": traceback_str
        }


def perform_ocr(base64_image: str) -> Dict:
    """
    Perform OCR analysis using Azure Document Intelligence
    
    Args:
        base64_image: Base64-encoded image string
        
    Returns:
        Dictionary containing OCR results or error information
    """
    try:
        logging.info("Setting up Azure Document Intelligence client")
        
        # Check if credentials exist
        if not os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY") or not os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT"):
            logging.error("Missing Azure Document Intelligence credentials")
            return {
                "success": False,
                "error": "Azure Document Intelligence credentials not configured"
            }
        
        # Get configuration values
        endpoint = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
        key = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY")
        model_id = os.environ.get("ERG_MONITOR_MODEL_ID", "erg-monitor-reader-v3")
        
        logging.info(f"Using endpoint: {endpoint}")
        logging.info(f"Using model ID: {model_id}")
        
        # Use the existing direct REST implementation which is already working
        ocr_result = analyze_image_with_direct_rest(base64_image, {
            "endpoint": endpoint,
            "key": key,
            "modelId": model_id
        })
        
        return ocr_result
        
    except Exception as e:
        error_message = f"OCR processing error: {str(e)}"
        traceback_str = traceback.format_exc()
        logging.error(error_message)
        logging.error(traceback_str)
        
        return {
            "success": False,
            "error": error_message,
            "traceback": traceback_str
        }


def extract_array_values(ocr_results: Dict, field_name: str) -> List[Dict]:
    """
    Extract array values from OCR results, handling both simple arrays and nested objects.
    
    This function:
    1. Navigates the correct OCR results structure
    2. Extracts values from arrays with proper structure handling
    3. Replaces \u00a5 with 'r' character in all text values
    4. Returns structured data from arrays
    
    Args:
        ocr_results: OCR results from Document Intelligence
        field_name: Name of the array field to extract
        
    Returns:
        List of extracted values, which may be strings or dictionaries depending on structure
    """
    values = []
    
    try:
        # Navigate to the correct structure in OCR results
        if "results" in ocr_results and "analyzeResult" in ocr_results["results"]:
            analyze_result = ocr_results["results"]["analyzeResult"]
            
            if "documents" in analyze_result:
                for doc in analyze_result["documents"]:
                    if "fields" in doc and field_name in doc["fields"]:
                        field_data = doc["fields"][field_name]
                        
                        # Handle array values
                        if "valueArray" in field_data:
                            for item in field_data["valueArray"]:
                                # Case 1: Item has direct content
                                if "content" in item:
                                    # Replace \u00a5 with 'r'
                                    cleaned_content = item["content"].replace('\u00a5', 'r')
                                    values.append(cleaned_content)
                                
                                # Case 2: Item has nested valueObject (for tables)
                                elif "valueObject" in item:
                                    row_data = {}
                                    for col_name, col_data in item["valueObject"].items():
                                        if isinstance(col_data, dict):
                                            if "content" in col_data:
                                                # Replace \u00a5 with 'r'
                                                col_data["content"] = col_data["content"].replace('\u00a5', 'r')
                                                row_data[col_name] = col_data["content"]
                                            elif "valueString" in col_data:
                                                # Replace \u00a5 with 'r'
                                                col_data["valueString"] = col_data["valueString"].replace('\u00a5', 'r')
                                                row_data[col_name] = col_data["valueString"]
                                    
                                    if row_data:  # Only add non-empty rows
                                        values.append(row_data)
                        
                        # Handle single value (non-array)
                        elif "content" in field_data:
                            # Replace \u00a5 with 'r'
                            cleaned_content = field_data["content"].replace('\u00a5', 'r')
                            values.append(cleaned_content)
    except Exception as e:
        logging.error(f"Error extracting array values for {field_name}: {e}")
                
    return values


def extract_field_value(field):
    """Extract value from a DocumentField object based on its type"""
    if not field:
        return None
        
    try:
        # Get field value based on field type
        if hasattr(field, "type"):
            if field.type == "string" and hasattr(field, "content"):
                return field.content
            elif field.type == "array" and hasattr(field, "value"):
                return [extract_field_value(item) for item in field.value]
            elif hasattr(field, "value") and field.value is not None:
                return field.value
        
        # Fallback to content
        if hasattr(field, "content"):
            return field.content
            
        return None
    except Exception as e:
        logging.warning(f"Error extracting field value: {e}")
        return None
    

def extract_fields_with_data(ocr_results: Dict) -> Dict:
    """Extract fields that contain data from OCR results"""
    fields_with_data = {}
    
    try:
        if "results" in ocr_results and "analyzeResult" in ocr_results["results"]:
            analyze_result = ocr_results["results"]["analyzeResult"]
            
            if "documents" in analyze_result and analyze_result["documents"]:
                for doc in analyze_result["documents"]:
                    if "fields" in doc:
                        for field_name, field_data in doc["fields"].items():
                            # Check if field_data is a dictionary before using get()
                            if isinstance(field_data, dict):
                                if field_data.get("type") == "string":
                                    if "content" in field_data:
                                        # Replace \u00a5 with 'r'
                                        value = field_data["content"].replace('\u00a5', 'r')
                                        fields_with_data[field_name] = value
                                elif field_data.get("type") == "array":
                                    if "valueArray" in field_data:
                                        fields_with_data[field_name] = field_data
                            # If field_data is a string, add it directly
                            elif isinstance(field_data, str):
                                # Replace \u00a5 with 'r'
                                value = field_data.replace('\u00a5', 'r')
                                fields_with_data[field_name] = value
        
        return fields_with_data
    except Exception as e:
        logging.error(f"Error extracting fields with data: {e}")
        return {}

from shared_code.workout_parser import parse_ocr_results

def process_erg_images(base64_images: List[str], options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Process erg monitor images with optional OCR analysis
    
    This function serves as the main entry point for image processing with integrated OCR:
    1. Preprocesses the images (cropping, enhancing)
    2. Stitches multiple images together if needed
    3. Optionally performs OCR analysis with Azure Document Intelligence
    4. Parses the OCR results into structured workout data
    
    Single images are processed more leniently - they will be enhanced and 
    conservatively cropped even if monitor detection fails.
    Multi-image submissions require successful monitor detection.
    """
    if options is None:
        options = {}
    
    debug_mode = options.get('debug', False)
    perform_ocr = options.get('ocr', True)
    enhance_readability = options.get('enhanceReadability', True)
    stitch_images = options.get('stitchImages', len(base64_images) > 1)
    
    # Track if we're processing a single image for more lenient handling
    is_single_image = len(base64_images) == 1
    
    try:
        # Step 1: Preprocess images
        print(f"Step 1: Processing {len(base64_images)} image(s)")
        
        # Process each image - detect monitor screen, crop, and enhance
        processed_images = []
        detection_results = []
        all_monitors_detected = True
        detection_messages = []
        
        for i, img_base64 in enumerate(base64_images):
            try:
                # Decode base64 image
                cv_image = decode_base64_image(img_base64)
                if cv_image is None:
                    print(f"Warning: Could not decode image {i+1}")
                    detection_results.append(False)
                    detection_messages.append(f"Image {i+1} could not be decoded")
                    all_monitors_detected = False
                    continue
                
                # Detect and crop to monitor screen - get success status and message
                cropped_img, monitor_detected, message = detect_and_crop_monitor_screen(cv_image)
                detection_results.append(monitor_detected)
                detection_messages.append(message)
                
                if not monitor_detected:
                    print(f"Warning: {message}")
                    all_monitors_detected = False
                    
                    # For single images with failed detection, apply conservative cropping
                    if is_single_image:
                        print("Single image - applying conservative cropping")
                        h, w = cv_image.shape[:2]
                        # Crop 10% from each edge
                        crop_margin = 0.1
                        x_start = int(w * crop_margin)
                        y_start = int(h * crop_margin)
                        x_end = int(w * (1 - crop_margin))
                        y_end = int(h * (1 - crop_margin))
                        cropped_img = cv_image[y_start:y_end, x_start:x_end]
                        detection_messages[i] = "Monitor detection failed, applied conservative cropping"
                
                # Enhance image readability if requested
                if enhance_readability:
                    cropped_img = enhance_image_readability(cropped_img)
                    
                # Convert back to base64
                processed_base64 = encode_base64_image(cropped_img)
                processed_images.append(processed_base64)
                
                if debug_mode:
                    print(f"Image {i+1} processing: {message}")
                    
            except Exception as e:
                print(f"Error processing image {i+1}: {e}")
                detection_results.append(False)
                detection_messages.append(f"Error processing image {i+1}: {str(e)}")
                all_monitors_detected = False
                # If processing fails, add original image
                processed_images.append(img_base64)
        
        # Create processing result with monitor detection status
        processing_result = {
            'success': True,  # Set default success to true, we'll handle specific cases below
            'monitorDetected': all_monitors_detected,  # Accurate flag for monitor detection
            'detectionMessages': detection_messages,  # Individual messages for each image
            'processedImages': processed_images,
            'stitchedImage': None  # Will be populated if stitching is performed
        }
        
        # Handle monitor detection based on single vs multi-image
        if not all_monitors_detected:
            # For single images: continue processing despite detection failure
            if is_single_image:
                print("Continuing with single image despite monitor detection failure")
                processing_result['warning'] = "Monitor screen not clearly detected. Image quality may be reduced."
            else:
                # For multiple images: return error and request better photos
                processing_result['success'] = False
                processing_result['error'] = "Monitor screen not clearly detected in one or more images. For multi-image submissions, please ensure all monitors are clearly visible."
                processing_result['needsBetterImage'] = True
                
                # Only return early for multi-image submissions with failed detection
                # unless explicitly requested to continue
                if not options.get('requireMonitorDetection', True):
                    print("Continuing processing multi-image despite monitor detection failure")
                else:
                    return processing_result
        
        # Step 2: Stitch images if requested and if multiple images
        stitched_image = None
        if stitch_images and len(processed_images) > 1:
            print(f"Stitching {len(processed_images)} images")
            try:
                # Convert processed base64 images to CV2 format for stitching
                cv_images = [decode_base64_image(img) for img in processed_images]
                
                # Stitch images vertically
                stitched = stitch_images_vertically(cv_images)
                
                # Convert stitched image back to base64
                stitched_image = encode_base64_image(stitched)
                processing_result['stitchedImage'] = stitched_image
                
                if debug_mode:
                    print("Successfully stitched images")
            except Exception as e:
                print(f"Error stitching images: {e}")
        
        # If no OCR requested, return processed images only
        if not perform_ocr:
            return processing_result
            
        # Get the best image for OCR (stitched image if available, otherwise first processed image)
        ocr_image = processing_result.get('stitchedImage')
        if not ocr_image and processing_result.get('processedImages'):
            ocr_image = processing_result['processedImages'][0]
            
        if not ocr_image:
            error = "No suitable image available for OCR"
            print(error)
            processing_result['success'] = False
            processing_result['error'] = error
            return processing_result
        
        # Rest of the function remains the same...
        # Step 3: Run OCR on the processed image with the custom model
        print("Step 2: Running OCR with Azure Document Intelligence custom model")
        #ocr_result = analyze_image_with_azure_model(ocr_image, options)
        ocr_result = analyze_image_with_direct_rest(ocr_image,options)
        # If OCR failed, return what we have so far
        if not ocr_result.get('success', False):
            print("OCR analysis failed")
            processing_result['success'] = False
            processing_result['error'] = ocr_result.get('error', 'OCR analysis failed')
            processing_result['ocrResults'] = ocr_result
            return processing_result
        
        # Step 4: Parse the OCR results
        print("Step 3: Parsing OCR results")
        parsed_result = parse_ocr_results(ocr_result)
        
        # Check if OCR returned enough data - if not, might need a better image
        data = parsed_result.get('data', {})
        if not data or (not data.get('splits') and not data.get('intervals')):
            processing_result['success'] = True  # Image processing succeeded
            processing_result['ocrSuccess'] = False  # But OCR didn't find useful data
            processing_result['needsBetterImage'] = True  # Suggest taking another photo
            processing_result['error'] = "Workout data couldn't be read from the image. Please take another photo with better lighting and a clearer view of the monitor screen."
            processing_result['ocrResults'] = ocr_result
            processing_result['parsedData'] = data
            return processing_result
        
        # Report on parsed data
        if debug_mode:
            # Determine workout type
            workout_type = data.get('workoutType', 'unknown')
            print(f"Workout type detected: {workout_type}")
            
            # Report on intervals
            interval_count = len(data.get('intervals', []))
            if interval_count > 0:
                print(f"Successfully extracted {interval_count} intervals")
                if data.get('workSummary'):
                    print(f"Work summary detected: {data['workSummary']}")
                if data.get('restSummary'):
                    print(f"Rest summary detected: {data['restSummary']}")
            elif workout_type == 'interval':
                print("WARNING: Workout identified as interval type but no intervals were extracted")
                
            # Report on splits
            split_count = len(data.get('splits', []))
            if split_count > 0:
                print(f"Successfully extracted {split_count} splits")
            elif workout_type != 'interval':
                print("WARNING: No splits were extracted for non-interval workout")
                
            # Print available fields for debugging
            if 'rawFields' in data:
                raw_fields = data['rawFields']
                print(f"Available fields: {', '.join(raw_fields.keys())}")
        
        # Return all results
        return {
            'success': True,
            'monitorDetected': all_monitors_detected,
            'detectionMessages': detection_messages,
            'processedImages': processing_result.get('processedImages', []),
            'stitchedImage': processing_result.get('stitchedImage'),
            'ocrResults': ocr_result,
            'parsedData': parsed_result.get('data'),
            'ocrSuccess': True
        }
        
    except Exception as e:
        error_message = f"Error processing erg images: {str(e)}"
        traceback_str = traceback.format_exc()
        print(error_message)
        print(traceback_str)
        
        return {
            'success': False,
            'error': error_message,
            'traceback': traceback_str,
            'needsBetterImage': True
        }
    

def detect_monitor_by_contrast(image: np.ndarray) -> Optional[np.ndarray]:
    """
    Detect monitor screen using contrast-based segmentation
    
    This method looks for regions with high contrast between foreground and background,
    which is typical for LCD screens displaying text against solid backgrounds.
    
    Args:
        image: Input image in BGR format
        
    Returns:
        Cropped image if monitor is detected, None otherwise
    """
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape[:2]
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Calculate local contrast using a sliding window
        window_size = 21
        local_contrast = np.zeros_like(blurred, dtype=np.float32)
        
        # Use the standard deviation within each window as a measure of contrast
        for i in range(0, h, window_size):
            for j in range(0, w, window_size):
                window = blurred[i:min(i+window_size, h), j:min(j+window_size, w)]
                if window.size > 0:
                    std_val = np.std(window)
                    # High std_val indicates high contrast
                    local_contrast[i:min(i+window_size, h), j:min(j+window_size, w)] = std_val
        
        # Normalize to 0-255 range
        local_contrast = cv2.normalize(local_contrast, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        
        # Threshold to find high contrast regions
        _, thresh = cv2.threshold(local_contrast, 50, 255, cv2.THRESH_BINARY)
        
        # Apply morphological operations to clean up the mask
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        # Find contours in the mask
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return None
        
        # Find the largest contour that's likely to be the monitor
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        
        for contour in contours[:5]:  # Check the top 5 largest contours
            x, y, w_rect, h_rect = cv2.boundingRect(contour)
            
            # Check if the area is reasonable for a monitor (not too small, not too large)
            area_ratio = (w_rect * h_rect) / (w * h)
            if 0.05 < area_ratio < 0.9:
                # Check if aspect ratio is reasonable for a monitor
                aspect_ratio = w_rect / h_rect if h_rect > 0 else 0
                if 0.5 < aspect_ratio < 3.0:  # Most monitors are between 1:2 and 3:1
                    # Add some margin
                    margin_x = int(0.1 * w_rect)
                    margin_y = int(0.1 * h_rect)
                    
                    x_start = max(0, x - margin_x)
                    y_start = max(0, y - margin_y)
                    x_end = min(w, x + w_rect + margin_x)
                    y_end = min(h, y + h_rect + margin_y)
                    
                    return image[y_start:y_end, x_start:x_end]
        
        return None
        
    except Exception as e:
        logging.error(f"Error in detect_monitor_by_contrast: {str(e)}")
        return None

def detect_monitor_by_grid_analysis(image: np.ndarray) -> Optional[np.ndarray]:
    """
    Detect monitor screen by analyzing a grid of cells for text-like content
    
    This method divides the image into a grid and examines each cell for features
    typical of text displays (alternating light/dark patterns, edges, etc.)
    
    Args:
        image: Input image in BGR format
        
    Returns:
        Cropped image if monitor is detected, None otherwise
    """
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape[:2]
        
        # Create grid
        grid_rows, grid_cols = 4, 6
        cell_h, cell_w = h // grid_rows, w // grid_cols
        
        # Score matrix for text-like content
        text_scores = np.zeros((grid_rows, grid_cols), dtype=np.float32)
        
        # Analyze each grid cell
        for i in range(grid_rows):
            for j in range(grid_cols):
                # Extract cell
                y1 = i * cell_h
                y2 = min((i + 1) * cell_h, h)
                x1 = j * cell_w
                x2 = min((j + 1) * cell_w, w)
                
                cell = gray[y1:y2, x1:x2]
                
                # Skip empty cells
                if cell.size == 0:
                    continue
                
                # Feature 1: Edge density (text has many edges)
                edges = cv2.Canny(cell, 50, 150)
                edge_density = np.sum(edges > 0) / cell.size
                
                # Feature 2: Histogram spread (text has peaks for dark text and light background)
                hist = cv2.calcHist([cell], [0], None, [32], [0, 256])
                hist_spread = np.std(hist) / np.mean(hist) if np.mean(hist) > 0 else 0
                
                # Feature 3: Local variance (text has high local variance)
                local_var = np.var(cell)
                
                # Combine features into a text-likelihood score
                text_scores[i, j] = (edge_density * 0.5) + (hist_spread * 0.3) + (min(1.0, local_var / 1000) * 0.2)
        
        # Find connected regions with high text scores
        binary_scores = (text_scores > np.mean(text_scores) + 0.5 * np.std(text_scores)).astype(np.uint8)
        
        # Expand to image size for visualization
        binary_mask = np.zeros((h, w), dtype=np.uint8)
        for i in range(grid_rows):
            for j in range(grid_cols):
                if binary_scores[i, j] > 0:
                    y1 = i * cell_h
                    y2 = min((i + 1) * cell_h, h)
                    x1 = j * cell_w
                    x2 = min((j + 1) * cell_w, w)
                    binary_mask[y1:y2, x1:x2] = 255
        
        # Find contours in the binary mask
        contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return None
        
        # Find the largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        x, y, w_rect, h_rect = cv2.boundingRect(largest_contour)
        
        # Check if the area is reasonable
        area_ratio = (w_rect * h_rect) / (w * h)
        if 0.05 < area_ratio < 0.9:
            # Add margin
            margin_x = int(0.15 * w_rect)
            margin_y = int(0.15 * h_rect)
            
            x_start = max(0, x - margin_x)
            y_start = max(0, y - margin_y)
            x_end = min(w, x + w_rect + margin_x)
            y_end = min(h, y + h_rect + margin_y)
            
            return image[y_start:y_end, x_start:x_end]
        
        return None
        
    except Exception as e:
        logging.error(f"Error in detect_monitor_by_grid_analysis: {str(e)}")
        return None

def detect_monitor_multi_scale(image: np.ndarray) -> Optional[np.ndarray]:
    """
    Detect monitor screen using multi-scale edge detection
    
    This method applies edge detection at multiple scales to find rectangular
    structures that may be missed at a single scale.
    
    Args:
        image: Input image in BGR format
        
    Returns:
        Cropped image if monitor is detected, None otherwise
    """
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape[:2]
        
        # Define scales to check
        scales = [0.5, 0.75, 1.0, 1.5]
        
        best_rect = None
        best_score = 0
        
        for scale in scales:
            # Resize image for this scale
            if scale != 1.0:
                width = int(w * scale)
                height = int(h * scale)
                resized = cv2.resize(gray, (width, height))
            else:
                resized = gray
            
            # Apply edge detection
            blurred = cv2.GaussianBlur(resized, (5, 5), 0)
            edges = cv2.Canny(blurred, 30, 150)
            
            # Dilate edges to connect nearby lines
            kernel = np.ones((3, 3), np.uint8)
            dilated = cv2.dilate(edges, kernel, iterations=2)
            
            # Find contours
            contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            
            # Check each contour
            for contour in contours:
                # Approximate contour
                peri = cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, 0.04 * peri, True)
                
                # Check if it's roughly rectangular (3-8 vertices)
                if 3 <= len(approx) <= 8:
                    # Calculate bounding rect
                    rect = cv2.boundingRect(approx)
                    x, y, w_rect, h_rect = rect
                    
                    # Scale back to original image size
                    if scale != 1.0:
                        x = int(x / scale)
                        y = int(y / scale)
                        w_rect = int(w_rect / scale)
                        h_rect = int(h_rect / scale)
                    
                    # Check if size is reasonable
                    area_ratio = (w_rect * h_rect) / (w * h)
                    if 0.05 <= area_ratio <= 0.9:
                        # Calculate aspect ratio
                        aspect_ratio = w_rect / h_rect if h_rect > 0 else 0
                        
                        # Score this rectangle
                        if 0.5 <= aspect_ratio <= 3.0:
                            # Calculate a score based on contour properties
                            score = area_ratio * (1.0 - abs(1.33 - aspect_ratio) / 1.33)
                            
                            if score > best_score:
                                best_score = score
                                best_rect = (x, y, w_rect, h_rect)
        
        # If we found a good rectangle, return the cropped image
        if best_rect and best_score > 0.1:
            x, y, w_rect, h_rect = best_rect
            
            # Add margins
            margin_x = int(0.1 * w_rect)
            margin_y = int(0.1 * h_rect)
            
            x_start = max(0, x - margin_x)
            y_start = max(0, y - margin_y)
            x_end = min(w, x + w_rect + margin_x)
            y_end = min(h, y + h_rect + margin_y)
            
            return image[y_start:y_end, x_start:x_end]
        
        return None
        
    except Exception as e:
        logging.error(f"Error in detect_monitor_multi_scale: {str(e)}")
        return None
        
def detect_and_crop_monitor_screen(image: np.ndarray) -> Tuple[np.ndarray, bool, str]:
    """
    Enhanced monitor screen detection with multiple techniques
    
    Returns:
        Tuple containing:
        - Processed image (cropped if monitor detected, original if not)
        - Boolean indicating if monitor was successfully detected
        - Message with detection details or guidance for the user
    """
    try:
        # Get image dimensions
        h, w = image.shape[:2]
        original = image.copy()
        
        # TECHNIQUE 1: STANDARD EDGE + CONTOUR DETECTION
        # Convert to grayscale for processing
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Use multiple edge detection methods for better results
        edges = cv2.Canny(blurred, 50, 150)
        thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                      cv2.THRESH_BINARY_INV, 11, 2)
        combined_edges = cv2.bitwise_or(edges, thresh)
        
        # Dilate to connect broken lines
        kernel = np.ones((3, 3), np.uint8)
        dilated_edges = cv2.dilate(combined_edges, kernel, iterations=1)
        
        # Find contours
        contours, _ = cv2.findContours(dilated_edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        
        # Variables to track detection quality
        best_quad = None
        best_area_ratio = 0
        best_approx = None
        best_score = 0
        
        # Look for quadrilateral contours that might be the monitor screen
        for contour in contours[:20]:
            # Approximate the contour
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            
            # Check for approximately rectangular shapes (allowing for perspective distortion)
            if 3 <= len(approx) <= 6:
                # Force it to have 4 corners if not already
                if len(approx) != 4:
                    x, y, w_rect, h_rect = cv2.boundingRect(approx)
                    rect_area = w_rect * h_rect
                    
                    perfect_rect = np.array([
                        [x, y],
                        [x + w_rect, y],
                        [x + w_rect, y + h_rect],
                        [x, y + h_rect]
                    ])
                    
                    contour_area = cv2.contourArea(contour)
                    if contour_area > 0 and rect_area / contour_area < 1.5:
                        approx = perfect_rect
                else:
                    # If already has 4 corners, ensure they're in the right order
                    approx = order_points(approx.reshape(-1, 2))
                
                # Calculate detection confidence metrics
                image_area = h * w
                contour_area = cv2.contourArea(approx)
                
                if contour_area <= 0:
                    continue
                
                # Check if size is reasonable for a monitor
                area_ratio = contour_area / image_area
                if 0.05 < area_ratio < 0.95:
                    # Get rectangle confidence score
                    rect_confidence = get_rectangle_confidence(approx.reshape(-1, 2))
                    
                    # Calculate overall confidence score
                    # - Higher area_ratio = larger portion of image (good)
                    # - Higher rect_confidence = more rectangular shape (good)
                    score = area_ratio * rect_confidence
                    
                    if score > best_score:
                        best_score = score
                        best_area_ratio = area_ratio
                        best_quad = approx
                        best_approx = approx.reshape(-1, 2)
        
        # Set minimum confidence threshold for successful detection
        MIN_CONFIDENCE_THRESHOLD = 0.12  # Slightly lower threshold for better recall
        
        # If we found a good quadrilateral, perform perspective correction
        if best_quad is not None and best_approx is not None and best_score > MIN_CONFIDENCE_THRESHOLD:
            #logging.info(f"Monitor screen detected with confidence score: {best_score:.2f}")
            
            # Process the detected monitor (perspective correction etc.)
            result = process_detected_monitor(image, best_approx)
            if result is not None:
                return result, True, "Monitor screen detected and cropped successfully"
        
        # TECHNIQUE 2: HOUGH LINE DETECTION
        # Only proceed if first method failed
        #logging.info("Standard contour detection failed, trying Hough line detection")
        edges = cv2.Canny(blurred, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=100, maxLineGap=10)
        
        if lines is not None and len(lines) > 0:
            # Create a mask of all lines
            line_mask = np.zeros_like(gray)
            for line in lines:
                x1, y1, x2, y2 = line[0]
                cv2.line(line_mask, (x1, y1), (x2, y2), 255, 2)
                
            line_contours, _ = cv2.findContours(line_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if line_contours:
                largest_contour = max(line_contours, key=cv2.contourArea)
                x, y, w_rect, h_rect = cv2.boundingRect(largest_contour)
                
                contour_area = w_rect * h_rect
                if 0.1 * (h * w) < contour_area < 0.9 * (h * w):
                    margin_x = int(0.1 * w_rect)
                    margin_y = int(0.1 * h_rect)
                    
                    x_start = max(0, x - margin_x)
                    y_start = max(0, y - margin_y)
                    x_end = min(w, x + w_rect + margin_x)
                    y_end = min(h, y + h_rect + margin_y)
                    
                    #logging.info("Monitor outline detected using line detection")
                    return image[y_start:y_end, x_start:x_end], True, "Monitor outline detected"
        
        # TECHNIQUE 3: CONTRAST-BASED SEGMENTATION
        # Try to detect the monitor based on contrast differences
        #logging.info("Line detection failed, trying contrast-based segmentation")
        result = detect_monitor_by_contrast(image)
        if result is not None:
            return result, True, "Monitor detected using contrast segmentation"
            
        # TECHNIQUE 4: GRID-BASED DETECTION
        # Try grid-based analysis to find rectangular regions with digit-like content
        #logging.info("Contrast segmentation failed, trying grid-based detection")
        result = detect_monitor_by_grid_analysis(image)
        if result is not None:
            return result, True, "Monitor detected using grid analysis"
            
        # TECHNIQUE 5: MULTI-SCALE EDGE DETECTION
        # Try edge detection at multiple scales
        #logging.info("Grid analysis failed, trying multi-scale edge detection")
        result = detect_monitor_multi_scale(image)
        if result is not None:
            return result, True, "Monitor detected using multi-scale analysis"
        
        # Monitor detection failed - return original image with failure message
        logging.warning("All detection methods failed, no monitor screen detected")
        
        # Return original image with failure status and message
        return image, False, "No rowing machine monitor detected. Please take another photo where the monitor screen is clearly visible, well-lit, and centered in the frame."
        
    except Exception as e:
        logging.error(f"Error in detect_and_crop_monitor_screen: {str(e)}")
        logging.error(traceback.format_exc())
        
        # Return original image with error message
        return image, False, f"Error detecting monitor: {str(e)}. Please try again with a clearer photo."

def process_detected_monitor(image: np.ndarray, corners) -> Optional[np.ndarray]:
    """
    Process a detected monitor by applying perspective correction and cropping
    to the content area
    """
    try:
        # Ensure we have 4 corners
        if len(corners) != 4:
            logging.warning(f"Expected 4 corners but got {len(corners)}, using bounding rectangle")
            x, y, w_rect, h_rect = cv2.boundingRect(corners)
            corners = np.array([
                [x, y],
                [x + w_rect, y],
                [x + w_rect, y + h_rect],
                [x, y + h_rect]
            ])
        
        # Order points correctly
        rect = order_points(corners)
        
        # Calculate dimensions for perspective transform
        width = int(max(
            np.linalg.norm(rect[1] - rect[0]),  # Top edge
            np.linalg.norm(rect[3] - rect[2])   # Bottom edge
        ))
        
        # Rowing machine monitors typically have aspect ratio between 4:3 and 16:9
        height = int(width * (3/4))  # 4:3 aspect ratio
        
        # Define destination points for perspective transform
        dst = np.array([
            [0, 0],                  # Top-left
            [width - 1, 0],          # Top-right
            [width - 1, height - 1], # Bottom-right
            [0, height - 1]          # Bottom-left
        ], dtype="float32")
        
        # Calculate and apply perspective transform
        transform_matrix = cv2.getPerspectiveTransform(rect, dst)
        warped = cv2.warpPerspective(image, transform_matrix, (width, height))
        
        # Find inner content area
        warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        _, warped_thresh = cv2.threshold(warped_gray, 100, 255, cv2.THRESH_BINARY)
        
        content_contours, _ = cv2.findContours(
            warped_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        # Skip tiny contours
        significant_contours = [c for c in content_contours if cv2.contourArea(c) > 50]
        
        # If we found significant content, find its bounding box
        if significant_contours:
            # Create a mask of all significant contours
            mask = np.zeros_like(warped_gray)
            for contour in significant_contours:
                cv2.drawContours(mask, [contour], -1, 255, -1)
            
            # Find bounding rectangle of all content
            x, y, w_content, h_content = cv2.boundingRect(mask)
            
            # Add margin to content area (8% of width/height)
            margin_x = int(0.08 * w_content)
            margin_y = int(0.08 * h_content)
            
            # Ensure margins stay within image bounds
            content_x1 = max(0, x - margin_x)
            content_y1 = max(0, y - margin_y)
            content_x2 = min(width, x + w_content + margin_x)
            content_y2 = min(height, y + h_content + margin_y)
            
            # Check if the resulting crop area is reasonable
            crop_ratio = (content_y2 - content_y1) * (content_x2 - content_x1) / (width * height)
            if crop_ratio > 0.25:  # At least 25% of the warped image
                return warped[content_y1:content_y2, content_x1:content_x2]
            else:
                # If inner content detection was too aggressive, use the whole warped monitor
                return warped
        
        # If content detection fails, return the whole perspective-corrected screen
        return warped
    
    except Exception as e:
        logging.error(f"Error in process_detected_monitor: {str(e)}")
        logging.error(traceback.format_exc())
        return None

def order_points(pts):
    """
    Order points in top-left, top-right, bottom-right, bottom-left order
    
    Args:
        pts: Array of 4 points
        
    Returns:
        Ordered points as float32 array
    """
    # Initialize an array of ordered points
    rect = np.zeros((4, 2), dtype="float32")
    
    # The top-left point has the smallest sum
    # The bottom-right has the largest sum
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    
    # Compute the difference between the points
    # The top-right has the smallest difference
    # The bottom-left has the largest difference
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    
    return rect

def get_rectangle_confidence(pts):
    """
    Calculate how close a quadrilateral is to a perfect rectangle
    
    Args:
        pts: Array of 4 points in clockwise order
        
    Returns:
        Confidence score between 0 and 1
    """
    # Perfect rectangles have equal diagonals and parallel sides
    if len(pts) != 4:
        return 0
    
    # Calculate diagonals
    d1 = np.linalg.norm(pts[0] - pts[2])  # Top-left to bottom-right
    d2 = np.linalg.norm(pts[1] - pts[3])  # Top-right to bottom-left
    
    # Calculate sides
    s1 = np.linalg.norm(pts[0] - pts[1])  # Top
    s2 = np.linalg.norm(pts[1] - pts[2])  # Right
    s3 = np.linalg.norm(pts[2] - pts[3])  # Bottom
    s4 = np.linalg.norm(pts[3] - pts[0])  # Left
    
    # Calculate aspect ratio
    aspect_ratio = max(s1, s3) / max(s2, s4) if max(s2, s4) > 0 else 0
    
    # Rectangle confidence based on diagonal similarity and aspect ratio
    diagonal_similarity = min(d1, d2) / max(d1, d2) if max(d1, d2) > 0 else 0
    
    # Aspect ratio confidence - rowing machine monitors are typically between 4:3 (1.33) and 16:9 (1.78)
    aspect_confidence = 1.0
    if aspect_ratio > 0:
        if aspect_ratio < 1:
            aspect_ratio = 1 / aspect_ratio  # Invert if less than 1
        
        # Penalize aspect ratios too far from typical monitor ratios
        if aspect_ratio < 1.2 or aspect_ratio > 1.9:
            aspect_confidence = 0.8
    
    # Combine scores (diagonal similarity is more important)
    return diagonal_similarity * 0.7 + aspect_confidence * 0.3


def stitch_images_vertically(images: List[np.ndarray]) -> np.ndarray:
    """
    Stitch multiple images vertically to create a single image
    Useful for combining multiple screen captures into one
    """
    if not images:
        raise ValueError("No images provided for stitching")
    
    if len(images) == 1:
        return images[0]
    
    # Resize all images to the same width (use the width of the first image)
    target_width = images[0].shape[1]
    resized_images = []
    
    for img in images:
        # Skip empty images
        if img is None or img.size == 0:
            continue
            
        # Calculate new height while maintaining aspect ratio
        aspect_ratio = img.shape[1] / img.shape[0]
        new_height = int(target_width / aspect_ratio)
        
        # Resize image
        resized = cv2.resize(img, (target_width, new_height))
        resized_images.append(resized)
    
    # Vertically concatenate the images
    return cv2.vconcat(resized_images)
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Process erg monitor images with optional OCR')
    parser.add_argument('--input', required=True, help='Input JSON file path')
    parser.add_argument('--output', required=True, help='Output JSON file path')
    parser.add_argument('--no-ocr', action='store_true', help='Disable OCR processing (image processing only)')
    parser.add_argument('--endpoint', help='Azure Document Intelligence endpoint')
    parser.add_argument('--key', help='Azure Document Intelligence API key')
    parser.add_argument('--model-id', default='erg_monitor_ocr', help='Azure Document Intelligence model ID')
    parser.add_argument('--debug', action='store_true', help='Enable debug output')
    args = parser.parse_args()
    
    # Read input JSON
    with open(args.input, 'r') as f:
        input_data = json.load(f)
    
    # Setup options
    options = input_data.get('options', {})
    options['ocr'] = not args.no_ocr
    options['debug'] = args.debug
    
    # Override with command line options if provided
    if args.endpoint:
        options['endpoint'] = args.endpoint
    if args.key:
        options['key'] = args.key
    if args.model_id:
        options['modelId'] = args.model_id
    
    # Process images with the consolidated function
    result = process_erg_images(input_data['images'], options)
    
    # Write output JSON
    with open(args.output, 'w') as f:
        json.dump(result, f)
    
    # Exit with success
    sys.exit(0)
