"""
Workout Parser Module

This module handles the parsing of OCR results into structured workout data:
1. Extract document fields and table data
2. Clean up text by fixing character encoding issues
3. Structure the data for easy consumption by applications

Separating this logic from image processing allows for:
- Better testability of parsing logic
- Cleaner separation of concerns
- More maintainable codebase
"""

import re
import logging
import traceback
from typing import Dict, List, Any, Optional, Tuple

def parse_ocr_results(ocr_results: Dict) -> Dict:
    """
    Parse OCR results focusing on direct extraction of document fields and tables.
    """
    try:
        if not ocr_results.get("success", False):
            return {
                "success": False,
                "error": ocr_results.get("error", "Unknown OCR error"),
                "data": None
            }
            
        # Extract document fields
        document_fields = extract_document_fields(ocr_results)
        
        # Extract tables
        tables_data = extract_tables(ocr_results)
        
        # Determine workout type
        workout_type = determine_workout_type(document_fields)
        
        # Create structured workout data with clean field values
        workout_data = {
            "workoutType": workout_type,
            
            "totalTime": clean_field_value(get_field_with_alternates(document_fields, 
                ["TotalWorkTime", "TotalTime", "WorkoutDuration", "Duration", "Time"])),
                
            "totalDistance": parse_distance(clean_field_value(get_field_with_alternates(document_fields, 
                ["TotalWorkDistance", "TotalDistance", "WorkoutDistance", "Distance", "Meters"]))),
                
            "averageSplit": clean_field_value(get_field_with_alternates(document_fields, 
                ["Average500mSplit", "AverageSplit", "AvgSplit", "Pace", "AveragePace"])),
                
            "averageStrokeRate": parse_number(clean_field_value(get_field_with_alternates(document_fields, 
                ["AverageStrokeRate", "AvgStrokeRate", "AvgSPM", "SPM"]))),
                
            "averageHeartRate": parse_number(clean_field_value(get_field_with_alternates(document_fields, 
                ["AverageHeartRate", "AvgHeartRate", "AvgHR", "HeartRate", "HR"]))),
                
            "date": clean_field_value(get_field_with_alternates(document_fields, 
                ["Date", "WorkoutDate"])),
                
            "workoutTitle": clean_field_value(get_field_with_alternates(document_fields, 
                ["WorkoutTitle", "WorkoutName", "Workout", "Title", "Name", "ScreenTitle"])),
                
            # Include raw fields and table data
            "tables": tables_data,
            "fields": document_fields,
            
            # Add the standard table if available (most common table type)
            "standardTable": tables_data.get("StandardTable", []) or tables_data.get("IntervalTable", []) or tables_data.get("VariableIntervalTable", [])
        }
        
        # Remove empty fields
        workout_data = {k: v for k, v in workout_data.items() 
                      if v or v == 0 or k in ["tables", "fields", "standardTable"]}
        
        # Apply deduplication to interval tables - THIS LINE WAS MISSING
        workout_data = deduplicate_interval_tables(workout_data)
        
        return {
            "success": True,
            "data": workout_data
        }
        
    except Exception as e:
        error_message = f"Error parsing OCR results: {str(e)}"
        traceback_str = traceback.format_exc()
        logging.error(error_message)
        logging.error(traceback_str)
        
        return {
            "success": False,
            "error": error_message,
            "traceback": traceback_str,
            "data": None
        }
def clean_field_value(value: str) -> str:
    """
    Clean field values by fixing character encoding issues:
    - Replace \u00a5 (¥) with 'r'
    - Remove any non-printable characters
    - Trim whitespace
    """
    if not value:
        return ""
        
    # Replace ¥ character with 'r'
    cleaned = value.replace('\u00a5', 'r')
    
    # Trim whitespace
    cleaned = cleaned.strip()
    
    return cleaned

