import Bottleneck from 'bottleneck';

/**
 * HTTP utilities with rate limiting and retry logic
 * Production-grade patterns for API resilience
 */
export class HttpUtils {
  private static limiter = new Bottleneck({
    maxConcurrent: 5,
    minTime: 200, // 200ms between requests (5 req/sec)
  });

  // Store the last applied limiter configuration for diagnostics/tests
  private static lastConfig: { maxConcurrent: number; minTime: number } | null = {
    maxConcurrent: 5,
    minTime: 200,
  };

  /**
   * Configure the internal rate limiter. Call this early during plugin initialization
   * to apply env-driven rate limits.
   */
  static configure(options: { maxConcurrent?: number; minTime?: number }) {
    const cfg = {
      maxConcurrent: options.maxConcurrent ?? 5,
      minTime: options.minTime ?? 200,
    };
    this.limiter = new Bottleneck(cfg);
    this.lastConfig = cfg;
  }

  /**
   * Return the last applied limiter settings (useful for tests and diagnostics).
   */
  static getLimiterConfig() {
    return this.lastConfig;
  }

  /**
   * Fetch with exponential backoff, jitter, and rate limiting
   */
  static async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL is required');
    }

    if (maxRetries < 0 || baseDelay < 0) {
      throw new Error('maxRetries and baseDelay must be non-negative');
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL format: ${url}`);
    }

    return this.limiter.schedule(async () => {
      let lastError: Error;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...options.headers,
            },
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            // Handle rate limiting specially
            if (response.status === 429) {
              const retryAfter = response.headers.get('retry-after');
              const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.calculateBackoffDelay(attempt, baseDelay);
              
              if (attempt < maxRetries) {
                await this.sleep(delay);
                continue;
              }
            }
            
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          try {
            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
              throw new Error('Response is not JSON');
            }
          } catch {
            throw new Error('Invalid response headers');
          }

          return await response.json() as T;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (attempt < maxRetries) {
            const delay = this.calculateBackoffDelay(attempt, baseDelay);
            await this.sleep(delay);
          }
        }
      }

      throw new Error(`Request failed after ${maxRetries + 1} attempts: ${lastError!.message}`);
    });
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private static calculateBackoffDelay(attempt: number, baseDelay: number): number {
    if (typeof attempt !== 'number' || typeof baseDelay !== 'number' || attempt < 0 || baseDelay < 0) {
      return 1000; // Safe fallback
    }
    
    const exponentialDelay = baseDelay * Math.pow(2, Math.min(attempt, 10)); // Cap attempt
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

