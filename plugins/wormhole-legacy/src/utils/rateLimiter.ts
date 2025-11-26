/**
 * Token Bucket Rate Limiter
 *
 * Implements a token bucket algorithm for rate limiting API requests.
 * Prevents exceeding API rate limits by controlling request throughput.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private readonly refillInterval: number; // milliseconds

  constructor(requestsPerSecond: number) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRate = requestsPerSecond;
    this.refillInterval = 1000; // 1 second
    this.lastRefill = Date.now();
  }

  /**
   * Wait for a token to become available before making a request.
   * This method will block (async) until a token is available.
   */
  async waitForToken(): Promise<void> {
    while (true) {
      this.refill();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      // Calculate how long to wait for next token
      const now = Date.now();
      const timeSinceRefill = now - this.lastRefill;
      const timeUntilNextToken = this.refillInterval - timeSinceRefill;

      if (timeUntilNextToken > 0) {
        await this.sleep(Math.min(timeUntilNextToken, 100)); // Check every 100ms
      }
    }
  }

  /**
   * Refill tokens based on time elapsed since last refill.
   */
  private refill(): void {
    const now = Date.now();
    const timeSinceRefill = now - this.lastRefill;

    if (timeSinceRefill >= this.refillInterval) {
      const intervalsElapsed = Math.floor(timeSinceRefill / this.refillInterval);
      const tokensToAdd = intervalsElapsed * this.refillRate;

      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current token count (for testing/debugging).
   */
  getTokenCount(): number {
    this.refill();
    return this.tokens;
  }
}
