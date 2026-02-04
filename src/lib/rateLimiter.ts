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

export const RATE_LIMIT_CONFIGS = {
  rsvp: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 3,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },

  rsvpRead: {
    windowMs: 1 * 60 * 1000,
    maxRequests: 120,
    skipSuccessfulRequests: true,
    skipFailedRequests: false
  },

  postOperations: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },

  guestSearch: {
    windowMs: 1 * 60 * 1000,
    maxRequests: 30,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  }
} as const;

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

export function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = `${clientId}:${config.windowMs}:${config.maxRequests}`;

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

function cleanupExpiredEntries(now: number): void {
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  }
}

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

export class AdvancedRateLimiter {
  private store: Map<string, number[]> = new Map();
  private windowSize: number;
  private maxRequests: number;

  constructor(windowSize: number, maxRequests: number) {
    this.windowSize = windowSize;
    this.maxRequests = maxRequests;
  }

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

  getRemaining(clientId: string): number {
    const now = Date.now();
    const requests = this.store.get(clientId) || [];
    const validRequests = requests.filter(timestamp => now - timestamp < this.windowSize);
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

export const rsvpRateLimiter = new AdvancedRateLimiter(15 * 60 * 1000, 3);
export const generalRateLimiter = new AdvancedRateLimiter(60 * 1000, 60);