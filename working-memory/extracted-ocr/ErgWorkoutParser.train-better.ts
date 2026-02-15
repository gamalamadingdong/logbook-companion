import { OcrMetrics } from './types';

/**
 * Interface for structured erg workout data
 */
export interface ErgWorkoutData {
  workoutType: 'single_distance' | 'single_time' | 'interval' | 'unknown';
  totalTime?: string;
  totalDistance?: number;
  averageSplit?: string;
  averageStrokeRate?: number;
  averageHeartRate?: number;
  date?: string;
  workoutTitle?: string;
  
  // Flag indicating if this is a variable interval format (alternating work/rest rows)
  isVariableInterval?: boolean;
  
  // Tables from Document Intelligence - now consolidated
  tables?: {
    StandardTable?: Array<Record<string, string>>;
    IntervalTable?: Array<Record<string, string>>;
    [key: string]: Array<Record<string, string>> | undefined;
  };
  
  // Extracted standard table for easy access
  standardTable?: Array<Record<string, string>>;
  
  // Raw fields from the document
  fields?: Record<string, any>;
}

/**
 * Parser for extracting structured data from Concept2 erg monitor OCR results
 */
export class ErgWorkoutParser {
  /**
   * Main entry point for parsing OCR results into structured workout data
   * This handles outputs directly from Azure Function which are processed by workout_parser.py
   */
  public parseWorkoutFromOcrJson(ocrJson: any): ErgWorkoutData {
    console.log('Parsing OCR result to extract workout data...');

    // Check if this is the top-level Azure Function response
    if (ocrJson?.success === true) {
      // Check for parsedData from workout_parser.py
      if (ocrJson.parsedData) {
        console.log('Found parsedData in Azure Function response');
        return this.parsePythonWorkoutParserOutput(ocrJson.parsedData);
      }
      
      // Legacy check for data
      if (ocrJson.data) {
        console.log('Found data in Azure Function response');
        return this.parsePythonWorkoutParserOutput(ocrJson.data);
      }
      
      // Check for OCR results that need further parsing
      if (ocrJson.ocrResults?.results?.analyzeResult?.documents) {
        console.log('Found raw OCR results in Azure Function response');
        const docFields = ocrJson.ocrResults.results.analyzeResult.documents[0].fields;
        
        // Create a synthetic result with basic structure
        return {
          workoutType: this.determineWorkoutTypeFromFields(docFields),
          fields: docFields,
          workoutTitle: this.extractField(docFields, ['WorkoutTitle', 'Title', 'Name']),
          totalTime: this.extractField(docFields, ['TotalTime', 'Time', 'Duration']),
          totalDistance: this.extractNumber(docFields, ['TotalDistance', 'Distance', 'Meters']),
          averageSplit: this.extractField(docFields, ['Average500mSplit', 'AverageSplit'])?.replace(',', '.'),
          averageStrokeRate: this.extractNumber(docFields, ['AverageStrokeRate', 'StrokeRate']),
          date: this.extractField(docFields, ['Date'])
        };
      }
    }

    // If nothing else worked, return minimal result
    console.log('No recognizable data format found in OCR response');
    return { workoutType: 'unknown' };
  }

  /**
   * Parse output from the Python workout_parser.py
   * The Python parser already extracts and structures most of the data we need
   */
  private parsePythonWorkoutParserOutput(data: any): ErgWorkoutData {
    try {
      // Create our result object using the Python parser's structure
      const result: ErgWorkoutData = {
        // Map workout type from Python format to our format
        workoutType: this.mapWorkoutType(data.workoutType || 'unknown'),
        
        // Copy basic fields directly
        totalTime: data.totalTime,
        totalDistance: data.totalDistance,
        date: data.date,
        workoutTitle: data.workoutTitle,
        
        // Fix comma-to-period conversion in split times
        averageSplit: data.averageSplit ? data.averageSplit.replace(',', '.') : undefined,
        
        averageStrokeRate: data.averageStrokeRate,
        averageHeartRate: data.averageHeartRate,
        
        // Copy table data - will now be either StandardTable or IntervalTable
        tables: data.tables,
        
        // Copy standardTable reference if available
        standardTable: data.standardTable,
        
        // Copy raw fields
        fields: data.fields
      };
      
      // If we don't have a standardTable yet but have one of the other tables,
      // set standardTable as a reference to whichever table is available
      if (!result.standardTable && result.tables) {
        if (result.tables.IntervalTable && result.tables.IntervalTable.length > 0) {
          result.standardTable = result.tables.IntervalTable;
        } else if (result.tables.StandardTable && result.tables.StandardTable.length > 0) {
          result.standardTable = result.tables.StandardTable;
        }
      }
      
      // Determine if this is a variable interval format
      if (result.workoutType === 'interval' && result.standardTable && result.standardTable.length > 2) {
        result.isVariableInterval = this.isVariableIntervalTable(result.standardTable);
      }

      return result;
    } catch (error) {
      console.error('Error parsing Python workout parser output:', error);
      return { workoutType: 'unknown' };
    }
  }

