# Azure Functions Deployment Guide

This guide covers deploying the SGE Azure Functions image processing pipeline to Azure.

## Prerequisites

1. **Azure Subscription** with sufficient credits/billing setup
2. **Azure CLI** installed and authenticated (`az login`)
3. **Azure Functions Core Tools** v4+ (`npm install -g azure-functions-core-tools@4`)
4. **Python 3.9+** for local development
5. **Azure Document Intelligence** resource created

## Step 1: Create Azure Resources

### Create Resource Group
```bash
az group create --name sge-image-processing --location eastus
```

### Create Storage Account
```bash
az storage account create \
  --name sgeimageprocessing \
  --resource-group sge-image-processing \
  --location eastus \
  --sku Standard_LRS
```

### Create Function App
```bash
az functionapp create \
  --resource-group sge-image-processing \
  --consumption-plan-location eastus \
  --runtime python \
  --runtime-version 3.9 \
  --functions-version 4 \
  --name sge-image-processor \
  --storage-account sgeimageprocessing \
  --os-type Linux
```

### Create Document Intelligence Resource
```bash
az cognitiveservices account create \
  --name sge-document-intelligence \
  --resource-group sge-image-processing \
  --kind FormRecognizer \
  --sku S0 \
  --location eastus \
  --yes
```

## Step 2: Configure Environment Variables

Get your Document Intelligence credentials:
```bash
# Get endpoint
az cognitiveservices account show \
  --name sge-document-intelligence \
  --resource-group sge-image-processing \
  --query properties.endpoint \
  --output tsv

# Get API key
az cognitiveservices account keys list \
  --name sge-document-intelligence \
  --resource-group sge-image-processing \
  --query key1 \
  --output tsv
```

Set environment variables in your Function App:
```bash
az functionapp config appsettings set \
  --name sge-image-processor \
  --resource-group sge-image-processing \
  --settings \
    "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://sge-document-intelligence.cognitiveservices.azure.com/" \
    "AZURE_DOCUMENT_INTELLIGENCE_KEY=your-api-key-here" \
    "AZURE_DOC_INTELLIGENCE_MODEL_ID=prebuilt-document" \
    "AZURE_DOC_INTELLIGENCE_API_VERSION=2024-11-30"
```

## Step 3: Deploy Function Code

### Prepare Local Development
```bash
# Navigate to the image-processing function directory
cd packages/azure/image-processing

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Create host.json and local.settings.json

Create `host.json`:
```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  },
  "functionTimeout": "00:05:00"
}
```

Create `local.settings.json` (for local testing):
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://your-resource.cognitiveservices.azure.com/",
    "AZURE_DOCUMENT_INTELLIGENCE_KEY": "your-api-key",
    "AZURE_DOC_INTELLIGENCE_MODEL_ID": "prebuilt-document",
    "AZURE_DOC_INTELLIGENCE_API_VERSION": "2024-11-30"
  }
}
```

### Deploy to Azure
```bash
# Deploy the function
func azure functionapp publish sge-image-processor
```

## Step 4: Configure Authentication

### Get Function Key
```bash
az functionapp function keys list \
  --function-name image-processing \
  --name sge-image-processor \
  --resource-group sge-image-processing
```

### Test Deployment
```bash
# Test with curl (replace with your function URL and key)
curl -X POST "https://sge-image-processor.azurewebsites.net/api/image-processing" \
  -H "Content-Type: application/json" \
  -H "x-functions-key: your-function-key" \
  -d '{
    "images": ["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="],
    "options": {
      "enhanceReadability": true
    }
  }'
```

## Step 5: Configure Your Application

Update your application's environment variables:

### For Web Applications
```bash
AZURE_FUNCTION_URL=https://sge-image-processor.azurewebsites.net/api/image-processing
AZURE_FUNCTION_KEY=your-function-key
```

### For React Native/Expo
```bash
EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_URL=https://sge-image-processor.azurewebsites.net/api/image-processing
EXPO_PUBLIC_AZURE_IMAGE_FUNCTION_KEY=your-function-key
```

### Usage in Code
```typescript
import { createOcrServiceFromEnv } from '@sge/azure/ocr-service';

const ocrService = createOcrServiceFromEnv();
const result = await ocrService.processSingleImage(base64Image);
```

## Step 6: Monitor and Scale

### Enable Application Insights
```bash
az functionapp config appsettings set \
  --name sge-image-processor \
  --resource-group sge-image-processing \
  --settings "APPINSIGHTS_INSTRUMENTATIONKEY=$(az monitor app-insights component show --app sge-image-processor --resource-group sge-image-processing --query instrumentationKey -o tsv)"
```

### Configure Scaling (Optional)
```bash
# Set maximum instance count for cost control
az functionapp plan update \
  --name ASP-sgeimageprocessing \
  --resource-group sge-image-processing \
  --max-burst 10
```

## Troubleshooting

### Common Issues

1. **Function timeout**: Increase timeout in `host.json` if processing large images
2. **Memory issues**: Consider upgrading to Premium plan for memory-intensive operations
3. **Authentication errors**: Verify function key is correctly configured
4. **Document Intelligence quota**: Check your cognitive services quota and usage

### Debugging

View function logs:
```bash
az functionapp log tail --name sge-image-processor --resource-group sge-image-processing
```

## Cost Management

- **Consumption Plan**: Pay per execution (recommended for low-medium usage)
- **Premium Plan**: Better performance but higher base cost
- **Document Intelligence**: Pay per document analyzed

Monitor costs in Azure Portal under Cost Management.

## Security Best Practices

1. **Rotate function keys** regularly
2. **Use managed identity** where possible instead of API keys
3. **Restrict function app access** using Azure AD authentication
4. **Monitor usage** for unusual patterns
5. **Keep dependencies updated** for security patches

## Next Steps

- **Custom Models**: Train custom Document Intelligence models for your specific document types
- **Batch Processing**: Implement batch processing for multiple documents
- **Caching**: Add caching layer for frequently processed images
- **Monitoring**: Set up alerts for failures or high usage