
/**
 * Security validation library for RSVP form inputs
 * Provides input sanitization, validation, and XSS prevention
 */


/**
 * Sanitizes input string to prevent XSS and DoS attacks.
 * Trims whitespace, limits length, and removes dangerous characters/protocols.
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .slice(0, 1000)
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

export function sanitizeHTML(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}


export function getSecurityHeaders() {
  return new Headers({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'"
  });
}


export function createSafeErrorMessage(originalError: unknown): string {
  const error = originalError instanceof Error ? originalError.message : String(originalError);

  console.error('RSVP Error:', originalError);

  if (error.includes('duplicate') || error.includes('unique')) {
    return 'This invite already exists. Please use your existing link.';
  }

  if (error.includes('connection') || error.includes('database')) {
    return 'Unable to process your request at this time. Please try again later.';
  }

  if (error.includes('validation') || error.includes('invalid')) {
    return 'Please check your input and try again.';
  }

  return 'An unexpected error occurred. Please try again later.';
}
