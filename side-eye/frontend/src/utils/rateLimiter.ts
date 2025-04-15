interface RateLimiterOptions {
  maxRequests: number;
  timeWindow: number; // in milliseconds
}

class RateLimiter {
  private requests: Map<string, number[]>;
  private maxRequests: number;
  private timeWindow: number;

  constructor(options: RateLimiterOptions) {
    this.requests = new Map();
    this.maxRequests = options.maxRequests;
    this.timeWindow = options.timeWindow;
  }

  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    
    // Remove timestamps outside the time window
    const validTimestamps = timestamps.filter(
      timestamp => now - timestamp < this.timeWindow
    );

    if (validTimestamps.length < this.maxRequests) {
      validTimestamps.push(now);
      this.requests.set(key, validTimestamps);
      return true;
    }

    return false;
  }

  reset(key: string): void {
    this.requests.delete(key);
  }

  resetAll(): void {
    this.requests.clear();
  }
}

// Create instances for different types of operations
export const messageLimiter = new RateLimiter({
  maxRequests: 10, // 10 messages
  timeWindow: 5000 // per 5 seconds
});

export const presenceLimiter = new RateLimiter({
  maxRequests: 1, // 1 presence update
  timeWindow: 1000 // per second
});

export const streamLimiter = new RateLimiter({
  maxRequests: 5, // 5 stream operations
  timeWindow: 60000 // per minute
});

export default RateLimiter; 