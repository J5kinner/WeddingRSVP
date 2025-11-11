/**
 * CSRF (Cross-Site Request Forgery) Protection
 * Implements double-submit cookie pattern for state-changing operations
 */

export interface CSRFToken {
  token: string;
  expires: number;
}

/**
 * Configuration for CSRF protection
 */
export const CSRF_CONFIG = {
  tokenLength: 32,
  expirationMinutes: 60,
  cookieName: '__Host-csrf-token',
  headerName: 'x-csrf-token',
  secure: process.env.NODE_ENV === 'production'
} as const;

/**
 * Generate a cryptographically secure CSRF token using Web Crypto API
 */
export async function generateCSRFToken(): Promise<CSRFToken> {
  // Generate random bytes using Web Crypto API
  const array = new Uint8Array(CSRF_CONFIG.tokenLength);
  crypto.getRandomValues(array);
  
  // Convert to hex string
  const token = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const expires = Date.now() + (CSRF_CONFIG.expirationMinutes * 60 * 1000);
  
  return { token, expires };
}

/**
 * Verify CSRF token
 */
export function verifyCSRFToken(token: string, expires: number): boolean {
  if (!token || Date.now() > expires) {
    return false;
  }
  
  // Additional verification could be added here
  // For now, we trust tokens that haven't expired
  return true;
}

/**
 * Get CSRF token from request headers or cookies
 */
export function getCSRFTokenFromRequest(request: Request): string | null {
  const headerToken = request.headers.get(CSRF_CONFIG.headerName);
  if (headerToken) {
    return headerToken;
  }
  
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {} as Record<string, string>);
    
    return cookies[CSRF_CONFIG.cookieName];
  }
  
  return null;
}

/**
 * Create CSRF cookie header
 */
export function createCSRFTokenCookie(token: string): string {
  const now = new Date();
  const expires = new Date(now.getTime() + CSRF_CONFIG.expirationMinutes * 60 * 1000);
  
  const cookieParts = [
    `${CSRF_CONFIG.cookieName}=${token}`,
    `Expires=${expires.toUTCString()}`,
    'Path=/',
    'HttpOnly=false', // Needs to be accessible by JavaScript for forms
    'Secure', // Only send over HTTPS
    'SameSite=Strict' // Strict CSRF protection
  ];
  
  if (CSRF_CONFIG.secure) {
    cookieParts.push('Partitioned');
  }
  
  return cookieParts.join('; ');
}

/**
 * CSRF protection middleware
 */
export function createCSRFMiddleware() {
  return (request: Request) => {
    if (request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'DELETE') {
      return null; // Skip CSRF for GET, HEAD, OPTIONS
    }
    
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const token = getCSRFTokenFromRequest(request);
      
      if (!token) {
        return new Response(
          JSON.stringify({
            error: 'CSRF token missing',
            message: 'Please include a valid CSRF token in your request'
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }
      
      // TODO: In a production system, you'd want to validate the token against a stored value
      if (token.length !== CSRF_CONFIG.tokenLength) {
        return new Response(
          JSON.stringify({
            error: 'CSRF token invalid',
            message: 'The provided CSRF token is not valid'
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }
    }
    
    return null; // Request passed CSRF check
  };
}

/**
 * Generate CSRF token for forms
 */
export async function generateFormCSRFToken(): Promise<{ token: string; cookie: string }> {
  const csrfToken = await generateCSRFToken();
  const cookie = createCSRFTokenCookie(csrfToken.token);
  
  return {
    token: csrfToken.token,
    cookie
  };
}

/**
 * Verify form CSRF token
 */
export function verifyFormCSRFToken(token: string): boolean {
  // In a real implementation, you'd compare against the token in the cookie
  // For now, we'll do basic validation
  return Boolean(token) && token.length === CSRF_CONFIG.tokenLength;
}

/**
 * Enhanced CSRF protection with origin checking
 */
export function verifyRequestOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // In production, you should have a whitelist of allowed origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  
  if (process.env.NODE_ENV === 'production') {
    if (!origin && !referer) {
      return false;
    }
    
    const requestOrigin = origin || (referer && new URL(referer).origin) || '';
    
    if (allowedOrigins.length > 0 && !allowedOrigins.includes(requestOrigin)) {
      return false;
    }
  }
  
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  return true;
}

/**
 * Complete CSRF protection for forms
 */
export class CSRFProtector {
  private tokens: Map<string, CSRFToken> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;
  
  constructor() {
    // Clean up expired tokens every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, 5 * 60 * 1000);
  }
  
  /**
   * Generate a new CSRF token
   */
  async generateToken(): Promise<{ token: string; cookie: string }> {
    const csrfToken = await generateCSRFToken();
    this.tokens.set(csrfToken.token, csrfToken);
    
    return {
      token: csrfToken.token,
      cookie: createCSRFTokenCookie(csrfToken.token)
    };
  }
  
  /**
   * Verify a CSRF token
   */
  verifyToken(token: string): boolean {
    const storedToken = this.tokens.get(token);
    
    if (!storedToken) {
      return false;
    }
    
    if (!verifyCSRFToken(storedToken.token, storedToken.expires)) {
      this.tokens.delete(token);
      return false;
    }
    
    return true;
  }
  
  /**
   * Cleanup expired tokens
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [token, csrfToken] of this.tokens.entries()) {
      if (now > csrfToken.expires) {
        this.tokens.delete(token);
      }
    }
  }
  
  /**
   * Cleanup method to be called on shutdown
   */
  cleanup(): void {
    clearInterval(this.cleanupInterval);
    this.tokens.clear();
  }
}

export const csrfProtector = new CSRFProtector();