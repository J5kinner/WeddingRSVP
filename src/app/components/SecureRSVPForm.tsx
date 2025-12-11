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

  // Ensure component is mounted before rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  // Generate CSRF token
  useEffect(() => {
    const generateToken = async () => {
      try {
        const { token } = await csrfProtector.generateToken()
        setCsrfToken(token)
      } catch (error) {
        console.error('Failed to generate CSRF token:', error)
        const fallbackToken = Math.random().toString(36).substring(2) + Date.now().toString(36)
        setCsrfToken(fallbackToken)
      }
    }

    generateToken()
  }, [])

  // Prefill form
  useEffect(() => {
    if (!mounted) return
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
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: '' }))
    if (value && (formErrors[field] || value.toString().length > 2)) validateField(field, value)
  }

  const handleAttendingChange = (value: boolean) => {
    const updatedData = {
      ...formData,
      attending: value,
      additionalGuests: value ? formData.additionalGuests : []
    }
    setFormData(updatedData)
    setFormErrors(prev => ({ ...prev, attending: '', additionalGuests: '' }))
    validateField('attending', value, updatedData)
  }

  const handleAddGuest = () => {
    if (formData.additionalGuests.length >= MAX_ADDITIONAL_GUESTS) return
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
    if (formErrors.additionalGuests) setFormErrors(prev => ({ ...prev, additionalGuests: '' }))
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
          ...formData,
          ...validationResult.sanitizedData
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

  const handleUnlock = () => {
    setIsLocked(false)
    setSubmitStatus(null)
    setSubmitMessage('You can update your RSVP below.')
  }

  const attendingOptions = [
    { value: true, label: 'Joyfully Accept', description: 'Can\'t wait to celebrate!' },
    { value: false, label: 'Regretfully Decline', description: 'Will be there in spirit' }
  ]

  const totalGuests = formData.attending ? formData.additionalGuests.length + 1 : 0
  const hasReachedGuestLimit = formData.additionalGuests.length >= MAX_ADDITIONAL_GUESTS
  const dietaryLength = formData.dietaryNotes.trim().length
  const attendanceLabel = formData.attending === true ? 'Attending' : formData.attending === false ? 'Not attending' : 'Not selected'

  return (
    <div className="space-y-6">
      {isPrefilling && (
        <div className="bg-primary/10 border border-primary/20 text-primary text-sm rounded-xl p-4 animate-pulse">
          Searching for your invitation...
        </div>
      )}

      {prefillError && (
        <div className="bg-destructive/10 border border-destructive/20 text-foreground text-sm rounded-xl p-4 flex items-center gap-2">
          <span className="text-destructive font-bold">Error:</span> {sanitizeHTML(prefillError)}
        </div>
      )}

      {formData.inviteCode && !isPrefilling && !prefillError && (
        <div className="bg-secondary/10 border border-secondary/20 text-secondary-foreground text-sm rounded-xl p-4">
          👋 Invite found! We prefilled details for <strong>{sanitizeHTML(formData.name || 'you')}</strong>.
        </div>
      )}

      {submitMessage && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${submitStatus === 'success'
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
          }`}>
          <span className="text-xl">{submitStatus === 'success' ? '🎉' : '⚠️'}</span>
          {sanitizeHTML(submitMessage)}
        </div>
      )}

      {isLocked ? (
        <div className="bg-card text-card-foreground border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-xl font-serif text-primary">RSVP Confirmed</h3>
              <p className="text-muted-foreground text-sm">Thank you, {sanitizeHTML(formData.name)}. We have your response.</p>
            </div>
            <button
              onClick={handleUnlock}
              className="text-sm font-medium text-primary hover:text-primary/80 underline decoration-2 underline-offset-4 transition-colors"
            >
              Edit Response
            </button>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-sm">
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="font-medium">Status</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${formData.attending ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                {attendanceLabel}
              </span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="font-medium">Total Guests</span>
              <span>{totalGuests}</span>
            </div>
            {formData.additionalGuests.length > 0 && (
              <div className="border-b border-border/50 pb-2">
                <p className="font-medium mb-1">Guests</p>
                <ul className="pl-4 list-disc list-outside text-muted-foreground space-y-1">
                  {formData.additionalGuests.map((g, i) => (
                    <li key={i}>
                      {g.name}
                      {g.dietaryNotes && <span className="text-xs opacity-70"> ({g.dietaryNotes})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {formData.message && (
              <div>
                <p className="font-medium mb-1">Message</p>
                <p className="text-muted-foreground italic">&ldquo;{sanitizeHTML(formData.message)}&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Name Field */}
          <div className="group">
            <label htmlFor="name" className="block text-sm font-medium text-primary mb-2">
              Your Name *
            </label>
            <div className="relative">
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                maxLength={100}
                className={`w-full px-4 py-3 bg-surface border rounded-xl outline-none transition-all duration-200 ${formErrors.name
                  ? 'border-destructive focus:ring-2 focus:ring-destructive/20'
                  : 'border-outline hover:border-primary focus:border-primary focus:ring-4 focus:ring-primary/10'
                  }`}
                placeholder="Name(s) as on invitation"
              />
            </div>
            <div className="flex justify-between mt-1 px-1">
              <p className="text-destructive text-xs min-h-[1rem]">
                {formErrors.name && sanitizeHTML(formErrors.name)}
              </p>
              <p className="text-muted-foreground text-xs">
                {formData.name.length}/100
              </p>
            </div>
          </div>

          {/* Attending Field */}
          <div>
            <label className="block text-sm font-medium text-primary mb-3">
              Response *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attendingOptions.map((option) => (
                <label
                  key={String(option.value)}
                  className={`relative flex flex-col p-4 border rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-md ${formData.attending === option.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-outline hover:border-primary/50 hover:bg-surface-container'
                    }`}
                >
                  <div className="flex items-center space-x-3 mb-1">
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${formData.attending === option.value ? 'border-primary' : 'border-outline'
                      }`}>
                      {formData.attending === option.value && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <input
                      type="radio"
                      name="attending"
                      checked={formData.attending === option.value}
                      onChange={() => handleAttendingChange(option.value)}
                      className="sr-only"
                    />
                    <span className={`font-semibold ${formData.attending === option.value ? 'text-primary' : 'text-foreground'
                      }`}>
                      {option.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-8">
                    {option.description}
                  </p>
                </label>
              ))}
            </div>
            {formErrors.attending && (
              <p className="text-destructive text-sm mt-2">{sanitizeHTML(formErrors.attending)}</p>
            )}
          </div>

          {/* Conditional Fields for Attending Guests */}
          {formData.attending && (
            <div className="animate-in slide-in-from-top-4 fade-in duration-300 space-y-8">
              {/* Additional Guests */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-primary">Guest List</h3>
                  <button
                    type="button"
                    onClick={handleAddGuest}
                    disabled={hasReachedGuestLimit}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-lg mr-2 leading-none">+</span>
                    Add Guest
                  </button>
                </div>

                {formData.additionalGuests.length === 0 ? (
                  <div className="border border-dashed border-outline-variant rounded-2xl p-6 text-center text-muted-foreground bg-surface-container-low/50">
                    <p>Attending solo? Just you!</p>
                    <p className="text-sm mt-1">Click &quot;Add Guest&quot; if you have a plus one.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.additionalGuests.map((guest, index) => (
                      <div key={`${guest.name}-${index}`} className="relative group border border-outline rounded-2xl p-5 bg-surface hover:border-primary/50 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Guest {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveGuest(index)}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1"
                            aria-label="Remove guest"
                          >
                            <span className="text-sm font-medium">Remove</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <input
                              type="text"
                              value={guest.name}
                              onChange={(e) => handleGuestChange(index, 'name', e.target.value)}
                              maxLength={100}
                              className="w-full px-4 py-2 bg-surface-container-low border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/70"
                              placeholder="Guest Name"
                              required
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={guest.dietaryNotes}
                              onChange={(e) => handleGuestChange(index, 'dietaryNotes', e.target.value)}
                              maxLength={120}
                              className="w-full px-4 py-2 bg-surface-container-low border border-outline rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/70"
                              placeholder="Dietary Requirements"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-right px-1">
                  Total Party Size: <span className="font-semibold text-primary">{totalGuests}</span>
                  {hasReachedGuestLimit && <span className="ml-1">(Max limit reached)</span>}
                </p>
              </div>

              {/* Dietary Restrictions */}
              <div>
                <label htmlFor="dietaryNotes" className="block text-sm font-medium text-primary mb-2">
                  Dietary Requirements <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <textarea
                  id="dietaryNotes"
                  value={formData.dietaryNotes}
                  onChange={(e) => handleInputChange('dietaryNotes', e.target.value)}
                  maxLength={500}
                  rows={3}
                  className={`w-full px-4 py-3 bg-surface border rounded-xl outline-none transition-all duration-200 ${formErrors.dietaryNotes
                    ? 'border-destructive focus:ring-2 focus:ring-destructive/20'
                    : 'border-outline hover:border-primary focus:border-primary focus:ring-4 focus:ring-primary/10'
                    }`}
                  placeholder="Any allergies or dietary restrictions for yourself?"
                />
                <div className="flex justify-end mt-1 px-1">
                  <p className="text-muted-foreground text-xs">
                    {dietaryLength}/500
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Message Field */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-primary mb-2">
              Leave a Note <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(e) => handleInputChange('message', e.target.value)}
              maxLength={300}
              rows={3}
              className="w-full px-4 py-3 bg-surface border border-outline rounded-xl outline-none transition-all duration-200 hover:border-primary focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/70"
              placeholder="Share a message with the couple..."
            />
            <div className="flex justify-between mt-1 px-1">
              <p className="text-destructive text-xs min-h-[1rem]">
                {formErrors.message && sanitizeHTML(formErrors.message)}
              </p>
              <p className="text-muted-foreground text-xs">
                {formData.message.length}/300
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isPrefilling}
            className="w-full bg-primary text-primary-foreground py-4 px-6 rounded-full font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              formData.attending ? 'Confirm RSVP' : 'Send Response'
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 opacity-80">
            <span className="text-lg">🔒</span> Securely submitted
          </p>
        </form>
      )}
    </div>
  )
}
