import { NextRequest, NextResponse } from 'next/server'
import { getSecurityHeaders, createSafeErrorMessage } from '@/lib/security'
import { checkRateLimit, getClientId, RATE_LIMIT_CONFIGS } from '@/lib/rateLimiter'
import { getCSRFTokenFromRequest, verifyRequestOrigin } from '@/lib/csrf'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

type GuestUpdate = {
  id: string
  isAttending: boolean | null
  dietaryRequirements: string
}

type RsvpPayload = {
  inviteCode: string
  guests: GuestUpdate[]
  message: string
  _csrf: string
}

/**
 * Fetches an Invite and its Guests by inviteCode.
 */
export async function GET(request: NextRequest) {
  const rateLimitDisabled = process.env.DISABLE_RSVP_RATE_LIMIT === 'true'
  const searchParams = request.nextUrl.searchParams
  const inviteCode = searchParams.get('inviteCode')?.trim()
  const clientId = getClientId(request)

  // Rate Limiting
  const rateLimitResult = rateLimitDisabled
    ? { allowed: true, remaining: 100, resetTime: Date.now(), retryAfter: 0 }
    : checkRateLimit(clientId, RATE_LIMIT_CONFIGS.rsvpRead)

  if (!rateLimitResult.allowed) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests', retryAfter: rateLimitResult.retryAfter }),
      { status: 429, headers: getSecurityHeaders() }
    )
  }

  try {
    const headers = getSecurityHeaders()
    if (!inviteCode) {
      return NextResponse.json({ error: 'Invite code required' }, { status: 400, headers })
    }

    // Fetch Invite + Guests
    // Note: We use a JOIN to get everything in one query usually, but simple queries work too.
    // Neon/Postgres typical query:
    const inviteRows = await sql`
      SELECT id, "inviteCode", "userMessage"
      FROM invites 
      WHERE "inviteCode" = ${inviteCode}
      LIMIT 1
    `

    if (inviteRows.length === 0) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404, headers })
    }

    const invite = inviteRows[0]

    const guestRows = await sql`
      SELECT id, name, "isAttending", "dietaryRequirements"
      FROM guests
      WHERE "inviteId" = ${invite.id}
      ORDER BY name ASC
    `

    const response = {
      id: invite.id,
      inviteCode: invite.inviteCode,
      message: invite.userMessage,
      guests: guestRows.map(g => ({
        id: g.id,
        name: g.name,
        isAttending: g.isAttending,
        dietaryRequirements: g.dietaryRequirements,
      }))
    }

    return NextResponse.json(response, { headers })

  } catch (error: unknown) {
    console.error('Error fetching RSVP:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: getSecurityHeaders() }
    )
  }
}

/**
 * Submits RSVP response.
 */
export async function POST(request: NextRequest) {
  if (!verifyRequestOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers: getSecurityHeaders() })
  }

  const clientId = getClientId(request)
  const rateLimitDisabled = process.env.DISABLE_RSVP_RATE_LIMIT === 'true'
  const rateLimitResult = rateLimitDisabled
    ? { allowed: true, remaining: 100, resetTime: Date.now(), retryAfter: 0 }
    : checkRateLimit(clientId, RATE_LIMIT_CONFIGS.rsvp)

  if (!rateLimitResult.allowed) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests' }),
      { status: 429, headers: getSecurityHeaders() }
    )
  }

  try {
    const body = (await request.json()) as RsvpPayload
    const csrfToken = getCSRFTokenFromRequest(request)

    // In a real app verify CSRF token matches session/cookie. 
    // Here we just check presence as per existing pattern or strict verification if implemented.
    if (!csrfToken) {
      return NextResponse.json({ error: 'CSRF token missing' }, { status: 403, headers: getSecurityHeaders() })
    }

    const { inviteCode, guests, message } = body

    if (!inviteCode) {
      return NextResponse.json({ error: 'Invite code required' }, { status: 400, headers: getSecurityHeaders() })
    }

    // 1. Verify Invite Exists
    const inviteRows = await sql`SELECT id FROM invites WHERE "inviteCode" = ${inviteCode} LIMIT 1`
    if (inviteRows.length === 0) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404, headers: getSecurityHeaders() })
    }
    const inviteId = inviteRows[0].id

    // 2. Update Invite Message
    await sql`
      UPDATE invites 
      SET "userMessage" = ${message || null}, "updatedAt" = NOW()
      WHERE id = ${inviteId}
    `

    // 3. Update Guests
    // Security: Only update guests that actually belong to this invite.
    // We fetch valid guest IDs for this invite first.
    const validGuestRows = await sql`SELECT id FROM guests WHERE "inviteId" = ${inviteId}`
    const validGuestIds = new Set(validGuestRows.map((r: any) => r.id))

    for (const guest of guests) {
      if (validGuestIds.has(guest.id)) {
        await sql`
          UPDATE guests
          SET 
            "isAttending" = ${guest.isAttending},
            "dietaryRequirements" = ${guest.dietaryRequirements || null},
            "updatedAt" = NOW()
          WHERE id = ${guest.id}
        `
        // Remove from set to track who was NOT updated
        validGuestIds.delete(guest.id)
      }
    }

    // 4. Handle Unselected Guests
    // Any guest ID remaining in validGuestIds was not in the submission.
    // We should mark them as not attending (or leave them? Requirements said "unselected then they are not coming").
    // Let's mark them as isAttending = false if they were not explicitly submitted.
    for (const missingId of validGuestIds) {
      await sql`
        UPDATE guests
        SET "isAttending" = false, "updatedAt" = NOW()
        WHERE id = ${missingId}
      `
    }

    // 5. Return updated data
    const updatedInviteRows = await sql`
      SELECT id, "inviteCode", "userMessage"
      FROM invites 
      WHERE id = ${inviteId}
    `
    const updatedGuests = await sql`
      SELECT id, name, "isAttending", "dietaryRequirements"
      FROM guests
      WHERE "inviteId" = ${inviteId}
      ORDER BY name ASC
    `

    return NextResponse.json({
      id: updatedInviteRows[0].id,
      inviteCode: updatedInviteRows[0].inviteCode,
      message: updatedInviteRows[0].userMessage,
      guests: updatedGuests
    }, { status: 200, headers: getSecurityHeaders() })

  } catch (error: unknown) {
    console.error('Error processing RSVP:', error)
    return NextResponse.json(
      { error: createSafeErrorMessage(error) },
      { status: 500, headers: getSecurityHeaders() }
    )
  }
}

