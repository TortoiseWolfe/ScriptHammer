/**
 * Rate Limiter
 * Prevents brute force attacks using localStorage
 */

interface RateLimitData {
  attempts: number[];
  windowStart: number;
}

export class RateLimiter {
  private key: string;
  private maxAttempts: number;
  private windowMs: number;

  /**
   * @param identifier - Unique identifier (e.g., email)
   * @param maxAttempts - Maximum attempts allowed
   * @param windowMinutes - Time window in minutes
   */
  constructor(identifier: string, maxAttempts: number, windowMinutes: number) {
    this.key = `rate_limit_${identifier}`;
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMinutes * 60 * 1000;
  }

  /**
   * Check if another attempt is allowed
   */
  isAllowed(): boolean {
    const data = this.getData();
    const now = Date.now();

    // Reset if window expired
    if (now - data.windowStart > this.windowMs) {
      this.clear();
      return true;
    }

    // Filter out old attempts
    const recentAttempts = data.attempts.filter(
      (timestamp) => now - timestamp <= this.windowMs
    );

    return recentAttempts.length < this.maxAttempts;
  }

  /**
   * Record a failed attempt
   */
  recordAttempt(): void {
    const data = this.getData();
    const now = Date.now();

    // Reset if window expired
    if (now - data.windowStart > this.windowMs) {
      data.attempts = [];
      data.windowStart = now;
    }

    data.attempts.push(now);
    this.saveData(data);
  }

  /**
   * Get remaining attempts
   */
  getRemainingAttempts(): number {
    const data = this.getData();
    const now = Date.now();

    // Reset if window expired
    if (now - data.windowStart > this.windowMs) {
      return this.maxAttempts;
    }

    const recentAttempts = data.attempts.filter(
      (timestamp) => now - timestamp <= this.windowMs
    );

    return Math.max(0, this.maxAttempts - recentAttempts.length);
  }

  /**
   * Get time until reset in milliseconds
   */
  getTimeUntilReset(): number {
    const data = this.getData();
    const now = Date.now();

    if (data.attempts.length === 0) {
      return 0;
    }

    const oldestAttempt = Math.min(...data.attempts);
    const resetTime = oldestAttempt + this.windowMs;

    return Math.max(0, resetTime - now);
  }

  /**
   * Clear rate limit
   */
  clear(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.key);
    }
  }

  private getData(): RateLimitData {
    if (typeof window === 'undefined') {
      return { attempts: [], windowStart: Date.now() };
    }

    const stored = localStorage.getItem(this.key);
    if (!stored) {
      return { attempts: [], windowStart: Date.now() };
    }

    try {
      return JSON.parse(stored);
    } catch {
      return { attempts: [], windowStart: Date.now() };
    }
  }

  private saveData(data: RateLimitData): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.key, JSON.stringify(data));
    }
  }
}
