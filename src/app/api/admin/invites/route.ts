import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getSecurityHeaders, createSafeErrorMessage } from '@/lib/security'
import { getCSRFTokenFromRequest, verifyRequestOrigin } from '@/lib/csrf'

const sql = neon(process.env.DATABASE_URL!)

type AdminInvitePayload = {
    guests: string[]
    _csrf: string
}

export async function POST(request: NextRequest) {
    if (!verifyRequestOrigin(request)) {
        return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers: getSecurityHeaders() })
    }

    try {
        const body = (await request.json()) as AdminInvitePayload
        const csrfToken = getCSRFTokenFromRequest(request)

        if (!csrfToken) {
            return NextResponse.json({ error: 'CSRF token missing' }, { status: 403, headers: getSecurityHeaders() })
        }

        const { guests } = body

        if (!guests || !Array.isArray(guests) || guests.length === 0) {
            return NextResponse.json({ error: 'Guest list required' }, { status: 400, headers: getSecurityHeaders() })
        }

        // Generate a random 6 character code
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
        const inviteId = crypto.randomUUID()

        // 1. Create Invite
        await sql`
            INSERT INTO invites (id, "inviteCode", "createdAt", "updatedAt")
            VALUES (${inviteId}, ${inviteCode}, NOW(), NOW())
        `

        // 2. Create Guests
        for (const name of guests) {
            if (name && name.trim()) {
                await sql`
                    INSERT INTO guests (id, "inviteId", name, "isAttending", "dietaryRequirements", "createdAt", "updatedAt")
                    VALUES (${crypto.randomUUID()}, ${inviteId}, ${name.trim()}, NULL, NULL, NOW(), NOW())
                `
            }
        }

        return NextResponse.json({ inviteCode }, { status: 201, headers: getSecurityHeaders() })

    } catch (error) {
        console.error('Error creating invite:', error)
        return NextResponse.json(
            { error: createSafeErrorMessage(error) },
            { status: 500, headers: getSecurityHeaders() }
        )
    }
}
