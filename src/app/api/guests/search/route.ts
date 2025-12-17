import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { checkRateLimit, getClientId, RATE_LIMIT_CONFIGS } from '@/lib/rateLimiter'
import { getSecurityHeaders, createSafeErrorMessage, sanitizeInput } from '@/lib/security'

const sql = neon(process.env.DATABASE_URL!)

/**
 * Handles guest search requests.
 * Enforces rate limiting, requires a valid invite code, and implements privacy logic
 * to only return results when specific criteria (like "First Name" completion) are met.
 */
export async function GET(request: NextRequest) {
    const rateLimitDisabled = process.env.DISABLE_RSVP_RATE_LIMIT === 'true'
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('query')?.trim() || ''
    const inviteCode = searchParams.get('inviteCode')?.trim()


    const clientId = getClientId(request)
    const rateLimitResult = rateLimitDisabled
        ? {
            allowed: true,
            remaining: RATE_LIMIT_CONFIGS.guestSearch.maxRequests,
            resetTime: Date.now() + RATE_LIMIT_CONFIGS.guestSearch.windowMs
        }
        : checkRateLimit(clientId, RATE_LIMIT_CONFIGS.guestSearch)

    if (!rateLimitResult.allowed) {
        return new NextResponse(
            JSON.stringify({
                error: 'Too many search requests',
                retryAfter: rateLimitResult.retryAfter
            }),
            {
                status: 429,
                headers: {
                    ...getSecurityHeaders(),
                    'Retry-After': String(rateLimitResult.retryAfter)
                }
            }
        )
    }

    const headers = getSecurityHeaders()

    try {
        if (!inviteCode) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
        }


        const inviteCheck = await sql`
      SELECT id FROM invites WHERE "inviteCode" = ${inviteCode} LIMIT 1
    `

        if (inviteCheck.length === 0) {
            return NextResponse.json({ error: 'Invalid invite session' }, { status: 403, headers })
        }

        if (inviteCheck.length === 0) {
            return NextResponse.json({ error: 'Invalid invite session' }, { status: 403, headers })
        }

        if (query.length < 3) {
            return NextResponse.json({ results: [] }, { headers })
        }

        const sanitizedQuery = sanitizeInput(query)

        const hasSpace = sanitizedQuery.includes(' ')

        if (!hasSpace) {
            return NextResponse.json({ results: [] }, { headers })
        }

        // Split into firstName (part before first space)
        const parts = sanitizedQuery.split(/\s+/)
        const firstNameInput = parts[0]

        if (firstNameInput.length < 2) {
            return NextResponse.json({ results: [] }, { headers })
        }

        if (firstNameInput.length < 2) {
            return NextResponse.json({ results: [] }, { headers })
        }

        const searchPattern = `${sanitizedQuery}%`

        const rawResults = await sql`
      SELECT id, name, "dietNotes" 
      FROM guests 
      WHERE name ILIKE ${searchPattern}
      LIMIT 10
    `

        type GuestRecord = { id: string; name: string; dietNotes: string | null }
        const results = (rawResults as GuestRecord[]).map((guest) => ({
            id: guest.id,
            name: guest.name,
            dietaryNotes: guest.dietNotes
        }))

        return NextResponse.json({ results }, { headers })

    } catch (error) {
        console.error('Search error:', error)
        return NextResponse.json(
            { error: createSafeErrorMessage(error) },
            { status: 500, headers }
        )
    }
}
