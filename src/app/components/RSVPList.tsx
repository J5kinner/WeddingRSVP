'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { Download } from 'lucide-react'
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
  filter?: 'responded' | 'pending' | 'all'
  showSummary?: boolean
}

export default function RSVPList({
  rsvps,
  onResetInvite,
  onDeleteInvite,
  filter = 'all',
  showSummary = true
}: RSVPListProps) {
  const [mounted, setMounted] = useState(false)
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null)
  const [lastVisited, setLastVisited] = useState<Date | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)

    const storedLastVisited = localStorage.getItem('adminLastVisited')
    const now = new Date()

    if (storedLastVisited) {
      setLastVisited(new Date(storedLastVisited))
    } else {
      // First visit, set to now so everything is "seen"
      setLastVisited(now)
    }

    localStorage.setItem('adminLastVisited', now.toISOString())
  }, [])

  const rawOrigin = mounted && typeof window !== 'undefined' ? window.location.origin : ''
  const origin = rawOrigin.replace(/^https?:\/\/localhost(:\d+)?/, 'https://oliviaandjonah.xyz')

  const copyToClipboard = (text: string, guestNames: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        const id = Date.now()
        setToast({ message: `Copied link for ${guestNames}`, id })
        setTimeout(() => {
          setToast(current => (current?.id === id ? null : current))
        }, 3000)
      })
      .catch(err => console.error('Failed to copy:', err))
  }

  const downloadCSV = () => {
    const attending = rsvps
      .flatMap(r => r.guests.map(g => ({ ...g, inviteCode: r.inviteCode })))
      .filter(g => g.isAttending === true)

    const headers = ['Name', 'Dietary Requirements', 'Invite Code']
    const rows = attending.map(g => [
      `"${g.name.replace(/"/g, '""')}"`,
      `"${(g.dietaryRequirements || '').replace(/"/g, '""')}"`,
      `"${g.inviteCode}"`
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `attending_guests_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!rsvps || rsvps.length === 0) {
    return (
      <div className="text-center py-8 text-[#000000]">
        No RSVPs yet. Be the first to respond!
      </div>
    )
  }

  const newRsvpCount = lastVisited
    ? rsvps.filter(r => new Date(r.updatedAt) > lastVisited).length
    : 0

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

  const renderInviteCard = (invite: InviteResponse) => {
    const attendingCount = invite.guests.filter((guest) => guest.isAttending === true).length
    const totalCount = invite.guests.length
    const isFullyDeclined = invite.guests.every(g => g.isAttending === false)
    const isUnanswered = invite.guests.every(g => g.isAttending === null)
    const guestNames = invite.guests.map(g => g.name).join(', ')

    let statusLabel = 'Mixed/Pending'
    let statusColor = 'bg-yellow-100 text-yellow-800 border-yellow-200'

    if (attendingCount > 0 && attendingCount === totalCount) {
      statusLabel = 'All Attending'
      statusColor = 'bg-green-100 text-[#000000] border-green-200'
    } else if (attendingCount > 0) {
      statusLabel = 'Some Attending'
      statusColor = 'bg-green-50 text-[#000000] border-green-200'
    } else if (isFullyDeclined) {
      statusLabel = 'Not Attending'
      statusColor = 'bg-gray-100 text-[#000000] border-gray-200'
    } else if (isUnanswered) {
      statusLabel = 'No Response'
      statusColor = 'bg-blue-50 text-[#000000] border-blue-200'
    }

    const inviteLink = origin ? `${origin}/?inviteCode=${invite.inviteCode}` : ''

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
              <h4 className="font-semibold text-[#000000]">
                {sanitizeHTML(guestNames)}
              </h4>
              {lastVisited && new Date(invite.updatedAt) > lastVisited && (
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200 uppercase tracking-wide">
                  New
                </span>
              )}

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
                  onClick={() => copyToClipboard(inviteLink, guestNames)}
                  className="text-xs text-[#000000] hover:underline font-medium flex items-center gap-1"
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
              <p className="text-sm text-[#000000] italic mt-1">
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
                      className="text-xs font-medium text-[#000000] underline"
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
                      className="text-xs font-medium text-[#000000] underline"
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
          <span className="text-xs text-[#000000] whitespace-nowrap" suppressHydrationWarning>
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
                <p className="font-medium text-[#000000]">{sanitizeHTML(guest.name)}</p>
                {guest.dietaryRequirements && (
                  <p className="text-sm text-[#000000]">
                    <span className="font-medium">Diet:</span> {sanitizeHTML(guest.dietaryRequirements)}
                  </p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-1 rounded ${guest.isAttending === true
                  ? 'bg-green-100 text-[#000000]'
                  : guest.isAttending === false
                    ? 'bg-gray-100 text-[#000000]'
                    : 'bg-yellow-100 text-[#000000]'
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
        <p className="text-xs text-[#000000] mt-2">
          Guests: {attendingCount}/{totalCount} attending
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showSummary && (
        <div className="bg-white border border-gray-100 rounded-3xl p-8 sm:p-10 shadow-sm mb-12 overflow-hidden">
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Guest Overview</h3>
            {newRsvpCount > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span className="text-sm font-semibold text-indigo-600">
                  {newRsvpCount} new {newRsvpCount === 1 ? 'update' : 'updates'}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-12 mb-10">
            {/* Donut Chart Container */}
            <div className="flex flex-col items-center gap-6">
              <div className="relative w-52 h-52 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#f3f4f6"
                    strokeWidth="12"
                  />

                  {/* Attending Segment */}
                  {attendingGuests > 0 && (
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#10b981"
                      strokeWidth="12"
                      strokeDasharray="251.32"
                      initial={{ strokeDashoffset: 251.32 }}
                      animate={{ strokeDashoffset: 251.32 * (1 - attendingGuests / (totalGuests || 1)) }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                  )}

                  {/* Declined Segment */}
                  {declinedGuests > 0 && (
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#fb7185"
                      strokeWidth="12"
                      strokeDasharray="251.32"
                      initial={{ strokeDashoffset: 251.32 }}
                      animate={{ strokeDashoffset: 251.32 * (1 - declinedGuests / (totalGuests || 1)) }}
                      style={{ rotate: (attendingGuests / (totalGuests || 1)) * 360 }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                    />
                  )}

                  {/* No Response Segment */}
                  {pendingGuests > 0 && (
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#fef3c7"
                      strokeWidth="12"
                      strokeDasharray="251.32"
                      initial={{ strokeDashoffset: 251.32 }}
                      animate={{ strokeDashoffset: 251.32 * (1 - pendingGuests / (totalGuests || 1)) }}
                      style={{ rotate: ((attendingGuests + declinedGuests) / (totalGuests || 1)) * 360 }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.4 }}
                    />
                  )}
                </svg>

                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-gray-900 leading-none">{totalGuests}</span>
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Total Guests</span>
                </div>
              </div>

              <button
                onClick={downloadCSV}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-xl active:scale-95 whitespace-nowrap"
              >
                <Download size={16} />
                Export Attending CSV
              </button>
            </div>

            {/* Legend Stats */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:gap-x-12 flex-1 w-full max-w-xl">
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                  Total Invites
                </span>
                <span className="text-3xl font-black text-gray-800">{rsvps.length}</span>
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Attending
                </span>
                <span className="text-3xl font-black text-emerald-600">{attendingGuests}</span>
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest block mb-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-400" />
                  Declined
                </span>
                <span className="text-3xl font-black text-rose-600">{declinedGuests}</span>
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-300" />
                  No Response
                </span>
                <span className="text-3xl font-black text-amber-500">{pendingGuests}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-12">
        {/* Responded Section */}
        {(filter === 'all' || filter === 'responded') && (
          <div className="space-y-6">
            {filter === 'all' && (
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                Responded
                <span className="text-sm font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {rsvps.filter((r) => r.guests.some((g) => g.isAttending !== null)).length}
                </span>
              </h3>
            )}
            <div className="grid grid-cols-1 gap-6">
              {rsvps
                .filter((r) => r.guests.some((g) => g.isAttending !== null))
                .map((invite) => renderInviteCard(invite))}
              {rsvps.filter((r) => r.guests.some((g) => g.isAttending !== null)).length === 0 && (
                <p className="text-sm text-gray-500 italic px-2">No responses yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Pending Section */}
        {(filter === 'all' || filter === 'pending') && (
          <div className="space-y-6">
            {filter === 'all' && (
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                Pending / No Response
                <span className="text-sm font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {rsvps.filter((r) => r.guests.every((g) => g.isAttending === null)).length}
                </span>
              </h3>
            )}
            <div className="grid grid-cols-1 gap-6">
              {rsvps
                .filter((r) => r.guests.every((g) => g.isAttending === null))
                .map((invite) => renderInviteCard(invite))}
              {rsvps.filter((r) => r.guests.every((g) => g.isAttending === null)).length === 0 && (
                <p className="text-sm text-gray-500 italic px-2">No pending invites.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-50 pointer-events-none"
          >
            <div className="bg-gray-900/95 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 ring-1 ring-black/5">
              <div className="bg-green-500 rounded-full p-1 shadow-sm">
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <span className="font-medium text-sm whitespace-nowrap tracking-wide">
                {toast.message}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