def extract_document_fields(ocr_results: Dict) -> Dict:
    """
    Extract all document fields from OCR results with cleaned values
    """
    document_fields = {}
    
    try:
        results = ocr_results.get("results", {})
        
        # Check if there is an analyzeResult layer
        if "analyzeResult" in results:
            analyze_result = results["analyzeResult"]
            
            # Extract from documents if available
            if "documents" in analyze_result and analyze_result["documents"]:
                for doc in analyze_result["documents"]:
                    if "fields" in doc:
                        for field_name, field_data in doc["fields"].items():
                            # Extract field value with proper cleanup
                            if "content" in field_data:
                                field_value = clean_field_value(field_data["content"])
                                document_fields[field_name] = field_value
                            elif "valueString" in field_data:
                                field_value = clean_field_value(field_data["valueString"])
                                document_fields[field_name] = field_value
    except Exception as e:
        logging.error(f"Error extracting document fields: {str(e)}")
    
    return document_fields
def deduplicate_interval_tables(workout_data: Dict) -> Dict:
    """
    Remove duplicate rows from interval tables when multiple images with overlapping data are processed.
    
    For interval workouts, we use the NumIntervals field to determine the expected number of rows,
    then intelligently remove duplicates when more rows than expected are found.
    """
    # Skip deduplication if not an interval workout
    if workout_data.get("workoutType") != "interval":
        return workout_data
    
    # Check if NumIntervals is specified
    num_intervals = None
    if "fields" in workout_data and "NumIntervals" in workout_data["fields"]:
        try:
            num_intervals = int(str(workout_data["fields"]["NumIntervals"]).strip())
        except (ValueError, TypeError):
            logging.warning("NumIntervals could not be parsed as an integer")
    
    if not num_intervals:
        logging.info("Cannot deduplicate: NumIntervals not found or invalid")
        return workout_data
    
    logging.info(f"Found NumIntervals={num_intervals}, checking for table deduplication")
    
    # Process tables if present
    if "tables" in workout_data:
        # Process IntervalTable if present
        if "IntervalTable" in workout_data["tables"] and isinstance(workout_data["tables"]["IntervalTable"], list):
            workout_data["tables"]["IntervalTable"] = deduplicate_table_rows(
                workout_data["tables"]["IntervalTable"], 
                num_intervals,
                determine_interval_table_type(workout_data["tables"]["IntervalTable"])
            )
        
        # Process StandardTable if present
        if "StandardTable" in workout_data["tables"] and isinstance(workout_data["tables"]["StandardTable"], list):
            workout_data["tables"]["StandardTable"] = deduplicate_table_rows(
                workout_data["tables"]["StandardTable"], 
                num_intervals,
                determine_interval_table_type(workout_data["tables"]["StandardTable"])
            )
    
    # Update the standardTable reference
    if "tables" in workout_data:
        if "IntervalTable" in workout_data["tables"] and workout_data["tables"]["IntervalTable"]:
            workout_data["standardTable"] = workout_data["tables"]["IntervalTable"]
        elif "StandardTable" in workout_data["tables"] and workout_data["tables"]["StandardTable"]:
            workout_data["standardTable"] = workout_data["tables"]["StandardTable"]
    
    return workout_data

def determine_interval_table_type(rows: List[Dict]) -> str:
    """
    Determine the type of interval table:
    - "standard": Regular interval table with one row per interval
    - "variable": Variable interval table with work/rest pairs
    
    Args:
        rows: List of table rows
        
    Returns:
        Table type as string: "standard" or "variable"
    """
    if not rows or len(rows) <= 1:  # Not enough rows to determine
        return "standard"
    
    # Check if we see rest rows (indicating variable interval format)
    rest_indicators = ["rest", "recovery", "rec", "r:", "r="]
    
    # Skip the header row, check the rest
    for i in range(1, min(5, len(rows))):  # Check up to 4 non-header rows
        row = rows[i]
        if not isinstance(row, dict):
            continue
            
        # Look for rest indicators in the row values
        for value in row.values():
            if isinstance(value, str) and any(ind in value.lower() for ind in rest_indicators):
                return "variable"
    
    # If no clear rest indicators, check row pattern
    # Variable format often has alternating patterns in distance or time
    if len(rows) >= 5:  # Need header + at least 2 pairs
        distances = []
        times = []
        
        for i in range(1, min(7, len(rows))):
            row = rows[i]
            if not isinstance(row, dict):
                continue
                
            # Try to extract distance and time values
            dist_val = extract_numeric_value(row, ["distance", "meter", "meters", "m"])
            time_val = extract_time_value(row, ["time", "duration", "mins", "min"])
            
            if dist_val is not None:
                distances.append(dist_val)
            if time_val is not None:
                times.append(time_val)
        
        # Check for alternating pattern in distances or times
        if check_alternating_pattern(distances) or check_alternating_pattern(times):
            return "variable"
    
    # Default to standard format
    return "standard"

