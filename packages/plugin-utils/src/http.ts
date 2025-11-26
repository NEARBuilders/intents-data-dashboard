import pRetry, { AbortError } from 'p-retry';
import Bottleneck from 'bottleneck';

export interface HttpClientConfig {
  baseUrl?: string;
  rateLimiter: Bottleneck;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export class HttpClient {
  constructor(private config: HttpClientConfig) {}

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>({ method: 'GET', path, ...options });
  }

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>({ method: 'POST', path, body, ...options });
  }

  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>({ method: 'PUT', path, body, ...options });
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>({ method: 'DELETE', path, ...options });
  }

  private async request<T>(params: {
    method: string;
    path: string;
    body?: unknown;
    params?: Record<string, string | number | boolean>;
    headers?: Record<string, string>;
    timeout?: number;
    retries?: number;
  }): Promise<T> {
    const fullUrl = this.buildUrl(params.path, params.params);
    const headers = { ...this.config.headers, ...params.headers };
    const timeout = params.timeout ?? this.config.timeout ?? 30000;
    const retries = params.retries ?? this.config.retries ?? 3;

    return pRetry(
      () => this.config.rateLimiter.schedule(async () => {
        const fetchHeaders: Record<string, string> = { ...headers };
        
        if (params.body !== undefined) {
          fetchHeaders['Content-Type'] = 'application/json';
        }

        const response = await fetch(fullUrl, {
          method: params.method,
          headers: fetchHeaders,
          body: params.body ? JSON.stringify(params.body) : undefined,
          signal: AbortSignal.timeout(timeout)
        });

        // Don't retry 4xx errors (except 429 rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          let errorBody = '';
          try {
            const text = await response.text();
            errorBody = text.slice(0, 500);
          } catch (e) {
            errorBody = response.statusText;
          }
          throw new AbortError(`HTTP ${response.status}: ${errorBody}`);
        }

        if (!response.ok) {
          let errorBody = '';
          try {
            const text = await response.text();
            errorBody = text.slice(0, 500);
          } catch (e) {
            errorBody = response.statusText;
          }
          throw new Error(`HTTP ${response.status}: ${errorBody}`);
        }

        return response.json() as T;
      }),
      {
        retries,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        randomize: true
      }
    );
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean>): string {
    const base = this.config.baseUrl || '';

    // Properly join base URL and path
    let fullUrl: string;
    if (base) {
      // Remove trailing slash from base and leading slash from path to avoid double slashes
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      fullUrl = `${cleanBase}${cleanPath}`;
    } else {
      fullUrl = path;
    }

    // Add query parameters if provided
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.set(key, String(value));
      });
      fullUrl = `${fullUrl}?${searchParams.toString()}`;
    }
    
    return fullUrl;
  }
}

export function createHttpClient(config: HttpClientConfig): HttpClient {
  return new HttpClient(config);
}

export function createRateLimiter(requestsPerSecond: number = 10): Bottleneck {
  return new Bottleneck({
    maxConcurrent: requestsPerSecond,
    minTime: 1000 / requestsPerSecond
  });
}
