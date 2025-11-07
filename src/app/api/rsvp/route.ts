import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const rsvps = await sql`
      SELECT * FROM rsvps 
      ORDER BY "respondedAt" DESC
    `
    return NextResponse.json(rsvps)
  } catch (error: any) {
    console.error('Error fetching RSVPs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RSVPs: ' + (error.message || 'Unknown error') },
      { status: 500 }
    )
  }
}

/**
 * Creates or updates an RSVP entry.
 * Uses PostgreSQL UPSERT to handle duplicate emails by updating existing records.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, attending, numberOfGuests, dietaryNotes, message } = body

    if (!name || !email || attending === undefined) {
      return NextResponse.json(
        { error: 'Name, email, and attending status are required' },
        { status: 400 }
      )
    }

    const result = await sql`
      INSERT INTO rsvps (id, name, email, attending, "numberOfGuests", "dietaryNotes", message, "respondedAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${name}, ${email}, ${attending}, ${numberOfGuests || 1}, ${dietaryNotes || null}, ${message || null}, NOW(), NOW())
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
    return NextResponse.json(rsvp, { status: 201 })
  } catch (error: any) {
    console.error('Error creating RSVP:', error)
    return NextResponse.json(
      { error: 'Failed to create RSVP: ' + (error.message || 'Unknown error') },
      { status: 500 }
    )
  }
}
