'use client'

import { useEffect, useState } from 'react'
import { sanitizeHTML } from '@/lib/security'

interface RSVP {
  id: string
  name: string
  email: string
  attending: boolean
  numberOfGuests: number
  dietaryNotes: string | null
  message: string | null
  respondedAt: string
  updatedAt: string
}

/**
 * Formats date consistently to prevent hydration mismatches
 * between server and client rendering.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function RSVPList() {
  const [rsvps, setRsvps] = useState<RSVP[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetchRSVPs()
  }, [])

  const fetchRSVPs = async () => {
    try {
      const response = await fetch('/api/rsvp')
      if (!response.ok) throw new Error('Failed to fetch RSVPs')
      const data = await response.json()
      setRsvps(data)
    } catch (err) {
      setError('Failed to load RSVPs')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!mounted || loading) {
    return <div className="text-center py-8 text-gray-500">Loading RSVPs...</div>
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">{error}</div>
  }

  const attendingRSVPs = rsvps.filter((r) => r.attending)
  const totalGuests = attendingRSVPs.reduce((sum, r) => sum + r.numberOfGuests, 0)

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">RSVP Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-700">Total Responses:</span>
            <span className="ml-2 font-semibold">{rsvps.length}</span>
          </div>
          <div>
            <span className="text-blue-700">Attending:</span>
            <span className="ml-2 font-semibold">{attendingRSVPs.length}</span>
          </div>
          <div>
            <span className="text-blue-700">Total Guests:</span>
            <span className="ml-2 font-semibold">{totalGuests}</span>
          </div>
          <div>
            <span className="text-blue-700">Not Attending:</span>
            <span className="ml-2 font-semibold">{rsvps.length - attendingRSVPs.length}</span>
          </div>
        </div>
      </div>

      {rsvps.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No RSVPs yet. Be the first to respond!
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">All RSVPs</h3>
          <div className="space-y-3">
            {rsvps.map((rsvp) => (
              <div
                key={rsvp.id}
                className={`border rounded-lg p-4 ${
                  rsvp.attending
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{sanitizeHTML(rsvp.name)}</h4>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          rsvp.attending
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {rsvp.attending ? 'Attending' : 'Not Attending'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{sanitizeHTML(rsvp.email)}</p>
                    {rsvp.attending && (
                      <p className="text-sm text-gray-700 mb-1">
                        <span className="font-medium">Guests:</span> {rsvp.numberOfGuests}
                      </p>
                    )}
                    {rsvp.dietaryNotes && (
                      <p className="text-sm text-gray-700 mb-1">
                        <span className="font-medium">Dietary Notes:</span> {sanitizeHTML(rsvp.dietaryNotes)}
                      </p>
                    )}
                    {rsvp.message && (
                      <p className="text-sm text-gray-700 italic mt-2">&quot;{rsvp.message}&quot;</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500" suppressHydrationWarning>
                    {formatDate(rsvp.respondedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