  /**
   * Determine if a table is in the variable interval format
   * Variable interval tables alternate between work and rest rows
   */
  private isVariableIntervalTable(rows: Array<Record<string, string>>): boolean {
    if (!rows || rows.length < 3) {  // Need header + at least one work/rest pair
      return false;
    }
    
    // Skip header, check the rest of the rows
    for (let i = 1; i < Math.min(rows.length, 5); i++) {
      const row = rows[i];
      
      // Look for rest indicators in the values
      const values = Object.values(row);
      const hasRestIndicator = values.some(value => {
        if (typeof value !== 'string') return false;
        const lower = value.toLowerCase();
        return lower.includes('rest') || lower.includes('recovery') || lower.includes('rec');
      });
      
      if (hasRestIndicator) {
        return true;
      }
    }
    
    // Check for alternating pattern in distances or times
    if (rows.length >= 5) {  // Need header + at least 2 pairs
      const distances: number[] = [];
      const times: number[] = [];
      
      // Extract numeric values from distance and time fields
      for (let i = 1; i < Math.min(rows.length, 7); i++) {
        const row = rows[i];
        
        // Look for distance values
        const distValue = this.extractNumericValueFromRow(row, ['distance', 'meter', 'meters', 'm']);
        if (distValue !== undefined) distances.push(distValue);
        
        // Look for time values
        const timeValue = this.extractTimeValueFromRow(row, ['time', 'duration', 'mins', 'min']);
        if (timeValue !== undefined) times.push(timeValue);
      }
      
      // Check for alternating pattern in distances or times
      if (this.hasAlternatingPattern(distances) || this.hasAlternatingPattern(times)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Extract a numeric value from a row using various possible field keys
   */
  private extractNumericValueFromRow(row: Record<string, string>, fieldKeys: string[]): number | undefined {
    for (const key of Object.keys(row)) {
      if (fieldKeys.some(fieldKey => key.toLowerCase().includes(fieldKey))) {
        try {
          const value = row[key];
          if (!value) continue;
          
          // Extract digits and possible decimal point
          const cleanValue = value.replace(/[^\d.]/g, '');
          if (cleanValue) {
            const numValue = parseFloat(cleanValue);
            if (!isNaN(numValue)) return numValue;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
    return undefined;
  }

  /**
   * Extract a time value from a row and convert to seconds
   */
  private extractTimeValueFromRow(row: Record<string, string>, fieldKeys: string[]): number | undefined {
    for (const key of Object.keys(row)) {
      if (fieldKeys.some(fieldKey => key.toLowerCase().includes(fieldKey))) {
        try {
          const value = row[key];
          if (!value) continue;
          
          // Handle MM:SS format
          if (value.includes(':')) {
            const parts = value.split(':');
            if (parts.length === 2) {
              const mins = parseFloat(parts[0]);
              const secs = parseFloat(parts[1]);
              if (!isNaN(mins) && !isNaN(secs)) {
                return mins * 60 + secs;
              }
            }
          }
          
          // Extract digits and possible decimal point
          const cleanValue = value.replace(/[^\d.]/g, '');
          if (cleanValue) {
            const numValue = parseFloat(cleanValue);
            if (!isNaN(numValue)) return numValue;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
    return undefined;
  }

  /**
   * Check if a list of values has an alternating pattern
   * This helps identify variable interval workouts that alternate between work and rest
   */
  private hasAlternatingPattern(values: number[]): boolean {
    if (values.length < 4) return false; // Need at least 2 pairs
    
    // Get odd and even values
    const oddValues = values.filter((_, i) => i % 2 === 0);
    const evenValues = values.filter((_, i) => i % 2 === 1);
    
    // Check if odd values are similar to each other
    const oddMean = oddValues.reduce((sum, v) => sum + v, 0) / oddValues.length;
    const oddSimilar = oddValues.every(v => Math.abs(v - oddMean) / oddMean < 0.2); // Within 20%
    
    // Check if even values are similar to each other
    const evenMean = evenValues.reduce((sum, v) => sum + v, 0) / evenValues.length;
    const evenSimilar = evenValues.every(v => Math.abs(v - evenMean) / evenMean < 0.2); // Within 20%
    
    // Check if odd and even values are different
    const meansDifferent = Math.abs(oddMean - evenMean) / Math.max(oddMean, evenMean) > 0.3; // At least 30% difference
    
    return oddSimilar && evenSimilar && meansDifferent;
  }

  /**
   * Extract field with fallbacks for different field names
   */
  private extractField(fields: any, fieldNames: string[]): string | undefined {
    if (!fields) return undefined;
    
    for (const name of fieldNames) {
      if (fields[name]?.valueString) {
        return fields[name].valueString;
      }
      if (fields[name]?.content) {
        return fields[name].content;
      }
    }
    return undefined;
  }

  /**
   * Extract and parse numeric fields
   */
  private extractNumber(fields: any, fieldNames: string[]): number | undefined {
    const value = this.extractField(fields, fieldNames);
    if (!value) return undefined;
    
    const parsed = parseFloat(value.replace(',', '.'));
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Map Python workout types to our internal types
   */
  private mapWorkoutType(pythonType: string): 'single_distance' | 'single_time' | 'interval' | 'unknown' {
    switch (pythonType.toLowerCase()) {
      case 'single_distance':
        return 'single_distance';
      case 'single_time':
        return 'single_time';
      case 'interval':
        return 'interval';
      default:
        return 'unknown';
    }
  }

  /**
   * Determine workout type from available fields
   */
  private determineWorkoutTypeFromFields(fields: any): 'single_distance' | 'single_time' | 'interval' | 'unknown' {
    if (!fields) return 'unknown';
    
    // Check for interval indicators
    if (fields.NumIntervals || fields.IntervalTable || fields.StandardTable) {
      return 'interval';
    }
    
    // Check workout title for clues
    const title = this.extractField(fields, ['WorkoutTitle', 'Title', 'Name']);
    if (title) {
      const lowerTitle = title.toLowerCase();
      
      // Check for interval patterns (e.g., "4x500m")
      if (lowerTitle.includes('interval') || 
          /\d+\s*[xX]\s*\d+/.test(lowerTitle) || 
          lowerTitle.includes('/')) {
        return 'interval';
      }
      
      // Check for distance patterns (e.g., "2000m")
      if (/\d+m/.test(lowerTitle) || lowerTitle.includes('meter')) {
        return 'single_distance';
      }
      
      // Check for time patterns (e.g., "30 min")
      if (/\d+\s*min/.test(lowerTitle) || lowerTitle.includes('time')) {
        return 'single_time';
      }
    }
    
    // Default based on which fields are present
    if (this.extractField(fields, ['TotalDistance', 'Distance'])) {
      return 'single_distance';
    }
    
    if (this.extractField(fields, ['TotalTime', 'Time'])) {
      return 'single_time';
    }
    
    return 'unknown';
  }

  /**
   * Convert parsed workout data into standardized metrics format
   */
  public convertToMetrics(workoutData: ErgWorkoutData | null): OcrMetrics {
    if (!workoutData) {
      return {
        ocrFailure: true,
        errorMessage: 'No workout data available'
      };
    }
    
    // Determine if this is a uniform interval workout that looks variable
    if (workoutData.workoutType === 'interval' && 
        workoutData.isVariableInterval && 
        this.hasUniformIntervals(workoutData)) {
      // Update the title to reflect the true nature
      const numIntervals = this.detectIntervalCount(workoutData);
      const info = this.extractUniformIntervalInfo(workoutData);
      
      if (numIntervals && (info.distance || info.time) && info.restTime) {
        // This is actually a standard interval workout
        workoutData.isVariableInterval = false;
      }
    }
    
    // Generate a standardized workout title
    const standardizedTitle = this.generateStandardWorkoutName(workoutData);
    workoutData.workoutTitle = standardizedTitle;
    
    // Initialize metrics object
    const metrics: OcrMetrics = {
      duration: workoutData.totalTime || null,
      distance: workoutData.totalDistance || null,
      avgSplit: workoutData.averageSplit ? workoutData.averageSplit.replace(',', '.') : null,
      avgHeartRate: workoutData.averageHeartRate || null,
      strokeRate: workoutData.averageStrokeRate || null,
      workoutData: workoutData // Store the full parsed data
    };
    
    // For interval workouts, calculate the total distance
    if (workoutData.workoutType === 'interval') {
      const calculatedDistance = this.calculateTotalIntervalDistance(workoutData);
      if (calculatedDistance) {
        metrics.distance = calculatedDistance;
      }
    }
    
    // Extract average split from table if not already set
    if (!metrics.avgSplit && workoutData.standardTable && workoutData.standardTable.length > 0) {
      // Try to extract from first row (summary row)
      const firstRow = workoutData.standardTable[0];
      const extractedSplit = this.extractRowSplit(firstRow);
      if (extractedSplit) {
        metrics.avgSplit = extractedSplit;
      }
    }
    
    // Ensure workoutType is valid
    if (!workoutData.workoutType || workoutData.workoutType === 'unknown') {
      if (workoutData.totalDistance && !workoutData.totalTime) {
        workoutData.workoutType = 'single_distance';
      } else if (workoutData.totalTime && !workoutData.totalDistance) {
        workoutData.workoutType = 'single_time';
      } else if (workoutData.standardTable && workoutData.standardTable.length > 0) {
        workoutData.workoutType = 'interval';
      } else if (workoutData.tables) {
        if (workoutData.tables.IntervalTable && workoutData.tables.IntervalTable.length > 0) {
          workoutData.workoutType = 'interval';
        } else if (workoutData.tables.StandardTable && workoutData.tables.StandardTable.length > 0) {
          workoutData.workoutType = 'interval';
        }
      }
    }
    
    return metrics;
  }

  /**
   * Extract workout intervals from the parsed data
   * This can be used to get a simplified view of interval data
   */
  public extractIntervals(workoutData: ErgWorkoutData): Array<{
    number?: number;
    distance?: number;
    time?: string;
    split?: string;
    strokeRate?: number;
    heartRate?: number;
    restTime?: string;
  }> {
    if (!workoutData.standardTable || workoutData.standardTable.length < 2) {
      return [];
    }
    
    const intervals = [];
    const isVariable = workoutData.isVariableInterval || false;
    const rows = workoutData.standardTable;
    
    // Start at index 1 to skip header row
    if (isVariable) {
      // Handle variable interval format (work/rest pairs)
      for (let i = 1; i < rows.length; i += 2) {
        const workRow = rows[i];
        const restRow = i + 1 < rows.length ? rows[i + 1] : null;
        
        intervals.push({
          number: this.extractRowNumber(workRow),
          distance: this.extractRowDistance(workRow),
          time: this.extractRowTime(workRow),
          split: this.extractRowSplit(workRow),
          strokeRate: this.extractRowStrokeRate(workRow),
          heartRate: this.extractRowHeartRate(workRow),
          restTime: restRow ? this.extractRowTime(restRow) : undefined
        });
      }
    } else {
      // Handle standard interval format (one row per interval)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        // Skip rows that appear to be rest summary
        if (this.isRestSummaryRow(row)) continue;
        
        intervals.push({
          number: this.extractRowNumber(row),
          distance: this.extractRowDistance(row),
          time: this.extractRowTime(row),
          split: this.extractRowSplit(row),
          strokeRate: this.extractRowStrokeRate(row),
          heartRate: this.extractRowHeartRate(row)
        });
      }
    }
    
    return intervals;
  }
  
  /**
   * Extract interval number from a table row
   */
  private extractRowNumber(row: Record<string, string>): number | undefined {
    // Try common field names for interval number
    for (const key of Object.keys(row)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'number' || lowerKey === 'interval' || lowerKey === '#' || lowerKey === 'no.') {
        const value = parseInt(row[key]);
        if (!isNaN(value)) return value;
      }
    }
    return undefined;
  }

  /**
   * Extract distance from a table row 
   */
  private extractRowDistance(row: Record<string, string>): number | undefined {
    return this.extractNumericValueFromRow(row, ['distance', 'meter', 'meters', 'm']);
  }

  /**
   * Extract time from a table row
   */
  private extractRowTime(row: Record<string, string>): string | undefined {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().includes('time') || key.toLowerCase().includes('duration')) {
        const value = row[key]?.trim();
        if (value && /^\d+:\d+/.test(value)) return value;
      }
    }
    return undefined;
  }

  /**
   * Extract split time from a table row
   */
  private extractRowSplit(row: Record<string, string>): string | undefined {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().includes('split') || key.toLowerCase().includes('/500')) {
        const value = row[key]?.trim();
        if (value) {
          // Make sure commas are converted to periods
          return value.replace(',', '.');
        }
      }
    }
    return undefined;
  }

  /**
   * Extract stroke rate from a table row
   */
  private extractRowStrokeRate(row: Record<string, string>): number | undefined {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().includes('stroke') || key.toLowerCase().includes('spm') || key.toLowerCase().includes('s/m')) {
        const value = parseInt(row[key]);
        if (!isNaN(value)) return value;
      }
    }
    return undefined;
  }

  /**
   * Extract heart rate from a table row
   */
  private extractRowHeartRate(row: Record<string, string>): number | undefined {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().includes('heart') || key.toLowerCase().includes('hr')) {
        const value = parseInt(row[key]);
        if (!isNaN(value)) return value;
      }
    }
    return undefined;
  }

  /**
   * Determine if a row is likely a rest summary row
   */
  private isRestSummaryRow(row: Record<string, string>): boolean {
    // Check for rest indicators in any value
    const values = Object.values(row);
    return values.some(value => {
      if (typeof value !== 'string') return false;
      const lower = value.toLowerCase();
      return lower.includes('rest total') || lower.includes('rest summary');
    });
  }

  /**
   * Calculates the total distance for an interval workout by adding the work distance 
   * from the summary row with all rest distances
   */
  public calculateTotalIntervalDistance(workoutData: ErgWorkoutData): number | null {
    if (!workoutData?.standardTable || workoutData.standardTable.length < 2) {
      return workoutData.totalDistance || null;
    }
    
    const rows = workoutData.standardTable;
    let totalDistance = 0;
    let workDistance = 0;
    let restDistance = 0;
    
    // Step 1: Get the work distance from the summary row (first row)
    const summaryRow = rows[0];
    if (summaryRow.meter) {
      const cleanWorkDistance = summaryRow.meter.replace(/[^\d]/g, '');
      workDistance = parseInt(cleanWorkDistance, 10);
      if (!isNaN(workDistance)) {
        totalDistance += workDistance;
        console.log('Work distance from summary row:', workDistance);
      }
    }
    
    // Step 2: Process all rest rows to add their distances
    // In variable interval format, rest rows have time value starting with 'r'
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Check if this is a rest row (time starts with 'r')
      if (row.time && typeof row.time === 'string' && row.time.toLowerCase().startsWith('r')) {
        // Extract distance from the meter field
        if (row.meter) {
          const cleanRestDistance = row.meter.replace(/[^\d]/g, '');
          const rowRestDistance = parseInt(cleanRestDistance, 10);
          
          if (!isNaN(rowRestDistance)) {
            restDistance += rowRestDistance;
            totalDistance += rowRestDistance;
            console.log(`Rest distance from row ${i}:`, rowRestDistance);
          }
        }
      }
    }
    
    console.log('Total work distance:', workDistance);
    console.log('Total rest distance:', restDistance);
    console.log('Final calculated total distance:', totalDistance);
    
    return totalDistance > 0 ? totalDistance : null;
  }

  /**
   * Generate a standardized workout name based on workout type and data
   */
  public generateStandardWorkoutName(workoutData: ErgWorkoutData): string {
    if (!workoutData.workoutType) {
      return 'Unknown Workout';
    }
    
    // For single distance workouts (e.g. "Distance Row: 2000m")
    if (workoutData.workoutType === 'single_distance' && workoutData.totalDistance) {
      return `Distance Row: ${workoutData.totalDistance}m`;
    }
    
    // For single time workouts (e.g. "Time Row: 30:00")
    if (workoutData.workoutType === 'single_time' && workoutData.totalTime) {
      return `Time Row: ${workoutData.totalTime}`;
    }
    
    // For interval workouts
    if (workoutData.workoutType === 'interval') {
      // Get interval count from fields if available
      const numIntervals = workoutData.fields?.NumIntervals || 
                           this.detectIntervalCount(workoutData);
      
      // First check if this looks like a variable interval but is actually uniform
      if (workoutData.isVariableInterval && this.hasUniformIntervals(workoutData)) {
        // It's actually a standard interval workout with consistent intervals
        const intervalInfo = this.extractUniformIntervalInfo(workoutData);
        if (intervalInfo.distance && intervalInfo.restTime && numIntervals) {
          return `Interval Workout: ${numIntervals}x${intervalInfo.distance}m/${intervalInfo.restTime}r`;
        }
        
        if (intervalInfo.time && intervalInfo.restTime && numIntervals) {
          return `Interval Workout: ${numIntervals}x${intervalInfo.time}/${intervalInfo.restTime}r`;
        }
      }
      
      // Handle true variable interval format
      if (workoutData.isVariableInterval) {
        // Try to construct a pattern like "2000m/5:00r...4"
        const pattern = this.generateVariableIntervalPattern(workoutData);
        if (pattern) {
          return `Variable Interval Workout: ${pattern}`;
        }
        
        // Fallback to the original title if we have one
        if (workoutData.workoutTitle) {
          return `Variable Interval Workout: ${workoutData.workoutTitle}`;
        }
        
        return 'Variable Interval Workout';
      }
      
      // Handle standard interval format (e.g. "Interval Workout: 4x1000m/5:00r")
      const intervalInfo = this.extractStandardIntervalInfo(workoutData);
      if (intervalInfo.distance && intervalInfo.restTime && numIntervals) {
        return `Interval Workout: ${numIntervals}x${intervalInfo.distance}m/${intervalInfo.restTime}r`;
      }
      
      if (intervalInfo.time && intervalInfo.restTime && numIntervals) {
        return `Interval Workout: ${numIntervals}x${intervalInfo.time}/${intervalInfo.restTime}r`;
      }
      
      // Fallback to the original title if we have one
      if (workoutData.workoutTitle) {
        return `Interval Workout: ${workoutData.workoutTitle}`;
      }
      
      return 'Interval Workout';
    }
    
    // Fallback to original title or a generic name
    return workoutData.workoutTitle || 'Rowing Workout';
  }

  /**
   * Check if a variable interval workout actually has uniform intervals
   * (i.e., all work intervals have same distance/time, all rest intervals have same time)
   */
  private hasUniformIntervals(workoutData: ErgWorkoutData): boolean {
    if (!workoutData.standardTable || workoutData.standardTable.length < 5) {
      return false; // Need at least 2 work/rest pairs plus header
    }
    
    const workRows: Array<Record<string, string>> = [];
    const restRows: Array<Record<string, string>> = [];
    
    // Skip the header row (index 0)
    // Work rows are at indices 1, 3, 5, etc.
    // Rest rows are at indices 2, 4, 6, etc.
    for (let i = 1; i < workoutData.standardTable.length; i++) {
      const row = workoutData.standardTable[i];
      
      if (i % 2 === 1) {
        // Odd indices starting from 1 (1, 3, 5...) are work intervals
        workRows.push(row);
      } else {
        // Even indices (2, 4, 6...) are rest intervals
        restRows.push(row);
      }
    }
    
    // Check if all work rows have the same distance
    const workDistances = workRows
      .map(row => this.extractRowDistance(row))
      .filter(distance => distance !== undefined) as number[];
    
    // Check if all work rows have the same time
    const workTimes = workRows
      .map(row => this.extractRowTime(row))
      .filter(time => time !== undefined) as string[];
    
    // Check if all rest rows have the same time
    const restTimes = restRows
      .map(row => this.extractRowTime(row))
      .filter(time => time !== undefined) as string[];
    
    // Check for uniformity in work distances (if present)
    const uniformWorkDistances = workDistances.length > 1 && 
      workDistances.every(d => Math.abs(d - workDistances[0]) < 1); // Allow small rounding errors
    
    // Check for uniformity in work times (if present)
    const uniformWorkTimes = workTimes.length > 1 && 
      workTimes.every(t => t === workTimes[0]);
    
    // Check for uniformity in rest times
    const uniformRestTimes = restTimes.length > 1 && 
      restTimes.every(t => t === restTimes[0]);
    
    // If either work distances or work times are uniform, and rest times are uniform,
    // then this is a uniform interval workout despite being formatted as variable
    return (uniformWorkDistances || uniformWorkTimes) && uniformRestTimes;
  }

  /**
   * Extract information about a uniform interval workout that was labeled as variable
   */
  private extractUniformIntervalInfo(workoutData: ErgWorkoutData): {
    distance?: string;
    time?: string;
    restTime?: string;
  } {
    const result: { distance?: string; time?: string; restTime?: string; } = {};
    
    if (!workoutData.standardTable || workoutData.standardTable.length < 3) {
      return result;
    }
    
    // Get the first work row (index 1) and first rest row (index 2)
    const workRow = workoutData.standardTable[1];
    const restRow = workoutData.standardTable[2];
    
    // Extract distance from work row
    const distance = this.extractRowDistance(workRow);
    if (distance !== undefined) {
      result.distance = distance.toString();
    }
    
    // Extract time from work row
    const time = this.extractRowTime(workRow);
    if (time) {
      result.time = time;
    }
    
    // Extract rest time from rest row
    if (restRow.time && typeof restRow.time === 'string') {
      // Strip any 'r' prefix from rest time
      result.restTime = restRow.time.replace(/^r/i, '');
    }
    
    return result;
  }

  /**
   * Detect the number of intervals in a workout
   */
  private detectIntervalCount(workoutData: ErgWorkoutData): number | undefined {
    // First check if we have an explicit interval count in fields
    if (workoutData.fields?.NumIntervals) {
      const numIntervals = parseInt(workoutData.fields.NumIntervals);
      if (!isNaN(numIntervals)) {
        return numIntervals;
      }
    }
    
    if (!workoutData.standardTable || workoutData.standardTable.length < 2) {
      return undefined;
    }
    
    // For variable intervals, count work+rest pairs
    if (workoutData.isVariableInterval) {
      // First row is summary, rest are work/rest pairs
      // So count number of work rows (every odd index after 0)
      let workRowCount = 0;
      for (let i = 1; i < workoutData.standardTable.length; i += 2) {
        workRowCount++;
      }
      return workRowCount;
    } else {
      // For standard intervals, count all non-summary rows except rest summary
      // Filter out rest summary rows
      const workRows = workoutData.standardTable.slice(1).filter(row => !this.isRestSummaryRow(row));
      return workRows.length;
    }
  }

  /**
   * Generate a pattern for variable interval workouts
   */
  private generateVariableIntervalPattern(workoutData: ErgWorkoutData): string | undefined {
    if (!workoutData.standardTable || workoutData.standardTable.length < 3) {
      return undefined;
    }
    
    // For variable intervals, extract info from the first work row and first rest row
    const workRow = workoutData.standardTable[1]; // First work interval
    const restRow = workoutData.standardTable[2]; // First rest interval
    
    let workInfo = '';
    let restInfo = '';
    
    // Extract work info - prefer distance, fallback to time
    if (workRow.meter) {
      workInfo = `${workRow.meter.replace(/[^\d]/g, '')}m`;
    } else if (workRow.time) {
      workInfo = workRow.time;
    }
    
    // Extract rest info from rest row time field
    if (restRow.time && typeof restRow.time === 'string') {
      restInfo = restRow.time.replace(/^r/i, '');
    }
    
    // Count total intervals
    const numIntervals = this.detectIntervalCount(workoutData);
    
    if (workInfo && restInfo && numIntervals) {
      return `${workInfo}/${restInfo}r...${numIntervals}`;
    }
    
    return undefined;
  }

  /**
   * Extract information about standard interval format
   */
  private extractStandardIntervalInfo(workoutData: ErgWorkoutData): {
    distance?: string;
    time?: string;
    restTime?: string;
  } {
    const result: { distance?: string; time?: string; restTime?: string; } = {};
    
    // If we have at least 2 rows (summary + work), extract from the first work row (index 1)
    if (workoutData.standardTable && workoutData.standardTable.length >= 2) {
      const workRow = workoutData.standardTable[1]; // First work interval
      
      // Extract distance
      if (workRow.meter) {
        result.distance = workRow.meter.replace(/[^\d]/g, ''); // Clean any non-digits
      }
      
      // Extract time
      if (workRow.time) {
        result.time = workRow.time;
      }
      
      // Extract rest time from last row if it contains rest info
      const lastRowIndex = workoutData.standardTable.length - 1;
      const lastRow = workoutData.standardTable[lastRowIndex];
      
      if (lastRow.time && lastRow.time.toLowerCase().includes('r')) {
        result.restTime = lastRow.time.replace(/^r/i, '');
      }
    }
    
    return result;
  }
}

export default ErgWorkoutParser;
