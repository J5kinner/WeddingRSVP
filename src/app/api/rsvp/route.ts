import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { validateRSVPData, getSecurityHeaders, createSafeErrorMessage } from '@/lib/security'
import { checkRateLimit, getClientId, RATE_LIMIT_CONFIGS } from '@/lib/rateLimiter'
import { getCSRFTokenFromRequest, verifyRequestOrigin } from '@/lib/csrf'
import { neon } from '@neondatabase/serverless'
import type { InviteResponse, GuestStatus } from '@/types/rsvp'

const sql = neon(process.env.DATABASE_URL!)

type RawInviteRow = {
  inviteId: string
  inviteCode: string
  message: string | null
  inviteCreatedAt: string | Date
  inviteUpdatedAt: string | Date
  guestId: string | null
  guestName: string | null
  guestStatus: GuestStatus | null
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
        status: row.guestStatus as GuestStatus || 'UNSELECTED',
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

async function fetchInviteWithGuestsByCode(inviteCode: string): Promise<InviteResponse | null> {
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
    WHERE i."inviteCode" = ${inviteCode}
    ORDER BY g."createdAt" ASC
  `) as unknown as RawInviteRow[]

  const invites = mapInviteRows(rows)
  return invites[0] || null
}

/**
 * GET /api/rsvp
 * Fetches all RSVP responses with security headers
 */
export async function GET(request: NextRequest) {
  const rateLimitDisabled = process.env.DISABLE_RSVP_RATE_LIMIT === 'true'
  const searchParams = request.nextUrl.searchParams
  const inviteCode = searchParams.get('inviteCode')?.trim()
  const clientId = getClientId(request)
  const rateLimitResult = rateLimitDisabled
    ? {
      allowed: true,
      remaining: RATE_LIMIT_CONFIGS.rsvpRead.maxRequests,
      resetTime: Date.now() + RATE_LIMIT_CONFIGS.rsvpRead.windowMs
    }
    : checkRateLimit(clientId, RATE_LIMIT_CONFIGS.rsvpRead)

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
    const headers = getSecurityHeaders()
    headers.set('X-RateLimit-Limit', String(RATE_LIMIT_CONFIGS.rsvpRead.maxRequests))
    headers.set('X-RateLimit-Remaining', String(
      rateLimitDisabled ? RATE_LIMIT_CONFIGS.rsvpRead.maxRequests : rateLimitResult.remaining
    ))
    headers.set('X-RateLimit-Reset', String(
      rateLimitDisabled ? 0 : Math.ceil(rateLimitResult.resetTime / 1000)
    ))

    if (inviteCode) {
      const invite = await fetchInviteWithGuestsByCode(inviteCode)

      if (!invite) {
        return NextResponse.json(
          { error: 'Invite not found' },
          { status: 404, headers }
        )
      }

      return NextResponse.json(invite, { headers })
    }

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
  const rateLimitDisabled = process.env.DISABLE_RSVP_RATE_LIMIT === 'true'
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
  const rateLimitResult = rateLimitDisabled
    ? {
      allowed: true,
      remaining: RATE_LIMIT_CONFIGS.rsvp.maxRequests,
      resetTime: Date.now() + RATE_LIMIT_CONFIGS.rsvp.windowMs
    }
    : checkRateLimit(clientId, RATE_LIMIT_CONFIGS.rsvp)

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

    const validationResult = validateRSVPData(body, { requireAttendance: false })

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
    const inviteCodeFromBody =
      typeof body.inviteCode === 'string' ? body.inviteCode.trim() : ''

    if (sanitizedData.guests.length === 0) {
      return NextResponse.json(
        { error: 'At least one guest is required' },
        {
          status: 400,
          headers: getSecurityHeaders()
        }
      )
    }

    if (inviteCodeFromBody) {
      // EXISTING INVITE LOGIC
      const existingInviteResult = await sql`
        SELECT id FROM invites WHERE "inviteCode" = ${inviteCodeFromBody} LIMIT 1
      `

      if (!Array.isArray(existingInviteResult) || existingInviteResult.length === 0) {
        return NextResponse.json(
          { error: 'Invalid invite code' },
          {
            status: 404,
            headers: getSecurityHeaders()
          }
        )
      }

      const inviteId = (existingInviteResult[0] as { id: string }).id

      // Fetch existing guests for this invite to validate IDs
      const existingGuests = (await sql`
        SELECT id FROM guests WHERE "inviteId" = ${inviteId}
      `) as { id: string }[]

      const existingGuestIds = new Set(existingGuests.map(g => g.id))
      const processedGuestIds = new Set<string>()

      // Optimize: Update invite details once
      await sql`
        UPDATE invites 
        SET message = ${messageValue}, "updatedAt" = NOW()
        WHERE id = ${inviteId}
      `

      // Process submitted guests
      for (const guest of sanitizedData.guests) {
        if (guest.id) {
          // Check if guest belongs to THIS invite
          if (existingGuestIds.has(guest.id)) {
            // Standard Update for own guest
            await sql`
              UPDATE guests
              SET 
                name = ${guest.name}, 
                status = ${guest.status}, 
                "dietNotes" = ${guest.dietNotes || null}, 
                "updatedAt" = NOW()
              WHERE id = ${guest.id} AND "inviteId" = ${inviteId}
            `
            processedGuestIds.add(guest.id)
          } else {
            // Guest from ANOTHER invite (Cross-Invite Link)
            // 1. Verify existence and Update status on their ORIGINAL invite
            const result = await sql`
              UPDATE guests
              SET status = ${guest.status}, "updatedAt" = NOW()
              WHERE id = ${guest.id}
              RETURNING id
            `

            if (result.length > 0) {
              // 2. Add them as a "Plus One" to THIS invite so they appear in the UI
              // We generate a NEW ID for this "link" record
              await sql`
                INSERT INTO guests (id, "inviteId", name, status, "dietNotes", "createdAt", "updatedAt")
                VALUES (${randomUUID()}, ${inviteId}, ${guest.name}, ${guest.status}, ${guest.dietNotes || null}, NOW(), NOW())
              `
            } else {
              // Invalid ID passed? Treat as new guest entirely
              await sql`
                INSERT INTO guests (id, "inviteId", name, status, "dietNotes", "createdAt", "updatedAt")
                VALUES (${randomUUID()}, ${inviteId}, ${guest.name}, ${guest.status}, ${guest.dietNotes || null}, NOW(), NOW())
              `
            }
          }
        } else {
          // New Guest: Create (Relaxed Mode - Allow Plus Ones)
          await sql`
            INSERT INTO guests (id, "inviteId", name, status, "dietNotes", "createdAt", "updatedAt")
            VALUES (${randomUUID()}, ${inviteId}, ${guest.name}, ${guest.status}, ${guest.dietNotes || null}, NOW(), NOW())
          `
        }
      }

      // Handle existing guests NOT in the submission (Mark as Not Attending)
      // We don't delete them, we just set status to false so they stay in the invite list
      for (const existingId of existingGuestIds) {
        if (!processedGuestIds.has(existingId)) {
          await sql`
            UPDATE guests
            SET status = 'NOT_ATTENDING', "updatedAt" = NOW()
            WHERE id = ${existingId} AND "inviteId" = ${inviteId}
          `
        }
      }

      const invite = await fetchInviteWithGuests(inviteId)
      if (!invite) {
        throw new Error('Invite could not be loaded after save')
      }

      const headers = getSecurityHeaders()
      headers.set('X-RateLimit-Limit', String(RATE_LIMIT_CONFIGS.rsvp.maxRequests))
      headers.set('X-RateLimit-Remaining', String(
        rateLimitDisabled ? RATE_LIMIT_CONFIGS.rsvp.maxRequests : rateLimitResult.remaining
      ))
      headers.set('X-RateLimit-Reset', String(
        rateLimitDisabled ? 0 : Math.ceil(rateLimitResult.resetTime / 1000)
      ))

      return NextResponse.json(invite, {
        status: 200,
        headers
      })
    }

    // NEW INVITE LOGIC (No Code) - Used for manually creating invites via form if enabled (Public implementation)
    // Or if this was an admin function, but here it seems to be public RSVP.
    // If public doesn't have a code, they create a new one?
    // Based on previous code, yes.

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
    headers.set('X-RateLimit-Remaining', String(
      rateLimitDisabled ? RATE_LIMIT_CONFIGS.rsvp.maxRequests : rateLimitResult.remaining
    ))
    headers.set('X-RateLimit-Reset', String(
      rateLimitDisabled ? 0 : Math.ceil(rateLimitResult.resetTime / 1000)
    ))

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
