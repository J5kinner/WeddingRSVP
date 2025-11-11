import { NextRequest, NextResponse } from 'next/server'
import { validateRSVPData, getSecurityHeaders, createSafeErrorMessage } from '@/lib/security'
import { checkRateLimit, getClientId, RATE_LIMIT_CONFIGS } from '@/lib/rateLimiter'
import { getCSRFTokenFromRequest, verifyRequestOrigin } from '@/lib/csrf'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

/**
 * GET /api/rsvp
 * Fetches all RSVP responses with security headers
 */
export async function GET() {
  const clientId = getClientId(new Request('http://localhost:3000/api/rsvp', { method: 'GET' }))
  const rateLimitResult = checkRateLimit(clientId, RATE_LIMIT_CONFIGS.rsvpRead)
  
  if (!rateLimitResult.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`,
        retryAfter: rateLimitResult.retryAfter
      }),
      {
        status: 429,
        headers: {
          ...getSecurityHeaders(),
          'X-RateLimit-Limit': String(RATE_LIMIT_CONFIGS.rsvpRead.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetTime / 1000)),
          'Retry-After': String(rateLimitResult.retryAfter)
        }
      }
    )
  }

  try {
    const rsvps = await sql`
      SELECT * FROM rsvps
      ORDER BY "respondedAt" DESC
    `
    
    const headers = getSecurityHeaders()
    headers.set('X-RateLimit-Limit', String(RATE_LIMIT_CONFIGS.rsvpRead.maxRequests))
    headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
    headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetTime / 1000)))
    
    return NextResponse.json(rsvps, { headers })
  } catch (error: unknown) {
    console.error('Error fetching RSVPs:', error)
    return NextResponse.json(
      { error: createSafeErrorMessage(error) },
      { 
        status: 500,
        headers: getSecurityHeaders()
      }
    )
  }
}

/**
 * POST /api/rsvp
 * Creates or updates an RSVP entry with comprehensive security validation
 */
export async function POST(request: NextRequest) {
  // Verify request origin first
  if (!verifyRequestOrigin(request)) {
    return NextResponse.json(
      { error: 'Invalid request origin' },
      {
        status: 403,
        headers: getSecurityHeaders()
      }
    )
  }

  const clientId = getClientId(request)
  const rateLimitResult = checkRateLimit(clientId, RATE_LIMIT_CONFIGS.rsvp)
  
  if (!rateLimitResult.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`,
        retryAfter: rateLimitResult.retryAfter
      }),
      {
        status: 429,
        headers: {
          ...getSecurityHeaders(),
          'X-RateLimit-Limit': String(RATE_LIMIT_CONFIGS.rsvp.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetTime / 1000)),
          'Retry-After': String(rateLimitResult.retryAfter)
        }
      }
    )
  }

  try {
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 1048576) {
      return NextResponse.json(
        { error: 'Request too large. Please reduce the size of your submission.' },
        {
          status: 413,
          headers: getSecurityHeaders()
        }
      )
    }

    const body = await request.json()
    const csrfToken = getCSRFTokenFromRequest(request)
    if (!csrfToken) {
      return NextResponse.json(
        { error: 'CSRF token required' },
        {
          status: 403,
          headers: getSecurityHeaders()
        }
      )
    }

    const validationResult = validateRSVPData(body)
    
    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.errors
        },
        {
          status: 400,
          headers: getSecurityHeaders()
        }
      )
    }

    const { sanitizedData } = validationResult
    const result = await sql`
      INSERT INTO rsvps (id, name, email, attending, "numberOfGuests", "dietaryNotes", message, "respondedAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${sanitizedData.name}, ${sanitizedData.email}, ${sanitizedData.attending}, ${sanitizedData.numberOfGuests}, ${sanitizedData.dietaryNotes || null}, ${sanitizedData.message || null}, NOW(), NOW())
      ON CONFLICT (email) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        attending = EXCLUDED.attending,
        "numberOfGuests" = EXCLUDED."numberOfGuests",
        "dietaryNotes" = EXCLUDED."dietaryNotes",
        message = EXCLUDED.message,
        "updatedAt" = NOW()
      RETURNING *
    `
    
    const rsvp = result[0]
    
    const headers = getSecurityHeaders()
    headers.set('X-RateLimit-Limit', String(RATE_LIMIT_CONFIGS.rsvp.maxRequests))
    headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
    headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetTime / 1000)))
    
    return NextResponse.json(rsvp, {
      status: 201,
      headers
    })
  } catch (error: unknown) {
    console.error('Error creating/updating RSVP:', error)
    
    const errorMessage = createSafeErrorMessage(error)
    
    return NextResponse.json(
      { error: errorMessage },
      {
        status: 500,
        headers: getSecurityHeaders()
      }
    )
  }
}

/**
 * OPTIONS /api/rsvp
 * Preflight request handler for CORS
 */
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      ...getSecurityHeaders(),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  })
}
