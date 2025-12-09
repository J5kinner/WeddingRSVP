'use server'

import { revalidatePath } from 'next/cache'
import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured')
}

const sql = neon(databaseUrl)

export async function resetInvite(formData: FormData) {
  const inviteId = formData.get('inviteId')

  if (!inviteId || typeof inviteId !== 'string') {
    throw new Error('Invalid invite ID')
  }

  await sql`
    UPDATE invites
    SET message = NULL,
        "updatedAt" = "createdAt"
    WHERE id = ${inviteId}
  `

  await sql`
    UPDATE guests
    SET status = false,
        "dietNotes" = NULL,
        "updatedAt" = NOW()
    WHERE "inviteId" = ${inviteId}
  `

  await revalidatePath('/admin')
  await revalidatePath('/api/rsvp')
}
