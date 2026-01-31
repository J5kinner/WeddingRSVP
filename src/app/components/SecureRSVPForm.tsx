'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { sanitizeHTML } from '@/lib/security'
import { csrfProtector } from '@/lib/csrf'
import { Check, X, Loader2 } from 'lucide-react'

interface Guest {
  id: string
  name: string
  isAttending: boolean | null
  dietaryRequirements: string | null
}

interface InviteData {
  id: string
  inviteCode: string
  message: string | null
  guests: Guest[]
}

export default function SecureRSVPForm() {
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string>('')

  // State for the invite logic
  const [inviteCode, setInviteCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteData, setInviteData] = useState<InviteData | null>(null)

  // Form state once invite is loaded
  const [localGuests, setLocalGuests] = useState<Guest[]>([])
  const [userMessage, setUserMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    setMounted(true)
    const urlCode = searchParams.get('inviteCode') || searchParams.get('invitecode')
    if (urlCode) {
      setInviteCode(urlCode)
      // Auto-load if code is present
      fetchInvite(urlCode)
    }
  }, [searchParams])

  useEffect(() => {
    const generateToken = async () => {
      try {
        const { token } = await csrfProtector.generateToken()
        setCsrfToken(token)
      } catch (error) {
        console.error('Failed to generate CSRF token:', error)
      }
    }
    generateToken()
  }, [])

  const fetchInvite = async (code: string) => {
    if (!code) return
    setIsLoading(true)
    setError('')
    setInviteData(null)

    try {
      const res = await fetch(`/api/rsvp?inviteCode=${encodeURIComponent(code)}`)
      const data = await res.json()

      if (res.ok) {
        setInviteData(data)
        setLocalGuests(data.guests)
        setUserMessage(data.message || '')
      } else {
        setError(data.error || 'Could not find invite.')
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load invite. Please check your connection.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualLookup = (e: FormEvent) => {
    e.preventDefault()
    fetchInvite(inviteCode)
  }

  const handleAttendanceChange = (guestId: string, isAttending: boolean) => {
    setLocalGuests(prev => prev.map(g => {
      if (g.id === guestId) {
        return { ...g, isAttending }
      }
      return g
    }))
  }

  const handleDietaryChange = (guestId: string, value: string) => {
    setLocalGuests(prev => prev.map(g => {
      if (g.id === guestId) {
        return { ...g, dietaryRequirements: value }
      }
      return g
    }))
  }

  const handleSubmitRSVP = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      const payload = {
        inviteCode: inviteData?.inviteCode,
        guests: localGuests.map(g => ({
          id: g.id,
          isAttending: g.isAttending || false,
          dietaryRequirements: g.dietaryRequirements
        })),
        message: userMessage,
        _csrf: csrfToken
      }

      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setSubmitStatus('success')
      } else {
        setSubmitStatus('error')
      }
    } catch (err) {
      console.error(err)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!mounted) return null

  // 1. Initial State: Enter Code
  if (!inviteData) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg border border-[#E5E9EB]">
        <h2 className="text-2xl font-serif text-[#000000] mb-4 text-center">Find Your Invite</h2>
        <form onSubmit={handleManualLookup} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-[#000000] mb-1">Invite Code</label>
            <input
              id="code"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#6B8E23] focus:border-transparent outline-none transition-all"
              placeholder="Enter code from your invite"
              required
            />
          </div>
          {error && <p className="text-[#000000] text-sm">{sanitizeHTML(error)}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#6B8E23] hover:bg-[#556B2F] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
          >
            {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Find Invite'}
          </button>
        </form>
      </div>
    )
  }

  // 2. RSVP Form
  return (
    <div className="w-full max-w-2xl mx-auto p-6 lg:p-8 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-[#E5E9EB]">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-serif text-[#000000] mb-2">RSVP</h2>
        <p className="text-[#000000]">Please let us know if you can make it.</p>
      </div>

      {submitStatus === 'success' ? (
        <div className="text-center py-10 space-y-4">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-serif text-[#000000]">Thank You!</h3>
          <p className="text-[#000000]">Your RSVP has been sent. We can&apos;t wait to celebrate with you!</p>
          <button
            onClick={() => setSubmitStatus(null)}
            className="text-[#6B8E23] font-medium hover:underline mt-4"
          >
            Edit Response
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmitRSVP} className="space-y-8">

          {/* Guest List */}
          <div className="space-y-4">
            {localGuests.map((guest) => (
              <div key={guest.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-medium text-[#000000]">{sanitizeHTML(guest.name)}</h3>
                  </div>
                  <div className="flex gap-2">
                    <label className={`
                                    cursor-pointer px-3 py-2 rounded-md border text-sm font-medium transition-all flex items-center gap-2
                                    ${guest.isAttending === true
                        ? 'bg-[#6B8E23] text-white border-[#6B8E23]'
                        : 'bg-white text-[#000000] border-gray-300 hover:bg-gray-50'}
                                `}>
                      <input
                        type="radio"
                        name={`attending-${guest.id}`}
                        className="sr-only"
                        checked={guest.isAttending === true}
                        onChange={() => handleAttendanceChange(guest.id, true)}
                      />
                      <Check className="w-4 h-4" />
                      Joyfully Accepts
                    </label>
                    <label className={`
                                    cursor-pointer px-3 py-2 rounded-md border text-sm font-medium transition-all flex items-center gap-2
                                    ${guest.isAttending === false
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-[#000000] border-gray-300 hover:bg-gray-50'}
                                `}>
                      <input
                        type="radio"
                        name={`attending-${guest.id}`}
                        className="sr-only"
                        checked={guest.isAttending === false}
                        onChange={() => handleAttendanceChange(guest.id, false)}
                      />
                      <X className="w-4 h-4" />
                      Regretfully Declines
                    </label>
                  </div>
                </div>

                {/* Dietary Requirements - Only show if attending */}
                {guest.isAttending === true && (
                  <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-[#000000] mb-1">
                      Dietary Requirements
                    </label>
                    <select
                      value={guest.dietaryRequirements || ''}
                      onChange={(e) => handleDietaryChange(guest.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#6B8E23] focus:border-transparent outline-none text-sm"
                    >
                      <option value="">None / Standard Meal</option>
                      <option value="Vegetarian">Vegetarian</option>
                      <option value="Vegan">Vegan</option>
                      <option value="Gluten Free">Gluten Free</option>
                      <option value="Dairy Free">Dairy Free</option>
                      <option value="Nut Allergy">Nut Allergy</option>
                      <option value="Other">Other (Please specify in message)</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-[#000000] mb-1">
              Message for the Happy Couple (Optional)
            </label>
            <textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#6B8E23] focus:border-transparent outline-none transition-all"
              placeholder="Leave a note..."
            />
          </div>

          {submitStatus === 'error' && (
            <div className="p-3 bg-red-50 text-[#000000] rounded-lg text-sm">
              Something went wrong. Please try again.
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#6B8E23] hover:bg-[#556B2F] text-white font-bold py-4 rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending RSVP...' : 'Submit RSVP'}
          </button>
        </form>
      )}
    </div>
  )
}