def extract_numeric_value(row: Dict, field_keys: List[str]) -> Optional[float]:
    """Extract a numeric value from a row using various possible field keys"""
    for key in row:
        if any(field_key in key.lower() for field_key in field_keys):
            try:
                # Extract digits and possible decimal point
                value_str = ''.join(c for c in str(row[key]) if c.isdigit() or c == '.')
                if value_str:
                    return float(value_str)
            except (ValueError, TypeError):
                pass
    return None

def extract_time_value(row: Dict, field_keys: List[str]) -> Optional[float]:
    """Extract a time value from a row and convert to seconds"""
    for key in row:
        if any(field_key in key.lower() for field_key in field_keys):
            if not row[key]:
                continue
                
            value_str = str(row[key])
            
            # Try to handle MM:SS format
            if ":" in value_str:
                try:
                    parts = value_str.split(":")
                    if len(parts) == 2:
                        mins = float(parts[0])
                        secs = float(parts[1])
                        return mins * 60 + secs
                except (ValueError, TypeError):
                    pass
            
            # Try to extract as a simple numeric value
            try:
                # Extract digits and possible decimal point
                clean_value = ''.join(c for c in value_str if c.isdigit() or c == '.')
                if clean_value:
                    return float(clean_value)
            except (ValueError, TypeError):
                pass
    return None

def check_alternating_pattern(values: List[float]) -> bool:
    """Check if a list of values has an alternating pattern"""
    if len(values) < 4:  # Need at least 2 pairs
        return False
        
    # Check if values alternate between two distinct values
    odd_values = values[::2]  # 0, 2, 4, ...
    even_values = values[1::2]  # 1, 3, 5, ...
    
    # Check if odd values are similar to each other
    odd_mean = sum(odd_values) / len(odd_values)
    odd_similar = all(abs(v - odd_mean) / odd_mean < 0.2 for v in odd_values)  # Within 20%
    
    # Check if even values are similar to each other
    even_mean = sum(even_values) / len(even_values)
    even_similar = all(abs(v - even_mean) / even_mean < 0.2 for v in even_values)  # Within 20%
    
    # Check if odd and even values are different
    means_different = abs(odd_mean - even_mean) / max(odd_mean, even_mean) > 0.3  # At least 30% difference
    
    return odd_similar and even_similar and means_different

def deduplicate_table_rows(rows: List[Dict], expected_count: int, table_type: str) -> List[Dict]:
    """
    Generic deduplication function that handles both standard and variable interval tables
    
    Args:
        rows: List of table rows
        expected_count: Expected number of intervals
        table_type: "standard" or "variable"
        
    Returns:
        Deduplicated list of rows
    """
    if not rows or len(rows) <= 1:  # Need at least a header
        return rows
        
    # Preserve header (row 0)
    header = rows[0]
    
    # For standard tables:
    # Total expected rows = header + workout intervals + (possibly) rest summary
    # For variable tables:
    # Total expected rows = header + (workout row + rest row) * expected_count
    total_expected_rows = 1 + expected_count
    if table_type == "variable":
        total_expected_rows = 1 + (expected_count * 2)
        
    # If we have the expected number of rows or fewer, no deduplication needed
    if len(rows) <= total_expected_rows:
        logging.info(f"No deduplication needed: {len(rows)} rows <= {total_expected_rows} expected")
        return rows
    
    logging.info(f"Deduplicating {table_type} table from {len(rows)} to {total_expected_rows} rows")
    
    if table_type == "standard":
        return deduplicate_standard_table_rows(rows, expected_count)
    else:
        return deduplicate_variable_table_rows(rows, expected_count)

