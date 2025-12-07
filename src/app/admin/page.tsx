import RSVPList, { type RSVP } from '@/app/components/RSVPList'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured')
}

const sql = neon(databaseUrl)

async function getRSVPs(): Promise<RSVP[]> {
  const rows = await sql<RSVP[]>`
    SELECT * FROM rsvps
    ORDER BY "respondedAt" DESC
  `

  return rows.map((row) => ({
    ...row,
    respondedAt:
      row.respondedAt instanceof Date
        ? row.respondedAt.toISOString()
        : row.respondedAt,
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }))
}

export default async function AdminPage() {
  let rsvps: RSVP[] = []
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

        <div className="bg-white rounded-xl shadow-lg p-8">
          {error ? (
            <p className="text-center text-red-600">{error}</p>
          ) : (
            <RSVPList rsvps={rsvps} />
          )}
        </div>
      </main>
    </div>
  )
}
