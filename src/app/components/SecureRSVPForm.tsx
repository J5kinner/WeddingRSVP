'use client'

import { useState, useCallback, useEffect } from 'react'
import { VALIDATION_CONFIG, validateRSVPData, sanitizeHTML } from '@/lib/security'
import type { AdditionalGuest } from '@/lib/security'
import { csrfProtector } from '@/lib/csrf'

const MAX_ADDITIONAL_GUESTS = VALIDATION_CONFIG.guestCount.max - 1

type FormField = keyof FormData | 'additionalGuests'
type FormErrors = Partial<Record<FormField, string>>

interface FormData {
  name: string;
  attending: boolean;
  dietaryNotes: string;
  message: string;
  additionalGuests: AdditionalGuest[];
}

export default function SecureRSVPForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    attending: true,
    dietaryNotes: '',
    message: '',
    additionalGuests: [],
  })
  const [csrfToken, setCsrfToken] = useState<string>('')
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null)
  const [submitMessage, setSubmitMessage] = useState('')

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
          _csrf: csrfToken
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSubmitStatus('success')
        setSubmitMessage('Thank you for your RSVP!')
        setFormData({
          name: '',
          attending: true,
          dietaryNotes: '',
          message: '',
          additionalGuests: [],
        })
        setTimeout(() => window.location.reload(), 1500)
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name Field */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Name * <span className="text-xs text-gray-500">(100 character limit)</span>
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          maxLength={100}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
            formErrors.name 
              ? 'border-red-500 focus:ring-red-200' 
              : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
          }`}
          placeholder="John & Jane Doe"
        />
        {formErrors.name && (
          <p className="text-red-600 text-sm mt-1">{sanitizeHTML(formErrors.name)}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">
          {formData.name.length}/100 characters
        </p>
      </div>

      {/* Attending Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Will you be attending? *
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {attendingOptions.map((option) => (
            <label
              key={String(option.value)}
              className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
                formData.attending === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="attending"
                checked={formData.attending === option.value}
                onChange={() => handleAttendingChange(option.value)}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">{option.label}</span>
                <p className="text-sm text-gray-600 mt-1">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
        {formErrors.attending && (
          <p className="text-red-600 text-sm mt-2">{sanitizeHTML(formErrors.attending)}</p>
        )}
      </div>

      {/* Conditional Fields for Attending Guests */}
      {formData.attending && (
        <>
          {/* Additional Guests */}
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Add guests
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Share names and dietary needs for anyone attending with you.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddGuest}
                disabled={hasReachedGuestLimit}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="text-lg mr-2">+</span>
                Add guest
              </button>
            </div>
            {formErrors.additionalGuests && (
              <p className="text-red-600 text-sm">{sanitizeHTML(formErrors.additionalGuests)}</p>
            )}
            {formData.additionalGuests.length === 0 && (
              <div className="border border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-600 bg-gray-50">
                No additional guests yet. Click &quot;Add guest&quot; to include family or friends.
              </div>
            )}
            <div className="space-y-3">
              {formData.additionalGuests.map((guest, index) => (
                <div key={`${guest.name}-${index}`} className="border rounded-lg p-4 bg-white shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Guest {index + 1}</p>
                      <p className="text-xs text-gray-500">Provide their name and dietary needs.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveGuest(index)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Guest name *
                      </label>
                      <input
                        type="text"
                        value={guest.name}
                        onChange={(e) => handleGuestChange(index, 'name', e.target.value)}
                        maxLength={100}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none border-gray-300 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Guest name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dietary needs or notes
                      </label>
                      <input
                        type="text"
                        value={guest.dietaryNotes}
                        onChange={(e) => handleGuestChange(index, 'dietaryNotes', e.target.value)}
                        maxLength={120}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none border-gray-300 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Vegetarian, gluten-free, allergies, etc."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600">
              Total guests (including you): <span className="font-semibold text-gray-900">{totalGuests}</span>{' '}
              {hasReachedGuestLimit ? '(guest limit reached)' : `(max ${MAX_ADDITIONAL_GUESTS + 1})`}
            </p>
          </div>

          {/* Dietary Restrictions */}
          <div>
            <label htmlFor="dietaryNotes" className="block text-sm font-medium text-gray-700 mb-1">
              Dietary Restrictions or Special Requests <span className="text-xs text-gray-500">(optional, 500 character limit)</span>
            </label>
            <textarea
              id="dietaryNotes"
              value={formData.dietaryNotes}
              onChange={(e) => handleInputChange('dietaryNotes', e.target.value)}
              maxLength={500}
              rows={3}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
                formErrors.dietaryNotes 
                  ? 'border-red-500 focus:ring-red-200' 
                  : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
              }`}
              placeholder="Leave blank if no restrictions. Include notes for you or added guests — vegetarian, gluten-free, allergies, etc."
            />
            {formErrors.dietaryNotes && (
              <p className="text-red-600 text-sm mt-1">{sanitizeHTML(formErrors.dietaryNotes)}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              This note is for you; each added guest has their own dietary details above.
            </p>
            <p className="text-gray-500 text-xs mt-1">
              {dietaryLength}/500 characters for your notes
            </p>
          </div>
        </>
      )}

      {/* Message Field */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
          Message <span className="text-xs text-gray-500">(300 character limit, optional)</span>
        </label>
        <textarea
          id="message"
          value={formData.message}
          onChange={(e) => handleInputChange('message', e.target.value)}
          maxLength={300}
          rows={3}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
            formErrors.message 
              ? 'border-red-500 focus:ring-red-200' 
              : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
          }`}
          placeholder="We're so excited to celebrate with you!"
        />
        {formErrors.message && (
          <p className="text-red-600 text-sm mt-1">{sanitizeHTML(formErrors.message)}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">
          {formData.message.length}/300 characters
        </p>
      </div>

      {/* Submit Status */}
      {submitMessage && (
        <div
          className={`p-4 rounded-lg ${
            submitStatus === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {sanitizeHTML(submitMessage)}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400"
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
          'Submit Secure RSVP'
        )}
      </button>

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          🔒 Your information is secure. We use industry-standard security practices to protect your data.
        </p>
      </div>
    </form>
  )
}