def deduplicate_standard_table_rows(rows: List[Dict], expected_count: int) -> List[Dict]:
    """
    Deduplicate standard interval table rows with structure:
    - Row 0: Header
    - Row 1-N: Workout rows
    - Row N+1: (Optional) Rest summary row
    """
    if not rows or len(rows) <= 1:
        return rows
        
    # Preserve header (row 0)
    header = rows[0]
    
    # Check if the last row is a rest summary
    rest_row = None
    workout_rows = rows[1:]
    
    # Check if last row might be a rest summary row
    if len(workout_rows) > 0:
        last_row = workout_rows[-1]
        is_rest_summary = False
        
        if isinstance(last_row, dict):
            # Look for "rest" in any field value
            for value in last_row.values():
                if isinstance(value, str) and "rest" in value.lower():
                    is_rest_summary = True
                    break
            
            # Also check if there's only data in the second column
            if not is_rest_summary:
                data_columns = [key for key, value in last_row.items() 
                              if value and str(value).strip()]
                if len(data_columns) == 1:
                    second_column_names = ["Meter", "meter", "distance", "Distance", "m"]
                    if any(column in data_columns[0] for column in second_column_names):
                        is_rest_summary = True
        
        if is_rest_summary:
            rest_row = last_row
            workout_rows = workout_rows[:-1]
    
    # Deduplicate workout rows
    unique_workout_rows = []
    seen_hashes = set()
    
    for row in workout_rows:
        # Create a hashable representation of the row
        row_items = sorted((k, str(v)) for k, v in row.items() if k != "number")
        row_hash = str(row_items)
        
        if row_hash not in seen_hashes:
            seen_hashes.add(row_hash)
            unique_workout_rows.append(row)
    
    # If we still have too many rows, sort by interval number and take the expected count
    if len(unique_workout_rows) > expected_count:
        sorted_rows = sorted(
            unique_workout_rows,
            key=lambda x: get_interval_number_from_row(x)
        )
        unique_workout_rows = sorted_rows[:expected_count]
    
    # Reassemble the table
    result = [header] + unique_workout_rows
    if rest_row:
        result.append(rest_row)
    
    logging.info(f"Deduplicated to {len(result)} rows (header + {len(unique_workout_rows)} workout rows + {1 if rest_row else 0} rest summary)")
    return result

def extract_tables(ocr_results: Dict) -> Dict[str, List[Dict]]:
    """ 
    Extract table data from OCR results
    
    Returns a dictionary mapping table names to lists of table rows
    """
    tables_data = {}
    
    try:
        results = ocr_results.get("results", {})
        
        # Check for analyzeResult layer
        if "analyzeResult" in results:
            analyze_result = results["analyzeResult"]
            
            # Extract from documents if available
            if "documents" in analyze_result and analyze_result["documents"]:
                for doc in analyze_result["documents"]:
                    if "fields" not in doc:
                        continue
                    
                    # Look for table fields (arrays)
                    for field_name, field_data in doc["fields"].items():
                        # Check if this is a table field
                        if field_data.get("type") == "array" and "valueArray" in field_data:
                            table_rows = []
                            
                            for item in field_data["valueArray"]:
                                if "valueObject" in item:
                                    # Process structured row data
                                    row_data = {}
                                    for col_name, col_data in item["valueObject"].items():
                                        if "content" in col_data:
                                            row_data[col_name] = clean_field_value(col_data["content"])
                                        elif "valueString" in col_data:
                                            row_data[col_name] = clean_field_value(col_data["valueString"])
                                    table_rows.append(row_data)
                                elif "content" in item:
                                    # Add simple content rows (less common)
                                    table_rows.append(clean_field_value(item["content"]))
                            
                            # Add to tables data
                            tables_data[field_name] = table_rows
    except Exception as e:
        logging.error(f"Error extracting tables: {str(e)}")
    
    return tables_data

