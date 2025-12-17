import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { checkRateLimit, getClientId, RATE_LIMIT_CONFIGS } from '@/lib/rateLimiter'
import { getSecurityHeaders, createSafeErrorMessage, sanitizeInput } from '@/lib/security'

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest) {
    const rateLimitDisabled = process.env.DISABLE_RSVP_RATE_LIMIT === 'true'
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('query')?.trim() || ''
    const inviteCode = searchParams.get('inviteCode')?.trim()

    // 1. Rate Limiting
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
        // 2. Authentication Check (Must have a valid invite code to search)
        if (!inviteCode) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
        }

        // Verify invite code exists
        const inviteCheck = await sql`
      SELECT id FROM invites WHERE "inviteCode" = ${inviteCode} LIMIT 1
    `

        if (inviteCheck.length === 0) {
            return NextResponse.json({ error: 'Invalid invite session' }, { status: 403, headers })
        }

        // 3. Input Validation & Privacy Logic
        // We strictly require at least 3 characters AND suggest checking for space to indicate "First Name Done"
        // However, the user request says "ideally the last name... suggested letter by letter".
        // This implies we should search when they type "Matt ".

        // Privacy Rule: Query must be at least 3 chars.
        if (query.length < 3) {
            return NextResponse.json({ results: [] }, { headers })
        }

        const sanitizedQuery = sanitizeInput(query)

        // Logic: 
        // If query has no space (e.g. "Mat"), we might NOT return anything or return exact matches only?
        // User requested: "only suggest names once the user has typed the first name"
        // Implementation: valid search only if it contains a space OR matches a full first name exactly?
        // Safer: Only search if query contains a space.

        const hasSpace = sanitizedQuery.includes(' ')

        if (!hasSpace) {
            // Optional: We could check if "sanitizedQuery" is exactly a first name in DB, but that leaks "First Name Existence".
            // Strictest adherence to user request "once the user has typed the first name" -> imply trigger on space?
            // Let's return empty if no space to be safe and strictly follow "typed the first name".
            // Actually, let's treat the part before the first space as "First Name" and require it to be complete.
            // So we return results only if we have "First Last..."
            return NextResponse.json({ results: [] }, { headers })
        }

        // Split into firstName (part before first space)
        const parts = sanitizedQuery.split(/\s+/)
        const firstNameInput = parts[0]
        // The rest is the start of the last name
        // If input is "Matt ", parts is ["Matt", ""]

        if (firstNameInput.length < 2) {
            return NextResponse.json({ results: [] }, { headers })
        }

        // Search Logic:
        // Find guests where:
        // 1. Name starts with the full query (First + partial Last)
        // OR
        // 2. Name ILIKE `${firstNameInput} %` (First name match + any last name)
        // But we want to filter by the user's progress.

        // SQL: match names that start with the sanitizedQuery (case insensitive)
        // And ensure the First Name part matches exactly or closely?
        // "Matt J" -> matches "Matt Jap"
        // "Mat J" -> should NOT match "Matt Jap" (because user hasn't typed full first name "Matt" yet?)
        // But "Mat " -> We decided to return nothing if no space. 
        // So "Mat J" would be processed. First name "Mat". Search for "Mat J...".
        // If the guest is "Matt Jap", "Mat J" does NOT match "Matt ...".
        // So this enforces "First Name" correctness naturally.

        const searchPattern = `${sanitizedQuery}%`

        const rawResults = await sql`
      SELECT id, name, "dietNotes" 
      FROM guests 
      WHERE name ILIKE ${searchPattern}
      LIMIT 10
    `

        // Map to safe response
        const results = rawResults.map((guest: any) => ({
            id: guest.id,
            name: guest.name,
            dietaryNotes: guest.dietNotes // Return this to prefill
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
