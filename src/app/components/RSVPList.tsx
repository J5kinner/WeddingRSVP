'use client'

import { useState, useEffect } from 'react'

import { sanitizeHTML } from '@/lib/security'
import type { InviteResponse } from '@/types/rsvp'

/**
 * Formats date consistently to prevent hydration mismatches
 * between server and client rendering.
 */
function formatDate(dateValue: string | Date): string {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date'
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date)
}

interface RSVPListProps {
  rsvps: InviteResponse[]
  onResetInvite?: (formData: FormData) => Promise<void>
  onDeleteInvite?: (formData: FormData) => Promise<void>
}

export default function RSVPList({ rsvps, onResetInvite, onDeleteInvite }: RSVPListProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const origin = mounted && typeof window !== 'undefined' ? window.location.origin : ''

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => alert('Link copied to clipboard!'))
      .catch(err => console.error('Failed to copy:', err))
  }

  if (!rsvps || rsvps.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No RSVPs yet. Be the first to respond!
      </div>
    )
  }

  const totalGuests = rsvps.reduce((sum, invite) => sum + invite.guests.length, 0)
  const attendingGuests = rsvps.reduce(
    (sum, invite) => sum + invite.guests.filter((guest) => guest.isAttending === true).length,
    0
  )
  const declinedGuests = rsvps.reduce(
    (sum, invite) => sum + invite.guests.filter((guest) => guest.isAttending === false).length,
    0
  )
  const pendingGuests = totalGuests - attendingGuests - declinedGuests

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">RSVP Summary</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-blue-700 block">Invites:</span>
            <span className="font-semibold text-lg">{rsvps.length}</span>
          </div>
          <div>
            <span className="text-blue-700 block">Attending Guests:</span>
            <span className="font-semibold text-lg text-green-700">{attendingGuests}</span>
          </div>
          <div>
            <span className="text-blue-700 block">Declined Guests:</span>
            <span className="font-semibold text-lg text-gray-700">{declinedGuests}</span>
          </div>
          <div>
            <span className="text-blue-700 block">Pending/No Response:</span>
            <span className="font-semibold text-lg text-yellow-700">{pendingGuests}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">All RSVPs</h3>
        <div className="space-y-3">
          {rsvps.map((invite) => {
            const attendingCount = invite.guests.filter((guest) => guest.isAttending === true).length
            const totalCount = invite.guests.length
            const isFullyDeclined = invite.guests.every(g => g.isAttending === false)
            const isUnanswered = invite.guests.every(g => g.isAttending === null)
            const guestNames = invite.guests.map(g => g.name).join(', ')

            let statusLabel = 'Mixed/Pending'
            let statusColor = 'bg-yellow-100 text-yellow-800 border-yellow-200'

            if (attendingCount > 0 && attendingCount === totalCount) {
              statusLabel = 'All Attending'
              statusColor = 'bg-green-100 text-green-800 border-green-200'
            } else if (attendingCount > 0) {
              statusLabel = 'Some Attending'
              statusColor = 'bg-green-50 text-green-800 border-green-200'
            } else if (isFullyDeclined) {
              statusLabel = 'Not Attending'
              statusColor = 'bg-gray-100 text-gray-800 border-gray-200'
            } else if (isUnanswered) {
              statusLabel = 'No Response'
              statusColor = 'bg-blue-50 text-blue-800 border-blue-200'
            }

            const inviteLink = origin ? `${origin}/?inviteCode=${invite.inviteCode}#rsvp` : ''

            return (
              <div
                key={invite.id}
                className={`border rounded-lg p-4 ${attendingCount > 0
                  ? 'border-green-200 bg-green-50'
                  : isFullyDeclined ? 'border-gray-200 bg-gray-50' : 'border-blue-100 bg-white'
                  }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">
                        {sanitizeHTML(guestNames)}
                      </h4>

                      <span
                        className={`text-xs px-2 py-1 rounded ${statusColor}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200">
                        {sanitizeHTML(invite.inviteCode)}
                      </code>
                      {inviteLink && (
                        <button
                          onClick={() => copyToClipboard(inviteLink)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 hover:underline"
                          title="Copy Link to Clipboard"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                          </svg>
                          Copy Link
                        </button>
                      )}
                    </div>

                    {invite.message && (
                      <p className="text-sm text-gray-700 italic mt-1">
                        &quot;{sanitizeHTML(invite.message)}&quot;
                      </p>
                    )}
                    {(onResetInvite || onDeleteInvite) && (
                      <div className="flex items-center gap-3 mt-2">
                        {onResetInvite && (
                          <form action={onResetInvite}>
                            <input type="hidden" name="inviteId" value={invite.id} />
                            <button
                              type="submit"
                              className="text-xs font-medium text-blue-700 hover:text-blue-800 underline"
                            >
                              Reset
                            </button>
                          </form>
                        )}
                        {onDeleteInvite && (
                          <form action={onDeleteInvite}>
                            <input type="hidden" name="inviteId" value={invite.id} />
                            <button
                              type="submit"
                              className="text-xs font-medium text-red-700 hover:text-red-800 underline"
                            >
                              Delete
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap" suppressHydrationWarning>
                    {formatDate(invite.updatedAt)}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {invite.guests.map((guest) => (
                    <div
                      key={guest.id}
                      className="flex items-start justify-between rounded-md border border-dashed border-gray-200 bg-white/60 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{sanitizeHTML(guest.name)}</p>
                        {guest.dietaryRequirements && (
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Diet:</span> {sanitizeHTML(guest.dietaryRequirements)}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${guest.isAttending === true
                          ? 'bg-green-100 text-green-800'
                          : guest.isAttending === false
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                          }`}
                      >
                        {guest.isAttending === true
                          ? 'Attending'
                          : guest.isAttending === false
                            ? 'Not Attending'
                            : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Guests: {attendingCount}/{totalCount} attending
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
