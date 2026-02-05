'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { sanitizeHTML } from '@/lib/security'
import { csrfProtector } from '@/lib/csrf'
import { Check, X, Loader2 } from 'lucide-react'
import { InteractiveRing } from '@/components/LazyComponents'

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

  const [inviteCode, setInviteCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteData, setInviteData] = useState<InviteData | null>(null)

  const [localGuests, setLocalGuests] = useState<Guest[]>([])
  const [userMessage, setUserMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    const urlCode = searchParams.get('inviteCode') || searchParams.get('invitecode')
    const storedCode = localStorage.getItem('wedding_rsvp_completed_code')

    if (urlCode) {
      setInviteCode(urlCode)
      fetchInvite(urlCode)
      if (urlCode === storedCode) {
        setSubmitStatus('success')
      }
    } else if (storedCode) {
      setInviteCode(storedCode)
      fetchInvite(storedCode)
      setSubmitStatus('success')
    }
  }, [searchParams])

  useEffect(() => {
    if (submitStatus === 'success' && containerRef.current) {
      requestAnimationFrame(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }, [submitStatus])

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
        if (inviteData?.inviteCode) {
          localStorage.setItem('wedding_rsvp_completed_code', inviteData.inviteCode)
        }
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

  if (isLoading && !inviteData) {
    return (
      <div className="w-full max-w-md mx-auto p-12 bg-white rounded-[var(--radius-md)] shadow-sm border border-[color:var(--color-border-light)] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin w-8 h-8 text-[#5B6F55]" />
        <p className="text-[color:var(--color-text-charcoal)] font-sans opacity-70">Loading your invite...</p>
      </div>
    )
  }

  if (!inviteData) {
    return (
      <div className="w-full max-w-md mx-auto p-12 bg-white rounded-[var(--radius-md)] shadow-sm border border-[color:var(--color-border-light)] transform transition-all hover:shadow-md">
        <h2 className="text-3xl font-serif text-[color:var(--color-text-charcoal)] mb-8 text-center">Find your invite</h2>
        <form onSubmit={handleManualLookup} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="code" className="block text-xs uppercase tracking-wider font-medium text-[color:var(--color-text-charcoal)] opacity-70">Invite code</label>
            <input
              id="code"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-[color:var(--color-border-light)] focus:ring-1 focus:ring-[color:var(--color-botanical-green)] focus:border-[color:var(--color-botanical-green)] outline-none transition-all placeholder:text-gray-400 placeholder:font-light"
              placeholder="Enter code from your invite"
              required
            />
          </div>
          {error && <p className="text-[#000000] text-sm text-center bg-red-50 p-2 rounded">{sanitizeHTML(error)}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#5B6F55] hover:bg-[#4A5D45] text-white font-medium py-3.5 rounded-[var(--radius-sm)] transition-colors flex items-center justify-center text-[15px] shadow-sm hover:shadow"
          >
            {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Find invite'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto p-6 lg:p-10 bg-white rounded-[var(--radius-md)] shadow-sm border border-[color:var(--color-border-light)]">
      {submitStatus === 'success' ? (
        <div className="text-center py-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-center -mt-8 relative z-10">
            <InteractiveRing />
          </div>
          <div className="space-y-3">
            <h3 className="text-3xl font-serif text-[color:var(--color-text-charcoal)]">Thank you!</h3>
            <p className="text-[color:var(--color-text-charcoal)] opacity-80 max-w-xs mx-auto leading-relaxed">
              Your RSVP has been sent. We can&apos;t wait to celebrate with you!
            </p>
          </div>
          <div className="pt-4">
            <button
              onClick={() => setSubmitStatus(null)}
              className="text-[#5B6F55] font-medium hover:text-[#4A5D45] transition-colors text-base"
            >
              Edit Response
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-10 text-center space-y-2">
            <h2 className="text-3xl font-serif text-[color:var(--color-text-charcoal)]">RSVP</h2>
            <p className="text-[color:var(--color-text-charcoal)] opacity-80">Please let us know if you can make it by the 10th of April.</p>
          </div>
          <form onSubmit={handleSubmitRSVP} className="space-y-10">
            <div className="space-y-6">
              {localGuests.map((guest) => (
                <div key={guest.id} className="p-6 border border-[color:var(--color-border-light)] rounded-[var(--radius-md)] bg-[#F8F5F0]/30 hover:bg-[#F8F5F0]/50 transition-colors">
                  <h3 className="text-xl font-serif text-[color:var(--color-text-charcoal)] mb-6 text-left">
                    {sanitizeHTML(guest.name)}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                    <label className={`
                        cursor-pointer px-4 py-3 rounded-[var(--radius-sm)] border text-sm font-medium transition-all flex items-center justify-center gap-2 group
                        ${guest.isAttending === true
                        ? 'bg-[#5B6F55] text-white border-[#5B6F55] shadow-sm'
                        : 'bg-white text-[color:var(--color-text-charcoal)] border-[color:var(--color-border-light)] hover:border-[#5B6F55] hover:text-[#5B6F55]'}
                    `}>
                      <input
                        type="radio"
                        name={`attending-${guest.id}`}
                        className="sr-only"
                        checked={guest.isAttending === true}
                        onChange={() => handleAttendanceChange(guest.id, true)}
                      />
                      <Check className="w-4 h-4 ml-[-4px]" />
                      <span>Joyfully Accepts</span>
                    </label>

                    <label className={`
                        cursor-pointer px-4 py-3 rounded-[var(--radius-sm)] border text-sm font-medium transition-all flex items-center justify-center gap-2 group
                        ${guest.isAttending === false
                        ? 'bg-[#E5E9EB] text-gray-600 border-[#E5E9EB]'
                        : 'bg-white text-[color:var(--color-text-charcoal)] border-[color:var(--color-border-light)] hover:border-gray-400'}
                    `}>
                      <input
                        type="radio"
                        name={`attending-${guest.id}`}
                        className="sr-only"
                        checked={guest.isAttending === false}
                        onChange={() => handleAttendanceChange(guest.id, false)}
                      />
                      <X className="w-4 h-4 ml-[-4px]" />
                      <span>Regretfully Declines</span>
                    </label>
                  </div>

                  {guest.isAttending === true && (
                    <div className="mt-6 animate-in fade-in slide-in-from-top-1">
                      <label className="block text-xs uppercase tracking-wider font-medium text-[color:var(--color-text-charcoal)] opacity-70 mb-2">
                        Dietary Requirements
                      </label>
                      <select
                        value={guest.dietaryRequirements || ''}
                        onChange={(e) => handleDietaryChange(guest.id, e.target.value)}
                        className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-[color:var(--color-border-light)] bg-white focus:ring-1 focus:ring-[#5B6F55] focus:border-[#5B6F55] outline-none text-sm transition-all cursor-pointer"
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

            <div className="pt-2">
              <label className="block text-base font-medium text-[color:var(--color-text-charcoal)] mb-3">
                Message for the Happy Couple (Optional)
              </label>
              <textarea
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-[var(--radius-sm)] border border-[color:var(--color-border-light)] focus:ring-1 focus:ring-[#5B6F55] focus:border-[#5B6F55] outline-none transition-all placeholder:text-gray-400 placeholder:font-light"
                placeholder="Leave a note..."
              />
            </div>

            {submitStatus === 'error' && (
              <div className="p-4 bg-red-50 text-red-900 rounded-[var(--radius-sm)] text-sm text-center">
                Something went wrong. Please try again or contact us directly.
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#5B6F55] hover:bg-[#4A5D45] text-white font-medium py-4 rounded-[var(--radius-sm)] transition-all shadow-sm hover:shadow text-[16px] disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
              {isSubmitting ? 'Sending RSVP...' : 'Submit RSVP'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

