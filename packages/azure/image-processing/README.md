# Azure Image Processing Function

Python Azure Function for image processing and OCR using Azure Document Intelligence.

## Features

- **Multi-image processing** with base64 input/output
- **Image enhancement** for improved OCR accuracy  
- **Table detection optimization** for structured data extraction
- **Azure Document Intelligence** integration with custom models
- **Comprehensive error handling** and logging
- **Configurable processing options** via request parameters

## Deployment

### Prerequisites

1. **Azure Function App** with Python 3.9+ runtime
2. **Azure Document Intelligence** resource
3. **Required environment variables** (see Configuration section)

### Deploy to Azure

```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# Deploy function
func azure functionapp publish <your-function-app-name>
```

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Start local function
func start
```

## Configuration

Set these environment variables in your Function App:

```bash
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your-api-key
AZURE_DOC_INTELLIGENCE_MODEL_ID=prebuilt-document  # or your custom model
AZURE_DOC_INTELLIGENCE_API_VERSION=2024-11-30
```

## Usage

### Request Format

```http
POST /api/image-processing
Content-Type: application/json
x-functions-key: your-function-key

{
  "images": [
    "base64-encoded-image-1",
    "base64-encoded-image-2"
  ],
  "options": {
    "enhanceReadability": true,
    "enhanceTableDetection": false,
    "modelId": "your-custom-model",
    "features": ["queryFields"],
    "queryFields": ["CustomTable1", "CustomTable2"]
  }
}
```

### Response Format

```json
{
  "success": true,
  "processedImages": ["processed-base64-1", "processed-base64-2"],
  "primaryImage": "primary-processed-base64",
  "ocrResults": {
    "success": true,
    "results": {
      "analyzeResult": {
        "documents": [...],
        "tables": [...],
        "pages": [...]
      }
    }
  },
  "requestId": "uuid"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error description",
  "requestId": "uuid"
}
```

## Processing Options

- **`enhanceReadability`** (boolean): Apply contrast and sharpness enhancement
- **`enhanceTableDetection`** (boolean): Apply preprocessing for better table recognition
- **`modelId`** (string): Azure Document Intelligence model ID to use
- **`endpoint`** (string): Override default Azure endpoint
- **`key`** (string): Override default Azure API key
- **`features`** (array): Azure analysis features to enable
- **`queryFields`** (array): Custom field names for model analysis

## Source

Extracted from train-better production application with proven reliability processing thousands of images.