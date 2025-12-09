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
  if (!rsvps || rsvps.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No RSVPs yet. Be the first to respond!
      </div>
    )
  }

  const totalGuests = rsvps.reduce((sum, invite) => sum + invite.guests.length, 0)
  const attendingGuests = rsvps.reduce(
    (sum, invite) => sum + invite.guests.filter((guest) => guest.status).length,
    0
  )
  const notAttendingGuests = totalGuests - attendingGuests
  const attendingInvites = rsvps.filter((invite) =>
    invite.guests.some((guest) => guest.status)
  ).length

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">RSVP Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-700">Invites Received:</span>
            <span className="ml-2 font-semibold">{rsvps.length}</span>
          </div>
          <div>
            <span className="text-blue-700">Attending Invites:</span>
            <span className="ml-2 font-semibold">{attendingInvites}</span>
          </div>
          <div>
            <span className="text-blue-700">Attending Guests:</span>
            <span className="ml-2 font-semibold">{attendingGuests}</span>
          </div>
          <div>
            <span className="text-blue-700">Guests Not Attending:</span>
            <span className="ml-2 font-semibold">{notAttendingGuests}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">All RSVPs</h3>
        <div className="space-y-3">
          {rsvps.map((invite) => {
            const attendingCount = invite.guests.filter((guest) => guest.status).length
            const totalCount = invite.guests.length
            const primaryGuest = invite.guests[0]?.name || 'Guest'

            return (
              <div
                key={invite.id}
                className={`border rounded-lg p-4 ${
                  attendingCount > 0
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{sanitizeHTML(primaryGuest)}</h4>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          attendingCount > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {attendingCount > 0 ? 'Attending' : 'Not Attending'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Invite code: {sanitizeHTML(invite.inviteCode)}</p>
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
                        {guest.dietNotes && (
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Diet:</span> {sanitizeHTML(guest.dietNotes)}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          guest.status ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {guest.status ? 'Attending' : 'Not Attending'}
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
