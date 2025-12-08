import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { validateRSVPData, getSecurityHeaders, createSafeErrorMessage } from '@/lib/security'
import { checkRateLimit, getClientId, RATE_LIMIT_CONFIGS } from '@/lib/rateLimiter'
import { getCSRFTokenFromRequest, verifyRequestOrigin } from '@/lib/csrf'
import { neon } from '@neondatabase/serverless'
import type { InviteResponse } from '@/types/rsvp'

const sql = neon(process.env.DATABASE_URL!)

type RawInviteRow = {
  inviteId: string
  inviteCode: string
  message: string | null
  inviteCreatedAt: string | Date
  inviteUpdatedAt: string | Date
  guestId: string | null
  guestName: string | null
  guestStatus: boolean | null
  guestDietNotes: string | null
  guestCreatedAt: string | Date | null
  guestUpdatedAt: string | Date | null
}

function mapInviteRows(rows: RawInviteRow[]): InviteResponse[] {
  const inviteMap = new Map<string, InviteResponse>()

  rows.forEach((row) => {
    if (!inviteMap.has(row.inviteId)) {
      inviteMap.set(row.inviteId, {
        id: row.inviteId,
        inviteCode: row.inviteCode,
        message: row.message,
        createdAt:
          row.inviteCreatedAt instanceof Date
            ? row.inviteCreatedAt.toISOString()
            : row.inviteCreatedAt,
        updatedAt:
          row.inviteUpdatedAt instanceof Date
            ? row.inviteUpdatedAt.toISOString()
            : row.inviteUpdatedAt,
        guests: []
      })
    }

    if (row.guestId) {
      const invite = inviteMap.get(row.inviteId)!
      invite.guests.push({
        id: row.guestId,
        name: row.guestName || '',
        status: Boolean(row.guestStatus),
        dietNotes: row.guestDietNotes,
        createdAt:
          row.guestCreatedAt instanceof Date
            ? row.guestCreatedAt.toISOString()
            : (row.guestCreatedAt || ''),
        updatedAt:
          row.guestUpdatedAt instanceof Date
            ? row.guestUpdatedAt.toISOString()
            : (row.guestUpdatedAt || '')
      })
    }
  })

  return Array.from(inviteMap.values())
}

async function fetchInviteWithGuests(inviteId: string): Promise<InviteResponse | null> {
  const rows = (await sql`
    SELECT 
      i.id as "inviteId",
      i."inviteCode",
      i.message,
      i."createdAt" as "inviteCreatedAt",
      i."updatedAt" as "inviteUpdatedAt",
      g.id as "guestId",
      g.name as "guestName",
      g.status as "guestStatus",
      g."dietNotes" as "guestDietNotes",
      g."createdAt" as "guestCreatedAt",
      g."updatedAt" as "guestUpdatedAt"
    FROM invites i
    LEFT JOIN guests g ON g."inviteId" = i.id
    WHERE i.id = ${inviteId}
    ORDER BY g."createdAt" ASC
  `) as unknown as RawInviteRow[]

  const invites = mapInviteRows(rows)
  return invites[0] || null
}

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
    const rows = (await sql`
      SELECT 
        i.id as "inviteId",
        i."inviteCode",
        i.message,
        i."createdAt" as "inviteCreatedAt",
        i."updatedAt" as "inviteUpdatedAt",
        g.id as "guestId",
        g.name as "guestName",
        g.status as "guestStatus",
        g."dietNotes" as "guestDietNotes",
        g."createdAt" as "guestCreatedAt",
        g."updatedAt" as "guestUpdatedAt"
      FROM invites i
      LEFT JOIN guests g ON g."inviteId" = i.id
      ORDER BY i."updatedAt" DESC, g."createdAt" ASC
    `) as unknown as RawInviteRow[]
    const invites = mapInviteRows(rows)
    
    const headers = getSecurityHeaders()
    headers.set('X-RateLimit-Limit', String(RATE_LIMIT_CONFIGS.rsvpRead.maxRequests))
    headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
    headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetTime / 1000)))
    
    return NextResponse.json(invites, { headers })
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
    const messageValue = sanitizedData.message || null

    if (sanitizedData.guests.length === 0) {
      return NextResponse.json(
        { error: 'At least one guest is required' },
        {
          status: 400,
          headers: getSecurityHeaders()
        }
      )
    }

    const inviteId = randomUUID()
    const inviteCode = randomUUID()

    await sql`
      INSERT INTO invites (id, "inviteCode", message, "createdAt", "updatedAt")
      VALUES (${inviteId}, ${inviteCode}, ${messageValue}, NOW(), NOW())
    `

    for (const guest of sanitizedData.guests) {
      await sql`
        INSERT INTO guests (id, "inviteId", name, status, "dietNotes", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${inviteId}, ${guest.name}, ${guest.status}, ${guest.dietNotes || null}, NOW(), NOW())
      `
    }

    const invite = await fetchInviteWithGuests(inviteId)
    if (!invite) {
      throw new Error('Invite could not be loaded after save')
    }
    
    const headers = getSecurityHeaders()
    headers.set('X-RateLimit-Limit', String(RATE_LIMIT_CONFIGS.rsvp.maxRequests))
    headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
    headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetTime / 1000)))
    
    return NextResponse.json(invite, {
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