def deduplicate_variable_table_rows(rows: List[Dict], expected_count: int) -> List[Dict]:
    """
    Deduplicate variable interval table rows with structure:
    - Row 0: Header
    - For each interval: 
      - Work row
      - Rest row
    """
    if not rows or len(rows) <= 1:
        return rows
        
    # Preserve header (row 0)
    header = rows[0]
    
    # Group rows into interval pairs (work+rest), starting after header
    interval_pairs = []
    i = 1
    while i < len(rows) - 1:  # Need at least 2 more rows to form a pair
        work_row = rows[i]
        rest_row = rows[i+1]
        
        # Check if this is likely a work+rest pair
        is_rest_row = False
        if isinstance(rest_row, dict):
            # Check for "rest" in any field value
            for value in rest_row.values():
                if isinstance(value, str) and "rest" in value.lower():
                    is_rest_row = True
                    break
            
            # Also check data pattern (data mainly in first and second columns)
            if not is_rest_row:
                data_columns = [key for key, value in rest_row.items() 
                              if value and str(value).strip()]
                if 1 <= len(data_columns) <= 2:
                    is_rest_row = True
        
        if is_rest_row:
            interval_pairs.append((work_row, rest_row))
            i += 2  # Skip both rows in the pair
        else:
            # If not a clear pair, treat current row as work and advance by one
            interval_pairs.append((work_row, None))
            i += 1
    
    # Handle any remaining row
    if i < len(rows):
        interval_pairs.append((rows[i], None))
    
    # Deduplicate interval pairs by looking at the work row (first element of each pair)
    unique_pairs = []
    seen_hashes = set()
    
    for work_row, rest_row in interval_pairs:
        # Create a hashable representation of the work row
        if isinstance(work_row, dict):
            row_items = sorted((k, str(v)) for k, v in work_row.items() if k != "number")
            row_hash = str(row_items)
            
            if row_hash not in seen_hashes:
                seen_hashes.add(row_hash)
                unique_pairs.append((work_row, rest_row))
    
    # If we still have too many pairs, sort by interval number and take the expected count
    if len(unique_pairs) > expected_count:
        sorted_pairs = sorted(
            unique_pairs,
            key=lambda pair: get_interval_number_from_row(pair[0])
        )
        unique_pairs = sorted_pairs[:expected_count]
    
    # Reassemble the table with header and deduplicated interval pairs
    result = [header]
    for work_row, rest_row in unique_pairs:
        result.append(work_row)
        if rest_row:
            result.append(rest_row)
    
    logging.info(f"Deduplicated to {len(result)} rows (header + {len(unique_pairs)} interval pairs)")
    return result

def get_interval_number_from_row(row: Dict) -> int:
    """Extract interval number from a row, with fallbacks to other numeric fields"""
    if not isinstance(row, dict):
        return 0
    
    # Try common interval number field names
    for key in ["number", "interval", "#", "no", "no."]:
        if key in row and row[key]:
            try:
                return int(str(row[key]).strip())
            except (ValueError, TypeError):
                pass
    
    # Fall back to numeric values in time or distance fields
    for key in ["Time", "time", "Meter", "meter", "Distance", "distance"]:
        if key in row and row[key]:
            # Extract digits
            digits = ''.join(c for c in str(row[key]) if c.isdigit())
            if digits:
                try:
                    return int(digits)
                except (ValueError, TypeError):
                    pass
    
    return 0

