/**
 * Security validation library for RSVP form inputs
 * Provides input sanitization, validation, and XSS prevention
 */


import type { GuestStatus } from '@/types/rsvp';

interface RawRSVPFormData {
  name?: unknown;
  attending?: unknown;
  dietaryNotes?: unknown;
  message?: unknown;
  additionalGuests?: unknown;
}

export interface AdditionalGuest {
  id?: string;
  name: string;
  dietaryNotes: string;
}

export interface SanitizedGuest {
  id?: string;
  name: string;
  dietNotes: string;
  status: GuestStatus;
}


export const VALIDATION_CONFIG = {
  name: {
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-\'\.]+$/,
    errorMessage: 'Name can only contain letters, spaces, hyphens, apostrophes, and periods'
  },
  guestCount: {
    min: 1,
    max: 20,
    errorMessage: 'You can RSVP up to 20 guests including yourself'
  },
  dietaryNotes: {
    maxLength: 500,
    allowedChars: /^[a-zA-Z0-9\s\-\:\;\'\,\.\/\(\)&]+$/,
    errorMessage: 'Dietary notes contain invalid characters'
  },
  message: {
    maxLength: 300,
    allowedChars: /^[a-zA-Z0-9\s\-\,\.\!\?\(\)]+$/,
    errorMessage: 'Message contains invalid characters'
  }
} as const;

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
    id?: string;
    name: string;
    attending: GuestStatus;
    dietaryNotes: string;
    message: string;
    additionalGuests: AdditionalGuest[];
    guests: SanitizedGuest[];
  };
}

export function validateRSVPData(
  data: RawRSVPFormData & { id?: string },
  options: { requireAttendance?: boolean } = { requireAttendance: true }
): RSVPValidationResult {
  const errors: Record<string, string> = {};
  const MAX_ADDITIONAL_GUESTS = VALIDATION_CONFIG.guestCount.max - 1;

  const rawAdditionalGuestCount = Array.isArray(data.additionalGuests) ? data.additionalGuests.length : 0
  const rawAttending = data.attending

  const sanitizedAdditionalGuests: AdditionalGuest[] = Array.isArray(data.additionalGuests)
    ? data.additionalGuests
      .slice(0, MAX_ADDITIONAL_GUESTS)
      .map((guest) => {
        const safeGuest = typeof guest === 'object' && guest !== null ? guest as Record<string, unknown> : {};
        const name = sanitizeInput(typeof safeGuest.name === 'string' ? safeGuest.name : '');
        const dietaryNotes = sanitizeInput(typeof safeGuest.dietaryNotes === 'string' ? safeGuest.dietaryNotes : '');
        const id = typeof safeGuest.id === 'string' ? safeGuest.id : undefined;

        return { id, name, dietaryNotes };
      })
    : [];

  let status: GuestStatus = 'UNSELECTED';
  if (typeof rawAttending === 'string' && (rawAttending === 'ATTENDING' || rawAttending === 'NOT_ATTENDING' || rawAttending === 'UNSELECTED')) {
    status = rawAttending as GuestStatus;
  }

  const sanitizedData = {
    id: typeof data.name === 'string' && (data as any).id ? (data as any).id : undefined,
    name: sanitizeInput(typeof data.name === 'string' ? data.name : ''),
    attending: status,
    dietaryNotes: sanitizeInput(typeof data.dietaryNotes === 'string' ? data.dietaryNotes : ''),
    message: sanitizeInput(typeof data.message === 'string' ? data.message : ''),
    additionalGuests: sanitizedAdditionalGuests,
    guests: [] as SanitizedGuest[]
  };

  if ((data as any).id) sanitizedData.id = (data as any).id;


  const nameValidation = validateName(sanitizedData.name);
  if (!nameValidation.isValid) {
    errors.name = nameValidation.error!;
  }

  const dietaryValidation = validateDietaryNotes(sanitizedData.dietaryNotes);
  if (!dietaryValidation.isValid) {
    errors.dietaryNotes = dietaryValidation.error!;
  }

  const messageValidation = validateMessage(sanitizedData.message);
  if (!messageValidation.isValid) {
    errors.message = messageValidation.error!;
  }

  const guestErrors: string[] = [];

  if (options.requireAttendance && status === 'UNSELECTED') {
    errors.attending = 'Please select if you will attend'
  }

  sanitizedAdditionalGuests.forEach((guest, index) => {
    if (!guest.name) {
      guestErrors.push(`Guest ${index + 1} name is required`);
    } else {
      const guestNameValidation = validateName(guest.name);
      if (!guestNameValidation.isValid) {
        guestErrors.push(`Guest ${index + 1}: ${guestNameValidation.error}`);
      }
    }

    const guestDietValidation = validateDietaryNotes(guest.dietaryNotes);
    if (!guestDietValidation.isValid) {
      guestErrors.push(`Guest ${index + 1}: ${guestDietValidation.error}`);
    }
  });

  if (status !== 'ATTENDING' && sanitizedAdditionalGuests.length > 0) {
    guestErrors.push('Additional guests can only be added when attending');
    sanitizedData.additionalGuests = [];
  }

  if (rawAdditionalGuestCount > MAX_ADDITIONAL_GUESTS) {
    guestErrors.push(VALIDATION_CONFIG.guestCount.errorMessage);
  }

  if (guestErrors.length > 0) {
    errors.additionalGuests = guestErrors[0];
  }

  sanitizedData.guests = [
    {
      id: sanitizedData.id,
      name: sanitizedData.name,
      dietNotes: sanitizedData.dietaryNotes,
      status: sanitizedData.attending
    },
    ...(
      sanitizedData.attending === 'ATTENDING'
        ? sanitizedData.additionalGuests.map((guest) => ({
          id: guest.id,
          name: guest.name,
          dietNotes: guest.dietaryNotes,
          status: 'ATTENDING' as GuestStatus
        }))
        : []
    )
  ];

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
