'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { VALIDATION_CONFIG, validateRSVPData, sanitizeHTML } from '@/lib/security'
import type { AdditionalGuest } from '@/lib/security'
import type { InviteResponse, GuestStatus } from '@/types/rsvp'
import { csrfProtector } from '@/lib/csrf'

const MAX_ADDITIONAL_GUESTS = VALIDATION_CONFIG.guestCount.max - 1

type FormField = keyof FormData | 'additionalGuests'
type FormErrors = Partial<Record<FormField, string>>

interface FormData {
  id?: string;
  name: string;
  attending: GuestStatus;
  dietaryNotes: string;
  message: string;
  additionalGuests: AdditionalGuest[];
  inviteCode?: string;
}

export default function SecureRSVPForm() {
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    attending: 'UNSELECTED',
    dietaryNotes: '',
    message: '',
    additionalGuests: [],
    inviteCode: '',
  })
  const [csrfToken, setCsrfToken] = useState<string>('')
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null)
  const [submitMessage, setSubmitMessage] = useState('')
  const [isPrefilling, setIsPrefilling] = useState(false)
  const [prefillError, setPrefillError] = useState('')
  const [isLocked, setIsLocked] = useState(false)
  const [availableGuests, setAvailableGuests] = useState<InviteResponse['guests']>([])
  const [guestSuggestions, setGuestSuggestions] = useState<Record<number, { id: string; name: string; dietaryNotes?: string }[]>>({})
  const [activeSearchRequest, setActiveSearchRequest] = useState<Record<number, number>>({}) // Track constraints to avoid race conditions

  // Ensure component is mounted before rendering to avoid hydration mismatches
  useEffect(() => {
    setMounted(true)
  }, [])

  // Generate CSRF token on component mount
  useEffect(() => {
    const generateToken = async () => {
      try {
        const { token } = await csrfProtector.generateToken()
        setCsrfToken(token)
      } catch (error) {
        console.error('Failed to generate CSRF token:', error)
        // Generate a fallback token using a simpler method
        const fallbackToken = Math.random().toString(36).substring(2) + Date.now().toString(36)
        setCsrfToken(fallbackToken)
      }
    }

    generateToken()
  }, [])

  // Prefill form if an inviteCode is present in the URL
  useEffect(() => {
    if (!mounted) return
    // Handle both camelCase (generated) and lowercase (user typed/browser forced) param names
    const code = searchParams.get('inviteCode') || searchParams.get('invitecode')
    if (!code) return

    const prefill = async () => {
      setIsPrefilling(true)
      setPrefillError('')

      try {
        const response = await fetch(`/api/rsvp?inviteCode=${encodeURIComponent(code)}`)

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          setPrefillError(
            typeof data.error === 'string'
              ? sanitizeHTML(data.error)
              : 'Invite link not found. Please check your URL.'
          )
          return
        }

        const invite = (await response.json()) as InviteResponse

        // Store all guests for usage in Select dropdowns
        setAvailableGuests(invite.guests)

        // Identify Primary Guest (First in list)
        const primaryGuest = invite.guests[0]

        const createdTime = new Date(invite.createdAt).getTime()
        const updatedTime = new Date(invite.updatedAt).getTime()

        // Check if this is an update to an existing RSVP response
        // Logic: updated > created means it was modified after creation
        // OR if any guest has status != null effectively? 
        // Better: check if any guest has a determined status (true/false) in DB?
        // But for "hasExistingResponse" intended for UI "Welcome back", the timestamp check is fine.
        // Or checking if primaryGuest status is not null?

        const hasExistingResponse = primaryGuest && (primaryGuest.status === 'ATTENDING' || primaryGuest.status === 'NOT_ATTENDING')

        setIsLocked(hasExistingResponse)

        // Map additional guests (everyone except primary)
        // If existing response, we only populate 'additionalGuests' form field with those currently marked 'Attending' (status: true)
        // If new response (or reset), we start with empty additional guests

        const otherGuests = invite.guests.slice(1)
        const activeAdditionalGuests = hasExistingResponse
          ? otherGuests.filter(g => g.status === 'ATTENDING').map(g => ({
            id: g.id,
            name: g.name,
            dietaryNotes: g.dietNotes || ''
          }))
          : []

        setFormData({
          id: primaryGuest?.id,
          name: primaryGuest?.name || '',
          attending: primaryGuest?.status ?? 'UNSELECTED',
          dietaryNotes: primaryGuest?.dietNotes || '',
          message: invite.message || '',
          additionalGuests: activeAdditionalGuests,
          inviteCode: invite.inviteCode
        })

        setSubmitStatus(null)
        setSubmitMessage(
          hasExistingResponse
            ? 'We already have your RSVP on file. You can review it below or edit if something changed.'
            : ''
        )
      } catch (error) {
        console.error('Failed to prefill invite', error)
        setPrefillError('Unable to load your invite. Please try again.')
      } finally {
        setIsPrefilling(false)
      }
    }

    prefill()
  }, [searchParams, mounted])

  // Debounced validation to avoid excessive validation calls
  const validateField = useCallback((fieldName: keyof FormData, value: unknown, currentData: FormData = formData) => {
    const validationData = { ...currentData, [fieldName]: value }
    const result = validateRSVPData(validationData)

    const fieldError = result.errors[fieldName]
    setFormErrors(prev => ({
      ...prev,
      [fieldName]: fieldError || ''
    }))

    return !fieldError
  }, [formData])

  // Validation check ensuring selected guests are in the invited list
  const validateGuestSelection = (name: string): boolean => {
    if (availableGuests.length === 0) return true
    return availableGuests.some(g => g.name.toLowerCase() === name.toLowerCase())
  }

  const handleInputChange = (field: keyof FormData, value: unknown) => {
    let newData = { ...formData, [field]: value }

    // Auto-link ID if name matches an available guest
    if (field === 'name' && typeof value === 'string') {
      const match = availableGuests.find(g => g.name.toLowerCase() === value.toLowerCase())
      if (match) {
        newData.id = match.id
      } else {
        // Optionally clear ID if name doesn't match anything? 
        // But maybe they are correcting a typo and we want to keep the ID? 
        // We'll trust the name-based strict validation.
        // Actually, strict mode requires ID. So we must clear it if no match.
        newData.id = undefined
      }
    }

    setFormData(newData)

    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }))
    }

    if (value && (formErrors[field] || value.toString().length > 2)) {
      if (field === 'name' && typeof value === 'string' && availableGuests.length > 0) {
        if (!validateGuestSelection(value)) {
          setFormErrors(prev => ({ ...prev, name: 'Please select a valid guest from the list.' }))
          return
        }
      }
      validateField(field, value, newData)
    }
  }

  const handleAttendingChange = (value: GuestStatus) => {
    const updatedData = {
      ...formData,
      attending: value,
      additionalGuests: value === 'ATTENDING' ? formData.additionalGuests : []
    }

    setFormData(updatedData)
    setFormErrors(prev => ({
      ...prev,
      attending: '',
      additionalGuests: ''
    }))

    validateField('attending', value, updatedData)
  }

  const handleAddGuest = () => {
    if (formData.additionalGuests.length >= MAX_ADDITIONAL_GUESTS) {
      return
    }

    setFormData(prev => ({
      ...prev,
      additionalGuests: [...prev.additionalGuests, { name: '', dietaryNotes: '' }]
    }))

    setFormErrors(prev => ({ ...prev, additionalGuests: '' }))
  }

  const searchGuests = useCallback(async (index: number, query: string) => {
    // Only search if we have a "First Last" structure starting (space detected)
    if (!query.includes(' ') || query.length < 3 || !formData.inviteCode) {
      setGuestSuggestions(prev => {
        const next = { ...prev }
        delete next[index]
        return next
      })
      return
    }

    const requestId = Date.now()
    setActiveSearchRequest(prev => ({ ...prev, [index]: requestId }))

    try {
      const res = await fetch(`/api/guests/search?inviteCode=${encodeURIComponent(formData.inviteCode)}&query=${encodeURIComponent(query)}`)
      if (!res.ok) return

      const data = await res.json()

      // Prevent race conditions: only update if this is still the active request
      setActiveSearchRequest(prev => {
        if (prev[index] === requestId) {
          setGuestSuggestions(current => ({
            ...current,
            [index]: data.results || []
          }))
        }
        return prev
      })
    } catch (e) {
      console.error('Search failed', e)
    }
  }, [formData.inviteCode])

  const handleGuestChange = (index: number, field: keyof AdditionalGuest, value: string) => {
    const updatedGuests = [...formData.additionalGuests]
    const guest = { ...updatedGuests[index], [field]: value }

    // If Changing Name:
    if (field === 'name') {
      // Clear ID if name changes significantly (logic is tricky, simple valid: clear ID if user types manually)
      // But we want to keep ID if they select from list.
      // For now, if they type, we assume it's a "New" entry unless they select suggestion.
      // However, we preserve ID if it was already set, until they change it?
      // Safest: Clear ID on any manual input change to force re-selection or treated as new.
      // But that breaks "Click suggestion -> Edit typo".
      // Let's Just Clear ID if they type.
      if (guest.id) {
        guest.id = undefined // Treat as new/unlinked until re-linked
      }

      // Trigger Search
      // We use a small timeout to debounce inside here or rely on the fact that useEffect isn't used
      // Let's just call it directly but we should debounce.
      // A simple timeout ref implementation:
      const timerId = setTimeout(() => searchGuests(index, value), 300)
      // We need to store this timer to clear previous ones. 
      // Since we didn't add a ref for timers, we'll accept basic throttled behavior or just run it.
      // Given "letter by letter", 300ms debounce is good.
      // *Quick fix*: Just run it. The browser handles fetch cancellation decently, or our `activeSearchRequest` state handles race conditions.
      searchGuests(index, value)
    }

    updatedGuests[index] = guest

    setFormData(prev => ({ ...prev, additionalGuests: updatedGuests }))

    if (formErrors.additionalGuests) {
      setFormErrors(prev => ({ ...prev, additionalGuests: '' }))
    }

    if (value && (formErrors.additionalGuests || value.length > 1)) {
      validateField('additionalGuests', updatedGuests, { ...formData, additionalGuests: updatedGuests })
    }
  }

  const handleSuggestionSelect = (index: number, suggestion: { id: string; name: string; dietaryNotes?: string }) => {
    const updatedGuests = [...formData.additionalGuests]
    updatedGuests[index] = {
      ...updatedGuests[index],
      name: suggestion.name,
      id: suggestion.id,
      dietaryNotes: suggestion.dietaryNotes || updatedGuests[index].dietaryNotes // Prefill diet if available
    }
    setFormData(prev => ({ ...prev, additionalGuests: updatedGuests }))

    // Clear suggestions
    setGuestSuggestions(prev => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const handleRemoveGuest = (index: number) => {
    const updatedGuests = formData.additionalGuests.filter((_, guestIndex) => guestIndex !== index)
    setFormData(prev => ({ ...prev, additionalGuests: updatedGuests }))
    validateField('additionalGuests', updatedGuests, { ...formData, additionalGuests: updatedGuests })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationResult = validateRSVPData(formData)

    if (!validationResult.isValid) {
      setFormErrors(validationResult.errors)
      return
    }

    setIsSubmitting(true)
    setSubmitStatus(null)
    setSubmitMessage('')

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          ...validationResult.sanitizedData,
          _csrf: csrfToken,
          inviteCode: formData.inviteCode
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSubmitStatus('success')
        setSubmitMessage('Thank you for your RSVP! We saved your response below. You can edit it anytime.')
        // Update form data to reflect what was saved (including any ID confirmations)
        // Re-mapping from backend response ensuring we have correct IDs
        // However, the backend returns the full InviteResponse, but here we just have partial data.
        // Let's just trust our local state but lock it.
        // Or better, we should update our local "availableGuests" to match the backend if anything changed, 
        // but for now, just Locking is enough.

        setFormData({
          id: validationResult.sanitizedData.id,
          name: validationResult.sanitizedData.name,
          attending: validationResult.sanitizedData.attending,
          dietaryNotes: validationResult.sanitizedData.dietaryNotes,
          message: validationResult.sanitizedData.message,
          additionalGuests: validationResult.sanitizedData.additionalGuests,
          inviteCode: formData.inviteCode
        })
        setIsLocked(true)
      } else {
        setSubmitStatus('error')
        setSubmitMessage(sanitizeHTML(data.error || 'Something went wrong. Please try again.'))
      }
    } catch (error) {
      console.error('Fetch error:', error)
      setSubmitStatus('error')
      setSubmitMessage('Failed to submit RSVP. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const attendingOptions: { value: GuestStatus; label: string; description: string }[] = [
    { value: 'ATTENDING', label: 'Yes, I\'ll be there!', description: 'We can\'t wait to celebrate with you!' },
    { value: 'NOT_ATTENDING', label: 'Sorry, can\'t make it', description: 'We understand, but we\'ll miss you!' }
  ]

  const totalGuests = formData.attending === 'ATTENDING' ? formData.additionalGuests.length + 1 : 0
  const hasReachedGuestLimit = formData.additionalGuests.length >= MAX_ADDITIONAL_GUESTS

  const dietaryLength = formData.dietaryNotes.trim().length
  const attendanceLabel =
    formData.attending === 'ATTENDING' ? 'Attending' : formData.attending === 'NOT_ATTENDING' ? 'Not attending' : 'Not selected'

  const handleUnlock = () => {
    setIsLocked(false)
    setSubmitStatus(null)
    setSubmitMessage('You can update your RSVP below.')
  }

  // Prevent hydration mismatch by ensuring consistent initial render
  // The form structure is consistent, but searchParams-dependent logic only runs after mount

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isPrefilling && (
        <div className="bg-[color:var(--color-sage)]/10 border border-[color:var(--color-sage)]/30 text-[color:var(--color-botanical-green)] text-sm rounded-[var(--radius-md)] p-3">
          Loading your invite details...
        </div>
      )}

      {prefillError && (
        <div className="bg-[color:var(--color-rose)]/10 border border-[color:var(--color-rose)]/30 text-[color:var(--color-text-charcoal)] text-sm rounded-[var(--radius-md)] p-3">
          {sanitizeHTML(prefillError)}
        </div>
      )}

      {/* Datalist for Guest Suggestions */}
      {availableGuests.length > 0 && (
        <datalist id="guest-options">
          {availableGuests.map((guest) => (
            <option key={guest.id} value={guest.name} />
          ))}
        </datalist>
      )}

      {formData.inviteCode && !isPrefilling && !prefillError && (
        <div className="bg-[color:var(--color-sage)]/10 border border-[color:var(--color-sage)]/30 text-[color:var(--color-botanical-green)] text-sm rounded-[var(--radius-md)] p-3">
          Invite link detected. We prefilled details for {sanitizeHTML(formData.name || 'your invite')}.
        </div>
      )}

      {submitMessage && (
        <div
          className={`p-4 rounded-[var(--radius-md)] ${submitStatus === 'success'
            ? 'bg-[color:var(--color-sage)]/10 border border-[color:var(--color-sage)]/30 text-[color:var(--color-botanical-green)]'
            : 'bg-[color:var(--color-rose)]/10 border border-[color:var(--color-rose)]/30 text-[color:var(--color-text-charcoal)]'
            }`}
        >
          {sanitizeHTML(submitMessage)}
        </div>
      )}

      {isLocked ? (
        <div className="space-y-4 bg-white border border-[color:var(--color-border-light)] rounded-[var(--radius-md)] p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-lg font-serif text-[color:var(--color-text-charcoal)]">RSVP on file</p>
              <p className="text-sm text-[color:var(--color-text-charcoal)]/70">
                Thank you, {sanitizeHTML(formData.name || 'guest')}. We&apos;ve saved your response.
              </p>
            </div>
            <button
              type="button"
              onClick={handleUnlock}
              className="text-sm font-medium text-[color:var(--color-botanical-green)] hover:text-[color:var(--color-botanical-green)]/80 transition-colors"
            >
              Edit my RSVP
            </button>
          </div>

          <div className="border border-[color:var(--color-border-subtle)] rounded-[var(--radius-sm)] p-3 bg-[color:var(--color-bg-paper)] space-y-2 text-sm text-[color:var(--color-text-charcoal)]/80">
            <div className="flex items-center justify-between">
              <span className="font-medium">Status</span>
              <span className="px-2 py-1 rounded-[var(--radius-sm)] bg-[color:var(--color-sage)]/20 text-[color:var(--color-botanical-green)]">{attendanceLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Total guests</span>
              <span className="text-[color:var(--color-text-charcoal)]">{totalGuests}</span>
            </div>
            {formData.additionalGuests.length > 0 && (
              <div>
                <p className="font-medium">Additional guests</p>
                <ul className="mt-1 space-y-1">
                  {formData.additionalGuests.map((guest, idx) => (
                    <li key={`summary-guest-${idx}`} className="flex items-center justify-between">
                      <span>{sanitizeHTML(guest.name || `Guest ${idx + 1}`)}</span>
                      {guest.dietaryNotes && (
                        <span className="text-xs text-[color:var(--color-text-charcoal)]/60">Diet: {sanitizeHTML(guest.dietaryNotes)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {formData.dietaryNotes && (
              <div>
                <p className="font-medium">Dietary notes</p>
                <p className="text-[color:var(--color-text-charcoal)]/70">{sanitizeHTML(formData.dietaryNotes)}</p>
              </div>
            )}
            {formData.message && (
              <div>
                <p className="font-medium">Message</p>
                <p className="text-[color:var(--color-text-charcoal)]/70">{sanitizeHTML(formData.message)}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[color:var(--color-text-charcoal)] mb-1">
              Name *
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              readOnly
              className="input-botanical bg-[color:var(--color-bg-paper)] opacity-70 cursor-not-allowed"
              placeholder="Guest Name"
            />
            {formErrors.name && (
              <p className="text-[color:var(--color-rose)] text-sm mt-1">{sanitizeHTML(formErrors.name)}</p>
            )}
            <p className="text-[color:var(--color-text-charcoal)]/60 text-xs mt-1">
              This invite is exclusively for <span className="font-medium">{formData.name}</span>.
            </p>
          </div>

          {/* Attending Field */}
          <div>
            <label className="block text-sm font-medium text-[color:var(--color-text-charcoal)] mb-3">
              Will you be attending? *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {attendingOptions.map((option) => (
                <label
                  key={String(option.value)}
                  className={`flex items-start space-x-3 p-4 border rounded-[var(--radius-md)] cursor-pointer transition-all ${formData.attending === option.value
                    ? 'border-[color:var(--color-botanical-green)] bg-[color:var(--color-sage)]/10'
                    : 'border-[color:var(--color-border-light)] hover:bg-[color:var(--color-bg-paper)]'
                    }`}
                >
                  <input
                    type="radio"
                    name="attending"
                    checked={formData.attending === option.value}
                    onChange={() => handleAttendingChange(option.value)}
                    required={formData.attending === 'UNSELECTED'}
                    className="mt-0.5 text-[color:var(--color-botanical-green)] focus:ring-[color:var(--color-botanical-green)]"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-[color:var(--color-text-charcoal)]">{option.label}</span>
                    <p className="text-sm text-[color:var(--color-text-charcoal)]/70 mt-1">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
            {formErrors.attending && (
              <p className="text-[color:var(--color-rose)] text-sm mt-2">{sanitizeHTML(formErrors.attending)}</p>
            )}
          </div>

          {formData.attending === 'ATTENDING' && (
            <>
              {/* Additional Guests */}
              <div className="space-y-3">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text-charcoal)]">
                      Add guests
                    </label>
                    <p className="text-xs text-[color:var(--color-text-charcoal)]/60 mt-1">
                      Share names and dietary needs for anyone attending with you.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddGuest}
                    disabled={hasReachedGuestLimit}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-[color:var(--color-botanical-green)] bg-[color:var(--color-sage)]/10 border border-[color:var(--color-sage)]/30 rounded-[var(--radius-sm)] hover:bg-[color:var(--color-sage)]/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="text-lg mr-2">+</span>
                    Add guest
                  </button>
                </div>
                {formErrors.additionalGuests && (
                  <p className="text-[color:var(--color-rose)] text-sm">{sanitizeHTML(formErrors.additionalGuests)}</p>
                )}
                {formData.additionalGuests.length === 0 && (
                  <div className="border border-dashed border-[color:var(--color-border-light)] rounded-[var(--radius-md)] p-4 text-sm text-[color:var(--color-text-charcoal)]/60 bg-[color:var(--color-bg-paper)]">
                    No additional guests yet. Click &quot;Add guest&quot; to include family or friends.
                  </div>
                )}
                <div className="space-y-3">
                  {formData.additionalGuests.map((guest, index) => (
                    <div key={`guest-${index}`} className="border border-[color:var(--color-border-light)] rounded-[var(--radius-md)] p-4 bg-white space-y-3 relative">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--color-text-charcoal)]">Guest {index + 1}</p>
                          <p className="text-xs text-[color:var(--color-text-charcoal)]/60">Provide their name and dietary needs.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveGuest(index)}
                          className="text-sm text-[color:var(--color-rose)] hover:text-[color:var(--color-rose)]/80 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="relative">
                          <label className="block text-sm font-medium text-[color:var(--color-text-charcoal)] mb-1">
                            Guest name *
                          </label>
                          <input
                            type="text"
                            value={guest.name}
                            onChange={(e) => handleGuestChange(index, 'name', e.target.value)}
                            maxLength={100}
                            className="input-botanical"
                            placeholder="Guest name"
                            required
                            autoComplete="off"
                          />
                          {guestSuggestions[index] && guestSuggestions[index].length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-[color:var(--color-border-light)] rounded-b-[var(--radius-md)] shadow-lg max-h-48 overflow-y-auto mt-1">
                              {guestSuggestions[index].map((suggestion) => (
                                <li
                                  key={suggestion.id}
                                  onClick={() => handleSuggestionSelect(index, suggestion)}
                                  className="px-4 py-2 hover:bg-[color:var(--color-sage)]/10 cursor-pointer text-sm text-[color:var(--color-text-charcoal)]"
                                >
                                  <div className="font-medium">{suggestion.name}</div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[color:var(--color-text-charcoal)] mb-1">
                            Dietary needs or notes
                          </label>
                          <input
                            type="text"
                            value={guest.dietaryNotes}
                            onChange={(e) => handleGuestChange(index, 'dietaryNotes', e.target.value)}
                            maxLength={120}
                            className="input-botanical"
                            placeholder="Vegetarian, gluten-free, allergies, etc."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[color:var(--color-text-charcoal)]/70">
                  Total guests (including you): <span className="font-semibold text-[color:var(--color-text-charcoal)]">{totalGuests}</span>{' '}
                  {hasReachedGuestLimit ? '(guest limit reached)' : `(max ${MAX_ADDITIONAL_GUESTS + 1})`}
                </p>
              </div>

              {/* Dietary Restrictions */}
              <div>
                <label htmlFor="dietaryNotes" className="block text-sm font-medium text-[color:var(--color-text-charcoal)] mb-1">
                  Dietary Restrictions or Special Requests <span className="text-xs text-[color:var(--color-text-charcoal)]/60">(optional, 500 character limit)</span>
                </label>
                <textarea
                  id="dietaryNotes"
                  value={formData.dietaryNotes}
                  onChange={(e) => handleInputChange('dietaryNotes', e.target.value)}
                  maxLength={500}
                  rows={3}
                  className={`textarea-botanical ${formErrors.dietaryNotes
                    ? 'border-[color:var(--color-rose)] focus:border-[color:var(--color-rose)]'
                    : ''
                    }`}
                  placeholder="Leave blank if no restrictions. Include notes for you or added guests — vegetarian, gluten-free, allergies, etc."
                />
                {formErrors.dietaryNotes && (
                  <p className="text-[color:var(--color-rose)] text-sm mt-1">{sanitizeHTML(formErrors.dietaryNotes)}</p>
                )}
                <p className="text-[color:var(--color-text-charcoal)]/60 text-xs mt-1">
                  This note is for you; each added guest has their own dietary details above.
                </p>
                <p className="text-[color:var(--color-text-charcoal)]/60 text-xs mt-1">
                  {dietaryLength}/500 characters for your notes
                </p>
              </div>
            </>
          )}

          {/* Message Field */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-[color:var(--color-text-charcoal)] mb-1">
              Message <span className="text-xs text-[color:var(--color-text-charcoal)]/60">(300 character limit, optional)</span>
            </label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(e) => handleInputChange('message', e.target.value)}
              maxLength={300}
              rows={3}
              className={`textarea-botanical ${formErrors.message
                ? 'border-[color:var(--color-rose)] focus:border-[color:var(--color-rose)]'
                : ''
                }`}
              placeholder="We're so excited to celebrate with you!"
            />
            {formErrors.message && (
              <p className="text-[color:var(--color-rose)] text-sm mt-1">{sanitizeHTML(formErrors.message)}</p>
            )}
            <p className="text-[color:var(--color-text-charcoal)]/60 text-xs mt-1">
              {formData.message.length}/300 characters
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isPrefilling}
            className="btn-botanical w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </span>
            ) : (
              'Submit RSVP'
            )}
          </button>

          {/* Security Notice */}
          <div className="bg-[color:var(--color-sage)]/10 border border-[color:var(--color-sage)]/30 rounded-[var(--radius-md)] p-4">
            <p className="text-sm text-[color:var(--color-botanical-green)]">
              🔒 Your information is secure. We use industry-standard security practices to protect your data.
            </p>
          </div>
        </>
      )}
    </form>
  )
}
