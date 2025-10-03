/**
 * Service Integration Utilities
 * 
 * Generalized patterns for integrating with external cloud services.
 * Extracted from train-better application and adapted for SGE template use.
 * 
 * @source Extracted from train-better production application
 * @license MIT
 */

export interface ServiceConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  requestId?: string;
}

export interface RetryOptions {
  attempts: number;
  delay: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
}

/**
 * Base class for external service integrations
 */
export abstract class BaseService {
  protected config: ServiceConfig;
  
  constructor(config: ServiceConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 2,
      retryDelay: 1000,
      headers: {},
      ...config
    };
  }
  
  /**
   * Make HTTP request with retry logic and error handling
   */
  protected async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOptions?: Partial<RetryOptions>
  ): Promise<ServiceResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const finalRetryOptions: RetryOptions = {
      attempts: this.config.retryAttempts || 2,
      delay: this.config.retryDelay || 1000,
      backoffMultiplier: 2,
      retryCondition: (error) => !this.isClientError(error),
      ...retryOptions
    };
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= finalRetryOptions.attempts; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retrying request to ${endpoint} (attempt ${attempt + 1})...`);
          await this.delay(finalRetryOptions.delay * Math.pow(finalRetryOptions.backoffMultiplier || 2, attempt - 1));
        }
        
        const response = await this.executeRequest(url, options);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        return {
          success: true,
          data,
          statusCode: response.status,
          requestId: this.generateRequestId()
        };
        
      } catch (error) {
        lastError = error as Error;
        
        // Check if we should retry
        if (!finalRetryOptions.retryCondition!(lastError) || attempt === finalRetryOptions.attempts) {
          break;
        }
        
        console.warn(`Request attempt ${attempt + 1} failed:`, error);
      }
    }
    
    return {
      success: false,
      error: lastError?.message || 'Request failed',
      statusCode: this.extractStatusCode(lastError),
      requestId: this.generateRequestId()
    };
  }
  
  /**
   * Execute HTTP request with timeout
   */
  private async executeRequest(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
          ...options.headers
        },
        signal: controller.signal
      });
      
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * Check if error is a client error (4xx) that shouldn't be retried
   */
  private isClientError(error: Error): boolean {
    const statusCode = this.extractStatusCode(error);
    return statusCode >= 400 && statusCode < 500;
  }
  
  /**
   * Extract HTTP status code from error message
   */
  private extractStatusCode(error: Error | null): number | undefined {
    if (!error) return undefined;
    
    const match = error.message.match(/HTTP (\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }
  
  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<ServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get sanitized configuration (excludes sensitive data)
   */
  getConfig(): Omit<ServiceConfig, 'apiKey'> {
    const { apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }
}

/**
 * Configuration-driven HTTP client for external services
 */
export class HttpServiceClient extends BaseService {
  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ServiceResponse<T>> {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
    return this.makeRequest<T>(url, { method: 'GET' });
  }
  
  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: any): Promise<ServiceResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  }
  
  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: any): Promise<ServiceResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
  }
  
  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<ServiceResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }
}

/**
 * Multi-backend service abstraction
 */
export interface BackendConfig {
  type: 'azure' | 'aws' | 'gcp' | 'supabase' | 'firebase' | 'custom';
  config: ServiceConfig;
  priority?: number;
  healthCheck?: () => Promise<boolean>;
}

export class MultiBackendService {
  private backends: BackendConfig[] = [];
  private activeBackend: BackendConfig | null = null;
  
  /**
   * Register a backend service
   */
  registerBackend(backend: BackendConfig): void {
    this.backends.push(backend);
    this.backends.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
  
  /**
   * Get active backend or determine best available
   */
  async getActiveBackend(): Promise<BackendConfig | null> {
    if (this.activeBackend && await this.isBackendHealthy(this.activeBackend)) {
      return this.activeBackend;
    }
    
    // Find the first healthy backend
    for (const backend of this.backends) {
      if (await this.isBackendHealthy(backend)) {
        this.activeBackend = backend;
        return backend;
      }
    }
    
    return null;
  }
  
  /**
   * Check if backend is healthy
   */
  private async isBackendHealthy(backend: BackendConfig): Promise<boolean> {
    if (!backend.healthCheck) return true;
    
    try {
      return await backend.healthCheck();
    } catch (error) {
      console.warn(`Backend ${backend.type} health check failed:`, error);
      return false;
    }
  }
  
  /**
   * Execute request with failover support
   */
  async executeWithFailover<T>(
    operation: (client: HttpServiceClient) => Promise<ServiceResponse<T>>
  ): Promise<ServiceResponse<T>> {
    const backend = await this.getActiveBackend();
    
    if (!backend) {
      return {
        success: false,
        error: 'No healthy backends available'
      };
    }
    
    const client = new HttpServiceClient(backend.config);
    return operation(client);
  }
}

/**
 * Environment-based service configuration
 */
export function createServiceFromEnv(
  serviceName: string,
  envPrefix?: string
): ServiceConfig | null {
  const prefix = envPrefix || serviceName.toUpperCase();
  
  const baseUrl = process.env[`${prefix}_URL`] || process.env[`${prefix}_ENDPOINT`];
  
  if (!baseUrl) {
    console.warn(`Service ${serviceName}: No base URL found in environment (${prefix}_URL)`);
    return null;
  }
  
  return {
    baseUrl,
    apiKey: process.env[`${prefix}_API_KEY`] || process.env[`${prefix}_KEY`],
    timeout: parseInt(process.env[`${prefix}_TIMEOUT`] || '30000'),
    retryAttempts: parseInt(process.env[`${prefix}_RETRIES`] || '2'),
    retryDelay: parseInt(process.env[`${prefix}_RETRY_DELAY`] || '1000'),
    headers: process.env[`${prefix}_HEADERS`] ? JSON.parse(process.env[`${prefix}_HEADERS`]) : {}
  };
}

/**
 * Common patterns for service health checks
 */
export const HealthCheckPatterns = {
  /**
   * Simple HTTP ping
   */
  httpPing: (url: string) => async (): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  },
  
  /**
   * Azure Function health check
   */
  azureFunction: (functionUrl: string, functionKey?: string) => async (): Promise<boolean> => {
    try {
      const headers: Record<string, string> = {};
      if (functionKey) {
        headers['x-functions-key'] = functionKey;
      }
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ healthCheck: true })
      });
      
      return response.ok;
    } catch {
      return false;
    }
  },
  
  /**
   * Supabase health check
   */
  supabase: (supabaseUrl: string, supabaseKey: string) => async (): Promise<boolean> => {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
};

export { BaseService as ServiceBase };