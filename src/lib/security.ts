/**
 * Security validation library for RSVP form inputs
 * Provides input sanitization, validation, and XSS prevention
 */


interface RawRSVPFormData {
  name?: unknown;
  email?: unknown;
  attending?: unknown;
  numberOfGuests?: unknown;
  dietaryNotes?: unknown;
  message?: unknown;
}


export const VALIDATION_CONFIG = {
  name: {
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-\'\.]+$/,
    errorMessage: 'Name can only contain letters, spaces, hyphens, apostrophes, and periods'
  },
  email: {
    maxLength: 255,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    blockedDomains: [
      '10minutemail.com',
      'tempmail.org', 
      'guerrillamail.com',
      'mailinator.com',
      'throwaway.email',
      'yopmail.com',
      'disposable.email',
      'temp-mail.org'
    ],
    errorMessage: 'Please provide a valid email address'
  },
  numberOfGuests: {
    min: 1,
    max: 20,
    errorMessage: 'Number of guests must be between 1 and 20'
  },
  dietaryNotes: {
    maxLength: 500,
    allowedChars: /^[a-zA-Z0-9\s\-\,\.\(\)]+$/,
    errorMessage: 'Dietary notes contain invalid characters'
  },
  message: {
    maxLength: 300,
    allowedChars: /^[a-zA-Z0-9\s\-\,\.\!\?\(\)]+$/,
    errorMessage: 'Message contains invalid characters'
  }
} as const;

export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .slice(0, 1000) // Hard limit to prevent DoS
    .replace(/[<>]/g, '') // Remove potentially dangerous characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers
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

export function validateEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  
  return !VALIDATION_CONFIG.email.blockedDomains.some(blocked => 
    domain.includes(blocked) || domain === blocked
  );
}


export function validateName(name: string): { isValid: boolean; error?: string } {
  const sanitized = sanitizeInput(name);
  
  if (!sanitized) {
    return { isValid: false, error: 'Name is required' };
  }
  
  if (sanitized.length > VALIDATION_CONFIG.name.maxLength) {
    return { 
      isValid: false, 
      error: `Name must be less than ${VALIDATION_CONFIG.name.maxLength} characters` 
    };
  }
  
  if (!VALIDATION_CONFIG.name.pattern.test(sanitized)) {
    return { isValid: false, error: VALIDATION_CONFIG.name.errorMessage };
  }
  
  return { isValid: true };
}

export function validateEmail(email: string): { isValid: boolean; error?: string } {
  const sanitized = sanitizeInput(email).toLowerCase();
  
  if (!sanitized) {
    return { isValid: false, error: 'Email is required' };
  }
  
  if (sanitized.length > VALIDATION_CONFIG.email.maxLength) {
    return { 
      isValid: false, 
      error: `Email must be less than ${VALIDATION_CONFIG.email.maxLength} characters` 
    };
  }
  
  if (!VALIDATION_CONFIG.email.pattern.test(sanitized)) {
    return { isValid: false, error: VALIDATION_CONFIG.email.errorMessage };
  }
  
  if (!validateEmailDomain(sanitized)) {
    return { isValid: false, error: 'Please use a permanent email address' };
  }
  
  return { isValid: true };
}

export function validateNumberOfGuests(guests: number): { isValid: boolean; error?: string } {
  if (!Number.isInteger(guests)) {
    return { isValid: false, error: 'Number of guests must be a whole number' };
  }
  
  if (guests < VALIDATION_CONFIG.numberOfGuests.min || guests > VALIDATION_CONFIG.numberOfGuests.max) {
    return { 
      isValid: false, 
      error: VALIDATION_CONFIG.numberOfGuests.errorMessage 
    };
  }
  
  return { isValid: true };
}

export function validateDietaryNotes(notes: string): { isValid: boolean; error?: string } {
  if (!notes.trim()) {
    return { isValid: true }; // Optional field
  }
  
  const sanitized = sanitizeInput(notes);
  
  if (sanitized.length > VALIDATION_CONFIG.dietaryNotes.maxLength) {
    return { 
      isValid: false, 
      error: `Dietary notes must be less than ${VALIDATION_CONFIG.dietaryNotes.maxLength} characters` 
    };
  }
  
  if (!VALIDATION_CONFIG.dietaryNotes.allowedChars.test(sanitized)) {
    return { isValid: false, error: VALIDATION_CONFIG.dietaryNotes.errorMessage };
  }
  
  return { isValid: true };
}

export function validateMessage(message: string): { isValid: boolean; error?: string } {
  if (!message.trim()) {
    return { isValid: true }; // Optional field
  }
  
  const sanitized = sanitizeInput(message);
  
  if (sanitized.length > VALIDATION_CONFIG.message.maxLength) {
    return { 
      isValid: false, 
      error: `Message must be less than ${VALIDATION_CONFIG.message.maxLength} characters` 
    };
  }
  
  if (!VALIDATION_CONFIG.message.allowedChars.test(sanitized)) {
    return { isValid: false, error: VALIDATION_CONFIG.message.errorMessage };
  }
  
  return { isValid: true };
}


export interface RSVPValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  sanitizedData: {
    name: string;
    email: string;
    attending: boolean;
    numberOfGuests: number;
    dietaryNotes: string;
    message: string;
  };
}

export function validateRSVPData(data: RawRSVPFormData): RSVPValidationResult {
  const errors: Record<string, string> = {};
  const sanitizedData = {
    name: sanitizeInput(typeof data.name === 'string' ? data.name : ''),
    email: sanitizeInput(typeof data.email === 'string' ? data.email : '').toLowerCase(),
    attending: Boolean(data.attending),
    numberOfGuests: Math.max(1, Math.min(20, typeof data.numberOfGuests === 'number' ? data.numberOfGuests : parseInt(String(data.numberOfGuests || 1)))),
    dietaryNotes: sanitizeInput(typeof data.dietaryNotes === 'string' ? data.dietaryNotes : ''),
    message: sanitizeInput(typeof data.message === 'string' ? data.message : '')
  };


  const nameValidation = validateName(sanitizedData.name);
  if (!nameValidation.isValid) {
    errors.name = nameValidation.error!;
  }

  const emailValidation = validateEmail(sanitizedData.email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error!;
  }

  const guestsValidation = validateNumberOfGuests(sanitizedData.numberOfGuests);
  if (!guestsValidation.isValid) {
    errors.numberOfGuests = guestsValidation.error!;
  }

  const dietaryValidation = validateDietaryNotes(sanitizedData.dietaryNotes);
  if (!dietaryValidation.isValid) {
    errors.dietaryNotes = dietaryValidation.error!;
  }

  const messageValidation = validateMessage(sanitizedData.message);
  if (!messageValidation.isValid) {
    errors.message = messageValidation.error!;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData
  };
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
    return 'This email has already been used for an RSVP';
  }
  
  if (error.includes('connection') || error.includes('database')) {
    return 'Unable to process your request at this time. Please try again later.';
  }
  
  if (error.includes('validation') || error.includes('invalid')) {
    return 'Please check your input and try again.';
  }
  
  return 'An unexpected error occurred. Please try again later.';
}