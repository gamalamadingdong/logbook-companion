# Azure Services Package

Production-ready Azure integrations for SGE template applications.

## Features

### Image Processing & OCR
- **Azure Functions pipeline** for image processing and OCR
- **Document Intelligence integration** for structured data extraction  
- **Configurable parsing** for different document types
- **Error handling and retry logic** for cloud service reliability

### Service Integration Architecture  
- **Multi-backend compatibility** patterns
- **Environment-driven configuration** for different deployment scenarios
- **Standardized error handling** across cloud services
- **Type-safe service abstractions**

## Packages

### `image-processing/`
Azure Functions (Python) for image processing and OCR operations.

### `ocr-service/` 
TypeScript service layer for interacting with Azure OCR functions.

## Usage

```typescript
import { OcrService } from '@sge/azure/ocr-service';
import { configureAzureServices } from '@sge/azure/lib/serviceConfig';

// Configure services
configureAzureServices({
  azureFunctionUrl: process.env.AZURE_FUNCTION_URL,
  azureFunctionKey: process.env.AZURE_FUNCTION_KEY,
  documentIntelligenceEndpoint: process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT,
  documentIntelligenceKey: process.env.AZURE_DOC_INTELLIGENCE_KEY
});

// Use OCR service
const ocrService = new OcrService();
const result = await ocrService.processImages(base64Images);
```

## Configuration

See individual package README files for specific configuration requirements.

## Source

Extracted from train-better production application with proven reliability in processing thousands of images.