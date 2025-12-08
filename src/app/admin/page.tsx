import RSVPList from '@/app/components/RSVPList'
import { neon } from '@neondatabase/serverless'
import AdminGuestForm from './AdminGuestForm'
import type { InviteResponse } from '@/types/rsvp'

export const dynamic = 'force-dynamic'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured')
}

const sql = neon(databaseUrl)

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

async function getRSVPs(): Promise<InviteResponse[]> {
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

  return mapInviteRows(rows)
}

export default async function AdminPage() {
  let rsvps: InviteResponse[] = []
  let error: string | null = null

  try {
    rsvps = await getRSVPs()
  } catch (err) {
    console.error('Failed to load RSVPs', err)
    error = 'Failed to load RSVPs. Please try again later.'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <main className="max-w-6xl mx-auto space-y-6">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">RSVP Responses</h1>
          <p className="text-lg text-gray-600">
            Secure admin view for reviewing guest responses.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Add Guest</h2>
            <p className="text-sm text-gray-600 mb-4">
              Create a new invite and guest record directly in the database.
            </p>
            <AdminGuestForm />
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 lg:col-span-1">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">All Responses</h2>
            {error ? (
              <p className="text-center text-red-600">{error}</p>
            ) : (
              <RSVPList rsvps={rsvps} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
