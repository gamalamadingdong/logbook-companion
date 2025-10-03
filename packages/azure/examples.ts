/**
 * Azure Services Usage Examples
 * 
 * This file demonstrates how to use the extracted Azure Functions and OCR capabilities
 * in SGE template applications.
 */

import { createOcrService, createOcrServiceFromEnv } from '@sge/azure/ocr-service';
import { HttpServiceClient, createServiceFromEnv } from '@sge/shared/lib/serviceIntegration';

// Example 1: OCR Service with explicit configuration
export async function example1_ExplicitOcrConfig() {
  const ocrService = createOcrService({
    azureFunctionUrl: 'https://your-app.azurewebsites.net/api/image-processing',
    azureFunctionKey: 'your-function-key',
    timeout: 30000,
    retryAttempts: 2
  });

  // Test connection first
  const connectionTest = await ocrService.testConnection();
  if (!connectionTest.success) {
    throw new Error(`OCR service unavailable: ${connectionTest.error}`);
  }

  // Process image with custom options
  const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABA...'; // Your base64 image
  
  const result = await ocrService.processSingleImage(base64Image, {
    enhanceReadability: true,
    enhanceTableDetection: true,
    modelId: 'prebuilt-document',
    features: ['queryFields'],
    queryFields: ['StandardTable', 'CustomTable']
  });

  if (result.success) {
    console.log('✅ OCR completed successfully');
    console.log('📄 Raw OCR results:', result.rawOcrResults);
    console.log('🖼️ Processed image available:', !!result.processedImage);
    
    // Extract structured data if available
    if (result.parsedData) {
      console.log('📊 Parsed data:', result.parsedData);
    }
  } else {
    console.error('❌ OCR failed:', result.errorMessage);
  }
}

// Example 2: Environment-based OCR configuration
export async function example2_EnvironmentOcrConfig() {
  // Requires these environment variables:
  // AZURE_FUNCTION_URL=https://your-app.azurewebsites.net/api/image-processing
  // AZURE_FUNCTION_KEY=your-function-key
  // AZURE_FUNCTION_TIMEOUT=30000
  // AZURE_FUNCTION_RETRIES=2
  
  const ocrService = createOcrServiceFromEnv();
  
  if (!ocrService) {
    throw new Error('OCR service configuration not found in environment');
  }

  // Process multiple images
  const images = [
    'base64-image-1',
    'base64-image-2',
    'base64-image-3'
  ];

  const result = await ocrService.processImages(images, {
    enhanceReadability: true,
    modelId: 'custom-model-v2'
  });

  return result;
}

// Example 3: React Native/Expo usage
export async function example3_ReactNativeUsage() {
  // For React Native/Expo, use EXPO_PUBLIC_ prefix:
  // EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_URL=https://your-app.azurewebsites.net/api/image-processing
  // EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_KEY=your-function-key

  const ocrService = createOcrServiceFromEnv('EXPO_PUBLIC_AZURE_');
  
  if (!ocrService) {
    console.warn('OCR service not configured for mobile app');
    return null;
  }

  // In a React Native component, you might get images from camera
  const processImageFromCamera = async (imageUri: string) => {
    // Convert image URI to base64 (implementation depends on your setup)
    const base64Image = await convertImageUriToBase64(imageUri);
    
    const result = await ocrService.processSingleImage(base64Image, {
      enhanceReadability: true,
      enhanceTableDetection: false // Faster processing for mobile
    });

    return result;
  };

  return { processImageFromCamera };
}

// Example 4: Generic service integration pattern
export async function example4_GenericServiceIntegration() {
  // Create a service config from environment
  const config = createServiceFromEnv('EXTERNAL_API');
  
  if (!config) {
    throw new Error('External API configuration not found');
  }

  const client = new HttpServiceClient(config);

  // Make authenticated requests with automatic retry
  const userResponse = await client.get('/users/profile');
  const createResponse = await client.post('/documents', {
    title: 'My Document',
    content: 'Document content here'
  });

  return {
    user: userResponse.success ? userResponse.data : null,
    document: createResponse.success ? createResponse.data : null,
    errors: [
      !userResponse.success ? userResponse.error : null,
      !createResponse.success ? createResponse.error : null
    ].filter(Boolean)
  };
}

// Example 5: Multi-backend service with failover
export async function example5_MultiBackendFailover() {
  const { MultiBackendService, HealthCheckPatterns } = await import('@sge/shared/lib/serviceIntegration');
  
  const multiService = new MultiBackendService();

  // Register primary Azure backend
  multiService.registerBackend({
    type: 'azure',
    priority: 1,
    config: {
      baseUrl: 'https://primary-azure-service.azurewebsites.net/api',
      apiKey: process.env.AZURE_PRIMARY_KEY,
      timeout: 15000
    },
    healthCheck: HealthCheckPatterns.azureFunction(
      'https://primary-azure-service.azurewebsites.net/api/health',
      process.env.AZURE_PRIMARY_KEY
    )
  });

  // Register backup service
  multiService.registerBackend({
    type: 'aws',
    priority: 2,
    config: {
      baseUrl: 'https://backup-service.amazonaws.com',
      apiKey: process.env.AWS_BACKUP_KEY,
      timeout: 20000
    },
    healthCheck: HealthCheckPatterns.httpPing('https://backup-service.amazonaws.com/health')
  });

  // Execute request with automatic failover
  const result = await multiService.executeWithFailover(async (client) => {
    return client.post('/process-data', {
      input: 'some data to process'
    });
  });

  if (result.success) {
    console.log('✅ Request succeeded with failover support');
    console.log('📊 Result:', result.data);
  } else {
    console.error('❌ All backends failed:', result.error);
  }

  return result;
}

// Helper function for React Native image conversion
async function convertImageUriToBase64(imageUri: string): Promise<string> {
  // This is a placeholder - implementation depends on your React Native setup
  // You might use expo-file-system, react-native-fs, or similar
  throw new Error('Implement image URI to base64 conversion for your platform');
}

// Export all examples
export const AzureExamples = {
  explicitOcrConfig: example1_ExplicitOcrConfig,
  environmentOcrConfig: example2_EnvironmentOcrConfig,
  reactNativeUsage: example3_ReactNativeUsage,
  genericServiceIntegration: example4_GenericServiceIntegration,
  multiBackendFailover: example5_MultiBackendFailover
};