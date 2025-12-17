/**
 * Rate limiting system for API endpoints.
 * Prevents spam submissions and DoS attacks.
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Rate limiting configuration for different endpoints.
 */
export const RATE_LIMIT_CONFIGS = {
  rsvp: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 3, // Max 3 submissions per 15 minutes per IP
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },

  rsvpRead: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 120, // Max 60 reads per minute per IP
    skipSuccessfulRequests: true,
    skipFailedRequests: false
  },

  postOperations: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5, // Max 5 POST requests per hour per IP
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },

  guestSearch: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30, // Max 30 searches per minute (generous for typing)
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  }
} as const;

/**
 * Get client identifier from request.
 * Uses `x-forwarded-for`, `cf-connecting-ip`, `x-real-ip`, or falls back to `unknown`.
 */
export function getClientId(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Apply rate limiting to a request
 */
export function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = `${clientId}:${config.windowMs}:${config.maxRequests}`;

  // Clean up expired entries periodically (1% chance)
  if (Math.random() < 0.01) {
    cleanupExpiredEntries(now);
  }

  const record = rateLimitStore[key];



  if (!record || now > record.resetTime) {
    rateLimitStore[key] = {
      count: 1,
      resetTime: now + config.windowMs
    };

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs
    };
  }

  if (record.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      retryAfter: Math.ceil((record.resetTime - now) / 1000)
    };
  }

  record.count++;

  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime
  };
}

/**
 * Cleanup expired rate limit entries
 */
function cleanupExpiredEntries(now: number): void {
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  }
}

/**
 * Rate limit middleware for API routes
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return (request: Request) => {
    const clientId = getClientId(request);
    const result = checkRateLimit(clientId, config);

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(config.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
            'Retry-After': String(result.retryAfter)
          }
        }
      );
    }

    return {
      headers: {
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000))
      }
    };
  };
}

/**
 * Advanced rate limiting with different strategies
 */
export class AdvancedRateLimiter {
  private store: Map<string, number[]> = new Map();
  private windowSize: number;
  private maxRequests: number;

  constructor(windowSize: number, maxRequests: number) {
    this.windowSize = windowSize;
    this.maxRequests = maxRequests;
  }

  /**
   * Sliding window rate limit check
   */
  isAllowed(clientId: string): boolean {
    const now = Date.now();
    const requests = this.store.get(clientId) || [];
    const validRequests = requests.filter(timestamp => now - timestamp < this.windowSize);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.store.set(clientId, validRequests);

    return true;
  }

  /**
   * Get remaining requests for client
   */
  getRemaining(clientId: string): number {
    const now = Date.now();
    const requests = this.store.get(clientId) || [];
    const validRequests = requests.filter(timestamp => now - timestamp < this.windowSize);
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

export const rsvpRateLimiter = new AdvancedRateLimiter(15 * 60 * 1000, 3); // 15min, 3 requests
export const generalRateLimiter = new AdvancedRateLimiter(60 * 1000, 60); // 1min, 60 requests