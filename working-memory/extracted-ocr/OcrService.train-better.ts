import ErgWorkoutParser, { ErgWorkoutData } from '../utils/ErgWorkoutParser';
import { OcrMetrics } from '../utils/types';
import Constants from 'expo-constants';

const ergWorkoutParser = new ErgWorkoutParser();

/**
 * Service for processing erg monitor images using Azure Functions
 */
class OcrService {
  private azureFunctionUrl: string;
  private azureFunctionKey: string;
  
  constructor() {
    // Get Azure Function configuration from environment variables
    this.azureFunctionUrl = 
      (Constants.expoConfig?.extra?.azureImageFunctionUrl as string) || 
      process.env.EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_URL || 
      '';
      
    this.azureFunctionKey = 
      (Constants.expoConfig?.extra?.azureImageFunctionKey as string) || 
      process.env.EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_KEY || 
      '';
    
    // Log configuration status
    if (!this.azureFunctionUrl) {
      console.warn('⚠️ No Azure Function URL configured. Check EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_URL in .env.development');
    }
    
    if (!this.azureFunctionKey) {
      console.warn('⚠️ No Azure Function key configured. Check EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_KEY in .env.development');
    }
  }
  
  /**
   * Process erg monitor images through Azure Function
   * @param base64Images Array of base64-encoded images to process
   */
  async processErgImages(base64Images: string[]): Promise<{
    processedImage: string | null;
    metrics: OcrMetrics;
    monitorDetected: boolean;
    errorMessage?: string;
  }> {
    try {
      if (!this.azureFunctionUrl) {
        throw new Error('Azure Function URL not configured. Please set EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_URL in your environment.');
      }
      
      console.log(`Processing ${base64Images.length} images with Azure Function...`);
      console.log(`Using Azure Function URL: ${this.azureFunctionUrl}`);
      
      // Prepare headers with function key if available
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add function key to headers if available
      if (this.azureFunctionKey) {
        headers['x-functions-key'] = this.azureFunctionKey;
      }
      
      // Call the Azure Function with images
      const response = await fetch(this.azureFunctionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          images: base64Images
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure Function returned status ${response.status}: ${errorText}`);
      }
      
      // Parse the response JSON
      const result = await response.json();
      
      // Check for explicit failure in the function response
      if (result.success === false) {
        throw new Error(result.error || 'Unknown error from Azure Function');
      }
      
      // Extract the processed image if available
      const processedImage = result.processedImage || 
                            (result.stitchedImage ? result.stitchedImage : null);
      
      // Extract OCR results - these may be in result.ocrResults, result.parsedData or directly in result
      const parsedData = result.parsedData || 
                         (result.data ? result.data : null);
      
      // Use our parser to extract workout data
      const workoutData = ergWorkoutParser.parseWorkoutFromOcrJson(result);
      
      // Convert the workout data to standard metrics format
      const metrics: OcrMetrics = {
        duration: workoutData.totalTime || null,
        distance: workoutData.totalDistance || null,
        avgSplit: workoutData.averageSplit ? workoutData.averageSplit.replace(',', '.') : null,
        avgHeartRate: workoutData.averageHeartRate || null,
        strokeRate: workoutData.averageStrokeRate || null,
        workoutData: workoutData // Use workoutData instead of parsedData
      };
      
      return {
        processedImage,
        metrics,
        monitorDetected: result.monitorDetected || false,
        errorMessage: result.errorMessage
      };
      
    } catch (error) {
      console.error('Error processing erg images:', error);
      return {
        processedImage: null,
        metrics: {
          ocrFailure: true,
          errorMessage: error instanceof Error ? error.message : 'Unknown error processing images'
        },
        monitorDetected: false,
        errorMessage: error instanceof Error ? error.message : 'Error processing images'
      };
    }
  }
  
  /**
   * Analyze raw OCR output to extract additional workout data
   * @param rawOutput Raw OCR JSON output to analyze
   */
  async analyzeRawOcrOutput(rawOutput: any): Promise<{
    workoutData: ErgWorkoutData | null;
  }> {
    try {
      // Use the parser to extract workout data
      const workoutData = ergWorkoutParser.parseWorkoutFromOcrJson(rawOutput);
      return { workoutData };
    } catch (error) {
      console.error('Error analyzing raw OCR output:', error);
      return { workoutData: null };
    }
  }
}

export default new OcrService();