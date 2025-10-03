# OCR Service

TypeScript service for integrating with Azure Functions OCR pipeline.

## Features

- **Azure Function integration** with automatic retry logic
- **Configurable timeout and retry** settings
- **Connection testing** utilities
- **Error handling** with detailed error messages
- **Environment variable** configuration support
- **TypeScript interfaces** for all data structures

## Installation

```bash
npm install @sge/azure
```

## Usage

### Basic Usage

```typescript
import { OcrService, createOcrService } from '@sge/azure/ocr-service';

// Create service with explicit configuration
const ocrService = createOcrService({
  azureFunctionUrl: 'https://your-function-app.azurewebsites.net/api/image-processing',
  azureFunctionKey: 'your-function-key',
  timeout: 30000,
  retryAttempts: 2
});

// Process images
const result = await ocrService.processImages([base64Image], {
  enhanceReadability: true,
  modelId: 'prebuilt-document'
});

if (result.success) {
  console.log('OCR Results:', result.rawOcrResults);
  console.log('Processed Image:', result.processedImage);
}
```

### Environment Variable Configuration

```typescript
import { createOcrServiceFromEnv } from '@sge/azure/ocr-service';

// Create service from environment variables
const ocrService = createOcrServiceFromEnv();

if (ocrService) {
  const result = await ocrService.processSingleImage(base64Image);
}
```

Required environment variables:
```bash
AZURE_FUNCTION_URL=https://your-function-app.azurewebsites.net/api/image-processing
AZURE_FUNCTION_KEY=your-function-key
AZURE_FUNCTION_TIMEOUT=30000  # Optional, defaults to 30000ms
AZURE_FUNCTION_RETRIES=2      # Optional, defaults to 2
```

### React Native / Expo Usage

For React Native/Expo apps, use the `EXPO_PUBLIC_` prefix:

```bash
EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_URL=https://your-function-app.azurewebsites.net/api/image-processing
EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_KEY=your-function-key
```

### Testing Connection

```typescript
const connectionTest = await ocrService.testConnection();

if (connectionTest.success) {
  console.log('✅ Azure Function is accessible');
} else {
  console.error('❌ Connection failed:', connectionTest.error);
}
```

## Processing Options

The service supports various processing options:

```typescript
const options = {
  enhanceReadability: true,        // Apply image enhancement
  enhanceTableDetection: false,    // Optimize for table detection
  modelId: 'custom-model-id',      // Azure Document Intelligence model
  features: ['queryFields'],       // Azure analysis features
  queryFields: ['Table1', 'Table2'] // Custom field queries
};

const result = await ocrService.processImages(images, options);
```

## Response Format

```typescript
interface ProcessImagesResult {
  success: boolean;
  processedImage: string | null;      // Primary processed image (base64)
  rawOcrResults: any;                 // Raw Azure OCR response
  parsedData?: any;                   // Structured parsed data
  errorMessage?: string;              // Error message if failed
  requestId?: string;                 // Unique request identifier
}
```

## Error Handling

The service includes comprehensive error handling:

- **Automatic retries** with exponential backoff
- **Timeout protection** for long-running requests
- **Detailed error messages** for debugging
- **Graceful fallbacks** for service unavailability

## Configuration

```typescript
interface OcrServiceConfig {
  azureFunctionUrl: string;    // Required: Azure Function endpoint
  azureFunctionKey?: string;   // Optional: Function access key
  timeout?: number;            // Optional: Request timeout (default: 30000ms)
  retryAttempts?: number;      // Optional: Retry attempts (default: 2)
}
```

## Source

Extracted from train-better production application with proven reliability processing thousands of images.