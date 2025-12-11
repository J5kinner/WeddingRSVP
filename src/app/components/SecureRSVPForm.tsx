'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { VALIDATION_CONFIG, validateRSVPData, sanitizeHTML } from '@/lib/security'
import type { AdditionalGuest } from '@/lib/security'
import type { InviteResponse } from '@/types/rsvp'
import { csrfProtector } from '@/lib/csrf'

const MAX_ADDITIONAL_GUESTS = VALIDATION_CONFIG.guestCount.max - 1

type FormField = keyof FormData | 'additionalGuests'
type FormErrors = Partial<Record<FormField, string>>

interface FormData {
  name: string;
  attending: boolean | null;
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
    attending: null,
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
    const code = searchParams.get('inviteCode')
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
        const primaryGuest = invite.guests[0]
        const createdTime = new Date(invite.createdAt).getTime()
        const updatedTime = new Date(invite.updatedAt).getTime()
        const hasExistingResponse =
          Number.isFinite(createdTime) &&
          Number.isFinite(updatedTime) &&
          updatedTime > createdTime
        setIsLocked(hasExistingResponse)

        setFormData({
          name: primaryGuest?.name || '',
          attending: hasExistingResponse ? (primaryGuest?.status ?? null) : null,
          dietaryNotes: primaryGuest?.dietNotes || '',
          message: invite.message || '',
          additionalGuests: invite.guests.slice(1).map((guest) => ({
            name: guest.name,
            dietaryNotes: guest.dietNotes || ''
          })),
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

  const handleInputChange = (field: keyof FormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }))
    }
    
    if (value && (formErrors[field] || value.toString().length > 2)) {
      validateField(field, value)
    }
  }

  const handleAttendingChange = (value: boolean) => {
    const updatedData = {
      ...formData,
      attending: value,
      additionalGuests: value ? formData.additionalGuests : []
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

  const handleGuestChange = (index: number, field: keyof AdditionalGuest, value: string) => {
    const updatedGuests = formData.additionalGuests.map((guest, guestIndex) => 
      guestIndex === index ? { ...guest, [field]: value } : guest
    )

    setFormData(prev => ({ ...prev, additionalGuests: updatedGuests }))
    
    if (formErrors.additionalGuests) {
      setFormErrors(prev => ({ ...prev, additionalGuests: '' }))
    }

    if (value && (formErrors.additionalGuests || value.length > 1)) {
      validateField('additionalGuests', updatedGuests, { ...formData, additionalGuests: updatedGuests })
    }
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
        setFormData({
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

  const attendingOptions = [
    { value: true, label: 'Yes, I\'ll be there!', description: 'We can\'t wait to celebrate with you!' },
    { value: false, label: 'Sorry, can\'t make it', description: 'We understand, but we\'ll miss you!' }
  ]

  const totalGuests = formData.attending ? formData.additionalGuests.length + 1 : 0
  const hasReachedGuestLimit = formData.additionalGuests.length >= MAX_ADDITIONAL_GUESTS
  const dietaryLength = formData.dietaryNotes.trim().length
  const attendanceLabel =
    formData.attending === true ? 'Attending' : formData.attending === false ? 'Not attending' : 'Not selected'

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

      {formData.inviteCode && !isPrefilling && !prefillError && (
        <div className="bg-[color:var(--color-sage)]/10 border border-[color:var(--color-sage)]/30 text-[color:var(--color-botanical-green)] text-sm rounded-[var(--radius-md)] p-3">
          Invite link detected. We prefilled details for {sanitizeHTML(formData.name || 'your invite')}.
        </div>
      )}

      {submitMessage && (
        <div
          className={`p-4 rounded-[var(--radius-md)] ${
            submitStatus === 'success'
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
          Name * <span className="text-xs text-[color:var(--color-text-charcoal)]/60">(100 character limit)</span>
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          maxLength={100}
          className={`input-botanical ${
            formErrors.name 
              ? 'border-[color:var(--color-rose)] focus:border-[color:var(--color-rose)]' 
              : ''
          }`}
          placeholder="John & Jane Doe"
        />
        {formErrors.name && (
          <p className="text-[color:var(--color-rose)] text-sm mt-1">{sanitizeHTML(formErrors.name)}</p>
        )}
        <p className="text-[color:var(--color-text-charcoal)]/60 text-xs mt-1">
          {formData.name.length}/100 characters
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
              className={`flex items-start space-x-3 p-4 border rounded-[var(--radius-md)] cursor-pointer transition-all ${
                formData.attending === option.value
                  ? 'border-[color:var(--color-botanical-green)] bg-[color:var(--color-sage)]/10'
                  : 'border-[color:var(--color-border-light)] hover:bg-[color:var(--color-bg-paper)]'
              }`}
            >
              <input
                type="radio"
                name="attending"
                checked={formData.attending === option.value}
                onChange={() => handleAttendingChange(option.value)}
                required={formData.attending === null}
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

      {/* Conditional Fields for Attending Guests */}
      {formData.attending && (
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
                <div key={`guest-${index}`} className="border border-[color:var(--color-border-light)] rounded-[var(--radius-md)] p-4 bg-white space-y-3">
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
                    <div>
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
                      />
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
              className={`textarea-botanical ${
                formErrors.dietaryNotes 
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
          className={`textarea-botanical ${
            formErrors.message 
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