def determine_workout_type(fields: Dict[str, Any]) -> str:
    """
    Determine the type of workout based on available fields and tables
    """
    # Get the title field with fallbacks
    title = get_field_with_alternates(fields, ["WorkoutTitle", "Title", "Name", "ScreenTitle"])
    
    # Check for interval tables in the tables dictionary
    if "tables" in fields:
        tables_data = fields["tables"]
        if "IntervalTable" in tables_data and tables_data["IntervalTable"]:
            if len(tables_data["IntervalTable"]) > 0:
                logging.info("Found IntervalTable with data - classified as interval workout")
                return "interval"
        
        if "VariableIntervalTable" in tables_data and tables_data["VariableIntervalTable"]:
            if len(tables_data["VariableIntervalTable"]) > 0:
                logging.info("Found VariableIntervalTable with data - classified as interval workout")
                return "interval"
    
    # Check direct array fields in the document
    for field_name, field_data in fields.items():
        if field_name in ["IntervalTable", "VariableIntervalTable"] and isinstance(field_data, dict):
            if field_data.get("type") == "array" and field_data.get("valueArray") and len(field_data["valueArray"]) > 0:
                logging.info(f"Found {field_name} with {len(field_data['valueArray'])} rows - classified as interval workout")
                return "interval"
    
    # Check for NumIntervals field as either int or string
    if "NumIntervals" in fields:
        num_intervals = fields["NumIntervals"]
        if isinstance(num_intervals, int) and num_intervals > 0:
            logging.info(f"Found NumIntervals={num_intervals} - classified as interval workout")
            return "interval"
        elif isinstance(num_intervals, str):
            try:
                num = int(num_intervals.strip())
                if num > 0:
                    logging.info(f"Found NumIntervals={num} - classified as interval workout")
                    return "interval"
            except (ValueError, TypeError):
                pass
    
    # Check title patterns
    if title:
        title_lower = title.lower().strip()
        
        # Check for interval patterns
        if re.search(r'\d+\s*[xX]\s*\d+', title):  # NxM pattern (e.g., "4x500m")
            logging.info(f"Title '{title}' matches interval pattern (NxM) - classified as interval workout")
            return "interval"
        
        # Check for "N or M" pattern with ellipses
        elif re.search(r'\.\.\.\d+\s*or\s*\d+', title):
            logging.info(f"Title '{title}' matches interval pattern (...N or M) - classified as interval workout")
            return "interval"
        
        # Check for interval keywords
        elif any(keyword in title_lower for keyword in ["interval", "intervals", "rest", "recovery", "work/rest"]):
            logging.info(f"Title '{title}' contains interval keywords - classified as interval workout")
            return "interval"
            
        # Check for single distance patterns
        elif re.search(r'\d+\s*[mM]', title):
            logging.info(f"Title '{title}' matches single distance pattern - classified as single_distance workout")
            return "single_distance"
            
        # Check for time patterns
        elif re.search(r'\d+\s*[mM]in', title) or re.search(r'\d+:\d+', title):
            logging.info(f"Title '{title}' matches time pattern - classified as single_time workout")
            return "single_time"
    
    logging.info("No specific workout type matched, defaulting to single_distance")
    return "single_distance"


def get_field_with_alternates(fields: Dict[str, str], field_names: List[str]) -> str:
    """
    Try to get a field value using multiple possible field names
    """
    for name in field_names:
        if name in fields and fields[name]:
            return fields[name]
    return ""

def parse_distance(distance_str: str) -> int:
    """Parse distance string to number"""
    if not distance_str:
        return 0
        
    try:
        # Remove non-numeric characters except decimal point
        cleaned = ''.join(c for c in str(distance_str) if c.isdigit() or c == '.')
        return int(float(cleaned))
    except:
        return 0
        
def parse_number(num_str: str) -> int:
    """Parse numeric string to int"""
    if not num_str:
        return 0
        
    try:
        cleaned = ''.join(c for c in str(num_str) if c.isdigit() or c == '.')
        return int(float(cleaned))
    except:
        return 0
        
