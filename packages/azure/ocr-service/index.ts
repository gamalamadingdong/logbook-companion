/**
 * OCR Service for Azure Functions Integration
 * 
 * Generalized service for processing images through Azure Functions with OCR capabilities.
 * Extracted from train-better application and adapted for SGE template use.
 * 
 * @source Extracted from train-better production application
 * @license MIT
 */

export interface OcrServiceConfig {
  azureFunctionUrl: string;
  azureFunctionKey?: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface OcrProcessingOptions {
  enhanceReadability?: boolean;
  enhanceTableDetection?: boolean;
  modelId?: string;
  features?: string[];
  queryFields?: string[];
}

export interface OcrResult {
  success: boolean;
  processedImages?: string[];
  primaryImage?: string;
  ocrResults?: any;
  parsedData?: any;
  error?: string;
  requestId?: string;
}

export interface ProcessImagesResult {
  success: boolean;
  processedImage: string | null;
  rawOcrResults: any;
  parsedData?: any;
  errorMessage?: string;
  requestId?: string;
}

/**
 * Service class for interacting with Azure Functions OCR pipeline
 */
export class OcrService {
  private config: OcrServiceConfig;
  
  constructor(config: OcrServiceConfig) {
    this.config = {
      timeout: 30000, // 30 seconds default
      retryAttempts: 2,
      ...config
    };
    
    // Validate required configuration
    if (!this.config.azureFunctionUrl) {
      console.warn('⚠️ Azure Function URL not provided to OcrService');
    }
  }
  
  /**
   * Process images through Azure Function OCR pipeline
   * 
   * @param base64Images Array of base64-encoded images
   * @param options Processing options for the Azure Function
   * @returns Promise resolving to OCR results
   */
  async processImages(
    base64Images: string[], 
    options: OcrProcessingOptions = {}
  ): Promise<ProcessImagesResult> {
    try {
      if (!this.config.azureFunctionUrl) {
        throw new Error('Azure Function URL not configured');
      }
      
      if (!base64Images || base64Images.length === 0) {
        throw new Error('At least one image is required');
      }
      
      console.log(`Processing ${base64Images.length} images with Azure Function...`);
      
      // Prepare request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (this.config.azureFunctionKey) {
        headers['x-functions-key'] = this.config.azureFunctionKey;
      }
      
      // Prepare request body
      const requestBody = {
        images: base64Images,
        options: {
          enhanceReadability: true,
          enhanceTableDetection: false,
          ...options
        }
      };
      
      // Make request with retry logic
      const result = await this._makeRequestWithRetry(headers, requestBody);
      
      return {
        success: result.success,
        processedImage: result.primaryImage || result.processedImages?.[0] || null,
        rawOcrResults: result.ocrResults,
        parsedData: result.parsedData,
        errorMessage: result.error,
        requestId: result.requestId
      };
      
    } catch (error) {
      console.error('Error processing images:', error);
      
      return {
        success: false,
        processedImage: null,
        rawOcrResults: null,
        errorMessage: error instanceof Error ? error.message : 'Unknown error processing images'
      };
    }
  }
  
  /**
   * Process a single image
   * 
   * @param base64Image Single base64-encoded image
   * @param options Processing options
   * @returns Promise resolving to OCR results
   */
  async processSingleImage(
    base64Image: string,
    options: OcrProcessingOptions = {}
  ): Promise<ProcessImagesResult> {
    return this.processImages([base64Image], options);
  }
  
  /**
   * Test connectivity to Azure Function
   * 
   * @returns Promise resolving to connection test result
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.config.azureFunctionUrl) {
        return { success: false, error: 'Azure Function URL not configured' };
      }
      
      // Create a minimal test image (1x1 pixel PNG in base64)
      const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      
      const result = await this.processSingleImage(testImage, {
        enhanceReadability: false,
        enhanceTableDetection: false
      });
      
      return {
        success: result.success,
        error: result.errorMessage
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
  
  /**
   * Update service configuration
   * 
   * @param newConfig Partial configuration to merge
   */
  updateConfig(newConfig: Partial<OcrServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get current configuration (excluding sensitive keys)
   */
  getConfig(): Omit<OcrServiceConfig, 'azureFunctionKey'> {
    const { azureFunctionKey, ...safeConfig } = this.config;
    return safeConfig;
  }
  
  /**
   * Make HTTP request with retry logic
   * 
   * @private
   */
  private async _makeRequestWithRetry(
    headers: Record<string, string>,
    body: any
  ): Promise<OcrResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= (this.config.retryAttempts || 2); attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retrying request (attempt ${attempt + 1})...`);
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        const response = await fetch(this.config.azureFunctionUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Azure Function returned status ${response.status}: ${errorText}`);
        }
        
        const result = await response.json() as OcrResult;
        
        // Check for explicit failure in function response
        if (result.success === false) {
          throw new Error(result.error || 'Unknown error from Azure Function');
        }
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain types of errors
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${this.config.timeout}ms`);
          }
          
          if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403')) {
            throw error; // Don't retry client errors
          }
        }
        
        console.warn(`Request attempt ${attempt + 1} failed:`, error);
      }
    }
    
    throw lastError || new Error('All retry attempts failed');
  }
}

/**
 * Create a configured OCR service instance
 * 
 * @param config Service configuration
 * @returns Configured OcrService instance
 */
export function createOcrService(config: OcrServiceConfig): OcrService {
  return new OcrService(config);
}

/**
 * Create OCR service from environment variables
 * 
 * @param envPrefix Optional prefix for environment variables (default: 'AZURE_')
 * @returns Configured OcrService instance or null if required config missing
 */
export function createOcrServiceFromEnv(envPrefix: string = 'AZURE_'): OcrService | null {
  const functionUrl = process.env[`${envPrefix}FUNCTION_URL`] || 
                     process.env['EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_URL'];
  
  if (!functionUrl) {
    console.warn(`OCR Service: No function URL found in environment (${envPrefix}FUNCTION_URL)`);
    return null;
  }
  
  const config: OcrServiceConfig = {
    azureFunctionUrl: functionUrl,
    azureFunctionKey: process.env[`${envPrefix}FUNCTION_KEY`] || 
                     process.env['EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_KEY'],
    timeout: parseInt(process.env[`${envPrefix}FUNCTION_TIMEOUT`] || '30000'),
    retryAttempts: parseInt(process.env[`${envPrefix}FUNCTION_RETRIES`] || '2')
  };
  
  return new OcrService(config);
}

export default OcrService;